import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Generate a short, human-readable redemption code (e.g. DINE-A3F2-9BCD) */
function generateRedemptionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 to avoid confusion
  const segment = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `DINE-${segment()}-${segment()}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Verify JWT ────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Parse body ────────────────────────────────────────────────────────
    const { perk_id, user_id } = await req.json() as { perk_id: string; user_id: string };

    if (!perk_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'perk_id and user_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Ensure the authenticated user matches the requested user_id
    if (authUser.id !== user_id) {
      return new Response(
        JSON.stringify({ error: 'Cannot redeem perks for another user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Validate perk exists and is active ────────────────────────────────
    const { data: perk, error: perkError } = await db
      .from('partner_perks')
      .select('*, partnership:restaurant_partnerships(*)')
      .eq('id', perk_id)
      .single();

    if (perkError || !perk) {
      return new Response(
        JSON.stringify({ error: 'Perk not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!perk.is_active) {
      return new Response(
        JSON.stringify({ error: 'This perk is no longer active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!perk.partnership?.is_active) {
      return new Response(
        JSON.stringify({ error: 'This restaurant partnership is no longer active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check date validity
    const now = new Date();
    if (perk.valid_until && new Date(perk.valid_until) < now) {
      return new Response(
        JSON.stringify({ error: 'This perk has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (perk.valid_from && new Date(perk.valid_from) > now) {
      return new Response(
        JSON.stringify({ error: 'This perk is not yet available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Check tier eligibility + monthly usage via RPC ─────────────────────
    const { data: eligibility, error: eligError } = await db.rpc('check_perk_eligibility', {
      p_user_id: user_id,
      p_perk_id: perk_id,
    });

    if (eligError) {
      return new Response(
        JSON.stringify({ error: 'Failed to check eligibility' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // RPC returns a single row with is_eligible, reason, uses_remaining, max_uses
    const check = Array.isArray(eligibility) ? eligibility[0] : eligibility;

    if (!check?.is_eligible) {
      return new Response(
        JSON.stringify({ error: check?.reason ?? 'Not eligible for this perk' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Create redemption (retry on code collision) ───────────────────────
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h

    let redemption = null;
    let insertError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const redemptionCode = generateRedemptionCode();
      const result = await db
        .from('perk_redemptions')
        .insert({
          perk_id,
          user_id,
          redemption_code: redemptionCode,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();
      insertError = result.error;
      redemption = result.data;
      if (!insertError) break;
      // Only retry on unique constraint violation (code collision)
      if (!insertError.message?.includes('unique') && !insertError.code?.includes('23505')) break;
    }

    if (insertError || !redemption) {
      return new Response(
        JSON.stringify({ error: 'Failed to create redemption' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify(redemption), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('create-perk-redemption error:', error);
    return new Response(
      JSON.stringify({ error: error.message ?? 'Redemption creation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
