require('dotenv').config();

module.exports = {
  expo: {
    name: 'Dine',
    slug: 'dine',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon-gold.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash-logo.png',
      resizeMode: 'contain',
      backgroundColor: '#000000',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.nalaknas.dine',
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
    runtimeVersion: {
      policy: 'appVersion',
    },
    plugins: [
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
    ],
    extra: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY,
      yelpApiKey: process.env.YELP_API_KEY,
      googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      eas: {
        projectId: process.env.EAS_PROJECT_ID || 'a11c2f5e-73df-446c-b361-cc1f36bf4cdf',
      },
    },
  },
};
