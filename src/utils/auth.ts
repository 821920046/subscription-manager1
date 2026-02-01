/**
 * 认证工具
 */

import bcrypt from 'bcryptjs';
import { CONFIG } from '../config/constants';
import { Logger } from './logger';

/**
 * JWT Payload 类型
 */
export interface JWTPayload {
  username: string;
  iat: number;
  exp: number;
}

/**
 * 默认 JWT 过期时间（秒）- 24小时
 */
const DEFAULT_JWT_EXPIRY = 86400;

/**
 * 密码哈希
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    Logger.error('Password hashing failed', error);
    throw new Error('密码加密失败');
  }
}

/**
 * 验证密码
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    Logger.error('Password verification failed', error);
    return false;
  }
}

/**
 * 验证 JWT Secret 是否符合要求
 */
export function validateJWTSecret(secret: string): boolean {
  return secret.length >= CONFIG.JWT.MIN_SECRET_LENGTH;
}

export const CryptoJS = {
  HmacSHA256: async function (message: string, key: string): Promise<string> {
    const keyData = new TextEncoder().encode(key);
    const messageData = new TextEncoder().encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign']
    );

    const buffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  },
};

/**
 * 生成随机密钥
 */
export function generateRandomSecret(): string {
  // Use Web Crypto API for secure random generation
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < array.length; i++) {
    result += chars.charAt(array[i] % chars.length);
  }
  return result;
}

/**
 * 生成 JWT Token
 *
 * @param username - 用户名
 * @param secret - JWT 密钥
 * @param expiresIn - 过期时间（秒），默认 24 小时
 * @returns JWT Token
 */
export async function generateJWT(
  username: string,
  secret: string,
  expiresIn: number = DEFAULT_JWT_EXPIRY
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    username,
    iat: now,
    exp: now + expiresIn,
  };

  const headerBase64 = btoa(JSON.stringify(header));
  const payloadBase64 = btoa(JSON.stringify(payload));

  const signatureInput = headerBase64 + '.' + payloadBase64;
  const signature = await CryptoJS.HmacSHA256(signatureInput, secret);

  return headerBase64 + '.' + payloadBase64 + '.' + signature;
}

/**
 * 验证 JWT Token
 *
 * @param token - JWT Token
 * @param secret - JWT 密钥
 * @returns JWT Payload 或 null（验证失败）
 */
export async function verifyJWT(
  token: string | null,
  secret: string
): Promise<JWTPayload | null> {
  try {
    if (!token || !secret) {
      console.log('[JWT] Token或Secret为空');
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('[JWT] Token格式错误，部分数量:', parts.length);
      return null;
    }

    const [headerBase64, payloadBase64, signature] = parts;
    const signatureInput = headerBase64 + '.' + payloadBase64;
    const expectedSignature = await CryptoJS.HmacSHA256(signatureInput, secret);

    if (signature !== expectedSignature) {
      console.log('[JWT] 签名验证失败');
      return null;
    }

    const payload = JSON.parse(atob(payloadBase64)) as JWTPayload;

    // 验证过期时间
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.log('[JWT] Token已过期，过期时间:', new Date(payload.exp * 1000).toISOString());
      return null;
    }

    console.log('[JWT] 验证成功，用户:', payload.username);
    return payload;
  } catch (error) {
    console.error('[JWT] 验证过程出错:', error);
    return null;
  }
}
