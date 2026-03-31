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

<<<<<<< HEAD
interface StreakInfo {
  weeks: number;
  multiplier: number;
  bonusCredits: number;
}

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getStreakMultiplier(weeks: number): number {
  if (weeks >= 8) return 2;
  if (weeks >= 4) return 1.5;
  if (weeks >= 2) return 1.2;
  return 1;
}

/** Returns the ISO week string for the week after the given one (e.g. "2026-W13" → "2026-W14"). */
function nextISOWeek(weekStr: string): string {
  // Parse "YYYY-WNN"
  const [yearStr, wPart] = weekStr.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(wPart, 10);

  // Find the Monday of the given ISO week
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(year, 0, 4);
  const jan4Day = (jan4.getDay() + 6) % 7; // 0=Mon
  const monday = new Date(jan4.getTime());
  monday.setDate(jan4.getDate() - jan4Day + (week - 1) * 7);

  // Add 7 days to get next week's Monday
  const nextMonday = new Date(monday.getTime() + 7 * 86400000);
  return getISOWeek(nextMonday);
}
=======
interface DiscoveryResult {
  isDiscoverer: boolean;
  discoveryCredits: number;
  attributionCredits: number;
}

const DISCOVERY_CREDITS = 15;
const ATTRIBUTION_CREDITS = 10;
const MAX_ATTRIBUTION_PER_RESTAURANT = 500;
>>>>>>> d2847e1 (Credit system discovery credit with race-safe unique index (ENG-42))

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
        restaurant_name,
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

    // ── Streak tracking (atomic via SQL to prevent race conditions) ─────────
    const currentWeek = getISOWeek(new Date());

    // Atomic read-modify-write using a raw SQL query with row locking
    const { data: streakResult, error: streakError } = await supabase.rpc(
      'update_streak',
      { p_user_id: post.author_id, p_current_week: currentWeek }
    );

    // Fallback if RPC doesn't exist yet — read without lock
    let streakWeeks = 0;
    let previousStreak = 0;
    if (streakError) {
      console.warn('update_streak RPC not available, falling back:', streakError.message);
      const { data: userData } = await supabase
        .from('users')
        .select('streak_weeks, last_post_week')
        .eq('id', post.author_id)
        .single();

      if (userData) {
        const lastPostWeek: string | null = userData.last_post_week;
        streakWeeks = userData.streak_weeks ?? 0;
        previousStreak = streakWeeks;

        if (lastPostWeek === currentWeek) {
          // Same week — no streak change
        } else if (lastPostWeek && nextISOWeek(lastPostWeek) === currentWeek) {
          streakWeeks += 1;
        } else {
          streakWeeks = 1;
        }

        await supabase
          .from('users')
          .update({ streak_weeks: streakWeeks, last_post_week: currentWeek })
          .eq('id', post.author_id);
      }
    } else {
      streakWeeks = streakResult?.new_streak ?? 0;
      previousStreak = streakResult?.previous_streak ?? 0;
    }

    // Apply streak multiplier to post quality credits (capped at MAX_CREDITS)
    const multiplier = getStreakMultiplier(streakWeeks);
    const multipliedTotal = Math.min(
      Math.round(breakdown.total * multiplier),
      MAX_CREDITS,
    );

    // Check for streak milestone bonuses
    const streakMilestones = [2, 4, 8];
    let bonusCredits = 0;
    const reachedMilestone = streakMilestones.find(
      (m) => streakWeeks >= m && previousStreak < m,
    );
    if (reachedMilestone) {
      // Award bonus credits based on milestone
      const bonusMap: Record<number, number> = { 2: 10, 4: 25, 8: 50 };
      bonusCredits = bonusMap[reachedMilestone] ?? 0;
    }

    const streak: StreakInfo = {
      weeks: streakWeeks,
      multiplier,
      bonusCredits,
    };

    // ── Award credits via add_credits RPC ────────────────────────────────────

    const { error: creditError } = await supabase.rpc('add_credits', {
      p_user_id: post.author_id,
      p_type: 'post_quality',
      p_amount: multipliedTotal,
      p_source_post_id: postId,
      p_metadata: { ...breakdown, streak },
    });

    if (creditError) {
      throw new Error(`Failed to award credits: ${creditError.message}`);
    }

