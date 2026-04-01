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

interface StreakInfo {
  weeks: number;
  multiplier: number;
  bonusCredits: number;
}

interface DiscoveryResult {
  isDiscoverer: boolean;
  discoveryCredits: number;
  attributionCredits: number;
}

const DISCOVERY_CREDITS = 15;
const ATTRIBUTION_CREDITS = 10;
const MAX_ATTRIBUTION_PER_RESTAURANT = 500;

/** Engagement-based attribution constants */
const ATTRIBUTION_WINDOW_DAYS = 30;
const ENGAGEMENT_CREDIT_VALUES: Record<string, number> = {
  like: 50,
  comment: 75,
  bookmark: 100,
};

interface EngagementAttribution {
  post_author_id: string;
  engagement_type: string;
  original_post_id: string;
  credits_awarded: number;
  days_since_engagement: number;
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
  const [yearStr, wPart] = weekStr.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(wPart, 10);

  const jan4 = new Date(year, 0, 4);
  const jan4Day = (jan4.getDay() + 6) % 7;
  const monday = new Date(jan4.getTime());
  monday.setDate(jan4.getDate() - jan4Day + (week - 1) * 7);

  const nextMonday = new Date(monday.getTime() + 7 * 86400000);
  return getISOWeek(nextMonday);
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

    if (receiptItems.length > 0 && dishRatings.length >= receiptItems.length) {
      breakdown.allDishesRated = 5;
    } else if (receiptItems.length === 0 && dishRatings.length > 0) {
      breakdown.allDishesRated = 5;
    }

    const hasNotes = dishRatings.some((r) => r.notes && r.notes.trim().length > 0);
    if (hasNotes) {
      breakdown.dishNotes = 3;
    }

    if (foodPhotos.length >= 3) {
      breakdown.photos = 5;
    }

    if (caption.length > 50) {
      breakdown.caption = 2;
    }

    const hasStarDish = dishRatings.some((r) => r.rating >= 7);
    if (hasStarDish) {
      breakdown.starDishes = 5;
    }

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

