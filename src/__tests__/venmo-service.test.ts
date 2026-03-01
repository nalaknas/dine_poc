// Mock react-native Linking before importing the service
jest.mock('react-native', () => ({
  Linking: {
    canOpenURL: jest.fn(),
    openURL: jest.fn(),
  },
}));

import { buildVenmoDeepLink, buildVenmoWebUrl, buildMealNote, getVenmoableBreakdowns } from '../services/venmo-service';
import { Linking } from 'react-native';
import type { PersonBreakdown, Friend } from '../types';

const makeFriend = (id: string, name: string, venmo?: string): Friend => ({
  id,
  display_name: name,
  username: name.toLowerCase(),
  is_app_user: true,
  venmo_username: venmo,
});

const makeBreakdown = (friend: Friend, total: number): PersonBreakdown => ({
  friend,
  items: [{ name: 'Test Item', price: total, share: total }],
  itemsTotal: total,
  taxShare: 0,
  tipShare: 0,
  total,
});

describe('Venmo Service', () => {
  describe('buildVenmoDeepLink', () => {
    it('should construct correct Venmo deep link URL', () => {
      const url = buildVenmoDeepLink({
        venmoUsername: 'john-doe',
        amount: 25.50,
        note: 'Dine: Dinner at Olive Garden',
      });

      expect(url).toBe(
        'venmo://paycharge?txn=charge&recipients=john-doe&amount=25.50&note=Dine%3A%20Dinner%20at%20Olive%20Garden'
      );
    });

    it('should encode special characters in username', () => {
      const url = buildVenmoDeepLink({
        venmoUsername: 'user@name',
        amount: 10.00,
        note: 'test',
      });

      expect(url).toContain('recipients=user%40name');
    });

    it('should format amount to 2 decimal places', () => {
      const url = buildVenmoDeepLink({
        venmoUsername: 'test',
        amount: 10,
        note: 'test',
      });

      expect(url).toContain('amount=10.00');
    });

    it('should handle amounts with many decimal places', () => {
      const url = buildVenmoDeepLink({
        venmoUsername: 'test',
        amount: 15.333333,
        note: 'test',
      });

      expect(url).toContain('amount=15.33');
    });

    it('should encode special characters in note', () => {
      const url = buildVenmoDeepLink({
        venmoUsername: 'test',
        amount: 10,
        note: 'Dine: Dinner at Joe\'s Crab Shack & Bar',
      });

      expect(url).toContain('note=Dine%3A%20Dinner%20at%20Joe\'s%20Crab%20Shack%20%26%20Bar');
    });
  });

  describe('buildVenmoWebUrl', () => {
    it('should construct correct web fallback URL', () => {
      const url = buildVenmoWebUrl('john-doe');
      expect(url).toBe('https://venmo.com/john-doe');
    });
  });

  describe('buildMealNote', () => {
    it('should format meal note correctly', () => {
      expect(buildMealNote('Olive Garden')).toBe('Dine: Dinner at Olive Garden');
    });

    it('should handle restaurant names with special characters', () => {
      expect(buildMealNote("Joe's Crab Shack")).toBe("Dine: Dinner at Joe's Crab Shack");
    });
  });

  describe('getVenmoableBreakdowns', () => {
    it('should filter to only friends with Venmo usernames and positive totals', () => {
      const breakdowns: PersonBreakdown[] = [
        makeBreakdown(makeFriend('a', 'Alice', 'alice-v'), 25.00),
        makeBreakdown(makeFriend('b', 'Bob'), 15.00), // no venmo
        makeBreakdown(makeFriend('c', 'Charlie', 'charlie-v'), 30.00),
      ];

      const result = getVenmoableBreakdowns(breakdowns);
      expect(result).toHaveLength(2);
      expect(result[0].friend.display_name).toBe('Alice');
      expect(result[1].friend.display_name).toBe('Charlie');
    });

    it('should exclude friends with zero total even if they have Venmo', () => {
      const breakdowns: PersonBreakdown[] = [
        makeBreakdown(makeFriend('a', 'Alice', 'alice-v'), 0),
        makeBreakdown(makeFriend('b', 'Bob', 'bob-v'), 25.00),
      ];

      const result = getVenmoableBreakdowns(breakdowns);
      expect(result).toHaveLength(1);
      expect(result[0].friend.display_name).toBe('Bob');
    });

    it('should return empty array when no friends have Venmo', () => {
      const breakdowns: PersonBreakdown[] = [
        makeBreakdown(makeFriend('a', 'Alice'), 25.00),
        makeBreakdown(makeFriend('b', 'Bob'), 15.00),
      ];

      const result = getVenmoableBreakdowns(breakdowns);
      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty input', () => {
      expect(getVenmoableBreakdowns([])).toHaveLength(0);
    });
  });
});
