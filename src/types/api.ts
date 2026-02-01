/**
 * 外部 API 响应类型定义
 * 为 notification.ts 提供类型安全的外部 API 响应类型
 */

/**
 * 微信公众号 Access Token 响应
 */
export interface WeChatAccessTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

/**
 * 微信公众号模板消息发送响应
 */
export interface WeChatTemplateMessageResponse {
  errcode: number;
  errmsg: string;
  msgid?: string;
}

/**
 * Telegram Bot API 响应基础类型
 */
export interface TelegramApiResponse {
  ok: boolean;
  result?: unknown;
  description?: string;
  error_code?: number;
}

/**
 * Telegram 发送消息成功响应
 */
export interface TelegramSendMessageResponse extends TelegramApiResponse {
  ok: true;
  result: {
    message_id: number;
    from: {
      id: number;
      is_bot: true;
      first_name: string;
      username: string;
    };
    chat: {
      id: number;
      type: 'private' | 'group' | 'supergroup' | 'channel';
    };
    date: number;
    text: string;
  };
}

/**
 * NotifyX API 响应
 */
export interface NotifyXApiResponse {
  status: 'queued' | 'sent' | 'failed';
  message?: string;
  id?: string;
}

/**
 * Bark API 响应
 */
export interface BarkApiResponse {
  code: number;
  message: string;
  timestamp?: number;
  id?: string;
}

/**
 * Resend Email API 响应
 */
export interface ResendEmailResponse {
  id: string;
  from: string;
  to: string[];
  created_at: string;
}

/**
 * 企业微信机器人响应
 */
export interface WeChatBotResponse {
  errcode: number;
  errmsg: string;
}

/**
 * 失败日志索引项类型
 */
export interface FailureLogIndex {
  key: string;
  id: number;
}

/**
 * 失败日志项类型
 */
export interface FailureLogEntry {
  timestamp: string;
  title: string;
  failures: Array<{ channel: string; success: boolean }>;
  successes: Array<{ channel: string; success: boolean }>;
}

/**
 * WeNotify Edge 请求体
 */
export interface WeNotifyEdgeRequestBody {
  title: string;
  content: string;
  token: string;
  userid?: string;
  template_id?: string;
}

/**
 * Bark 推送请求体
 */
export interface BarkPushRequestBody {
  title: string;
  body: string;
  device_key: string;
  isArchive?: number;
  sound?: string;
  icon?: string;
  group?: string;
  url?: string;
  copy?: string;
  autoCopy?: number;
}

/**
 * 企业微信机器人消息类型
 */
export type WeChatBotMessageType = 'text' | 'markdown';

/**
 * 企业微信机器人文本消息
 */
export interface WeChatBotTextMessage {
  msgtype: 'text';
  text: {
    content: string;
    mentioned_list?: string[];
    mentioned_mobile_list?: string[];
  };
}

/**
 * 企业微信机器人 Markdown 消息
 */
export interface WeChatBotMarkdownMessage {
  msgtype: 'markdown';
  markdown: {
    content: string;
  };
}

/**
 * 企业微信机器人消息
 */
export type WeChatBotMessage = WeChatBotTextMessage | WeChatBotMarkdownMessage;

/**
 * 微信公众号模板消息数据项
 */
export interface WeChatTemplateDataItem {
  value: string;
}

/**
 * 微信公众号模板消息数据
 */
export interface WeChatTemplateData {
  thing01?: WeChatTemplateDataItem;
  thing02?: WeChatTemplateDataItem;
  time01?: WeChatTemplateDataItem;
  number01?: WeChatTemplateDataItem;
  [key: string]: WeChatTemplateDataItem | undefined;
}
