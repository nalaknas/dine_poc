import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LANDING_BASE_URL = Deno.env.get('LANDING_BASE_URL') ?? 'https://dine.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LineInput {
  recipient_user_id?: string;
  recipient_name: string;
  recipient_phone?: string;
  amount: number;
}

interface RequestBody {
  post_id?: string;
  restaurant_name?: string;
  note?: string;
  lines?: LineInput[];
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return jsonResponse({ error: 'Invalid or expired token' }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const restaurantName = body.restaurant_name?.trim();
    const lines = Array.isArray(body.lines) ? body.lines : [];

    if (!restaurantName) {
      return jsonResponse({ error: 'restaurant_name is required' }, 400);
    }
    if (lines.length === 0) {
      return jsonResponse({ error: 'At least one line is required' }, 400);
    }

    // Per-line validation: amount > 0, at least one channel
    for (const [i, line] of lines.entries()) {
      if (!line.recipient_name?.trim()) {
        return jsonResponse({ error: `lines[${i}].recipient_name is required` }, 400);
      }
      if (typeof line.amount !== 'number' || !isFinite(line.amount) || line.amount <= 0) {
        return jsonResponse({ error: `lines[${i}].amount must be a positive number` }, 400);
      }
      if (!line.recipient_user_id && !line.recipient_phone) {
        return jsonResponse(
          { error: `lines[${i}] must include recipient_user_id or recipient_phone` },
          400,
        );
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Sender must have a Venmo handle. Schema column is `venmo_username`
    // (migration 001); the public landing-page contract calls it `venmo_handle`.
    const { data: senderRow, error: senderErr } = await supabase
      .from('users')
      .select('venmo_username')
      .eq('id', caller.id)
      .single();

    if (senderErr || !senderRow) {
      return jsonResponse({ error: 'Sender not found' }, 404);
    }
    if (!senderRow.venmo_username || senderRow.venmo_username.trim().length === 0) {
      return jsonResponse({ reason: 'missing_venmo_handle' }, 412);
    }

    // Insert request — DB DEFAULT generates the public_token + expires_at.
    const { data: request, error: insertErr } = await supabase
      .from('split_requests')
      .insert({
        post_id: body.post_id ?? null,
        sender_user_id: caller.id,
        restaurant_name: restaurantName,
        note: body.note ?? null,
      })
      .select('id, public_token')
      .single();

    if (insertErr || !request) {
      throw new Error(`Failed to create split request: ${insertErr?.message ?? 'unknown'}`);
    }

    const lineRows = lines.map((l) => ({
      split_request_id: request.id,
      recipient_user_id: l.recipient_user_id ?? null,
      recipient_name: l.recipient_name.trim(),
      recipient_phone: l.recipient_phone ?? null,
      amount: l.amount,
    }));

    const { error: linesErr } = await supabase
      .from('split_request_lines')
      .insert(lineRows);

    if (linesErr) {
      // Roll back the parent request so we don't leak orphans.
      await supabase.from('split_requests').delete().eq('id', request.id);
      throw new Error(`Failed to create split request lines: ${linesErr.message}`);
    }

    const landingUrl = `${LANDING_BASE_URL.replace(/\/$/, '')}/r/${request.public_token}`;

    const recipientPhones = Array.from(
      new Set(lines.map((l) => l.recipient_phone).filter((p): p is string => !!p)),
    );
    const dineRecipientUserIds = Array.from(
      new Set(lines.map((l) => l.recipient_user_id).filter((u): u is string => !!u)),
    );
    const smsBody = `${restaurantName} bill — your share: ${landingUrl}`;

    return jsonResponse({
      split_request_id: request.id,
      public_token: request.public_token,
      landing_url: landingUrl,
      recipient_phones: recipientPhones,
      dine_recipient_user_ids: dineRecipientUserIds,
      sms_body: smsBody,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'create-split-request failed';
    console.error('create-split-request error:', message);
    return jsonResponse({ error: message }, 500);
  }
});
