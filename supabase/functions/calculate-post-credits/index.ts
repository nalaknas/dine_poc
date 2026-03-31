import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_CREDITS = 25;

interface CreditBreakdown {
  base: number;
  allDishesRated: number;
  dishNotes: number;
  photos: number;
  caption: number;
  starDishes: number;
  total: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Authenticate caller ─────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Create an anon client to verify the caller's JWT
    const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { postId } = (await req.json()) as { postId: string };

    if (!postId) {
      throw new Error('Missing required field: postId');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the post with dish_ratings and receipt_items
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select(`
        id,
        author_id,
        caption,
        food_photos,
        overall_rating,
        dish_ratings(*),
        receipt_items(*)
      `)
      .eq('id', postId)
      .single();

    if (postError || !post) {
      throw new Error(`Post not found: ${postError?.message ?? 'no data'}`);
    }

    // ── Verify caller is the post author ────────────────────────────────────
    if (post.author_id !== caller.id) {
      return new Response(
        JSON.stringify({ error: 'You can only earn credits for your own posts' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Idempotency: check if credits were already awarded for this post ────
    const { data: existingCredit } = await supabase
      .from('credit_events')
      .select('id')
      .eq('source_post_id', postId)
      .eq('type', 'post_quality')
      .limit(1)
      .maybeSingle();

    if (existingCredit) {
      return new Response(
        JSON.stringify({ credits: 0, breakdown: null, message: 'Credits already awarded for this post' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const dishRatings = (post.dish_ratings ?? []) as {
      dish_name: string;
      rating: number;
      notes?: string;
    }[];
    const receiptItems = (post.receipt_items ?? []) as { name: string }[];
    const foodPhotos = (post.food_photos ?? []) as string[];
    const caption = (post.caption ?? '') as string;

    // ── Calculate credits ────────────────────────────────────────────────────

    const breakdown: CreditBreakdown = {
      base: 5,
      allDishesRated: 0,
      dishNotes: 0,
      photos: 0,
      caption: 0,
      starDishes: 0,
      total: 0,
    };

    // +5 if all dishes rated (not just overall)
    // "All dishes rated" means every receipt item has a corresponding dish rating
    if (receiptItems.length > 0 && dishRatings.length >= receiptItems.length) {
      breakdown.allDishesRated = 5;
    } else if (receiptItems.length === 0 && dishRatings.length > 0) {
      // No receipt items but user still rated dishes — count as all rated
      breakdown.allDishesRated = 5;
    }

    // +3 if notes written on any dish
    const hasNotes = dishRatings.some((r) => r.notes && r.notes.trim().length > 0);
    if (hasNotes) {
      breakdown.dishNotes = 3;
    }

    // +5 if 3+ food photos uploaded
    if (foodPhotos.length >= 3) {
      breakdown.photos = 5;
    }

    // +2 if caption > 50 chars
    if (caption.length > 50) {
      breakdown.caption = 2;
    }

    // +5 if star dishes identified (rating >= 7)
    const hasStarDish = dishRatings.some((r) => r.rating >= 7);
    if (hasStarDish) {
      breakdown.starDishes = 5;
    }

    // Cap at MAX_CREDITS
    const rawTotal =
      breakdown.base +
      breakdown.allDishesRated +
      breakdown.dishNotes +
      breakdown.photos +
      breakdown.caption +
      breakdown.starDishes;
    breakdown.total = Math.min(rawTotal, MAX_CREDITS);

    // ── Award credits via add_credits RPC ────────────────────────────────────

    const { error: creditError } = await supabase.rpc('add_credits', {
      p_user_id: post.author_id,
      p_type: 'post_quality',
      p_amount: breakdown.total,
      p_source_post_id: postId,
      p_metadata: breakdown,
    });

    if (creditError) {
      throw new Error(`Failed to award credits: ${creditError.message}`);
    }

    return new Response(
      JSON.stringify({ credits: breakdown.total, breakdown }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('calculate-post-credits error:', error);
    return new Response(
      JSON.stringify({ error: error.message ?? 'Credit calculation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
