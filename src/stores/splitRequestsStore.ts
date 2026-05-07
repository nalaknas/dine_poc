import { create } from 'zustand';
import {
  fetchSenderSplits,
  fetchSenderSplitById,
  type SenderSplit,
  type SenderSplitLine,
} from '../services/sender-split-service';

interface SplitRequestsState {
  splits: SenderSplit[];
  isLoading: boolean;
  error: string | null;
  refresh: (userId: string) => Promise<void>;
  /** Refetch a single split by id and merge it back into the list. */
  refreshSplit: (splitId: string) => Promise<void>;
  /** Optimistic local mutation — used by overflow-menu actions. */
  patchLine: (splitId: string, lineId: string, updates: Partial<SenderSplitLine>) => void;
  /** Mark every line in a split as cancelled (mirrors the cancel action). */
  cancelSplitLocal: (splitId: string) => void;
  reset: () => void;
}

export const useSplitRequestsStore = create<SplitRequestsState>((set, get) => ({
  splits: [],
  isLoading: false,
  error: null,

  refresh: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const splits = await fetchSenderSplits(userId);
      set({ splits, isLoading: false });
    } catch (err: any) {
      set({ error: err?.message ?? 'Could not load splits', isLoading: false });
    }
  },

  refreshSplit: async (splitId) => {
    try {
      const fresh = await fetchSenderSplitById(splitId);
      if (!fresh) return;
      set({
        splits: get().splits.map((s) => (s.id === splitId ? fresh : s)),
      });
    } catch (err) {
      // Silent — caller surfaces the error via the action that triggered it.
      console.warn('[splitRequests] refreshSplit failed', err);
    }
  },

  patchLine: (splitId, lineId, updates) => {
    set({
      splits: get().splits.map((s) =>
        s.id !== splitId
          ? s
          : { ...s, lines: s.lines.map((l) => (l.id === lineId ? { ...l, ...updates } : l)) },
      ),
    });
  },

  cancelSplitLocal: (splitId) => {
    set({
      splits: get().splits.map((s) =>
        s.id !== splitId
          ? s
          : { ...s, lines: s.lines.map((l) => ({ ...l, status: 'cancelled' as const })) },
      ),
    });
  },

  reset: () => set({ splits: [], isLoading: false, error: null }),
}));
