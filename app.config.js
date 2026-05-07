require('dotenv').config();

const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = {
  expo: {
    name: IS_DEV ? 'Dine (Dev)' : 'Dine',
    slug: 'dine',
    version: '1.0.2',
    scheme: 'dine',
    orientation: 'portrait',
    icon: IS_DEV ? './assets/icon.png' : './assets/icon-gold.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash-logo.png',
      resizeMode: 'contain',
      backgroundColor: '#000000',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: IS_DEV ? 'com.nalaknas.dine.dev' : 'com.nalaknas.dine',
      usesAppleSignIn: true,
      associatedDomains: ['applinks:joindine.app'],
      infoPlist: {
        NSCameraUsageDescription: 'Dine needs camera access to scan receipts and take food photos.',
        NSPhotoLibraryUsageDescription: 'Dine needs photo library access to upload food photos.',
        NSContactsUsageDescription: 'Dine uses your contacts to help you find friends already on Dine.',
        NSUserTrackingUsageDescription: 'We use this to personalize your dining recommendations.',
        LSApplicationQueriesSchemes: ['venmo'],
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    updates: {
      url: 'https://u.expo.dev/a11c2f5e-73df-446c-b361-cc1f36bf4cdf',
    },
    runtimeVersion: '1.0.0',
    plugins: [
      'expo-apple-authentication',
      'expo-updates',
      'expo-camera',
      'expo-media-library',
      [
        'expo-image-picker',
        {
          photosPermission: 'Dine needs photo library access to upload food photos.',
          cameraPermission: 'Dine needs camera access to scan receipts.',
        },
      ],
      'expo-secure-store',
      [
        'expo-contacts',
        {
          contactsPermission: 'Dine uses your contacts to help you find and tag friends you dine with.',
        },
      ],
      [
        'expo-notifications',
        {
          icon: IS_DEV ? './assets/icon.png' : './assets/icon-gold.png',
          color: '#007AFF',
        },
      ],
      'expo-font',
      'expo-web-browser',
    ],
    extra: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY,
      yelpApiKey: process.env.YELP_API_KEY,
      googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      googleIosOAuthClientId: process.env.GOOGLE_IOS_OAUTH_CLIENT_ID,
      mixpanelToken: process.env.MIXPANEL_TOKEN,
      eas: {
        projectId: process.env.EAS_PROJECT_ID || 'a11c2f5e-73df-446c-b361-cc1f36bf4cdf',
      },
    },
  },
};