    const { data: streakResult, error: streakError } = await supabase.rpc(
      'update_streak',
      { p_user_id: post.author_id, p_current_week: currentWeek }
    );

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
      const bonusMap: Record<number, number> = { 2: 10, 4: 25, 8: 50 };
      bonusCredits = bonusMap[reachedMilestone] ?? 0;
    }

    const streak: StreakInfo = {
      weeks: streakWeeks,
      multiplier,
      bonusCredits,
    };

    // ── Award credits via add_credits RPC ────────────────────────────────────

    const { data: creditResult, error: creditError } = await supabase.rpc('add_credits', {
      p_user_id: post.author_id,
      p_type: 'post_quality',
      p_amount: multipliedTotal,
      p_source_post_id: postId,
      p_metadata: { ...breakdown, streak },
    });

    if (creditError) {
      throw new Error(`Failed to award credits: ${creditError.message}`);
    }

    // Extract the new tier after credits were awarded
    let newTier: string = creditResult?.[0]?.new_tier ?? 'rock';

    // Award streak milestone bonus credits if applicable
    if (bonusCredits > 0) {
      const { data: bonusResult, error: bonusError } = await supabase.rpc('add_credits', {
        p_user_id: post.author_id,
        p_type: 'streak',
        p_amount: bonusCredits,
        p_source_post_id: postId,
        p_metadata: { milestone: reachedMilestone, streakWeeks },
      });

      if (bonusError) {
        console.error('Failed to award streak bonus:', bonusError.message);
      } else {
        // Streak bonus may push user to a higher tier — use the latest tier
        const bonusTier = bonusResult?.[0]?.new_tier;
        if (bonusTier) newTier = bonusTier;
      }
    }

    // ── Discovery credit logic ──────────────────────────────────────────────

    const discovery: DiscoveryResult = {
      isDiscoverer: false,
      discoveryCredits: 0,
      attributionCredits: 0,
    };

    const restaurantName = (post.restaurant_name ?? '') as string;
    const escapedName = restaurantName.replace(/%/g, '\\%').replace(/_/g, '\\_');

    if (restaurantName.trim().length > 0) {
      // Idempotency: check if discovery/attribution credits already awarded for this post
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
          // FIRST post for this restaurant — unique partial index prevents race conditions
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
            console.warn('Discoverer race: another post won, skipping discovery credits');
          }
        } else if (discovererPost.author_id !== post.author_id) {
          // Check if current author is new to this restaurant
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
      }
    }

    // ── Referral credit check (server-side, atomic) ───────────────────────────
    // After each post, check if this author was referred and has hit 3+ posts
    const REFERRAL_CREDITS = 25;
    const REQUIRED_POSTS = 3;

    try {
      const { data: referral } = await supabase
        .from('referrals')
        .select('id, inviter_id')
        .eq('invitee_id', post.author_id)
        .eq('credited', false)
        .limit(1)
        .maybeSingle();

      if (referral) {
        const { count: postCount } = await supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .eq('author_id', post.author_id);

        if ((postCount ?? 0) >= REQUIRED_POSTS) {
          // Idempotency: check if referral credit already awarded
          const { data: existingReferralCredit } = await supabase
            .from('credit_events')
            .select('id')
            .eq('type', 'referral')
            .eq('source_user_id', post.author_id)
            .eq('user_id', referral.inviter_id)
            .limit(1)
            .maybeSingle();

          if (!existingReferralCredit) {
            await supabase.rpc('add_credits', {
              p_user_id: referral.inviter_id,
              p_type: 'referral',
              p_amount: REFERRAL_CREDITS,
              p_source_post_id: postId,
              p_source_user_id: post.author_id,
              p_metadata: { source: 'bill_split', invitee_id: post.author_id },
            });

            await supabase
              .from('referrals')
              .update({ credited: true, credited_at: new Date().toISOString() })
              .eq('id', referral.id);
          }
        }
      }
    } catch (refErr: any) {
      console.warn('Referral credit check failed:', refErr?.message);
    }

    // ── Engagement-based attribution credit logic ─────────────────────────────
    // When a user posts about a restaurant, check if they previously engaged
    // (liked, commented, bookmarked) with another author's post about the same
    // restaurant within the attribution window. If so, credit that author for
    // influencing this visit.

    const engagementAttributions: EngagementAttribution[] = [];

    if (restaurantName.trim().length > 0) {
      try {
        const windowStart = new Date();
        windowStart.setDate(windowStart.getDate() - ATTRIBUTION_WINDOW_DAYS);

        // Find engagements where the current poster interacted with posts
        // about this restaurant from other authors within the attribution window
        const { data: engagements, error: engErr } = await supabase
          .from('post_engagements')
          .select('post_author_id, engagement_type, post_id, created_at')
          .eq('user_id', post.author_id)
          .ilike('restaurant_name', escapedName)
          .neq('post_author_id', post.author_id)
          .gte('created_at', windowStart.toISOString());

        if (engErr) {
          console.error('Failed to query post_engagements:', engErr.message);
        } else if (engagements && engagements.length > 0) {
          // Group by post_author_id, keeping only the highest-value engagement per author
          const authorBestEngagement = new Map<
            string,
            { engagement_type: string; post_id: string; credits: number; created_at: string }
          >();

          for (const eng of engagements) {
            const creditValue = ENGAGEMENT_CREDIT_VALUES[eng.engagement_type] ?? 0;
            const existing = authorBestEngagement.get(eng.post_author_id);

            if (!existing || creditValue > existing.credits) {
              authorBestEngagement.set(eng.post_author_id, {
                engagement_type: eng.engagement_type,
                post_id: eng.post_id,
                credits: creditValue,
                created_at: eng.created_at,
              });
            }
          }

          // Award credits to each attributed author
          for (const [authorId, best] of authorBestEngagement) {
            // Idempotency: check for existing attribution credit for this
            // (source_user_id=poster, user_id=author, restaurant) combo in the last 30 days
            const { data: existingAttr } = await supabase
              .from('credit_events')
              .select('id')
              .eq('type', 'attribution')
              .eq('source_user_id', post.author_id)
              .eq('user_id', authorId)
              .contains('metadata', { restaurant_name: restaurantName })
              .gte('created_at', windowStart.toISOString())
              .limit(1)
              .maybeSingle();

            if (existingAttr) {
              continue; // Already attributed in this window
            }

            // Per-restaurant cap: check how many attribution credits this author
            // has already earned for this restaurant
            const { data: capData } = await supabase
              .from('credit_events')
              .select('credits')
              .eq('type', 'attribution')
              .eq('user_id', authorId)
              .contains('metadata', { restaurant_name: restaurantName });

            const currentTotal = (capData ?? []).reduce(
              (sum: number, e: { credits: number }) => sum + e.credits, 0,
            );

            if (currentTotal >= MAX_ATTRIBUTION_PER_RESTAURANT) {
              continue; // Cap reached for this restaurant
            }

            // Clamp credits if near cap
            const allowedCredits = Math.min(
              best.credits,
              MAX_ATTRIBUTION_PER_RESTAURANT - currentTotal,
            );

            const daysSinceEngagement = Math.round(
              (Date.now() - new Date(best.created_at).getTime()) / (1000 * 60 * 60 * 24),
            );

            const { error: attrError } = await supabase.rpc('add_credits', {
              p_user_id: authorId,
              p_type: 'attribution',
              p_amount: allowedCredits,
              p_source_post_id: postId,
              p_source_user_id: post.author_id,
              p_metadata: {
                attribution_type: 'engagement',
                engagement_type: best.engagement_type,
                original_post_id: best.post_id,
                new_post_id: postId,
                restaurant_name: restaurantName,
                days_since_engagement: daysSinceEngagement,
              },
            });

            if (attrError) {
              console.error(
                `Failed to award engagement attribution to ${authorId}:`,
                attrError.message,
              );
            } else {
              engagementAttributions.push({
                post_author_id: authorId,
                engagement_type: best.engagement_type,
                original_post_id: best.post_id,
                credits_awarded: allowedCredits,
                days_since_engagement: daysSinceEngagement,
              });
            }
          }
        }
      } catch (engAttrErr: any) {
        console.warn('Engagement attribution check failed:', engAttrErr?.message);
      }
    }

    return new Response(
      JSON.stringify({
        credits: multipliedTotal,
        breakdown,
        streak,
        discovery,
        newTier,
        engagementAttributions,
      }),
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
