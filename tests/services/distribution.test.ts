import { expect, test, describe } from 'vitest';
import { distributeWeNotifyNotifications } from '../../src/services/notification';
import { Subscription, Config } from '../../src/types';

describe('Notification Distribution', () => {
    const mockConfig: Config = {
        enabledNotifiers: ['wenotify'],
        wenotify: {
            url: 'http://test',
            token: 'token',
            userid: 'global1|global2'
        },
        // Required fields for Config type
        reminderTimes: [],
        showLunarGlobal: false,
        adminUsername: 'admin',
        adminPassword: 'password',
        jwtSecret: 'secret',
    };

    const sub1: Subscription = { id: '1', name: 'Sub1', expiryDate: '2024-01-01', isActive: true, autoRenew: true };
    const sub2: Subscription = { id: '2', name: 'Sub2', expiryDate: '2024-01-01', isActive: true, autoRenew: true, weNotifyUserIds: 'user3' };
    const sub3: Subscription = { id: '3', name: 'Sub3', expiryDate: '2024-01-01', isActive: true, autoRenew: true, weNotifyUserIds: 'user3,user4' };
    const subNoTargets: Subscription = { id: '4', name: 'Sub4', expiryDate: '2024-01-01', isActive: true, autoRenew: true, weNotifyUserIds: '' }; // Should go to global

    test('should distribute global subs to global users', () => {
        const map = distributeWeNotifyNotifications([sub1], mockConfig);
        expect(map.size).toBe(2);
        expect(map.get('global1')).toHaveLength(1);
        expect(map.get('global1')![0].id).toBe('1');
        expect(map.get('global2')![0].id).toBe('1');
    });

    test('should distribute specific subs to specific users', () => {
        const map = distributeWeNotifyNotifications([sub2], mockConfig);
        expect(map.size).toBe(1);
        expect(map.has('user3')).toBe(true);
        expect(map.get('user3')![0].id).toBe('2');
        expect(map.has('global1')).toBe(false);
    });

    test('should handle mixed subs', () => {
        const map = distributeWeNotifyNotifications([sub1, sub2, sub3], mockConfig);

        // sub1 -> global1, global2
        // sub2 -> user3
        // sub3 -> user3, user4

        expect(map.get('global1')).toBeDefined();
        expect(map.get('global1')!.length).toBeGreaterThanOrEqual(1); // sub1
        expect(map.get('global1')!.find(s => s.id === '1')).toBeDefined();
        expect(map.get('global1')!.find(s => s.id === '2')).toBeUndefined();

        expect(map.get('user3')).toBeDefined();
        expect(map.get('user3')!.length).toBeGreaterThanOrEqual(2); // sub2, sub3

        expect(map.get('user4')).toBeDefined();
        expect(map.get('user4')!.length).toBe(1); // sub3
    });

    test('should handle empty config global users', () => {
        const emptyConfig: Config = { ...mockConfig, wenotify: { ...mockConfig.wenotify!, userid: '' } };
        const map = distributeWeNotifyNotifications([sub1], emptyConfig);
        expect(map.size).toBe(1);
        expect(map.has('')).toBe(true); // Should fallback to empty string key
        expect(map.get('')![0].id).toBe('1');
    });
});
