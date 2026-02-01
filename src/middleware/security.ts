/**
 * 安全中间件
 * 提供 HTTP 安全头和安全相关功能
 */

/**
 * 安全响应头配置
 */
export const SECURITY_HEADERS: Record<string, string> = {
    // HSTS - 强制 HTTPS
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    // 防止 MIME 类型嗅探
    'X-Content-Type-Options': 'nosniff',
    // 防止点击劫持
    'X-Frame-Options': 'SAMEORIGIN',
    // XSS 防护
    'X-XSS-Protection': '1; mode=block',
    // 引用策略
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // 权限策略
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/**
 * 为响应添加安全头
 * 
 * @param response - 原始响应
 * @param additionalHeaders - 额外的响应头
 * @returns 添加了安全头的响应
 */
export function addSecurityHeaders(
    response: Response,
    additionalHeaders?: Record<string, string>
): Response {
    const newHeaders = new Headers(response.headers);

    // 添加安全头
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
        newHeaders.set(key, value);
    });

    // 添加额外的响应头
    if (additionalHeaders) {
        Object.entries(additionalHeaders).forEach(([key, value]) => {
            newHeaders.set(key, value);
        });
    }

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
    });
}

/**
 * 创建带安全头的 JSON 响应
 * 
 * @param data - 响应数据
 * @param status - HTTP 状态码
 * @param additionalHeaders - 额外的响应头
 * @returns HTTP 响应
 */
export function jsonResponse(
    data: unknown,
    status: number = 200,
    additionalHeaders?: Record<string, string>
): Response {
    const response = new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
        },
    });
    return addSecurityHeaders(response, additionalHeaders);
}

/**
 * 创建带安全头的 HTML 响应
 * 
 * @param html - HTML 内容
 * @param status - HTTP 状态码
 * @param additionalHeaders - 额外的响应头
 * @returns HTTP 响应
 */
export function htmlResponse(
    html: string,
    status: number = 200,
    additionalHeaders?: Record<string, string>
): Response {
    const response = new Response(html, {
        status,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
        },
    });
    return addSecurityHeaders(response, additionalHeaders);
}

/**
 * 创建带安全头的文本响应
 * 
 * @param text - 文本内容
 * @param status - HTTP 状态码
 * @param contentType - 内容类型
 * @param additionalHeaders - 额外的响应头
 * @returns HTTP 响应
 */
export function textResponse(
    text: string,
    status: number = 200,
    contentType: string = 'text/plain; charset=utf-8',
    additionalHeaders?: Record<string, string>
): Response {
    const response = new Response(text, {
        status,
        headers: {
            'Content-Type': contentType,
        },
    });
    return addSecurityHeaders(response, additionalHeaders);
}

/**
 * 创建重定向响应
 * 
 * @param location - 重定向目标
 * @param status - HTTP 状态码（默认 302）
 * @param additionalHeaders - 额外的响应头
 * @returns HTTP 响应
 */
export function redirectResponse(
    location: string,
    status: number = 302,
    additionalHeaders?: Record<string, string>
): Response {
    const response = new Response('', {
        status,
        headers: {
            Location: location,
        },
    });
    return addSecurityHeaders(response, additionalHeaders);
}

/**
 * 创建错误响应
 * 
 * @param message - 错误消息
 * @param status - HTTP 状态码
 * @param code - 错误代码
 * @returns HTTP 响应
 */
export function errorResponse(
    message: string,
    status: number = 500,
    code?: string
): Response {
    const data: { success: false; message: string; code?: string } = {
        success: false,
        message,
    };
    if (code) {
        data.code = code;
    }
    return jsonResponse(data, status);
}

/**
 * 创建成功响应
 * 
 * @param data - 响应数据
 * @param message - 成功消息
 * @returns HTTP 响应
 */
export function successResponse(
    data?: unknown,
    message?: string
): Response {
    const responseData: { success: true; message?: string; data?: unknown } = {
        success: true,
    };
    if (message) {
        responseData.message = message;
    }
    if (data !== undefined) {
        responseData.data = data;
    }
    return jsonResponse(responseData);
}
