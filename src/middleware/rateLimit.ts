/**
 * 速率限制中间件
 * 使用 Cloudflare KV 实现分布式速率限制
 */

import { CONFIG } from '../config/constants';

/**
 * 速率限制配置
 */
export interface RateLimitConfig {
  /** 时间窗口内最大请求数 */
  maxRequests: number;
  /** 时间窗口（毫秒） */
  windowMs: number;
}

/**
 * 速率限制结果
 */
export interface RateLimitResult {
  /** 是否被限制 */
  limited: boolean;
  /** 当前请求数 */
  current: number;
  /** 剩余请求数 */
  remaining: number;
  /** 重置时间（毫秒时间戳） */
  resetTime: number;
}

/**
 * KV 命名空间接口（兼容 Cloudflare KV）
 */
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/**
 * 检查是否被速率限制
 * 
 * @param kv - KV 命名空间
 * @param identifier - 限制标识符（如 IP 地址）
 * @param action - 操作类型（如 'login', 'api'）
 * @param config - 速率限制配置
 * @returns 速率限制结果
 */
export async function checkRateLimit(
  kv: KVNamespace,
  identifier: string,
  action: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { maxRequests, windowMs } = config;
  
  // 计算当前时间窗口
  const bucket = Math.floor(Date.now() / windowMs);
  const key = `rate:${action}:${identifier}:${bucket}`;
  
  // 计算重置时间
  const resetTime = (bucket + 1) * windowMs;
  
  // 获取当前计数
  const val = await kv.get(key);
  const current = (val ? parseInt(val, 10) : 0) + 1;
  
  // 更新计数，设置过期时间略长于窗口期
  const ttl = Math.ceil(windowMs / 1000) + 60;
  await kv.put(key, String(current), { expirationTtl: ttl });
  
  const limited = current > maxRequests;
  const remaining = Math.max(0, maxRequests - current);
  
  return {
    limited,
    current,
    remaining,
    resetTime,
  };
}

/**
 * 简化的速率限制检查（兼容旧接口）
 * 
 * @param kv - KV 命名空间
 * @param action - 操作类型
 * @param identifier - 限制标识符
 * @param maxRequests - 最大请求数
 * @param windowMs - 时间窗口（毫秒），默认 60000
 * @returns 是否被限制
 */
export async function isRateLimited(
  kv: KVNamespace,
  action: string,
  identifier: string,
  maxRequests: number,
  windowMs: number = 60000
): Promise<boolean> {
  const result = await checkRateLimit(kv, identifier, action, { maxRequests, windowMs });
  return result.limited;
}

/**
 * 获取客户端 IP 地址
 * 
 * @param request - 请求对象
 * @returns IP 地址
 */
export function getClientIP(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * 创建速率限制响应
 * 
 * @param result - 速率限制结果
 * @param message - 错误消息
 * @returns HTTP 响应
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  message: string = '请求过于频繁，请稍后再试'
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      message,
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(result.current),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetTime),
        'Retry-After': String(Math.ceil((result.resetTime - Date.now()) / 1000)),
      },
    }
  );
}

/**
 * 预定义的速率限制配置
 */
export const RATE_LIMITS = {
  LOGIN: CONFIG.RATE_LIMIT.LOGIN,
  API: CONFIG.RATE_LIMIT.API,
  NOTIFY: CONFIG.RATE_LIMIT.NOTIFY,
} as const;
