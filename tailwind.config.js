/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // ─── Legacy tokens — do NOT remove (consumed across the codebase) ──
        background: '#FFFFFF',
        'background-secondary': '#F9FAFB',
        'text-primary': '#1F2937',
        'text-secondary': '#6B7280',
        border: '#E5E7EB',
        'border-light': '#F3F4F6',
        'dark-background': '#111827',
        'dark-background-secondary': '#1F2937',
        'dark-text-primary': '#FFFFFF',
        'dark-text-secondary': '#9CA3AF',
        'dark-border': '#374151',
        accent: '#007AFF',
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        /** Legacy amber. New editorial work → `gold-400`. */
        gold: '#F59E0B',

        // ─── Editorial palette (new) ──────────────────────────────────────
        // Brand yellow — signature scale
        'gold-50': '#FFF7E0',
        'gold-100': '#FCEBB0',
        'gold-200': '#FADB78',
        'gold-300': '#F9C849',
        'gold-400': '#F7B52E',
        'gold-500': '#DB9C1F',
        'gold-600': '#B07C15',
        'gold-700': '#83590E',
        'gold-800': '#553A09',

        // Onyx — warm off-black
        'onyx-500': '#3A3A3A',
        'onyx-600': '#262626',
        'onyx-700': '#1C1C1C',
        'onyx-800': '#141414',
        'onyx-900': '#0A0A0A',
        onyx: '#0A0A0A',

        // Warm neutrals
        'neutral-0': '#FFFFFF',
        'neutral-25': '#FCFCFB',
        'neutral-50': '#F8F7F5',
        'neutral-100': '#F0EFEC',
        'neutral-200': '#E4E2DE',
        'neutral-300': '#C9C6C1',
        'neutral-400': '#9B9791',
        'neutral-500': '#6E6A63',
        'neutral-600': '#4A4640',
        'neutral-700': '#2C2A26',
        'neutral-800': '#1A1815',

        /** The working-surface cream (feed / profile / discover bg). */
        cream: '#FAF8F4',

        // Functional accent
        'accent-50': '#EFF6FF',
        'accent-100': '#DBEAFE',
        'accent-500': '#007AFF',
        'accent-600': '#0062CC',
        'accent-700': '#0050A6',
        'indigo-500': '#5856D6',
        'indigo-linear': '#5E6AD2',

        // Tier system (consumer earns, restaurant sees)
        'tier-rock': '#9CA3AF',
        'tier-bronze': '#CD7F32',
        'tier-silver': '#C0C0C0',
        'tier-gold': '#FFD700',
        'tier-platinum': '#E5E4E2',
        'tier-black': '#1A1A1A',
      },
      borderRadius: {
        // Signature scale — matches src/constants/radii.ts
        xs: '4px',
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
        pill: '999px',
      },
      fontFamily: {
        // Fallback to System until ENG-124 loads the Google Fonts.
        // Named to match @expo-google-fonts/* import naming so ENG-124 is a
        // config-only swap.
        sans: ['Inter_400Regular', 'System'],
        'sans-medium': ['Inter_500Medium', 'System'],
        'sans-semibold': ['Inter_600SemiBold', 'System'],
        'sans-bold': ['Inter_700Bold', 'System'],
        display: ['Manrope_800ExtraBold', 'System'],
        'display-semibold': ['Manrope_600SemiBold', 'System'],
        'display-bold': ['Manrope_700Bold', 'System'],
        serif: ['Fraunces_400Regular', 'Georgia', 'serif'],
        'serif-medium': ['Fraunces_500Medium', 'Georgia', 'serif'],
        mono: ['JetBrainsMono_500Medium', 'Menlo', 'monospace'],
        'mono-semibold': ['JetBrainsMono_600SemiBold', 'Menlo', 'monospace'],
      },
      fontSize: {
        xs: ['10px', { lineHeight: '14px' }],
        sm: ['12px', { lineHeight: '16px' }],
        base: ['14px', { lineHeight: '20px' }],
        md: ['16px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '28px' }],
        xl: ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['32px', { lineHeight: '40px' }],
        '4xl': ['40px', { lineHeight: '48px' }],
      },
    },
  },
  plugins: [],
};
