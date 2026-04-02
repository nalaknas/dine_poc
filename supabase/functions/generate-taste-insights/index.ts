import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Minimum number of dish ratings required to generate insights */
const MIN_RATINGS_FOR_INSIGHTS = 5;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth: verify JWT and extract user_id ────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !authUser) {
      throw new Error('Unauthorized');
    }

    const { user_id } = await req.json() as { user_id: string };

    // Ensure the requesting user matches the target user
    if (authUser.id !== user_id) {
      throw new Error('Forbidden: cannot generate insights for another user');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Step 1: Fetch the user's dish ratings ───────────────────────────────
    const { data: dishRatings, error: ratingsError } = await supabase
      .from('dish_ratings')
      .select('dish_name, rating, notes, is_star_dish')
      .eq('user_id', user_id)
      .order('rating', { ascending: false });

    if (ratingsError) throw ratingsError;

    // ── Step 2: Fetch the user's posts for cuisine data ─────────────────────
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('cuisine_type, overall_rating, restaurant_name, city, price_range, meal_type')
      .eq('author_id', user_id)
      .order('created_at', { ascending: false });

    if (postsError) throw postsError;

    const totalRatings = dishRatings?.length ?? 0;

    // ── Step 3: Check minimum data threshold ────────────────────────────────
    if (totalRatings < MIN_RATINGS_FOR_INSIGHTS) {
      return new Response(
        JSON.stringify({
          insights: [],
          insufficient_data: true,
          ratings_needed: MIN_RATINGS_FOR_INSIGHTS - totalRatings,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 4: Prepare data summary for GPT ────────────────────────────────
    const cuisineCounts: Record<string, { count: number; totalRating: number }> = {};
    for (const post of (posts ?? [])) {
      const cuisine = post.cuisine_type ?? 'Unknown';
      if (!cuisineCounts[cuisine]) cuisineCounts[cuisine] = { count: 0, totalRating: 0 };
      cuisineCounts[cuisine].count++;
      cuisineCounts[cuisine].totalRating += post.overall_rating ?? 0;
    }

    const topDishes = (dishRatings ?? []).slice(0, 10);
    const avgRating = totalRatings > 0
      ? (dishRatings ?? []).reduce((sum, d) => sum + d.rating, 0) / totalRatings
      : 0;
    const starDishes = (dishRatings ?? []).filter((d) => d.is_star_dish);

    const dataSummary = {
      totalDishesRated: totalRatings,
      averageRating: Math.round(avgRating * 10) / 10,
      topRatedDishes: topDishes.map((d) => ({ name: d.dish_name, rating: d.rating })),
      starDishes: starDishes.map((d) => d.dish_name),
      cuisineBreakdown: Object.entries(cuisineCounts)
        .map(([cuisine, data]) => ({
          cuisine,
          mealCount: data.count,
          avgRating: Math.round((data.totalRating / data.count) * 10) / 10,
        }))
        .sort((a, b) => b.mealCount - a.mealCount),
      totalPosts: posts?.length ?? 0,
      uniqueRestaurants: new Set((posts ?? []).map((p) => p.restaurant_name)).size,
      priceRanges: (posts ?? []).map((p) => p.price_range).filter(Boolean),
      mealTypes: (posts ?? []).map((p) => p.meal_type).filter(Boolean),
    };

    // ── Step 5: Call GPT-4o Mini to generate insight summaries ──────────────
    const gptPrompt = `You are analyzing a food lover's dining data. Generate exactly 4 insights as a JSON array. Each insight must have this exact shape:

{
  "id": "insight_N",
  "type": "standard" | "metric" | "comparison",
  "icon": "ionicon-name",
  "title": "short title (3-5 words)",
  "subtitle": "one engaging sentence about this insight",
  "value": number or null,
  "userValue": number or null,
  "averageValue": number or null,
  "color": "#hex color"
}

Rules:
- Generate exactly 4 insights, one of each configuration:
  1. One "metric" type: Show a key number about the user (e.g. total dishes rated, average rating, unique restaurants). Use value field. Use icon like "star", "restaurant", "analytics". Use color "#007AFF" or "#10B981".
  2. One "standard" type: A personality-based insight about their taste (e.g. "Adventurous Eater" or "Comfort Food Fan"). No value/userValue/averageValue needed. Use icon like "flame", "heart", "leaf", "pizza". Use color "#F59E0B" or "#8B5CF6".
  3. One "comparison" type: Compare user to average. Use userValue (user's number) and averageValue (typical average for context). Use icon like "trending-up", "bar-chart". Use color "#007AFF".
  4. One more "standard" type: About their top cuisine preference. Use icon like "globe", "earth", "flag". Use color "#EF4444" or "#10B981".

- Use only valid Ionicons names (e.g. "star", "flame", "restaurant", "analytics", "heart", "globe", "trending-up", "bar-chart-outline", "pizza-outline")
- Keep titles catchy and under 5 words
- Subtitles should be conversational and specific to the data
- Return ONLY the JSON array, no markdown

User's dining data:
${JSON.stringify(dataSummary, null, 2)}`;

    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: gptPrompt }],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!gptResponse.ok) {
      throw new Error(`OpenAI API error: ${gptResponse.status}`);
    }

    const gptData = await gptResponse.json();
    const content = gptData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from GPT');
    }

    const parsed = JSON.parse(content);
    // GPT might wrap in { "insights": [...] } or return raw array
    const rawInsights = Array.isArray(parsed) ? parsed : (parsed.insights ?? []);

    // ── Step 6: Validate and sanitize insights ──────────────────────────────
    const validTypes = new Set(['standard', 'metric', 'comparison']);
    const insights = rawInsights
      .filter((i: any) => i.id && i.type && validTypes.has(i.type) && i.title && i.subtitle)
      .map((i: any) => ({
        id: String(i.id),
        type: i.type as 'standard' | 'metric' | 'comparison',
        icon: String(i.icon ?? 'sparkles'),
        title: String(i.title),
        subtitle: String(i.subtitle),
        value: typeof i.value === 'number' ? i.value : undefined,
        userValue: typeof i.userValue === 'number' ? i.userValue : undefined,
        averageValue: typeof i.averageValue === 'number' ? i.averageValue : undefined,
        color: String(i.color ?? '#007AFF'),
      }));

    // ── Step 7: Cache results in user_taste_profiles ────────────────────────
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('user_taste_profiles')
      .update({
        insights_cache: insights,
        insights_generated_at: now,
      })
      .eq('user_id', user_id);

    if (updateError) {
      console.error('Failed to cache insights:', updateError);
      // Non-fatal — still return the insights
    }

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('generate-taste-insights error:', error);

    const status = error.message === 'Unauthorized' || error.message === 'Missing authorization header'
      ? 401
      : error.message?.startsWith('Forbidden')
        ? 403
        : 500;

    return new Response(
      JSON.stringify({ error: error.message ?? 'Insight generation failed', insights: [] }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
