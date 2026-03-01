import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../constants/config';

// Supabase client — uses anon key client-side; all authorization via RLS
export const supabase = createClient(Config.supabase.url, Config.supabase.anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
