/**
 * API 路由处理器
 * 处理所有 /api/* 路由
 */

import { Config, Env } from '../types';
import { SubscriptionService } from '../services/subscription';
import {
    sendNotificationToAllChannels,
    sendTelegramNotification,
    sendNotifyXNotification,
    sendWeNotifyEdgeNotification,
    sendWebhookNotification,
    sendWechatBotNotification,
    sendWeChatOfficialAccountNotification,
    sendEmailNotification,
    sendBarkNotification,
    formatNotificationContent,
} from '../services/notification';
import { getConfig, getRawConfig } from '../utils/config';
import { generateJWT, verifyJWT, generateRandomSecret } from '../utils/auth';
import { verifyAdminPassword } from '../utils/config';
import { getCookieValue } from '../utils/http';
import { isRateLimited, getClientIP } from '../middleware/rateLimit';
import { z } from 'zod';
import {
    LoginSchema,
    ThirdPartyNotifySchema,
    ConfigSchema,
    TestNotificationSchema,
    SubscriptionSchema,
    SubscriptionUpdateSchema,
} from '../utils/validation';
import { jsonResponse, errorResponse, redirectResponse } from '../middleware/security';

/**
 * API 路由上下文
 */
interface ApiContext {
    request: Request;
    env: Env;
    url: URL;
    path: string;
    method: string;
    config: Config;
    ip: string;
}

/**
 * 处理 API 请求
 */
export async function handleApiRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.slice(4); // Remove '/api'
    const method = request.method;
    const config = await getConfig(env);
    const ip = getClientIP(request);

    const ctx: ApiContext = { request, env, url, path, method, config, ip };

    // 公开 API 路由
    if (path === '/dev/reset-login' && method === 'POST') {
        return handleDevResetLogin(ctx);
    }

    if (path === '/login' && method === 'POST') {
        return handleLogin(ctx);
    }

    if (path === '/logout' && (method === 'GET' || method === 'POST')) {
        return handleLogout(ctx);
    }

    if (path.startsWith('/notify/') && method === 'POST') {
        return handleThirdPartyNotify(ctx);
    }

    // 需要认证的路由
    const token = getCookieValue(request.headers.get('Cookie'), 'token');
    const user = token ? await verifyJWT(token, config.jwtSecret!) : null;

    if (!user) {
        return errorResponse('Unauthorized', 401);
    }

    // 认证后的路由
    if (path === '/config') {
        return handleConfigApi(ctx, method);
    }

    if (path === '/failure-logs' && method === 'GET') {
        return handleFailureLogs(ctx);
    }

    if (path === '/test-notification' && method === 'POST') {
        return handleTestNotification(ctx);
    }

    if (path === '/subscriptions') {
        return handleSubscriptionsApi(ctx);
    }

    if (path.startsWith('/subscriptions/')) {
        return handleSubscriptionByIdApi(ctx);
    }

    return errorResponse('Not Found', 404);
}

/**
 * 开发环境重置登录
 */
