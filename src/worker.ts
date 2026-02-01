/**
 * Cloudflare Workers 入口文件
 * 负责请求分发和定时任务
 */

import { Env } from './types';
import { loginPage } from './templates/login';
import { handleDebugRequest } from './templates/debug';
import { SubscriptionService } from './services/subscription';
import { sendNotificationToAllChannels, formatNotificationContent } from './services/notification';
import { getConfig } from './utils/config';
import { handleApiRequest, handleAdminRequest } from './routes';
import { addSecurityHeaders, textResponse, htmlResponse } from './middleware/security';

export default {
  /**
   * HTTP 请求处理
   */
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // security.txt
    if (url.pathname === '/.well-known/security.txt') {
      const content = `Contact: mailto:security@de5.net
Expires: 2027-01-01T00:00:00.000Z
Preferred-Languages: zh-cn, en
Encryption: https://${url.hostname}/pgp-key.txt
Canonical: https://${url.hostname}/.well-known/security.txt`;

      return textResponse(content);
    }

    // Debug page
    if (url.pathname === '/debug') {
      return addSecurityHeaders(await handleDebugRequest(request, env));
    }

    // API Routes
    if (url.pathname.startsWith('/api')) {
      return addSecurityHeaders(await handleApiRequest(request, env));
    }

    // Admin Routes
    if (url.pathname.startsWith('/admin')) {
      return addSecurityHeaders(await handleAdminRequest(request, env));
    }

    // Default: Login page
    return htmlResponse(loginPage);
  },

  /**
   * 定时任务处理
   */
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const config = await getConfig(env);
    const timezone = config.timezone || 'UTC';
    const now = new Date();

    // 获取当前时间 HH:mm
    const dtf = new Intl.DateTimeFormat('zh-CN', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    const parts = dtf.formatToParts(now);
    const get = (type: string): string => parts.find((x) => x.type === type)?.value || '00';
    const hhmm = `${get('hour')}:${get('minute')}`;

    // 全局提醒时段
    const globalTimes =
      config.reminderTimes && config.reminderTimes.length > 0 ? config.reminderTimes : ['08:00'];

    // 获取需要提醒的订阅
    const subscriptionService = new SubscriptionService(env);
    const { notifications } = await subscriptionService.checkExpiringSubscriptions();

    // 根据时段过滤
    const filtered = notifications.filter((n) => {
      const t = n.subscription.dailyReminderTimes || [];
      if (t.length > 0) return t.includes(hhmm);
      return globalTimes.includes(hhmm);
    });

    if (filtered.length > 0) {
      // 按到期时间排序
      filtered.sort((a, b) => a.daysUntil - b.daysUntil);

      const subscriptions = filtered.map((n) => ({
        ...n.subscription,
        daysRemaining: n.daysUntil,
      }));

      const commonContent = formatNotificationContent(subscriptions, config);
      const title = '订阅到期提醒';

      ctx.waitUntil(
        sendNotificationToAllChannels(title, commonContent, config, env, '[定时任务]', subscriptions)
      );
    }
  },
};
