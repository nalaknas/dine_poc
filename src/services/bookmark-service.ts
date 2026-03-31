import { supabase } from '../lib/supabase';
import type { Playlist, PlaylistRestaurant } from '../types';

const DEFAULT_PLAYLIST_NAME = 'Saved';

// In-flight guard to prevent race conditions on concurrent calls
const inflightDefault = new Map<string, Promise<Playlist>>();

// ─── Default Playlist ────────────────────────────────────────────────────────

/** Get or create the user's default "Saved" playlist. Concurrent-safe. */
export async function getOrCreateDefaultPlaylist(userId: string): Promise<Playlist> {
  const inflight = inflightDefault.get(userId);
  if (inflight) return inflight;

  const promise = _getOrCreateDefaultPlaylist(userId);
  inflightDefault.set(userId, promise);
  try {
    return await promise;
  } finally {
    inflightDefault.delete(userId);
  }
}

async function _getOrCreateDefaultPlaylist(userId: string): Promise<Playlist> {
  const { data: existing } = await supabase
    .from('playlists')
    .select('*, restaurants:playlist_restaurants(*)')
    .eq('user_id', userId)
    .eq('name', DEFAULT_PLAYLIST_NAME)
    .limit(1)
    .maybeSingle();

  if (existing) return existing as Playlist;

  const { data: created, error } = await supabase
    .from('playlists')
    .insert({
      user_id: userId,
      name: DEFAULT_PLAYLIST_NAME,
      description: 'Your saved restaurants',
      is_public: false,
    })
    .select('*, restaurants:playlist_restaurants(*)')
    .single();

  if (error) throw error;
  return created as Playlist;
}

// ─── Playlists CRUD ─────────────────────────────────────────────────────────

export async function getUserPlaylists(userId: string): Promise<Playlist[]> {
  const { data, error } = await supabase
    .from('playlists')
    .select('*, restaurants:playlist_restaurants(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Playlist[];
}

export async function createPlaylist(
  userId: string,
  name: string,
  description?: string,
  isPublic = false,
): Promise<Playlist> {
  const { data, error } = await supabase
    .from('playlists')
    .insert({ user_id: userId, name, description, is_public: isPublic })
    .select('*, restaurants:playlist_restaurants(*)')
    .single();

  if (error) throw error;
  return data as Playlist;
}

export async function updatePlaylist(
  playlistId: string,
  updates: { name?: string; description?: string; is_public?: boolean },
): Promise<void> {
  const { error } = await supabase
    .from('playlists')
    .update(updates)
    .eq('id', playlistId);

  if (error) throw error;
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', playlistId);

  if (error) throw error;
}

// ─── Bookmark (Add/Remove Restaurant) ───────────────────────────────────────

export async function addRestaurantToPlaylist(
  playlistId: string,
  restaurant: {
    restaurant_name: string;
    city?: string;
    state?: string;
    cuisine_type?: string;
    google_place_id?: string;
    yelp_id?: string;
    notes?: string;
  },
): Promise<PlaylistRestaurant> {
  const { data, error } = await supabase
    .from('playlist_restaurants')
    .insert({ playlist_id: playlistId, ...restaurant })
    .select()
    .single();

  if (error) throw error;
  return data as PlaylistRestaurant;
}

export async function removeRestaurantFromPlaylist(
  playlistId: string,
  restaurantName: string,
): Promise<void> {
  const { error } = await supabase
    .from('playlist_restaurants')
    .delete()
    .eq('playlist_id', playlistId)
    .eq('restaurant_name', restaurantName);

  if (error) throw error;
}

// ─── Quick Bookmark (toggle on default playlist) ────────────────────────────

export async function isRestaurantBookmarked(
  userId: string,
  restaurantName: string,
): Promise<boolean> {
  const defaultPlaylist = await getOrCreateDefaultPlaylist(userId);
  const match = (defaultPlaylist.restaurants ?? []).find(
    (r) => r.restaurant_name.toLowerCase() === restaurantName.toLowerCase(),
  );
  return !!match;
}

export async function toggleBookmark(
  userId: string,
  restaurantName: string,
  city?: string,
  state?: string,
  cuisineType?: string,
): Promise<boolean> {
  const defaultPlaylist = await getOrCreateDefaultPlaylist(userId);
  const existing = (defaultPlaylist.restaurants ?? []).find(
    (r) => r.restaurant_name.toLowerCase() === restaurantName.toLowerCase(),
  );

  if (existing) {
    await removeRestaurantFromPlaylist(defaultPlaylist.id, existing.restaurant_name);
    return false; // removed
  }

  await addRestaurantToPlaylist(defaultPlaylist.id, {
    restaurant_name: restaurantName,
    city,
    state,
    cuisine_type: cuisineType,
  });
  return true; // added
}

// ─── Get Playlists Containing a Restaurant ──────────────────────────────────

export async function getPlaylistsForRestaurant(
  userId: string,
  restaurantName: string,
): Promise<string[]> {
  const playlists = await getUserPlaylists(userId);
  return playlists
    .filter((p) =>
      (p.restaurants ?? []).some(
        (r) => r.restaurant_name.toLowerCase() === restaurantName.toLowerCase(),
      ),
    )
    .map((p) => p.id);
}
