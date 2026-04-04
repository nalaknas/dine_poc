import { supabase } from '../lib/supabase';
import type { Restaurant } from '../types';

/**
 * Get a restaurant by its UUID.
 */
export async function getRestaurantById(id: string): Promise<Restaurant | null> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as Restaurant;
}

/**
 * Find a restaurant by name + city + state (case-insensitive).
 * Returns null if not found.
 */
export async function findRestaurant(
  name: string,
  city?: string | null,
  state?: string | null,
): Promise<Restaurant | null> {
  let query = supabase
    .from('restaurants')
    .select('*')
    .ilike('name', name);

  if (city) {
    query = query.ilike('city', city);
  } else {
    query = query.is('city', null);
  }

  if (state) {
    query = query.ilike('state', state);
  } else {
    query = query.is('state', null);
  }

  const { data } = await query.limit(1).maybeSingle();
  return data as Restaurant | null;
}

/**
 * Search restaurants by name using trigram similarity.
 */
export async function searchRestaurants(
  query: string,
  limit = 10,
): Promise<Restaurant[]> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('post_count', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Restaurant[];
}

/**
 * Find an existing restaurant or create a new one.
 * Used during post creation to ensure every post has a restaurant_id.
 */
export async function findOrCreateRestaurant(
  name: string,
  city?: string | null,
  state?: string | null,
  extra?: {
    address?: string;
    cuisine_type?: string;
    google_place_id?: string;
  },
): Promise<string> {
  // Try to find existing
  const existing = await findRestaurant(name, city, state);
  if (existing) return existing.id;

  // Create new restaurant record
  const { data, error } = await supabase
    .from('restaurants')
    .insert({
      name,
      city: city ?? null,
      state: state ?? null,
      address: extra?.address,
      cuisine_type: extra?.cuisine_type,
      google_place_id: extra?.google_place_id,
    })
    .select('id')
    .single();

  if (error) {
    // Handle race condition: another request may have created it
    if (error.code === '23505') {
      const retry = await findRestaurant(name, city, state);
      if (retry) return retry.id;
    }
    throw error;
  }

  return data.id as string;
}

/**
 * Get restaurants near a location (requires PostGIS geography column).
 */
export async function getNearbyRestaurants(
  lat: number,
  lng: number,
  radiusMeters = 2000,
  limit = 20,
): Promise<Restaurant[]> {
  const { data, error } = await supabase.rpc('get_nearby_restaurants', {
    p_lat: lat,
    p_lng: lng,
    p_radius: radiusMeters,
    p_limit: limit,
  });

  if (error) throw error;
  return (data ?? []) as Restaurant[];
}
