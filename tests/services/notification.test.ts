/**
 * Notification Service 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendNotificationToAllChannels, sendTelegramNotification, sendNotifyXNotification } from '../../src/services/notification';
import { Config } from '../../src/types';

// 模拟 KV Namespace
function createMockKV() {
  const store = new Map<string, string>();

  return {
    async get(key: string): Promise<string | null> {
      return store.get(key) || null;
    },
    async put(key: string, value: string): Promise<void> {
      store.set(key, value);
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
  };
}

// 模拟 fetch
vi.mock('node-fetch');

describe('Notification Service', () => {
  let mockEnv: any;
  let mockConfig: Config;

  beforeEach(() => {
    mockEnv = {
      SUBSCRIPTIONS_KV: createMockKV(),
    };

    mockConfig = {
      adminUsername: 'admin',
      adminPassword: 'password',
      jwtSecret: 'test-secret-key-1234567890abcdef',
      timezone: 'UTC',
      reminderTimes: [],
      showLunarGlobal: false,
      enabledNotifiers: ['notifyx'],
      telegram: { botToken: 'test-token', chatId: 'test-chat-id' },
      notifyx: { apiKey: 'test-api-key' },
      wenotify: {
        url: 'https://example.com',
        token: 'test-token',
        userid: 'test-user',
        templateId: 'test-template',
        path: '/wxsend',
      },
      wechatBot: {
        webhook: 'https://example.com/webhook',
        msgType: 'text',
        atMobiles: '',
        atAll: 'false',
      },
      wechatOfficialAccount: {
        appId: 'test-appid',
        appSecret: 'test-secret',
        templateId: 'test-template',
        userIds: 'test-userid',
      },
      webhook: {
        url: 'https://example.com/webhook',
        method: 'POST',
        headers: '{}',
        template: '{}',
      },
      email: {
        resendApiKey: 'test-key',
        fromEmail: 'test@example.com',
        toEmail: 'to@example.com',
      },
      bark: {
        server: 'https://api.day.app',
        deviceKey: 'test-device-key',
        isArchive: 'false',
      },
    };

    // 重置 fetch mock
    vi.mocked(() => global.fetch, { partial: false });
  });

  describe('sendTelegramNotification', () => {
    it('应该在配置缺失时返回 false', async () => {
      const result = await sendTelegramNotification('test message', {
        ...mockConfig,
        telegram: { botToken: '', chatId: '' },
      });

      expect(result).toBe(false);
    });

    it('应该在 Telegram 成功发送时返回 true', async () => {
      // Mock 成功响应
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      } as any);
      global.fetch = mockFetch;

      const result = await sendTelegramNotification('test message', mockConfig);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-token/sendMessage',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: 'test-chat-id',
            text: 'test message',
            parse_mode: 'Markdown'
          })
        })
      );
    });

    it('应该在 Telegram 失败时返回 false', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ ok: false, description: 'error' }),
      } as any);
      global.fetch = mockFetch;

      const result = await sendTelegramNotification('test message', mockConfig);

      expect(result).toBe(false);
    });
  });

  describe('sendNotifyXNotification', () => {
    it('应该在配置缺失时返回 false', async () => {
      const result = await sendNotifyXNotification('title', 'content', 'description', {
        ...mockConfig,
        notifyx: { apiKey: '' },
      });

      expect(result).toBe(false);
    });

    it('应该在 NotifyX 成功发送时返回 true', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'queued' }),
      } as any);
      global.fetch = mockFetch;

      const result = await sendNotifyXNotification('title', 'content', 'description', mockConfig);

      expect(result).toBe(true);
    });

    it('应该在 NotifyX 失败时返回 false', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'failed' }),
      } as any);
      global.fetch = mockFetch;

      const result = await sendNotifyXNotification('title', 'content', 'description', mockConfig);

      expect(result).toBe(false);
    });
  });

  describe('sendNotificationToAllChannels', () => {
    it('应该在未启用任何通知渠道时直接返回', async () => {
      const spy = vi.spyOn(console, 'log');

      await sendNotificationToAllChannels('title', 'content', {
        ...mockConfig,
        enabledNotifiers: [],
      }, null, '[测试]');

      spy.mockRestore();
    });

    it('应该在单个渠道失败时记录失败日志', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string, options?: any) => {
        // NotifyX 成功，Telegram 失败
        if (url.includes('notifyx')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: 'queued' }),
          });
        }
        return Promise.reject(new Error('Network error'));
      });

      global.fetch = mockFetch;

      await sendNotificationToAllChannels('title', 'content', {
        ...mockConfig,
        enabledNotifiers: ['notifyx', 'telegram'],
      }, mockEnv, '[测试]');

      // 验证失败日志已写入 KV
      const failureLog = await mockEnv.SUBSCRIPTIONS_KV.get('reminder_failure_index');
      expect(failureLog).not.toBeNull();
    });
  });
});
