import { Subscription, Env } from '../types';
import { lunarBiz, lunarCalendar } from '../utils/lunar';
import { getConfig } from '../utils/config';
import { getCurrentTimeInTimezone } from '../utils/date';
import { CONFIG } from '../config/constants';

/**
 * Calculate the next expiry date based on period
 */
function calculateNextExpiryDate(
  currentExpiry: Date,
  periodValue: number,
  periodUnit: 'day' | 'month' | 'year',
  useLunar: boolean,
  targetDate: Date
): Date {
  let nextExpiry = new Date(currentExpiry);

  // If date is already in future (>= target), no need to calculate
  if (nextExpiry >= targetDate) return nextExpiry;

  if (useLunar) {
    let lunarData = lunarCalendar.solar2lunar(
      nextExpiry.getFullYear(),
      nextExpiry.getMonth() + 1,
      nextExpiry.getDate()
    );
    // If lunar conversion fails, return original to avoid infinite loops or errors
    if (!lunarData) return nextExpiry;

    while (nextExpiry < targetDate) {
      const nextLunar = lunarBiz.addLunarPeriod(lunarData, periodValue, periodUnit);
      const solar = lunarBiz.lunar2solar(nextLunar);
      if (!solar) break;
      nextExpiry = new Date(solar.year, solar.month - 1, solar.day);
      // Update lunarData for next iteration
      lunarData = { ...nextLunar, yearStr: '', monthStr: '', dayStr: '', fullStr: '' };
    }
  } else {
    while (nextExpiry < targetDate) {
      if (periodUnit === 'day') {
        nextExpiry.setDate(nextExpiry.getDate() + periodValue);
      } else if (periodUnit === 'month') {
        nextExpiry.setMonth(nextExpiry.getMonth() + periodValue);
      } else if (periodUnit === 'year') {
        nextExpiry.setFullYear(nextExpiry.getFullYear() + periodValue);
      }
    }
  }
  return nextExpiry;
}

export class SubscriptionService {
  constructor(private env: Env) { }

