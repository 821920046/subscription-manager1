export function getCookieValue(cookieString: string | null, key: string): string | null {
  if (!cookieString) return null;

  const match = cookieString.match(new RegExp('(^| )' + key + '=([^;]+)'));
  return match ? match[2] : null;
}

export async function requestWithRetry(
  url: string,
  options: RequestInit,
  retries = 1,
  timeoutMs = 8000
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (resp.ok || attempt === retries) return resp;
      lastError = new Error('Request failed');
    } catch (e) {
      clearTimeout(timer);
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError;
}
