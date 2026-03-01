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
        // Light mode
        background: '#FFFFFF',
        'background-secondary': '#F9FAFB',
        'text-primary': '#1F2937',
        'text-secondary': '#6B7280',
        border: '#E5E7EB',
        'border-light': '#F3F4F6',
        // Dark mode
        'dark-background': '#111827',
        'dark-background-secondary': '#1F2937',
        'dark-text-primary': '#FFFFFF',
        'dark-text-secondary': '#9CA3AF',
        'dark-border': '#374151',
        // Brand
        accent: '#007AFF',
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        gold: '#F59E0B',
      },
      fontFamily: {
        sans: ['System'],
      },
      fontSize: {
        xs: ['10px', { lineHeight: '14px' }],
        sm: ['12px', { lineHeight: '16px' }],
        base: ['14px', { lineHeight: '20px' }],
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