  /**
   * 获取所有订阅（使用分批并行获取优化性能）
   */
  async getAllSubscriptions(): Promise<Subscription[]> {
    if (!this.env.SUBSCRIPTIONS_KV) return [];

    const indexStr = await this.env.SUBSCRIPTIONS_KV.get('subscriptions:index');
    if (indexStr) {
      const ids: string[] = JSON.parse(indexStr);
      const subscriptions: Subscription[] = [];
      const BATCH_SIZE = CONFIG.BATCH.SUBSCRIPTION_BATCH_SIZE;

      // 分批并行获取，避免过多并发请求
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        const promises = batch.map((id) => this.env.SUBSCRIPTIONS_KV.get('subscription:' + id));
        const results = await Promise.all(promises);

        for (const result of results) {
          if (result !== null) {
            try {
              subscriptions.push(JSON.parse(result));
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      return subscriptions;
    }

    // 兼容旧数据格式迁移
    const legacy = await this.env.SUBSCRIPTIONS_KV.get('subscriptions');
    if (legacy) {
      const list: Subscription[] = JSON.parse(legacy);
      const ids = list.map((s) => s.id);
      await this.env.SUBSCRIPTIONS_KV.put('subscriptions:index', JSON.stringify(ids));
      for (const s of list) {
        await this.env.SUBSCRIPTIONS_KV.put('subscription:' + s.id, JSON.stringify(s));
      }
      return list;
    }

    return [];
  }

  async getSubscription(id: string): Promise<Subscription | undefined> {
    const s = await this.env.SUBSCRIPTIONS_KV.get('subscription:' + id);
    if (s) return JSON.parse(s) as Subscription;
    const subscriptions = await this.getAllSubscriptions();
    return subscriptions.find(s => s.id === id);
  }

  async createSubscription(subscription: Partial<Subscription>): Promise<{ success: boolean; message?: string; subscription?: Subscription }> {
    try {
      const config = await getConfig(this.env);
      const timezone = config.timezone || 'UTC';
      const currentTime = getCurrentTimeInTimezone(timezone);

      if (!subscription.name || !subscription.expiryDate) {
        return { success: false, message: '缺少必填字段' };
      }

      let expiryDate = new Date(subscription.expiryDate);
      const useLunar = !!subscription.useLunar;

      if (useLunar) {
        const lunar = lunarCalendar.solar2lunar(
          expiryDate.getFullYear(),
          expiryDate.getMonth() + 1,
          expiryDate.getDate()
        );
        if (!lunar) {
          return { success: false, message: '农历日期超出支持范围（1900-2100年）' };
        }
      }

      if (subscription.periodValue && subscription.periodUnit) {
        expiryDate = calculateNextExpiryDate(
          expiryDate,
          subscription.periodValue,
          subscription.periodUnit,
          useLunar,
          currentTime
        );
        subscription.expiryDate = expiryDate.toISOString();
      }

      const newSubscription: Subscription = {
        id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : Date.now().toString(),
        name: subscription.name,
        customType: subscription.customType || '',
        startDate: subscription.startDate || null,
        expiryDate: subscription.expiryDate,
        periodValue: subscription.periodValue || 1,
        periodUnit: subscription.periodUnit || 'month',
        price: subscription.price !== undefined ? Number(subscription.price) : undefined,
        reminderDays: subscription.reminderDays !== undefined ? subscription.reminderDays : 7,
        dailyReminderTimes: Array.isArray(subscription.dailyReminderTimes) ? subscription.dailyReminderTimes : undefined,
        notes: subscription.notes || '',
        isActive: subscription.isActive !== false,
        autoRenew: subscription.autoRenew !== false,
        useLunar: useLunar,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const indexStr = await this.env.SUBSCRIPTIONS_KV.get('subscriptions:index');
      const ids: string[] = indexStr ? JSON.parse(indexStr) : [];
      ids.push(newSubscription.id);
      await this.env.SUBSCRIPTIONS_KV.put('subscriptions:index', JSON.stringify(ids));
      await this.env.SUBSCRIPTIONS_KV.put('subscription:' + newSubscription.id, JSON.stringify(newSubscription));
      return { success: true, subscription: newSubscription };
    } catch (error: unknown) {
      console.error("创建订阅异常：", error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      return { success: false, message: errorMessage };
    }
  }

  async updateSubscription(id: string, subscription: Partial<Subscription>): Promise<{ success: boolean; message?: string; subscription?: Subscription }> {
    try {
      const current = await this.getSubscription(id);
      if (!current) {
        return { success: false, message: '订阅不存在' };
      }

      if (!subscription.name || !subscription.expiryDate) {
        return { success: false, message: '缺少必填字段' };
      }

      let expiryDate = new Date(subscription.expiryDate);
      const config = await getConfig(this.env);
      const timezone = config.timezone || 'UTC';
      const currentTime = getCurrentTimeInTimezone(timezone);

      const useLunar = !!subscription.useLunar;
      if (useLunar) {
        const lunar = lunarCalendar.solar2lunar(
          expiryDate.getFullYear(),
          expiryDate.getMonth() + 1,
          expiryDate.getDate()
        );
        if (!lunar) return { success: false, message: '农历日期超出支持范围' };
      }

      if (expiryDate < currentTime && subscription.periodValue && subscription.periodUnit) {
        expiryDate = calculateNextExpiryDate(
          expiryDate,
          subscription.periodValue,
          subscription.periodUnit,
          useLunar,
          currentTime
        );
        subscription.expiryDate = expiryDate.toISOString();
      }

      const updated: Subscription = {
        ...current,
        name: subscription.name,
        customType: subscription.customType || current.customType || '',
        startDate: subscription.startDate || current.startDate,
        expiryDate: subscription.expiryDate,
        periodValue: subscription.periodValue || current.periodValue || 1,
        periodUnit: subscription.periodUnit || current.periodUnit || 'month',
        price: subscription.price !== undefined ? Number(subscription.price) : current.price,
        reminderDays: subscription.reminderDays !== undefined ? subscription.reminderDays : current.reminderDays,
        dailyReminderTimes: Array.isArray(subscription.dailyReminderTimes) ? subscription.dailyReminderTimes : current.dailyReminderTimes,
        notes: subscription.notes || '',
        isActive: subscription.isActive !== undefined ? subscription.isActive : current.isActive,
        autoRenew: subscription.autoRenew !== undefined ? subscription.autoRenew : current.autoRenew,
        useLunar: useLunar,
        updatedAt: new Date().toISOString()
      };

      await this.env.SUBSCRIPTIONS_KV.put('subscription:' + id, JSON.stringify(updated));
      return { success: true, subscription: updated };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '更新订阅失败';
      return { success: false, message: errorMessage };
    }
  }

  async deleteSubscription(id: string): Promise<{ success: boolean; message?: string }> {
    try {
      const indexStr = await this.env.SUBSCRIPTIONS_KV.get('subscriptions:index');
      const ids: string[] = indexStr ? JSON.parse(indexStr) : [];
      const newIds = ids.filter(x => x !== id);
      if (newIds.length === ids.length) {
        return { success: false, message: '订阅不存在' };
      }
      await this.env.SUBSCRIPTIONS_KV.put('subscriptions:index', JSON.stringify(newIds));
      await this.env.SUBSCRIPTIONS_KV.delete('subscription:' + id);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, message: '删除订阅失败' };
    }
  }

  async toggleSubscriptionStatus(id: string, isActive: boolean): Promise<{ success: boolean; message?: string; subscription?: Subscription }> {
    try {
      const current = await this.getSubscription(id);
      if (!current) return { success: false, message: '订阅不存在' };
      const updated: Subscription = {
        ...current,
        isActive: isActive,
        updatedAt: new Date().toISOString()
      };
      await this.env.SUBSCRIPTIONS_KV.put('subscription:' + id, JSON.stringify(updated));
      return { success: true, subscription: updated };
    } catch (error: unknown) {
      return { success: false, message: '更新状态失败' };
    }
  }

  async checkExpiringSubscriptions(): Promise<{ notifications: { subscription: Subscription; daysUntil: number }[] }> {
    const subscriptions = await this.getAllSubscriptions();
    const config = await getConfig(this.env);
    const timezone = config.timezone || 'UTC';
    const currentTime = getCurrentTimeInTimezone(timezone);

    // Normalize current time to start of day for accurate day calculation
    const today = new Date(currentTime);
    today.setHours(0, 0, 0, 0);

    const notifications: { subscription: Subscription; daysUntil: number }[] = [];

    for (let i = 0; i < subscriptions.length; i++) {
      const sub = subscriptions[i];
      if (!sub.isActive) continue;

      const expiryDate = new Date(sub.expiryDate);

      // Calculate days remaining
      // For calculation, we need to compare dates without time component
      const expiryCheck = new Date(expiryDate);
      expiryCheck.setHours(0, 0, 0, 0);

      const diffTime = expiryCheck.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Check for auto-renewal if expired
      if (daysRemaining < 0 && sub.autoRenew) {
        // Auto-renew logic
        console.log(`[AutoRenew] Renewing subscription: ${sub.name}`);

        // Calculate next expiry date based on period
        const nextExpiry = calculateNextExpiryDate(
          expiryDate,
          sub.periodValue || 1,
          sub.periodUnit || 'month',
          !!sub.useLunar,
          today
        );
        sub.expiryDate = nextExpiry.toISOString();

        sub.updatedAt = new Date().toISOString();
        await this.env.SUBSCRIPTIONS_KV.put('subscription:' + sub.id, JSON.stringify(sub));

        // Recalculate days remaining for the renewed subscription
        const newExpiry = new Date(sub.expiryDate);
        newExpiry.setHours(0, 0, 0, 0);
        const newDiff = newExpiry.getTime() - today.getTime();
        const newDaysRemaining = Math.ceil(newDiff / (1000 * 60 * 60 * 24));

        // Add to notifications as "Renewed" or just status update?
        // Usually we want to notify that it was renewed or is now due in X days.
        // If it's renewed, it might be far in future, so maybe no notification unless reminderDays matches.
        // But if we want to notify "Renewed", we might need a special flag.
        // For now, let's just check against reminderDays again.

        if (newDaysRemaining <= (sub.reminderDays || 7) && newDaysRemaining >= 0) {
          notifications.push({ subscription: sub, daysUntil: newDaysRemaining });
        }
      } else {
        // Regular check
        if (daysRemaining <= (sub.reminderDays || 7) && daysRemaining >= 0) {
          notifications.push({ subscription: sub, daysUntil: daysRemaining });
        } else if (daysRemaining < 0) {
          // Expired and not auto-renewed
          notifications.push({ subscription: sub, daysUntil: daysRemaining });
        }
      }
    }

    return { notifications };
  }

}
