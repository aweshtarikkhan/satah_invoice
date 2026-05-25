import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Require an authenticated Supabase user — prevents anonymous abuse of GEMINI_API_KEY
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { items, currency, threshold, language } = await req.json();
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

    // Cap input size to prevent runaway prompts
    const rawItems = Array.isArray(items) ? items.slice(0, 100) : [];
    const itemList = rawItems.map((i: any) => ({
      name: String(i.name ?? '').slice(0, 200),
      stock: Number(i.stock_quantity || 0),
      unit: String(i.unit ?? 'pcs').slice(0, 20),
      price: Number(i.unit_price || 0),
      category: i.category ? String(i.category).slice(0, 100) : null,
    }));

    const sys = `You are an inventory advisor for a small business. Analyze stock levels and give practical monthly purchasing guidance in ${language || 'Hinglish (mix of Hindi and English in Roman script)'}. Be concise, friendly, action-oriented. Use bullet points and emojis. Group as: 🔴 Urgent Restock, 🟡 Restock Soon, 🟢 Healthy Stock, 🛑 Reduce Buying (overstocked). For each item suggest approx monthly buy quantity. Currency: ${currency || 'INR'}. Low-stock threshold: ${threshold}.`;
    const user = `Here is the current inventory (JSON):\n${JSON.stringify(itemList, null, 2)}\n\nGive me month-wise purchasing advice: kaun sa item kitna kharidna chahiye, kaun sa kam kharide. Keep it under 400 words. Use markdown.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sys }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      }
    );

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) return new Response(JSON.stringify({ error: 'Gemini rate limit. Try again shortly.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      throw new Error(`Gemini API ${res.status}: ${txt}`);
    }

    const data = await res.json();
    const advice = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No advice generated.';

    return new Response(JSON.stringify({ advice }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
