import { Config, Env } from '../types';
import { generateRandomSecret, verifyPassword } from './auth';
import { CONFIG } from '../config/constants';

// 密码哈希标记前缀，用于识别已哈希的密码
const HASH_PREFIX = 'HASHED:';

/**
 * 配置缓存
 * 注意：Cloudflare Workers 是无状态的，此缓存仅在单次请求的生命周期内有效
 * 对于同一请求中多次调用 getConfig 的场景可以避免重复 KV 读取
 */
interface ConfigCache {
  config: Config;
  timestamp: number;
  kvId: string; // 用于区分不同的 KV namespace
}

let configCache: ConfigCache | null = null;

/**
 * 清除配置缓存（用于配置更新后）
 */
export function clearConfigCache(): void {
  configCache = null;
}

/**
 * 验证管理员密码（自动处理哈希）
 */
export async function verifyAdminPassword(
  inputPassword: string,
  storedPassword: string
): Promise<boolean> {
  if (!inputPassword || !storedPassword) {
    return false;
  }

  // 如果密码已哈希
  if (storedPassword.startsWith(HASH_PREFIX)) {
    const hashed = storedPassword.substring(HASH_PREFIX.length);
    return await verifyPassword(inputPassword, hashed);
  }

  // 兼容未哈希的旧密码（明文比较）
  return inputPassword === storedPassword;
}

export async function getRawConfig(env: Env): Promise<Record<string, unknown>> {
  if (!env.SUBSCRIPTIONS_KV) {
    console.error('[配置] KV存储未绑定');
    return {};
  }
  const data = await env.SUBSCRIPTIONS_KV.get('config');
  return data ? JSON.parse(data) : {};
}

