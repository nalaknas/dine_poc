import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
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
    const { dishRatingId, dishName, rating, notes, userId } = await req.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Step 1: Create enriched text for embedding ─────────────────────────────
    const ratingDescriptor = rating >= 9 ? 'amazing' : rating >= 7 ? 'excellent' : rating >= 5 ? 'good' : 'average';
    const text = `${dishName}${notes ? `: ${notes}` : ''} (${ratingDescriptor} dish, rated ${rating}/10)`;

    // ── Step 2: Generate OpenAI embedding ─────────────────────────────────────
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`OpenAI embedding error: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const rawEmbedding: number[] = embeddingData.data[0].embedding;

    // ── Step 3: Weight embedding by rating (quadratic weight: strong preferences matter more) ──
    const weight = (rating / 10) * (rating / 10);
    const weightedEmbedding = rawEmbedding.map((v: number) => v * weight);

    // ── Step 4: Store embedding on dish_rating ─────────────────────────────────
    await supabase
      .from('dish_ratings')
      .update({ embedding: weightedEmbedding })
      .eq('id', dishRatingId);

    // ── Step 5: Recalculate user taste profile (weighted average of all embeddings) ──
    const { data: allRatings } = await supabase
      .from('dish_ratings')
      .select('embedding, rating')
      .eq('user_id', userId)
      .not('embedding', 'is', null);

    if (allRatings && allRatings.length > 0) {
      const totalWeight = allRatings.reduce((sum: number, r: any) => {
        const w = (r.rating / 10) * (r.rating / 10);
        return sum + w;
      }, 0);

      const profileEmbedding = allRatings.reduce((acc: number[], r: any) => {
        const w = (r.rating / 10) * (r.rating / 10);
        const emb: number[] = r.embedding;
        return acc.map((v, i) => v + (emb[i] * w) / totalWeight);
      }, new Array(1536).fill(0));

      // Upsert the aggregated taste profile
      await supabase.rpc('upsert_taste_profile', {
        p_user_id: userId,
        p_embedding: profileEmbedding,
        p_total_ratings: allRatings.length,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('generate-embedding error:', error);
    return new Response(
      JSON.stringify({ error: error.message ?? 'Embedding generation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
