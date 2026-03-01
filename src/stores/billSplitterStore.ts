import { create } from 'zustand';
import type { ReceiptData, Friend, PersonBreakdown } from '../types';

interface BillSplitterState {
  currentReceipt: ReceiptData | null;
  selectedFriends: Friend[];
  savedFriends: Friend[];
  isFamilyStyle: boolean;
  itemAssignments: Record<string, string[]>; // itemId -> friendIds
  personBreakdowns: PersonBreakdown[];
  // Receipt
  setReceipt: (receipt: ReceiptData | null) => void;
  updateReceiptItem: (itemId: string, updates: { name?: string; price?: number }) => void;
  updateReceiptField: (field: keyof Omit<ReceiptData, 'items'>, value: string | number) => void;
  // Friends
  setSelectedFriends: (friends: Friend[]) => void;
  addSelectedFriend: (friend: Friend) => void;
  removeSelectedFriend: (friendId: string) => void;
  setSavedFriends: (friends: Friend[]) => void;
  // Assignment
  setFamilyStyle: (value: boolean) => void;
  assignItem: (itemId: string, friendId: string) => void;
  unassignItem: (itemId: string, friendId: string) => void;
  setItemAssignment: (itemId: string, friendIds: string[]) => void;
  // Calculations
  calculateBreakdowns: () => PersonBreakdown[];
  setBreakdowns: (breakdowns: PersonBreakdown[]) => void;
  reset: () => void;
}

function calcBreakdowns(
  receipt: ReceiptData,
  friends: Friend[],
  assignments: Record<string, string[]>,
  familyStyle: boolean
): PersonBreakdown[] {
  if (!receipt || friends.length === 0) return [];

  return friends.map((friend) => {
    const myItems = receipt.items
      .filter((item) => {
        if (familyStyle) return true;
        return assignments[item.id]?.includes(friend.id);
      })
      .map((item) => {
        const assignedCount = familyStyle
          ? friends.length
          : (assignments[item.id]?.length ?? 1);
        const share = item.price / assignedCount;
        return { name: item.name, price: item.price, share };
      });

    const itemsTotal = myItems.reduce((sum, i) => sum + i.share, 0);
    const proportion = receipt.subtotal > 0 ? itemsTotal / receipt.subtotal : 1 / friends.length;
    const taxShare = receipt.tax * proportion;
    const tipShare = receipt.tip * proportion;

    return {
      friend,
      items: myItems,
      itemsTotal,
      taxShare,
      tipShare,
      total: itemsTotal + taxShare + tipShare,
    };
  });
}

export const useBillSplitterStore = create<BillSplitterState>((set, get) => ({
  currentReceipt: null,
  selectedFriends: [],
  savedFriends: [],
  isFamilyStyle: false,
  itemAssignments: {},
  personBreakdowns: [],

  setReceipt: (receipt) => set({ currentReceipt: receipt }),

  updateReceiptItem: (itemId, updates) =>
    set((state) => ({
      currentReceipt: state.currentReceipt
        ? {
            ...state.currentReceipt,
            items: state.currentReceipt.items.map((i) =>
              i.id === itemId ? { ...i, ...updates } : i
            ),
          }
        : null,
    })),

  updateReceiptField: (field, value) =>
    set((state) => ({
      currentReceipt: state.currentReceipt
        ? { ...state.currentReceipt, [field]: value }
        : null,
    })),

  setSelectedFriends: (friends) => set({ selectedFriends: friends }),
  addSelectedFriend: (friend) =>
    set((state) => ({ selectedFriends: [...state.selectedFriends, friend] })),
  removeSelectedFriend: (friendId) =>
    set((state) => ({
      selectedFriends: state.selectedFriends.filter((f) => f.id !== friendId),
    })),
  setSavedFriends: (friends) => set({ savedFriends: friends }),

  setFamilyStyle: (isFamilyStyle) => set({ isFamilyStyle }),

  assignItem: (itemId, friendId) =>
    set((state) => {
      const current = state.itemAssignments[itemId] ?? [];
      if (current.includes(friendId)) return state;
      return { itemAssignments: { ...state.itemAssignments, [itemId]: [...current, friendId] } };
    }),

  unassignItem: (itemId, friendId) =>
    set((state) => ({
      itemAssignments: {
        ...state.itemAssignments,
        [itemId]: (state.itemAssignments[itemId] ?? []).filter((id) => id !== friendId),
      },
    })),

  setItemAssignment: (itemId, friendIds) =>
    set((state) => ({
      itemAssignments: { ...state.itemAssignments, [itemId]: friendIds },
    })),

  calculateBreakdowns: () => {
    const { currentReceipt, selectedFriends, itemAssignments, isFamilyStyle } = get();
    if (!currentReceipt) return [];
    const breakdowns = calcBreakdowns(
      currentReceipt,
      selectedFriends,
      itemAssignments,
      isFamilyStyle
    );
    set({ personBreakdowns: breakdowns });
    return breakdowns;
  },

  setBreakdowns: (personBreakdowns) => set({ personBreakdowns }),

  reset: () =>
    set({
      currentReceipt: null,
      selectedFriends: [],
      isFamilyStyle: false,
      itemAssignments: {},
      personBreakdowns: [],
    }),
}));
