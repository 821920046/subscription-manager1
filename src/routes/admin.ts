/**
 * Admin 路由处理器
 * 处理所有 /admin/* 路由
 */

import { Env } from '../types';
import { adminPage } from '../templates/admin';
import { configPage } from '../templates/config';
import { getConfig } from '../utils/config';
import { verifyJWT } from '../utils/auth';
import { getCookieValue } from '../utils/http';
import { htmlResponse, redirectResponse } from '../middleware/security';

/**
 * 处理 Admin 请求
 */
export async function handleAdminRequest(request: Request, env: Env): Promise<Response> {
    try {
        const url = new URL(request.url);
        const token = getCookieValue(request.headers.get('Cookie'), 'token');
        const config = await getConfig(env);
        const user = token ? await verifyJWT(token, config.jwtSecret!) : null;

        if (!user) {
            return redirectResponse('/');
        }

        if (url.pathname === '/admin/config') {
            return htmlResponse(configPage);
        }

        return htmlResponse(adminPage);
    } catch (error) {
        console.error('[Admin] Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