async function handleDevResetLogin(ctx: ApiContext): Promise<Response> {
    try {
        const isLocal =
            ctx.url.hostname === '127.0.0.1' || ctx.url.hostname === 'localhost';
        if (!isLocal) {
            return errorResponse('仅限本地开发使用', 403);
        }
        const raw = await getRawConfig(ctx.env);
        raw.ADMIN_USERNAME = 'admin';
        raw.ADMIN_PASSWORD = 'password';
        if (!raw.JWT_SECRET) {
            raw.JWT_SECRET = generateRandomSecret();
        }
        await ctx.env.SUBSCRIPTIONS_KV.put('config', JSON.stringify(raw));
        return jsonResponse({ success: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : '未知错误';
        return errorResponse(message, 500);
    }
}

/**
 * 登录处理
 */
async function handleLogin(ctx: ApiContext): Promise<Response> {
    try {
        const limited = await isRateLimited(
            ctx.env.SUBSCRIPTIONS_KV,
            'login',
            ctx.ip,
            10
        );
        if (limited) {
            return errorResponse('请求过于频繁', 429);
        }

        const json = await ctx.request.json();
        const body = await LoginSchema.parseAsync(json);

        const expectedUser = ctx.config.adminUsername || 'admin';
        const expectedPass = ctx.config.adminPassword || 'password';
        const inputUser = body.username;
        const inputPass = body.password;

        const ok =
            inputUser === expectedUser &&
            (await verifyAdminPassword(inputPass, expectedPass));

        if (ok) {
            const token = await generateJWT(body.username, ctx.config.jwtSecret!);
            const secureFlag = ctx.url.protocol === 'https:' ? '; Secure' : '';
            return jsonResponse(
                { success: true },
                200,
                {
                    'Set-Cookie': `token=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400${secureFlag}`,
                }
            );
        } else {
            return jsonResponse({ success: false, message: '用户名或密码错误' });
        }
    } catch (e: unknown) {
        if (e instanceof z.ZodError) {
            return errorResponse(e.errors[0].message, 400);
        }
        return errorResponse('Invalid request', 400);
    }
}

/**
 * 登出处理
 */
function handleLogout(ctx: ApiContext): Response {
    const secureFlag = ctx.url.protocol === 'https:' ? '; Secure' : '';
    return redirectResponse('/', 302, {
        'Set-Cookie': `token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureFlag}`,
    });
}

/**
 * 第三方通知 API
 */
async function handleThirdPartyNotify(ctx: ApiContext): Promise<Response> {
    try {
        const limited = await isRateLimited(
            ctx.env.SUBSCRIPTIONS_KV,
            'notify',
            ctx.ip,
            20
        );
        if (limited) {
            return errorResponse('请求过于频繁', 429);
        }

        const tokenHeader = ctx.request.headers.get('X-Notify-Token') || '';
        const tokenQuery = ctx.url.searchParams.get('token') || '';
        const providedToken = tokenHeader || tokenQuery;

        if (!providedToken || providedToken !== (ctx.config.thirdPartyToken || '')) {
            return errorResponse('Unauthorized', 403);
        }

        const json = await ctx.request.json();
        const body = await ThirdPartyNotifySchema.parseAsync(json);

        await sendNotificationToAllChannels(body.title, body.content, ctx.config, ctx.env, '[第三方API]');

        return jsonResponse({
            message: '发送成功',
            response: { errcode: 0, errmsg: 'ok', msgid: 'MSGID' + Date.now() },
        });
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            return errorResponse(error.errors[0].message, 400);
        }
        const message = error instanceof Error ? error.message : '未知错误';
        return jsonResponse(
            {
                message: '发送失败',
                response: { errcode: 1, errmsg: message },
            },
            500
        );
    }
}

/**
 * 配置 API
 */
async function handleConfigApi(ctx: ApiContext, method: string): Promise<Response> {
    if (method === 'GET') {
        const rawConfig = await getRawConfig(ctx.env);
        const safeConfig = { ...rawConfig };
        delete safeConfig.JWT_SECRET;
        delete safeConfig.ADMIN_PASSWORD;
        delete safeConfig.THIRD_PARTY_TOKEN;
        return jsonResponse(safeConfig);
    }

    if (method === 'POST') {
        try {
            const json = await ctx.request.json();
            const body = await ConfigSchema.partial().parseAsync(json);
            const currentRawConfig = await getRawConfig(ctx.env);

            const updatedConfig: Record<string, unknown> = {
                ...currentRawConfig,
                ADMIN_USERNAME: body.ADMIN_USERNAME || currentRawConfig.ADMIN_USERNAME,
                TG_BOT_TOKEN: body.TG_BOT_TOKEN || '',
                TG_CHAT_ID: body.TG_CHAT_ID || '',
                NOTIFYX_API_KEY: body.NOTIFYX_API_KEY || '',
                WENOTIFY_URL: body.WENOTIFY_URL || '',
                WENOTIFY_TOKEN: body.WENOTIFY_TOKEN || '',
                WENOTIFY_USERID: body.WENOTIFY_USERID || '',
                WENOTIFY_TEMPLATE_ID: body.WENOTIFY_TEMPLATE_ID || '',
                WENOTIFY_PATH: body.WENOTIFY_PATH || currentRawConfig.WENOTIFY_PATH || '/wxsend',
                WEBHOOK_URL: body.WEBHOOK_URL || '',
                WEBHOOK_METHOD: body.WEBHOOK_METHOD || 'POST',
                WEBHOOK_HEADERS: body.WEBHOOK_HEADERS || '',
                WEBHOOK_TEMPLATE: body.WEBHOOK_TEMPLATE || '',
                SHOW_LUNAR: body.SHOW_LUNAR === true,
                WECHATBOT_WEBHOOK: body.WECHATBOT_WEBHOOK || '',
                WECHATBOT_MSG_TYPE: body.WECHATBOT_MSG_TYPE || 'text',
                WECHATBOT_AT_MOBILES: body.WECHATBOT_AT_MOBILES || '',
                WECHATBOT_AT_ALL: body.WECHATBOT_AT_ALL || 'false',
                WECHAT_OA_APPID: body.WECHAT_OA_APPID || '',
                WECHAT_OA_APPSECRET: body.WECHAT_OA_APPSECRET || '',
                WECHAT_OA_TEMPLATE_ID: body.WECHAT_OA_TEMPLATE_ID || '',
                WECHAT_OA_USERIDS: body.WECHAT_OA_USERIDS || '',
                RESEND_API_KEY: body.RESEND_API_KEY || '',
                EMAIL_FROM: body.EMAIL_FROM || '',
                EMAIL_FROM_NAME: body.EMAIL_FROM_NAME || '',
                EMAIL_TO: body.EMAIL_TO || '',
                BARK_DEVICE_KEY: body.BARK_DEVICE_KEY || '',
                BARK_SERVER: body.BARK_SERVER || 'https://api.day.app',
                BARK_IS_ARCHIVE: body.BARK_IS_ARCHIVE || 'false',
                ENABLED_NOTIFIERS: body.ENABLED_NOTIFIERS || ['notifyx'],
                TIMEZONE: body.TIMEZONE || currentRawConfig.TIMEZONE || 'UTC',
                REMINDER_TIMES: body.REMINDER_TIMES || currentRawConfig.REMINDER_TIMES || '',
            };

            if (body.ADMIN_PASSWORD) {
                updatedConfig.ADMIN_PASSWORD = body.ADMIN_PASSWORD;
            }

            // 确保第三方Token存在
            if (!updatedConfig.THIRD_PARTY_TOKEN || updatedConfig.THIRD_PARTY_TOKEN === 'your-secret-key') {
                updatedConfig.THIRD_PARTY_TOKEN = generateRandomSecret();
            }

            if (!updatedConfig.JWT_SECRET || updatedConfig.JWT_SECRET === 'your-secret-key') {
                updatedConfig.JWT_SECRET = generateRandomSecret();
            }

            await ctx.env.SUBSCRIPTIONS_KV.put('config', JSON.stringify(updatedConfig));

            // 清除配置缓存
            try {
                const { clearConfigCache } = await import('../utils/config');
                clearConfigCache();
            } catch (e) {
                console.error('Failed to clear config cache', e);
            }

            return jsonResponse({ success: true });
        } catch (error: unknown) {
            if (error instanceof z.ZodError) {
                return errorResponse(error.errors[0].message, 400);
            }
            const message = error instanceof Error ? error.message : '未知错误';
            return errorResponse(message, 400);
        }
    }

    return errorResponse('Method not allowed', 405);
}

/**
 * 失败日志 API
 */
async function handleFailureLogs(ctx: ApiContext): Promise<Response> {
    try {
        const idxRaw = await ctx.env.SUBSCRIPTIONS_KV.get('reminder_failure_index');
        let idx: Array<{ key: string; id: number }> = [];
        if (idxRaw) {
            try {
                idx = JSON.parse(idxRaw) || [];
            } catch {
                // ignore parse error
            }
        }
        const limit = parseInt(ctx.url.searchParams.get('limit') || '50');
        const keys = idx.slice(-limit).reverse();
        const out: Array<{
            key: string;
            id: number;
            timestamp: string;
            title: string;
            failures: Array<{ channel: string; success: boolean }>;
            successes: Array<{ channel: string; success: boolean }>;
        }> = [];

        for (const item of keys) {
            const raw = await ctx.env.SUBSCRIPTIONS_KV.get(item.key);
            if (!raw) continue;
            try {
                const obj = JSON.parse(raw);
                out.push({ key: item.key, id: item.id, ...obj });
            } catch {
                // ignore parse error
            }
        }
        return jsonResponse(out);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : '未知错误';
        return errorResponse(message, 500);
    }
}

/**
 * 测试通知 API
 */
async function handleTestNotification(ctx: ApiContext): Promise<Response> {
    try {
        const json = await ctx.request.json();
        // 使用 Zod 验证
        const body = await TestNotificationSchema.parseAsync(json);

        let success = false;
        const tempConfig = { ...ctx.config };

        switch (body.type) {
            case 'telegram':
                tempConfig.telegram = {
                    botToken: body.TG_BOT_TOKEN || ctx.config.telegram?.botToken || '',
                    chatId: body.TG_CHAT_ID || ctx.config.telegram?.chatId || '',
                };
                success = await sendTelegramNotification(
                    '*测试通知*\n\n这是一条测试通知...',
                    tempConfig
                );
                break;

            case 'notifyx':
                tempConfig.notifyx = {
                    apiKey: body.NOTIFYX_API_KEY || ctx.config.notifyx?.apiKey || '',
                };
                success = await sendNotifyXNotification('测试通知', '## 测试通知...', '测试描述', tempConfig);
                break;

            case 'wenotify':
                tempConfig.wenotify = {
                    url: body.WENOTIFY_URL || ctx.config.wenotify?.url || '',
                    token: body.WENOTIFY_TOKEN || ctx.config.wenotify?.token || '',
                    userid: body.WENOTIFY_USERID || ctx.config.wenotify?.userid || '',
                    templateId: body.WENOTIFY_TEMPLATE_ID || ctx.config.wenotify?.templateId || '',
                };
                success = await sendWeNotifyEdgeNotification('测试通知', '测试通知...', tempConfig, true);
                break;

            case 'webhook':
                tempConfig.webhook = {
                    url: body.WEBHOOK_URL || ctx.config.webhook?.url || '',
                    method: body.WEBHOOK_METHOD || ctx.config.webhook?.method || 'POST',
                    headers: body.WEBHOOK_HEADERS || ctx.config.webhook?.headers || '',
                    template: body.WEBHOOK_TEMPLATE || ctx.config.webhook?.template || '',
                };
                success = await sendWebhookNotification('测试通知', '测试通知...', tempConfig);
                break;

            case 'wechatbot':
                tempConfig.wechatBot = {
                    webhook: body.WECHATBOT_WEBHOOK || ctx.config.wechatBot?.webhook || '',
                    msgType: body.WECHATBOT_MSG_TYPE || ctx.config.wechatBot?.msgType || 'text',
                    atMobiles: body.WECHATBOT_AT_MOBILES || ctx.config.wechatBot?.atMobiles || '',
                    atAll: body.WECHATBOT_AT_ALL || ctx.config.wechatBot?.atAll || 'false',
                };
                success = await sendWechatBotNotification('测试通知', '测试通知...', tempConfig);
                break;

            case 'wechatOfficialAccount':
                tempConfig.wechatOfficialAccount = {
                    appId: body.WECHAT_OA_APPID || ctx.config.wechatOfficialAccount?.appId || '',
                    appSecret: body.WECHAT_OA_APPSECRET || ctx.config.wechatOfficialAccount?.appSecret || '',
                    templateId: body.WECHAT_OA_TEMPLATE_ID || ctx.config.wechatOfficialAccount?.templateId || '',
                    userIds: body.WECHAT_OA_USERIDS || ctx.config.wechatOfficialAccount?.userIds || '',
                };
                success = await sendWeChatOfficialAccountNotification(
                    '测试通知',
                    '这是一条测试通知',
                    tempConfig,
                    ctx.env
                );
                break;

            case 'email':
                tempConfig.email = {
                    resendApiKey: body.RESEND_API_KEY || ctx.config.email?.resendApiKey || '',
                    fromEmail: body.EMAIL_FROM || ctx.config.email?.fromEmail || '',
                    toEmail: body.EMAIL_TO || ctx.config.email?.toEmail || '',
                };
                success = await sendEmailNotification('测试通知', '测试通知...', tempConfig);
                break;

            case 'bark':
                tempConfig.bark = {
                    server: body.BARK_SERVER || ctx.config.bark?.server || '',
                    deviceKey: body.BARK_DEVICE_KEY || ctx.config.bark?.deviceKey || '',
                    isArchive: body.BARK_IS_ARCHIVE || ctx.config.bark?.isArchive || 'false',
                };
                success = await sendBarkNotification('测试通知', '测试通知...', tempConfig);
                break;
        }

        return jsonResponse({
            success,
            message: success ? '发送成功' : '发送失败',
        });
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            return errorResponse(error.errors[0].message, 400);
        }
        const message = error instanceof Error ? error.message : '未知错误';
        return jsonResponse({ success: false, message }, 200);
    }
}

