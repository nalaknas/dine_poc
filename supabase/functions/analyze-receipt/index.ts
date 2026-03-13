import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KEY')!;
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
    const { images } = await req.json() as { images: string[] };

    if (!images || images.length === 0) {
      throw new Error('No images provided');
    }

    // ── Step 1: Google Vision API — extract text from all images ──────────────
    const visionRequests = images.map((base64) => ({
      image: { content: base64 },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
    }));

    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: visionRequests }),
      }
    );

    if (!visionResponse.ok) {
      throw new Error(`Vision API error: ${visionResponse.status}`);
    }

    const visionData = await visionResponse.json();

    // Combine all detected text — prefer fullTextAnnotation (better structure) with fallback
    const fullText = (visionData.responses as any[])
      .map((r: any) => r.fullTextAnnotation?.text ?? r.textAnnotations?.[0]?.description ?? '')
      .filter(Boolean)
      .join('\n\n--- NEXT PAGE ---\n\n');

    if (!fullText.trim()) {
      throw new Error('No text detected in receipt image(s)');
    }

    // ── Step 2: GPT-4o Mini — structure the text into JSON ───────────────────
    const gptPrompt = `You are a receipt parser. Extract the following information from this receipt text and return ONLY valid JSON with no markdown:

{
  "restaurantName": "string (restaurant name or empty string)",
  "date": "YYYY-MM-DD format or empty string",
  "time": "HH:MM AM/PM format or empty string",
  "address": "street address or empty string",
  "city": "city name or empty string",
  "state": "2-letter state code or empty string",
  "items": [{ "id": "unique_id", "name": "item name", "price": number }],
  "subtotal": number,
  "tax": number,
  "tip": number,
  "discount": number,
  "total": number
}

Rules:
- All prices must be numbers (not strings)
- If a value is missing, use 0 for numbers or "" for strings
- CRITICAL: If an item has a quantity greater than 1 (e.g. "3 Coffee $12" or "Coffee x3 $12" or "Coffee  3  $12.00"), you MUST expand it into separate individual items. For example "3 Coffee $12" becomes three separate items each named "Coffee" with price 4.00 (total divided by quantity). Each expanded item gets its own unique id.
- items array should contain each individual line item with its per-unit price
- Exclude items that are clearly not food (like "Take-out bag fee" unless it's a food item)
- The "id" field should be a simple incrementing string like "item_1", "item_2", etc.

Receipt text:
${fullText}`;

    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: gptPrompt }],
        temperature: 0,
        max_tokens: 2000,
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

    const receiptData = JSON.parse(content);

    // Validate and clean up
    const cleaned = {
      restaurantName: String(receiptData.restaurantName ?? ''),
      date: String(receiptData.date ?? ''),
      time: String(receiptData.time ?? ''),
      address: String(receiptData.address ?? ''),
      city: String(receiptData.city ?? ''),
      state: String(receiptData.state ?? ''),
      items: (receiptData.items ?? []).map((item: any, i: number) => ({
        id: item.id ?? `item_${i + 1}`,
        name: String(item.name ?? ''),
        price: Number(item.price ?? 0),
      })).filter((item: any) => item.name && item.price > 0),
      subtotal: Number(receiptData.subtotal ?? 0),
      tax: Number(receiptData.tax ?? 0),
      tip: Number(receiptData.tip ?? 0),
      discount: Number(receiptData.discount ?? 0),
      total: Number(receiptData.total ?? 0),
    };

    // Auto-calculate total if missing
    if (cleaned.total === 0) {
      cleaned.total = cleaned.subtotal + cleaned.tax + cleaned.tip - cleaned.discount;
    }

    return new Response(JSON.stringify(cleaned), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('analyze-receipt error:', error);
    return new Response(
      JSON.stringify({ error: error.message ?? 'Receipt analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
