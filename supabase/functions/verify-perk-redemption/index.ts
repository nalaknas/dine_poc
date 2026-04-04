import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { redemption_code } = await req.json() as { redemption_code: string };

    if (!redemption_code) {
      return new Response(
        JSON.stringify({ error: 'redemption_code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Look up redemption ────────────────────────────────────────────────
    const { data: redemption, error: fetchError } = await db
      .from('perk_redemptions')
      .select('*, perk:partner_perks(*, partnership:restaurant_partnerships(*))')
      .eq('redemption_code', redemption_code.toUpperCase().trim())
      .single();

    if (fetchError || !redemption) {
      return new Response(
        JSON.stringify({ error: 'Redemption not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // For MVP: allow the user themselves or a restaurant account to verify
    if (redemption.user_id !== authUser.id) {
      // Check if user is a restaurant account linked to this perk's partnership
      const { data: restaurantAccount } = await db
        .from('restaurant_accounts')
        .select('id')
        .eq('email', authUser.email)
        .eq('partnership_id', redemption.perk?.partnership_id)
        .single();

      if (!restaurantAccount) {
        return new Response(
          JSON.stringify({ error: 'Not authorized to verify this redemption' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // ── Validate status ───────────────────────────────────────────────────
    if (redemption.status !== 'pending') {
      return new Response(
        JSON.stringify({
          error: redemption.status === 'redeemed'
            ? 'This code has already been redeemed'
            : 'This code has expired',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check expiry
    if (new Date(redemption.expires_at) < new Date()) {
      // Update status to expired
      await db
        .from('perk_redemptions')
        .update({ status: 'expired' })
        .eq('id', redemption.id);

      return new Response(
        JSON.stringify({ error: 'This redemption code has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Mark as redeemed ──────────────────────────────────────────────────
    const { data: updated, error: updateError } = await db
      .from('perk_redemptions')
      .update({
        status: 'redeemed',
        redeemed_at: new Date().toISOString(),
      })
      .eq('id', redemption.id)
      .select('*, perk:partner_perks(*, partnership:restaurant_partnerships(*))')
      .single();

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update redemption' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify(updated), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('verify-perk-redemption error:', error);
    return new Response(
      JSON.stringify({ error: error.message ?? 'Verification failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
