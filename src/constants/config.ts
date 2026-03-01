import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export const Config = {
  supabase: {
    url: (extra.supabaseUrl as string) ?? '',
    anonKey: (extra.supabaseAnonKey as string) ?? '',
  },
  google: {
    placesApiKey: (extra.googlePlacesApiKey as string) ?? '',
    oauthClientId: (extra.googleOAuthClientId as string) ?? '',
  },
  yelp: {
    apiKey: (extra.yelpApiKey as string) ?? '',
  },
} as const;
