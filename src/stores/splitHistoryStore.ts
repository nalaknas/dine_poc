import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Friend } from '../types';

export interface SplitHistoryEntry {
  /** Stable key: user_id for app users, or generated id for manual friends */
  id: string;
  display_name: string;
  username?: string;
  avatar_url?: string;
  venmo_username?: string;
  user_id?: string;
  is_app_user: boolean;
  /** Number of times you've split a bill with this person */
  split_count: number;
  /** ISO timestamp of most recent split */
  last_split_at: string;
}

interface SplitHistoryState {
  entries: SplitHistoryEntry[];
  loaded: boolean;

  /** Load persisted history from AsyncStorage */
  loadHistory: () => Promise<void>;

  /** Record that a split happened with these friends (call after post creation) */
  recordSplit: (friends: Friend[]) => Promise<void>;

  /** Update a friend's Venmo username in history */
  updateVenmo: (entryId: string, venmoUsername: string) => Promise<void>;

  /** Get top friends sorted by split_count desc */
  getTopFriends: (limit?: number) => SplitHistoryEntry[];
}

const STORAGE_KEY = '@dine:split_history';

export const useSplitHistoryStore = create<SplitHistoryState>((set, get) => ({
  entries: [],
  loaded: false,

  loadHistory: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        set({ entries: JSON.parse(raw) as SplitHistoryEntry[], loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  recordSplit: async (friends: Friend[]) => {
    const { entries } = get();
    const now = new Date().toISOString();
    const updated = [...entries];

    for (const friend of friends) {
      const existing = updated.find((e) =>
        friend.is_app_user && friend.user_id
          ? e.user_id === friend.user_id
          : e.id === friend.id
      );

      if (existing) {
        existing.split_count += 1;
        existing.last_split_at = now;
        // Update display info in case it changed
        existing.display_name = friend.display_name;
        existing.username = friend.username ?? existing.username;
        existing.avatar_url = friend.avatar_url ?? existing.avatar_url;
        // Only update venmo if the friend has one set (don't overwrite with undefined)
        if (friend.venmo_username) {
          existing.venmo_username = friend.venmo_username;
        }
      } else {
        updated.push({
          id: friend.id,
          display_name: friend.display_name,
          username: friend.username,
          avatar_url: friend.avatar_url,
          venmo_username: friend.venmo_username,
          user_id: friend.user_id,
          is_app_user: friend.is_app_user,
          split_count: 1,
          last_split_at: now,
        });
      }
    }

    set({ entries: updated });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  },

  updateVenmo: async (entryId: string, venmoUsername: string) => {
    const { entries } = get();
    const updated = entries.map((e) =>
      e.id === entryId ? { ...e, venmo_username: venmoUsername } : e
    );
    set({ entries: updated });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  },

  getTopFriends: (limit = 10) => {
    return [...get().entries]
      .sort((a, b) => b.split_count - a.split_count)
      .slice(0, limit);
  },
}));
