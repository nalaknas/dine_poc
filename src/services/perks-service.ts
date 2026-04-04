import { supabase } from '../lib/supabase';
import type { Perk, PerkWithRestaurant, PerkRedemption } from '../types';

// ─── Fetch available perks ──────────────────────────────────────────────────

/** Fetches perks available to the user, optionally filtered by city. */
export async function fetchAvailablePerks(
  userId: string,
  city?: string,
): Promise<PerkWithRestaurant[]> {
  const params: Record<string, string> = { p_user_id: userId };
  if (city) params.p_city = city;

  const { data, error } = await supabase.rpc('get_available_perks', params);

  if (error) throw error;
  return (data ?? []) as PerkWithRestaurant[];
}

// ─── Fetch single perk detail ───────────────────────────────────────────────

/** Fetches a single perk with its partnership/restaurant info. */
export async function fetchPerkDetail(
  perkId: string,
): Promise<(Perk & { restaurant_name: string; city: string; logo_url?: string }) | null> {
  const { data, error } = await supabase
    .from('partner_perks')
    .select('*, partnership:restaurant_partnerships(restaurant_name, city, state, logo_url)')
    .eq('id', perkId)
    .single();

  if (error) throw error;
  if (!data) return null;

  const partnership = data.partnership as {
    restaurant_name: string;
    city: string;
    state?: string;
    logo_url?: string;
  };

  return {
    ...data,
    restaurant_name: partnership.restaurant_name,
    city: partnership.city,
    logo_url: partnership.logo_url,
    partnership: undefined, // strip the nested object
  } as Perk & { restaurant_name: string; city: string; logo_url?: string };
}

// ─── Check eligibility ─────────────────────────────────────────────────────

export interface EligibilityResult {
  is_eligible: boolean;
  reason?: string;
  uses_remaining: number;
}

/** Checks whether a user can redeem a given perk (tier + monthly usage). */
export async function checkEligibility(
  userId: string,
  perkId: string,
): Promise<EligibilityResult> {
  const { data, error } = await supabase.rpc('check_perk_eligibility', {
    p_user_id: userId,
    p_perk_id: perkId,
  });

  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  return {
    is_eligible: result?.is_eligible ?? false,
    reason: result?.reason,
    uses_remaining: result?.uses_remaining ?? 0,
  };
}

// ─── Create redemption ──────────────────────────────────────────────────────

/** Invokes the create-perk-redemption Edge Function to generate a redemption code. */
export async function createRedemption(
  perkId: string,
  userId: string,
): Promise<PerkRedemption> {
  const { data, error } = await supabase.functions.invoke('create-perk-redemption', {
    body: { perk_id: perkId, user_id: userId },
  });

  if (error) throw error;
  return data as PerkRedemption;
}

// ─── Fetch redemption history ───────────────────────────────────────────────

/** Fetches all past redemptions for a user, most recent first. */
export async function fetchRedemptionHistory(
  userId: string,
): Promise<PerkRedemption[]> {
  const { data, error } = await supabase
    .from('perk_redemptions')
    .select('*, perk:partner_perks(*, partnership:restaurant_partnerships(restaurant_name))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    perk_id: row.perk_id,
    user_id: row.user_id,
    redemption_code: row.redemption_code,
    status: row.status,
    expires_at: row.expires_at,
    redeemed_at: row.redeemed_at,
    created_at: row.created_at,
    perk: row.perk
      ? {
          id: row.perk.id,
          partnership_id: row.perk.partnership_id,
          title: row.perk.title,
          description: row.perk.description,
          perk_type: row.perk.perk_type,
          tier_required: row.perk.tier_required,
          uses_per_month: row.perk.uses_per_month,
          is_active: row.perk.is_active,
          valid_from: row.perk.valid_from,
          valid_until: row.perk.valid_until,
        }
      : undefined,
    restaurant_name: row.perk?.partnership?.restaurant_name,
  })) as PerkRedemption[];
}

// ─── Fetch active redemption (for QR display) ───────────────────────────────

/**
 * Fetches a single redemption by ID and subscribes to Realtime changes.
 * Returns an object with the initial data and an unsubscribe function.
 */
export async function fetchActiveRedemption(
  redemptionId: string,
  onUpdate: (redemption: PerkRedemption) => void,
): Promise<{ initial: PerkRedemption; unsubscribe: () => void }> {
  const { data, error } = await supabase
    .from('perk_redemptions')
    .select('*, perk:partner_perks(*, partnership:restaurant_partnerships(restaurant_name))')
    .eq('id', redemptionId)
    .single();

  if (error) throw error;

  const mapRow = (row: any): PerkRedemption => ({
    id: row.id,
    perk_id: row.perk_id,
    user_id: row.user_id,
    redemption_code: row.redemption_code,
    status: row.status,
    expires_at: row.expires_at,
    redeemed_at: row.redeemed_at,
    created_at: row.created_at,
    perk: row.perk
      ? {
          id: row.perk.id,
          partnership_id: row.perk.partnership_id,
          title: row.perk.title,
          description: row.perk.description,
          perk_type: row.perk.perk_type,
          tier_required: row.perk.tier_required,
          uses_per_month: row.perk.uses_per_month,
          is_active: row.perk.is_active,
          valid_from: row.perk.valid_from,
          valid_until: row.perk.valid_until,
        }
      : undefined,
    restaurant_name: row.perk?.partnership?.restaurant_name,
  });

  // Subscribe to Realtime changes on this specific redemption row
  const channel = supabase
    .channel(`redemption-${redemptionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'perk_redemptions',
        filter: `id=eq.${redemptionId}`,
      },
      async (payload) => {
        // Re-fetch with joins for complete data
        const { data: updated } = await supabase
          .from('perk_redemptions')
          .select('*, perk:partner_perks(*, partnership:restaurant_partnerships(restaurant_name))')
          .eq('id', redemptionId)
          .single();

        if (updated) {
          onUpdate(mapRow(updated));
        }
      },
    )
    .subscribe();

  return {
    initial: mapRow(data),
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}

// ─── Fetch perks for a specific restaurant ──────────────────────────────────

/** Fetches active perks for a given restaurant name (used on RestaurantDetailScreen). */
export async function fetchPerksForRestaurant(
  restaurantName: string,
): Promise<Perk[]> {
  const { data, error } = await supabase
    .from('partner_perks')
    .select('*, partnership:restaurant_partnerships!inner(restaurant_name, is_active)')
    .eq('is_active', true)
    .eq('partnership.is_active', true)
    .ilike('partnership.restaurant_name', restaurantName);

  if (error) throw error;
  return (data ?? []) as Perk[];
}
