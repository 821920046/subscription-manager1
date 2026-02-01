/**
 * 数据验证 Schema
 */

import { z } from 'zod';
import { CONFIG } from '../config/constants';

/**
 * 时间格式验证（HH:mm）
 */
const timeFormatRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * 订阅数据 Schema
 */
export const SubscriptionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .min(1, '服务名称不能为空')
    .max(
      CONFIG.VALIDATION.MAX_NAME_LENGTH,
      `服务名称不能超过 ${CONFIG.VALIDATION.MAX_NAME_LENGTH} 字符`
    ),
  customType: z.string().max(CONFIG.VALIDATION.MAX_CUSTOM_TYPE_LENGTH).optional().default(''),
  startDate: z.string().datetime().nullable().optional(),
  expiryDate: z.string().datetime({ message: '到期日期格式不正确' }),
  periodValue: z
    .number()
    .int()
    .min(CONFIG.VALIDATION.MIN_PERIOD_VALUE)
    .max(CONFIG.VALIDATION.MAX_PERIOD_VALUE)
    .optional()
    .default(CONFIG.DEFAULTS.PERIOD_VALUE),
  periodUnit: z.enum(['year', 'month', 'day']).optional().default(CONFIG.DEFAULTS.PERIOD_UNIT),
  price: z.number().min(CONFIG.VALIDATION.MIN_PRICE).max(CONFIG.VALIDATION.MAX_PRICE).optional(),
  reminderDays: z
    .number()
    .int()
    .min(CONFIG.VALIDATION.MIN_REMINDER_DAYS)
    .max(CONFIG.VALIDATION.MAX_REMINDER_DAYS)
    .optional()
    .default(CONFIG.DEFAULTS.REMINDER_DAYS),
  dailyReminderTimes: z.array(z.string().regex(timeFormatRegex, '时间格式必须为 HH:mm')).optional(),
  notes: z
    .string()
    .max(
      CONFIG.VALIDATION.MAX_NOTES_LENGTH,
      `备注不能超过 ${CONFIG.VALIDATION.MAX_NOTES_LENGTH} 字符`
    )
    .optional()
    .default(''),
  isActive: z.boolean().default(true),
  autoRenew: z.boolean().default(true),
  useLunar: z.boolean().optional().default(false),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type SubscriptionInput = z.infer<typeof SubscriptionSchema>;

/**
 * 部分订阅更新 Schema
 */
export const SubscriptionUpdateSchema = SubscriptionSchema.partial().required({
  name: true,
  expiryDate: true,
});

/**
 * 登录数据 Schema
 */
export const LoginSchema = z.object({
  username: z.string().min(1, '用户名不能为空').max(50),
  password: z.string().min(1, '密码不能为空').max(100),
});

export type LoginInput = z.infer<typeof LoginSchema>;

/**
 * 配置数据 Schema
 */
export const ConfigSchema = z.object({
  ADMIN_USERNAME: z.string().min(1).max(50).optional(),
  ADMIN_PASSWORD: z.string().min(6, '密码至少需要 6 个字符').max(100).optional(),
  THIRD_PARTY_TOKEN: z.string().min(32, '第三方Token至少需要32个字符').optional(),
  TG_BOT_TOKEN: z.string().optional().default(''),
  TG_CHAT_ID: z.string().optional().default(''),
  NOTIFYX_API_KEY: z.string().optional().default(''),
  WENOTIFY_URL: z.string().url().optional().or(z.literal('')).default(''),
  WENOTIFY_TOKEN: z.string().optional().default(''),
  WENOTIFY_USERID: z.string().optional().default(''),
  WENOTIFY_TEMPLATE_ID: z.string().optional().default(''),
  WENOTIFY_PATH: z.string().optional().default('/wxsend'),
  WEBHOOK_URL: z.string().url().optional().or(z.literal('')).default(''),
  WEBHOOK_METHOD: z.enum(['GET', 'POST', 'PUT', 'PATCH']).optional().default('POST'),
  WEBHOOK_HEADERS: z.string().optional().default(''),
  WEBHOOK_TEMPLATE: z.string().optional().default(''),
  SHOW_LUNAR: z.boolean().optional().default(false),
  WECHATBOT_WEBHOOK: z.string().url().optional().or(z.literal('')).default(''),
  WECHATBOT_MSG_TYPE: z.string().optional().default('text'),
  WECHATBOT_AT_MOBILES: z.string().optional().default(''),
  WECHATBOT_AT_ALL: z.string().optional().default('false'),
  WECHAT_OA_APPID: z.string().optional().default(''),
  WECHAT_OA_APPSECRET: z.string().optional().default(''),
  WECHAT_OA_TEMPLATE_ID: z.string().optional().default(''),
  WECHAT_OA_USERIDS: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().email().optional().or(z.literal('')).default(''),
  EMAIL_FROM_NAME: z.string().optional().default(''),
  EMAIL_TO: z.string().email().optional().or(z.literal('')).default(''),
  BARK_DEVICE_KEY: z.string().optional().default(''),
  BARK_SERVER: z.string().url().optional().default(CONFIG.DEFAULTS.BARK_SERVER),
  BARK_IS_ARCHIVE: z.string().optional().default('false'),
  ENABLED_NOTIFIERS: z.array(z.string()).optional().default(['notifyx']),
  TIMEZONE: z.string().optional().default(CONFIG.DEFAULTS.TIMEZONE),
  REMINDER_TIMES: z.string().optional().default(''),
});

export type ConfigInput = z.infer<typeof ConfigSchema>;

/**
 * 测试通知数据 Schema
 */
export const TestNotificationSchema = z
  .object({
    type: z.enum([
      'telegram',
      'notifyx',
      'wenotify',
      'webhook',
      'wechatbot',
      'wechatOfficialAccount',
      'email',
      'bark',
    ]),
  })
  .merge(ConfigSchema);

export type TestNotificationInput = z.infer<typeof TestNotificationSchema>;

/**
 * 第三方通知 API Schema
 */
export const ThirdPartyNotifySchema = z.object({
  title: z.string().optional().default('第三方通知'),
  content: z.string().min(1, '内容不能为空'),
});

export type ThirdPartyNotifyInput = z.infer<typeof ThirdPartyNotifySchema>;
