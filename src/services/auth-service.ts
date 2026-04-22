import { supabase } from '../lib/supabase';
import type { User } from '../types';
import type { Session } from '@supabase/supabase-js';

/**
 * Sign in with an Apple ID token (from expo-apple-authentication).
 */
export async function signInWithAppleToken(identityToken: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
  });
  if (error) throw error;
  return data.session;
}

/**
 * Sign in with a Google ID token (from expo-auth-session).
 */
export async function signInWithGoogleToken(idToken: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  return data.session;
}

export interface GetOrCreateResult {
  profile: User;
  /**
   * True if this call created a brand-new row (i.e. the user has never
   * logged in before). Callers can use this to differentiate sign-up from
   * sign-in when the underlying auth call can't (e.g. Apple ID token).
   */
  wasCreated: boolean;
}

export async function getOrCreateUserProfile(
  uid: string,
  email: string,
): Promise<GetOrCreateResult> {
  // Try to get existing profile
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('id', uid)
    .single();

  if (existing) return { profile: existing as User, wasCreated: false };

  // Create new profile
  const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') + Math.floor(Math.random() * 1000);
  const { data: created, error: createError } = await supabase
    .from('users')
    .insert({
      id: uid,
      email,
      username,
      display_name: email.split('@')[0],
      total_meals: 0,
      restaurants_visited: 0,
      cities_explored: 0,
      cuisine_preferences: [],
      dietary_restrictions: [],
    })
    .select()
    .single();

  if (createError) {
    // Race: a concurrent caller (AuthScreen's post-auth handler +
    // RootNavigator's profile effect both fire on auth state change) or a
    // server-side trigger already inserted the row between our SELECT and
    // INSERT. Re-fetch and return theirs instead of bubbling a duplicate-
    // key error to the UI. `23505` = Postgres unique_violation.
    if ((createError as { code?: string }).code === '23505') {
      const { data: reread } = await supabase
        .from('users')
        .select('*')
        .eq('id', uid)
        .single();
      if (reread) return { profile: reread as User, wasCreated: false };
    }
    throw createError;
  }
  return { profile: created as User, wasCreated: true };
}

export async function updateUserProfile(uid: string, updates: Partial<User>): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', uid)
    .select()
    .single();

  if (error) throw error;
  return data as User;
}

export async function getUserById(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data as User;
}