export async function getConfig(env: Env): Promise<Config> {
  // 检查缓存
  const now = Date.now();
  if (configCache && now - configCache.timestamp < CONFIG.CACHE.CONFIG_TTL) {
    console.log('[配置] 使用缓存配置');
    return configCache.config;
  }

  try {
    const config = await getRawConfig(env);
    console.log('[配置] 从KV读取配置:', Object.keys(config).length > 0 ? '成功' : '空配置');

    // 确保JWT_SECRET的一致性
    let jwtSecret: string | undefined = typeof config.JWT_SECRET === 'string' ? config.JWT_SECRET : undefined;
    if (!jwtSecret || jwtSecret === 'your-secret-key') {
      jwtSecret = generateRandomSecret();
      console.log('[配置] 生成新的JWT密钥');

      // 保存新的JWT密钥
      const updatedConfig = { ...config, JWT_SECRET: jwtSecret };
      if (env.SUBSCRIPTIONS_KV) {
        await env.SUBSCRIPTIONS_KV.put('config', JSON.stringify(updatedConfig));
      }
    }

    const finalConfig: Config = {
      adminUsername: (typeof config.ADMIN_USERNAME === 'string' ? config.ADMIN_USERNAME : 'admin') || 'admin',
      adminPassword: (typeof config.ADMIN_PASSWORD === 'string' ? config.ADMIN_PASSWORD : 'password') || 'password',
      jwtSecret: jwtSecret || generateRandomSecret(),
      thirdPartyToken: (typeof config.THIRD_PARTY_TOKEN === 'string' ? config.THIRD_PARTY_TOKEN : undefined) || generateRandomSecret(),
      timezone: (typeof config.TIMEZONE === 'string' ? config.TIMEZONE : undefined) || 'UTC',
      reminderTimes: (typeof config.REMINDER_TIMES === 'string' ? config.REMINDER_TIMES : '')
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0),
      showLunarGlobal: config.SHOW_LUNAR === true,
      enabledNotifiers: (Array.isArray(config.ENABLED_NOTIFIERS) ? config.ENABLED_NOTIFIERS : undefined) || ['notifyx'],

      telegram: {
        botToken: (typeof config.TG_BOT_TOKEN === 'string' ? config.TG_BOT_TOKEN : '') || '',
        chatId: (typeof config.TG_CHAT_ID === 'string' ? config.TG_CHAT_ID : '') || '',
      },

      notifyx: {
        apiKey: (typeof config.NOTIFYX_API_KEY === 'string' ? config.NOTIFYX_API_KEY : '') || '',
      },

      wenotify: {
        url: (typeof config.WENOTIFY_URL === 'string' ? config.WENOTIFY_URL : '') || '',
        token: (typeof config.WENOTIFY_TOKEN === 'string' ? config.WENOTIFY_TOKEN : '') || '',
        userid: (typeof config.WENOTIFY_USERID === 'string' ? config.WENOTIFY_USERID : '') || '',
        templateId: (typeof config.WENOTIFY_TEMPLATE_ID === 'string' ? config.WENOTIFY_TEMPLATE_ID : '') || '',
        path: (typeof config.WENOTIFY_PATH === 'string' ? config.WENOTIFY_PATH : undefined) || '/wxsend',
      },

      wechatBot: {
        webhook: (typeof config.WECHATBOT_WEBHOOK === 'string' ? config.WECHATBOT_WEBHOOK : '') || '',
        msgType: (typeof config.WECHATBOT_MSG_TYPE === 'string' ? config.WECHATBOT_MSG_TYPE : undefined) || 'text',
        atMobiles: (typeof config.WECHATBOT_AT_MOBILES === 'string' ? config.WECHATBOT_AT_MOBILES : '') || '',
        atAll: (typeof config.WECHATBOT_AT_ALL === 'string' ? config.WECHATBOT_AT_ALL : undefined) || 'false',
      },

      wechatOfficialAccount: {
        appId: (typeof config.WECHAT_OA_APPID === 'string' ? config.WECHAT_OA_APPID : '') || '',
        appSecret: (typeof config.WECHAT_OA_APPSECRET === 'string' ? config.WECHAT_OA_APPSECRET : '') || '',
        templateId: (typeof config.WECHAT_OA_TEMPLATE_ID === 'string' ? config.WECHAT_OA_TEMPLATE_ID : '') || '',
        userIds: (typeof config.WECHAT_OA_USERIDS === 'string' ? config.WECHAT_OA_USERIDS : '') || '',
      },

      webhook: {
        url: (typeof config.WEBHOOK_URL === 'string' ? config.WEBHOOK_URL : '') || '',
        method: (typeof config.WEBHOOK_METHOD === 'string' ? config.WEBHOOK_METHOD : undefined) || 'POST',
        headers: (typeof config.WEBHOOK_HEADERS === 'string' ? config.WEBHOOK_HEADERS : undefined) || '',
        template: (typeof config.WEBHOOK_TEMPLATE === 'string' ? config.WEBHOOK_TEMPLATE : undefined) || '',
      },

      email: {
        resendApiKey: (typeof config.RESEND_API_KEY === 'string' ? config.RESEND_API_KEY : '') || '',
        fromEmail: (typeof config.EMAIL_FROM === 'string' ? config.EMAIL_FROM : '') || '',
        toEmail: (typeof config.EMAIL_TO === 'string' ? config.EMAIL_TO : '') || '',
      },

      bark: {
        server: (typeof config.BARK_SERVER === 'string' ? config.BARK_SERVER : 'https://api.day.app') || 'https://api.day.app',
        deviceKey: (typeof config.BARK_DEVICE_KEY === 'string' ? config.BARK_DEVICE_KEY : '') || '',
        isArchive: (typeof config.BARK_IS_ARCHIVE === 'string' ? config.BARK_IS_ARCHIVE : 'false') || 'false',
      },
    };

    // 更新缓存
    configCache = {
      config: finalConfig,
      timestamp: Date.now(),
      kvId: 'SUBSCRIPTIONS_KV',
    };

    return finalConfig;
  } catch (error: unknown) {
    console.error('[配置] 获取配置失败:', error);
    const defaultJwtSecret = generateRandomSecret();

    return {
      adminUsername: 'admin',
      adminPassword: 'password',
      jwtSecret: defaultJwtSecret,
      thirdPartyToken: generateRandomSecret(),
      timezone: 'UTC',
      showLunarGlobal: true,
      enabledNotifiers: ['notifyx'],
      telegram: { botToken: '', chatId: '' },
      notifyx: { apiKey: '' },
      wenotify: { url: '', token: '', userid: '', templateId: '', path: '/wxsend' },
      wechatBot: { webhook: '', msgType: 'text', atMobiles: '', atAll: 'false' },
      wechatOfficialAccount: { appId: '', appSecret: '', templateId: '', userIds: '' },
      webhook: { url: '', method: 'POST', headers: '', template: '' },
      email: { resendApiKey: '', fromEmail: '', toEmail: '' },
      bark: { server: 'https://api.day.app', deviceKey: '', isArchive: 'false' },
    };
  }
}
