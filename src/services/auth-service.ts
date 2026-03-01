import { supabase } from '../lib/supabase';
import type { User } from '../types';

export async function getOrCreateUserProfile(uid: string, email: string): Promise<User> {
  // Try to get existing profile
  const { data: existing, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('id', uid)
    .single();

  if (existing) return existing as User;

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

  if (createError) throw createError;
  return created as User;
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
