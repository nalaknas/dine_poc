import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemePreference = 'light' | 'dark' | 'system';
type SplitMethod = 'equal' | 'proportional';

interface SettingsState {
  themePreference: ThemePreference;
  taxSplitMethod: SplitMethod;
  tipSplitMethod: SplitMethod;
  defaultTipPercentage: number;
  hasCompletedOnboarding: boolean;
  setThemePreference: (pref: ThemePreference) => void;
  setTaxSplitMethod: (method: SplitMethod) => void;
  setTipSplitMethod: (method: SplitMethod) => void;
  setDefaultTipPercentage: (pct: number) => void;
  setHasCompletedOnboarding: (value: boolean) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

const SETTINGS_KEY = '@dine:settings';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  themePreference: 'system',
  taxSplitMethod: 'proportional',
  tipSplitMethod: 'proportional',
  defaultTipPercentage: 20,
  hasCompletedOnboarding: false,

  setThemePreference: (themePreference) => {
    set({ themePreference });
    get().saveSettings();
  },
  setTaxSplitMethod: (taxSplitMethod) => {
    set({ taxSplitMethod });
    get().saveSettings();
  },
  setTipSplitMethod: (tipSplitMethod) => {
    set({ tipSplitMethod });
    get().saveSettings();
  },
  setDefaultTipPercentage: (defaultTipPercentage) => {
    set({ defaultTipPercentage });
    get().saveSettings();
  },
  setHasCompletedOnboarding: (hasCompletedOnboarding) => {
    set({ hasCompletedOnboarding });
    get().saveSettings();
  },

  loadSettings: async () => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<SettingsState>;
        set({
          themePreference: saved.themePreference ?? 'system',
          taxSplitMethod: saved.taxSplitMethod ?? 'proportional',
          tipSplitMethod: saved.tipSplitMethod ?? 'proportional',
          defaultTipPercentage: saved.defaultTipPercentage ?? 20,
          hasCompletedOnboarding: saved.hasCompletedOnboarding ?? false,
        });
      }
    } catch {
      // Ignore storage errors
    }
  },

  saveSettings: async () => {
    try {
      const { themePreference, taxSplitMethod, tipSplitMethod, defaultTipPercentage, hasCompletedOnboarding } = get();
      await AsyncStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ themePreference, taxSplitMethod, tipSplitMethod, defaultTipPercentage, hasCompletedOnboarding })
      );
    } catch {
      // Ignore storage errors
    }
  },
}));
