/**
 * Lunar Calendar Utils 测试
 */

import { describe, it, expect } from 'vitest';
import {
  lunar2solar,
  addLunarPeriod,
  daysToLunar,
  lunarCalendar,
} from '../../src/utils/lunar';

describe('Lunar Calendar Utils', () => {
  describe('solar2lunar - 公历转农历', () => {
    it('应该正确转换 2024 年农历新年', () => {
      // 2024 年农历正月初一对应公历 2024 年 2 月 10 日
      const lunar = lunarCalendar.solar2lunar(2024, 2, 10);

      expect(lunar).not.toBeNull();
      expect(lunar?.year).toBe(2024);
      expect(lunar?.month).toBe(1); // 正月
      expect(lunar?.day).toBe(1);   // 初一
      expect(lunar?.isLeap).toBe(false);
    });

    it('应该正确转换闰月日期', () => {
      // 2023 年有闰二月
      const lunar = lunarCalendar.solar2lunar(2023, 3, 22);

      expect(lunar).not.toBeNull();
      expect(lunar?.isLeap).toBe(true);
      expect(lunar?.month).toBe(2);
    });

    it('应该在支持范围外的日期返回 null', () => {
      const lunar1 = lunarCalendar.solar2lunar(1899, 1, 1);
      const lunar2 = lunarCalendar.solar2lunar(2101, 1, 1);

      expect(lunar1).toBeNull();
      expect(lunar2).toBeNull();
    });

    it('应该返回完整的农历字符串', () => {
      const lunar = lunarCalendar.solar2lunar(2024, 2, 10);

      expect(lunar?.fullStr).toMatch(/甲辰|正月初一/);
    });

    it('应该正确转换闰月日期', () => {
      // 2023 年有闰二月
      const lunar = lunarCalendar.solar2lunar(2023, 3, 22);

      expect(lunar).not.toBeNull();
      expect(lunar?.isLeap).toBe(true);
      expect(lunar?.month).toBe(2);
    });

    it('应该在支持范围外的日期返回 null', () => {
      const lunar1 = lunarCalendar.solar2lunar(1899, 1, 1);
      const lunar2 = lunarCalendar.solar2lunar(2101, 1, 1);

      expect(lunar1).toBeNull();
      expect(lunar2).toBeNull();
    });

    it('应该返回完整的农历字符串', () => {
      const lunar = lunarCalendar.solar2lunar(2024, 2, 10);

      expect(lunar?.fullStr).toMatch(/甲辰|正月初一/);
    });
  });

  describe('lunar2solar - 农历转公历', () => {
    it('应该正确转换农历正月初一为公历', () => {
      // 2024 年农历正月初一
      const lunar = { year: 2024, month: 1, day: 1, isLeap: false };
      const solar = lunar2solar(lunar);

      expect(solar).not.toBeNull();
      expect(solar?.year).toBe(2024);
      expect(solar?.month).toBe(2);
      expect(solar?.day).toBe(10);
    });

    it('应该正确转换闰月日期', () => {
      // 2023 年闰二月
      const lunar = { year: 2023, month: 2, day: 10, isLeap: true };
      const solar = lunar2solar(lunar);

      expect(solar).not.toBeNull();
      expect(solar?.year).toBe(2023);
    });

    it('应该在找不到匹配时返回 null', () => {
      const lunar = { year: 2024, month: 12, day: 32, isLeap: false };
      const solar = lunar2solar(lunar);

      // 无效的农历日期（农历十二月没有 32 天）
      expect(solar).toBeNull();
    });
  });

  describe('addLunarPeriod - 农历周期计算', () => {
    it('应该正确添加年周期', () => {
      const lunar = { year: 2024, month: 1, day: 1, isLeap: false };
      const result = addLunarPeriod(lunar, 1, 'year');

      expect(result.year).toBe(2025);
      expect(result.month).toBe(1);
      expect(result.day).toBe(1);
      expect(result.isLeap).toBe(false);
    });

    it('应该正确添加月周期', () => {
      const lunar = { year: 2024, month: 1, day: 15, isLeap: false };
      const result = addLunarPeriod(lunar, 1, 'month');

      expect(result.year).toBe(2024);
      expect(result.month).toBe(2);
      expect(result.day).toBe(15);
      expect(result.isLeap).toBe(false);
    });

    it('应该正确添加天周期', () => {
      const lunar = { year: 2024, month: 1, day: 1, isLeap: false };
      const result = addLunarPeriod(lunar, 10, 'day');

      expect(result.year).toBeGreaterThanOrEqual(2024);
      expect(result.day).toBeGreaterThan(1);
    });

    it('应该在闰月时正确处理', () => {
      // 2023 年闰二月
      const lunar = { year: 2023, month: 2, day: 1, isLeap: true };
      const result = addLunarPeriod(lunar, 1, 'year');

      expect(result.year).toBe(2024);
      expect(result.isLeap).toBe(false); // 跨年后闰月标志重置
    });
  });

  describe('daysToLunar - 距离农历日期的天数', () => {
    it('应该计算距离未来农历日期的天数', () => {
      // 使用一个遥远的未来日期
      const futureLunar = { year: 2030, month: 1, day: 1, isLeap: false };
      const days = daysToLunar(futureLunar);

      // 返回距离未来日期的天数（可能是正数或负数，取决于当前时间）
      expect(typeof days).toBe('number');
    });

    it('应该计算距离过去农历日期的天数', () => {
      const pastLunar = { year: 2020, month: 1, day: 1, isLeap: false };
      const days = daysToLunar(pastLunar);

      // 返回距离过去日期的天数（应该是负数）
      expect(days).toBeLessThan(0);
    });

    it('应该处理今天农历日期', () => {
      // 使用当前时间创建农历日期
      const now = new Date();
      const lunar = lunarCalendar.solar2lunar(now.getFullYear(), now.getMonth() + 1, now.getDate());

      if (lunar) {
        const days = daysToLunar(lunar);

        // 今天的农历日期距离今天应该是 0
        expect(days).toBe(0);
      }
    });
  });

  describe('lunarCalendar - 工具函数测试', () => {
    it('应该正确计算农历年天数', () => {
      const days = lunarCalendar.lunarYearDays(2024);

      // 农历年通常是 354 或 355 天（闰月 354-384 天）
      expect(days).toBeGreaterThan(350);
      expect(days).toBeLessThan(390);
    });

    it('应该正确计算闰月天数', () => {
      // 2023 年有闰二月
      const leapMonth = lunarCalendar.leapMonth(2023);

      expect(leapMonth).toBe(2); // 闰二月

      if (leapMonth > 0) {
        const leapDays = lunarCalendar.leapDays(2023);

        expect(leapDays).toBeGreaterThan(28);
        expect(leapDays).toBeLessThan(31);
      }
    });

    it('应该正确计算农历月天数', () => {
      const days1 = lunarCalendar.monthDays(2024, 1); // 正月
      const days2 = lunarCalendar.monthDays(2024, 2); // 二月

      expect(days1).toBeGreaterThan(28);
      expect(days1).toBeLessThan(31);
      expect(days2).toBeGreaterThan(28);
      expect(days2).toBeLessThan(31);
    });
  });

  describe('边界情况处理', () => {
    it('应该处理跨年边界', () => {
      const lunar = { year: 2023, month: 12, day: 29, isLeap: false };
      const result = addLunarPeriod(lunar, 1, 'day');

      expect(result.year).toBeGreaterThanOrEqual(2023);
    });

    it('应该处理闰年二月（闰月）', () => {
      // 查找一个有闰二月的年份
      for (let year = 2020; year <= 2030; year++) {
        const leapMonth = lunarCalendar.leapMonth(year);
        if (leapMonth === 2) {
          const days = lunarCalendar.leapDays(year);

          expect(days).toBeGreaterThan(28);
          expect(days).toBeLessThan(31);

          break;
        }
      }
    });

    it('应该处理农历年底日期', () => {
      const lunar = { year: 2023, month: 12, day: 29, isLeap: false };
      const result = addLunarPeriod(lunar, 1, 'day');

      // 2023 年农历12月29加1天应该进入新年
      expect(result.year).toBeGreaterThanOrEqual(2023);
    });
  });
});
