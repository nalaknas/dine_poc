import { useBillSplitterStore } from '../stores/billSplitterStore';
import type { ReceiptData, Friend } from '../types';

// Helper to reset the store before each test
const resetStore = () => useBillSplitterStore.setState({
  currentReceipt: null,
  selectedFriends: [],
  savedFriends: [],
  isFamilyStyle: false,
  itemAssignments: {},
  personBreakdowns: [],
});

// Test helpers
const makeFriend = (id: string, name: string, venmo?: string): Friend => ({
  id,
  display_name: name,
  username: name.toLowerCase(),
  is_app_user: true,
  venmo_username: venmo,
});

const makeReceipt = (overrides?: Partial<ReceiptData>): ReceiptData => ({
  restaurantName: 'Test Restaurant',
  date: '2026-01-15',
  time: '7:30 PM',
  address: '123 Main St',
  city: 'New York',
  state: 'NY',
  items: [
    { id: 'item_1', name: 'Burger', price: 15.00 },
    { id: 'item_2', name: 'Salad', price: 12.00 },
    { id: 'item_3', name: 'Pasta', price: 18.00 },
  ],
  subtotal: 45.00,
  tax: 4.00,
  tip: 9.00,
  discount: 0,
  total: 58.00,
  ...overrides,
});

describe('BillSplitterStore', () => {
  beforeEach(() => resetStore());

  describe('Receipt management', () => {
    it('should set and clear receipt', () => {
      const store = useBillSplitterStore.getState();
      const receipt = makeReceipt();

      store.setReceipt(receipt);
      expect(useBillSplitterStore.getState().currentReceipt).toEqual(receipt);

      store.setReceipt(null);
      expect(useBillSplitterStore.getState().currentReceipt).toBeNull();
    });

    it('should update a receipt item name', () => {
      const store = useBillSplitterStore.getState();
      store.setReceipt(makeReceipt());

      store.updateReceiptItem('item_1', { name: 'Cheeseburger' });
      const updated = useBillSplitterStore.getState().currentReceipt!;
      expect(updated.items[0].name).toBe('Cheeseburger');
      expect(updated.items[0].price).toBe(15.00); // unchanged
    });

    it('should update a receipt item price', () => {
      const store = useBillSplitterStore.getState();
      store.setReceipt(makeReceipt());

      store.updateReceiptItem('item_2', { price: 14.50 });
      const updated = useBillSplitterStore.getState().currentReceipt!;
      expect(updated.items[1].price).toBe(14.50);
      expect(updated.items[1].name).toBe('Salad'); // unchanged
    });

    it('should update receipt fields', () => {
      const store = useBillSplitterStore.getState();
      store.setReceipt(makeReceipt());

      store.updateReceiptField('restaurantName', 'New Name');
      store.updateReceiptField('tax', 5.50);
      const updated = useBillSplitterStore.getState().currentReceipt!;
      expect(updated.restaurantName).toBe('New Name');
      expect(updated.tax).toBe(5.50);
    });
  });

  describe('Friend management', () => {
    it('should add and remove friends', () => {
      const store = useBillSplitterStore.getState();
      const alice = makeFriend('a', 'Alice');
      const bob = makeFriend('b', 'Bob');

      store.addSelectedFriend(alice);
      store.addSelectedFriend(bob);
      expect(useBillSplitterStore.getState().selectedFriends).toHaveLength(2);

      store.removeSelectedFriend('a');
      expect(useBillSplitterStore.getState().selectedFriends).toHaveLength(1);
      expect(useBillSplitterStore.getState().selectedFriends[0].id).toBe('b');
    });

    it('should set friends in bulk', () => {
      const store = useBillSplitterStore.getState();
      const friends = [makeFriend('a', 'Alice'), makeFriend('b', 'Bob')];
      store.setSelectedFriends(friends);
      expect(useBillSplitterStore.getState().selectedFriends).toHaveLength(2);
    });
  });

  describe('Item assignment', () => {
    it('should assign and unassign items to friends', () => {
      const store = useBillSplitterStore.getState();
      store.assignItem('item_1', 'friend_a');
      store.assignItem('item_1', 'friend_b');
      expect(useBillSplitterStore.getState().itemAssignments['item_1']).toEqual(['friend_a', 'friend_b']);

      store.unassignItem('item_1', 'friend_a');
      expect(useBillSplitterStore.getState().itemAssignments['item_1']).toEqual(['friend_b']);
    });

    it('should not duplicate assignments', () => {
      const store = useBillSplitterStore.getState();
      store.assignItem('item_1', 'friend_a');
      store.assignItem('item_1', 'friend_a'); // duplicate
      expect(useBillSplitterStore.getState().itemAssignments['item_1']).toEqual(['friend_a']);
    });
  });

  describe('calculateBreakdowns — Family Style', () => {
    it('should split all items equally among all friends', () => {
      const store = useBillSplitterStore.getState();
      const friends = [makeFriend('a', 'Alice'), makeFriend('b', 'Bob'), makeFriend('c', 'Charlie')];
      store.setReceipt(makeReceipt());
      store.setSelectedFriends(friends);
      store.setFamilyStyle(true);

      const breakdowns = store.calculateBreakdowns();

      expect(breakdowns).toHaveLength(3);

      // Each person gets 1/3 of each item
      // Burger: 15/3 = 5, Salad: 12/3 = 4, Pasta: 18/3 = 6 → itemsTotal = 15
      for (const breakdown of breakdowns) {
        expect(breakdown.items).toHaveLength(3); // all items
        expect(breakdown.itemsTotal).toBeCloseTo(15.00, 2);
        // proportion = 15/45 = 1/3
        expect(breakdown.taxShare).toBeCloseTo(4.00 / 3, 2);
        expect(breakdown.tipShare).toBeCloseTo(9.00 / 3, 2);
        expect(breakdown.total).toBeCloseTo(15.00 + 4.00 / 3 + 9.00 / 3, 2);
      }
    });

    it('should split evenly with 2 friends', () => {
      const store = useBillSplitterStore.getState();
      const friends = [makeFriend('a', 'Alice'), makeFriend('b', 'Bob')];
      store.setReceipt(makeReceipt());
      store.setSelectedFriends(friends);
      store.setFamilyStyle(true);

      const breakdowns = store.calculateBreakdowns();

      expect(breakdowns).toHaveLength(2);
      for (const breakdown of breakdowns) {
        expect(breakdown.itemsTotal).toBeCloseTo(22.50, 2);
        expect(breakdown.taxShare).toBeCloseTo(2.00, 2);
        expect(breakdown.tipShare).toBeCloseTo(4.50, 2);
        expect(breakdown.total).toBeCloseTo(29.00, 2);
      }
    });

    it('total of all breakdowns should equal the bill total minus discount', () => {
      const store = useBillSplitterStore.getState();
      const friends = [makeFriend('a', 'Alice'), makeFriend('b', 'Bob'), makeFriend('c', 'Charlie')];
      store.setReceipt(makeReceipt());
      store.setSelectedFriends(friends);
      store.setFamilyStyle(true);

      const breakdowns = store.calculateBreakdowns();
      const totalSplit = breakdowns.reduce((sum, b) => sum + b.total, 0);

      // subtotal(45) + tax(4) + tip(9) = 58
      expect(totalSplit).toBeCloseTo(58.00, 2);
    });
  });

  describe('calculateBreakdowns — Per-Item Assignment', () => {
    it('should correctly split when items assigned to different friends', () => {
      const store = useBillSplitterStore.getState();
      const alice = makeFriend('a', 'Alice');
      const bob = makeFriend('b', 'Bob');
      store.setReceipt(makeReceipt());
      store.setSelectedFriends([alice, bob]);
      store.setFamilyStyle(false);

      // Alice gets Burger (15), Bob gets Salad (12) and Pasta (18)
      store.assignItem('item_1', 'a');
      store.assignItem('item_2', 'b');
      store.assignItem('item_3', 'b');

      const breakdowns = store.calculateBreakdowns();

      const aliceBreakdown = breakdowns.find((b) => b.friend.id === 'a')!;
      const bobBreakdown = breakdowns.find((b) => b.friend.id === 'b')!;

      // Alice: items = 15, proportion = 15/45 = 1/3
      expect(aliceBreakdown.itemsTotal).toBeCloseTo(15.00, 2);
      expect(aliceBreakdown.taxShare).toBeCloseTo(4.00 * (15 / 45), 2);
      expect(aliceBreakdown.tipShare).toBeCloseTo(9.00 * (15 / 45), 2);

      // Bob: items = 30, proportion = 30/45 = 2/3
      expect(bobBreakdown.itemsTotal).toBeCloseTo(30.00, 2);
      expect(bobBreakdown.taxShare).toBeCloseTo(4.00 * (30 / 45), 2);
      expect(bobBreakdown.tipShare).toBeCloseTo(9.00 * (30 / 45), 2);
    });

    it('should correctly split shared items between multiple friends', () => {
      const store = useBillSplitterStore.getState();
      const alice = makeFriend('a', 'Alice');
      const bob = makeFriend('b', 'Bob');
      store.setReceipt(makeReceipt({ items: [{ id: 'item_1', name: 'Pizza', price: 20.00 }], subtotal: 20.00, total: 20.00, tax: 0, tip: 0 }));
      store.setSelectedFriends([alice, bob]);
      store.setFamilyStyle(false);

      // Both share the pizza
      store.assignItem('item_1', 'a');
      store.assignItem('item_1', 'b');

      const breakdowns = store.calculateBreakdowns();

      expect(breakdowns[0].itemsTotal).toBeCloseTo(10.00, 2);
      expect(breakdowns[1].itemsTotal).toBeCloseTo(10.00, 2);
    });

    it('should handle unassigned items gracefully', () => {
      const store = useBillSplitterStore.getState();
      const alice = makeFriend('a', 'Alice');
      store.setReceipt(makeReceipt());
      store.setSelectedFriends([alice]);
      store.setFamilyStyle(false);

      // Only assign item_1, leave item_2 and item_3 unassigned
      store.assignItem('item_1', 'a');

      const breakdowns = store.calculateBreakdowns();
      const aliceBreakdown = breakdowns.find((b) => b.friend.id === 'a')!;

      // Alice only has the Burger (15)
      expect(aliceBreakdown.itemsTotal).toBeCloseTo(15.00, 2);
      expect(aliceBreakdown.items).toHaveLength(1);
    });

    it('total of per-item breakdowns should equal bill when all items assigned', () => {
      const store = useBillSplitterStore.getState();
      const alice = makeFriend('a', 'Alice');
      const bob = makeFriend('b', 'Bob');
      store.setReceipt(makeReceipt());
      store.setSelectedFriends([alice, bob]);
      store.setFamilyStyle(false);

      // Assign all items
      store.assignItem('item_1', 'a');
      store.assignItem('item_2', 'b');
      store.assignItem('item_3', 'a');
      store.assignItem('item_3', 'b'); // shared

      const breakdowns = store.calculateBreakdowns();
      const totalSplit = breakdowns.reduce((sum, b) => sum + b.total, 0);

      // subtotal(45) + tax(4) + tip(9) = 58
      expect(totalSplit).toBeCloseTo(58.00, 2);
    });
  });

  describe('Edge cases', () => {
    it('should return empty breakdowns when no friends', () => {
      const store = useBillSplitterStore.getState();
      store.setReceipt(makeReceipt());
      store.setSelectedFriends([]);

      const breakdowns = store.calculateBreakdowns();
      expect(breakdowns).toHaveLength(0);
    });

    it('should return empty breakdowns when no receipt', () => {
      const store = useBillSplitterStore.getState();
      store.setSelectedFriends([makeFriend('a', 'Alice')]);

      const breakdowns = store.calculateBreakdowns();
      expect(breakdowns).toHaveLength(0);
    });

    it('should handle zero subtotal without division by zero', () => {
      const store = useBillSplitterStore.getState();
      store.setReceipt(makeReceipt({
        items: [{ id: 'item_1', name: 'Free item', price: 0 }],
        subtotal: 0,
        tax: 2.00,
        tip: 3.00,
        total: 5.00,
      }));
      store.setSelectedFriends([makeFriend('a', 'Alice'), makeFriend('b', 'Bob')]);
      store.setFamilyStyle(true);

      // Should not throw
      const breakdowns = store.calculateBreakdowns();
      expect(breakdowns).toHaveLength(2);
      // With zero subtotal, proportion falls back to 1/friends.length
      for (const b of breakdowns) {
        expect(b.taxShare).toBeCloseTo(1.00, 2);
        expect(b.tipShare).toBeCloseTo(1.50, 2);
        expect(isFinite(b.total)).toBe(true);
      }
    });

    it('should handle receipt with discount', () => {
      const store = useBillSplitterStore.getState();
      store.setReceipt(makeReceipt({
        subtotal: 50.00,
        tax: 5.00,
        tip: 10.00,
        discount: 10.00,
        total: 55.00,
      }));
      store.setSelectedFriends([makeFriend('a', 'Alice')]);
      store.setFamilyStyle(true);

      const breakdowns = store.calculateBreakdowns();
      // Discount doesn't factor into calcBreakdowns — only used in total display
      // proportion = itemsTotal(45) / subtotal(50) = 0.9
      expect(breakdowns[0].itemsTotal).toBeCloseTo(45.00, 2);
      expect(breakdowns[0].taxShare).toBeCloseTo(5.00 * 0.9, 2); // 4.50
      expect(breakdowns[0].tipShare).toBeCloseTo(10.00 * 0.9, 2); // 9.00
    });

    it('should handle single friend getting everything', () => {
      const store = useBillSplitterStore.getState();
      store.setReceipt(makeReceipt());
      store.setSelectedFriends([makeFriend('a', 'Alice')]);
      store.setFamilyStyle(true);

      const breakdowns = store.calculateBreakdowns();
      expect(breakdowns).toHaveLength(1);
      expect(breakdowns[0].itemsTotal).toBeCloseTo(45.00, 2);
      expect(breakdowns[0].taxShare).toBeCloseTo(4.00, 2);
      expect(breakdowns[0].tipShare).toBeCloseTo(9.00, 2);
      expect(breakdowns[0].total).toBeCloseTo(58.00, 2);
    });
  });

  describe('Store reset', () => {
    it('should reset all state', () => {
      const store = useBillSplitterStore.getState();
      store.setReceipt(makeReceipt());
      store.setSelectedFriends([makeFriend('a', 'Alice')]);
      store.setFamilyStyle(true);
      store.assignItem('item_1', 'a');

      store.reset();

      const state = useBillSplitterStore.getState();
      expect(state.currentReceipt).toBeNull();
      expect(state.selectedFriends).toHaveLength(0);
      expect(state.isFamilyStyle).toBe(false);
      expect(state.itemAssignments).toEqual({});
      expect(state.personBreakdowns).toHaveLength(0);
    });
  });
});