/**
 * 订阅列表 API
 */
async function handleSubscriptionsApi(ctx: ApiContext): Promise<Response> {
    const subscriptionService = new SubscriptionService(ctx.env);

    if (ctx.method === 'GET') {
        const subscriptions = await subscriptionService.getAllSubscriptions();
        return jsonResponse(subscriptions);
    }

    if (ctx.method === 'POST') {
        try {
            const json = await ctx.request.json();
            const sub = await SubscriptionSchema.parseAsync(json);
            const result = await subscriptionService.createSubscription(sub);
            return jsonResponse(result, result.success ? 201 : 400);
        } catch (error: unknown) {
            if (error instanceof z.ZodError) {
                return errorResponse(error.errors[0].message, 400);
            }
            return errorResponse('Invalid request', 400);
        }
    }

    return errorResponse('Method not allowed', 405);
}

/**
 * 单个订阅 API
 */
async function handleSubscriptionByIdApi(ctx: ApiContext): Promise<Response> {
    const subscriptionService = new SubscriptionService(ctx.env);
    const parts = ctx.path.split('/');
    const id = parts[2];

    // 测试通知
    if (parts[3] === 'test-notify' && ctx.method === 'POST') {
        try {
            const sub = await subscriptionService.getSubscription(id);
            if (!sub) {
                return errorResponse('Subscription not found', 404);
            }

            const now = new Date();
            const expiry = new Date(sub.expiryDate);
            sub.daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            const content = formatNotificationContent([sub], ctx.config);
            await sendNotificationToAllChannels('订阅提醒测试', content, ctx.config, ctx.env, '[手动测试]', [
                sub,
            ]);
            return jsonResponse({ success: true, message: '已发送' });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : '未知错误';
            return errorResponse(message, 500);
        }
    }

    if (ctx.method === 'GET') {
        const sub = await subscriptionService.getSubscription(id);
        return jsonResponse(sub);
    }

    if (ctx.method === 'PUT') {
        try {
            const json = await ctx.request.json();
            const sub = await SubscriptionUpdateSchema.parseAsync(json);
            const result = await subscriptionService.updateSubscription(id, sub);
            return jsonResponse(result, result.success ? 200 : 400);
        } catch (error: unknown) {
            if (error instanceof z.ZodError) {
                return errorResponse(error.errors[0].message, 400);
            }
            return errorResponse('Invalid request', 400);
        }
    }

    if (ctx.method === 'DELETE') {
        const result = await subscriptionService.deleteSubscription(id);
        return jsonResponse(result, result.success ? 200 : 400);
    }

    return errorResponse('Method not allowed', 405);
}