<<<<<<< HEAD
    // Award streak milestone bonus credits if applicable
    if (bonusCredits > 0) {
      const { error: bonusError } = await supabase.rpc('add_credits', {
        p_user_id: post.author_id,
        p_type: 'streak',
        p_amount: bonusCredits,
        p_source_post_id: postId,
        p_metadata: { milestone: reachedMilestone, streakWeeks },
      });

      if (bonusError) {
        console.error('Failed to award streak bonus:', bonusError.message);
=======
    // ── Discovery credit logic ──────────────────────────────────────────────

    const discovery: DiscoveryResult = {
      isDiscoverer: false,
      discoveryCredits: 0,
      attributionCredits: 0,
    };

    const restaurantName = (post.restaurant_name ?? '') as string;
    // Escape ilike wildcards to prevent injection (e.g. "100% Natural")
    const escapedName = restaurantName.replace(/%/g, '\\%').replace(/_/g, '\\_');

    if (restaurantName.trim().length > 0) {
      // ── Idempotency: check if discovery/attribution credits already awarded for this post
      const { data: existingDiscovery } = await supabase
        .from('credit_events')
        .select('id')
        .eq('source_post_id', postId)
        .in('type', ['discovery', 'attribution'])
        .limit(1)
        .maybeSingle();

      if (!existingDiscovery) {
        // Find the discoverer post for this restaurant (if any)
        const { data: discovererPost } = await supabase
          .from('posts')
          .select('id, author_id')
          .ilike('restaurant_name', escapedName)
          .eq('is_discoverer', true)
          .limit(1)
          .maybeSingle();

        if (!discovererPost) {
          // ── FIRST post for this restaurant — mark as discoverer ──────────
          // The unique partial index on lower(restaurant_name) WHERE is_discoverer=true
          // prevents race conditions — only one concurrent writer will succeed.
          const { error: updateErr } = await supabase
            .from('posts')
            .update({ is_discoverer: true })
            .eq('id', postId);

          if (!updateErr) {
            discovery.isDiscoverer = true;
            discovery.discoveryCredits = DISCOVERY_CREDITS;

            const { error: discErr } = await supabase.rpc('add_credits', {
              p_user_id: post.author_id,
              p_type: 'discovery',
              p_amount: DISCOVERY_CREDITS,
              p_source_post_id: postId,
              p_source_user_id: post.author_id,
              p_metadata: { restaurant_name: restaurantName },
            });

            if (discErr) {
              console.error('Failed to award discovery credits:', discErr.message);
            }
          } else {
            // Unique index violation — another post beat us. Fall through to attribution.
            console.warn('Discoverer race: another post won, skipping discovery credits');
          }
        } else if (discovererPost.author_id !== post.author_id) {
          // ── NOT the first post — check if current author is new to this restaurant
          const { count: authorPriorPosts } = await supabase
            .from('posts')
            .select('id', { count: 'exact', head: true })
            .ilike('restaurant_name', escapedName)
            .eq('author_id', post.author_id)
            .neq('id', postId);

          if ((authorPriorPosts ?? 0) === 0) {
            // New unique user — check attribution cap using SUM of actual credits
            const { data: capData } = await supabase
              .from('credit_events')
              .select('credits')
              .eq('type', 'attribution')
              .eq('source_post_id', discovererPost.id);

            const currentAttributionTotal = (capData ?? []).reduce(
              (sum: number, e: { credits: number }) => sum + e.credits, 0,
            );

            if (currentAttributionTotal < MAX_ATTRIBUTION_PER_RESTAURANT) {
              discovery.attributionCredits = ATTRIBUTION_CREDITS;

              const { error: attrErr } = await supabase.rpc('add_credits', {
                p_user_id: discovererPost.author_id,
                p_type: 'attribution',
                p_amount: ATTRIBUTION_CREDITS,
                p_source_post_id: discovererPost.id,
                p_source_user_id: post.author_id,
                p_metadata: {
                  restaurant_name: restaurantName,
                  new_poster_id: post.author_id,
                },
              });

              if (attrErr) {
                console.error('Failed to award attribution credits:', attrErr.message);
              }
            }
          }
        }
>>>>>>> d2847e1 (Credit system discovery credit with race-safe unique index (ENG-42))
      }
    }

    return new Response(
<<<<<<< HEAD
      JSON.stringify({ credits: multipliedTotal, breakdown, streak }),
=======
      JSON.stringify({ credits: breakdown.total, breakdown, discovery }),
>>>>>>> d2847e1 (Credit system discovery credit with race-safe unique index (ENG-42))
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
