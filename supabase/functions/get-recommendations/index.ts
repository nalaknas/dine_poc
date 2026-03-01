import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const YELP_API_KEY = Deno.env.get('YELP_API_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, partnerIds = [], mode = 'solo', city, limit = 10 } = await req.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Step 1: Load taste embeddings for user + partners ────────────────────
    const allUserIds = [userId, ...partnerIds].filter(Boolean);

    const { data: profiles } = await supabase
      .from('user_taste_profiles')
      .select('user_id, embedding, total_ratings')
      .in('user_id', allUserIds)
      .not('embedding', 'is', null);

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ recommendations: [], reason: 'no_taste_data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 2: Compute combined embedding (centroid for multi-user) ─────────
    let combinedEmbedding: number[];
    if (profiles.length === 1) {
      combinedEmbedding = profiles[0].embedding;
    } else {
      // For couple/group: average all embeddings equally
      combinedEmbedding = profiles[0].embedding.map((_: number, i: number) =>
        profiles.reduce((sum: number, p: any) => sum + p.embedding[i], 0) / profiles.length
      );
    }

    // ── Step 3: Find similar dish ratings from other users (in-app data) ─────
    // Using pgvector cosine similarity
    const { data: similarDishes } = await supabase.rpc('find_similar_dishes', {
      query_embedding: combinedEmbedding,
      match_threshold: 0.7,
      match_count: 50,
      exclude_user_ids: allUserIds,
    });

    // Group by restaurant and score
    const restaurantScores: Record<string, {
      restaurant_name: string;
      city: string;
      state: string;
      dishes: Array<{ name: string; similarity: number }>;
      score: number;
    }> = {};

    for (const dish of (similarDishes ?? [])) {
      const key = `${dish.restaurant_name}::${dish.city}`;
      if (!restaurantScores[key]) {
        restaurantScores[key] = {
          restaurant_name: dish.restaurant_name,
          city: dish.city ?? '',
          state: dish.state ?? '',
          dishes: [],
          score: 0,
        };
      }
      restaurantScores[key].dishes.push({ name: dish.dish_name, similarity: dish.similarity });
      restaurantScores[key].score = Math.max(restaurantScores[key].score, dish.similarity);
    }

    // ── Step 4: Supplement with Yelp if we have an API key and city ──────────
    let yelpRestaurants: any[] = [];
    if (YELP_API_KEY && city) {
      try {
        // Get top cuisines from the combined taste to query Yelp smartly
        const yelpResponse = await fetch(
          `https://api.yelp.com/v3/businesses/search?location=${encodeURIComponent(city)}&categories=restaurants&sort_by=rating&limit=20`,
          { headers: { Authorization: `Bearer ${YELP_API_KEY}` } }
        );
        if (yelpResponse.ok) {
          const yelpData = await yelpResponse.json();
          yelpRestaurants = yelpData.businesses ?? [];
        }
      } catch {
        // Yelp is supplementary, don't fail on error
      }
    }

    // ── Step 5: Build final recommendations ───────────────────────────────────
    const recommendations = Object.values(restaurantScores)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => ({
        restaurant_name: r.restaurant_name,
        city: r.city,
        state: r.state,
        match_score: r.score,
        matched_dishes: r.dishes
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 3)
          .map((d) => ({ name: d.name, similarity_score: d.similarity })),
        explanation: buildExplanation(r.dishes, mode, partnerIds.length > 0),
      }));

    // Add Yelp restaurants if we don't have enough in-app data
    if (recommendations.length < limit) {
      const existing = new Set(recommendations.map((r) => r.restaurant_name.toLowerCase()));
      for (const business of yelpRestaurants) {
        if (recommendations.length >= limit) break;
        if (existing.has(business.name.toLowerCase())) continue;
        recommendations.push({
          restaurant_name: business.name,
          city: business.location?.city ?? city,
          state: business.location?.state ?? '',
          match_score: 0.5,
          matched_dishes: [],
          explanation: `Highly rated on Yelp (${business.rating}⭐) in ${business.location?.city ?? city}`,
        });
      }
    }

    return new Response(JSON.stringify({ recommendations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('get-recommendations error:', error);
    return new Response(
      JSON.stringify({ error: error.message ?? 'Recommendations failed', recommendations: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildExplanation(dishes: Array<{ name: string; similarity: number }>, mode: string, isPartner: boolean): string {
  const topDish = dishes[0];
  if (!topDish) return 'Based on your dining history';

  const modeText = isPartner ? "you'll both love" : "you'll love";
  const confidence = topDish.similarity > 0.9 ? 'We think' : topDish.similarity > 0.8 ? 'Good chance' : 'Worth trying';

  return `${confidence} ${modeText} the ${topDish.name} here based on your taste profile.`;
}
