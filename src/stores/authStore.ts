import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerForPushNotifications, unregisterPushToken } from '../lib/pushNotifications';
import { useSettingsStore } from './settingsStore';
import type { AuthUser } from '../types';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isInitialized: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithIdToken: (provider: 'apple' | 'google', token: string, nonce?: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isInitialized: false,

  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      set({
        user: {
          id: session.user.id,
          email: session.user.email ?? '',
          accessToken: session.access_token,
        },
      });
    }
    set({ isInitialized: true });

    // Register push token if user is already signed in
    if (session) {
      registerForPushNotifications().catch(() => {});
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        set({
          user: {
            id: session.user.id,
            email: session.user.email ?? '',
            accessToken: session.access_token,
          },
        });
        // Register push token on sign in
        registerForPushNotifications().catch(() => {});
      } else {
        set({ user: null });
      }
    });
  },

  signUp: async (email, password) => {
    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  signInWithIdToken: async (provider, token, nonce) => {
    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.signInWithIdToken({ provider, token, nonce });
      if (error) throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      await unregisterPushToken();
      await supabase.auth.signOut();
      set({ user: null });
      // `hasCompletedOnboarding` is device-level, not per-user — reset it on
      // sign-out so the next account to sign in on this device actually sees
      // the onboarding flow. Proper per-user tracking would live server-side
      // on the users table; this is the pragmatic single-device fix.
      useSettingsStore.getState().setHasCompletedOnboarding(false);
    } finally {
      set({ isLoading: false });
    }
  },
}));
