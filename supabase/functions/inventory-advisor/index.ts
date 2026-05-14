import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { items, currency, threshold, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const itemList = (items || []).map((i: any) => ({
      name: i.name,
      stock: Number(i.stock_quantity || 0),
      unit: i.unit || 'pcs',
      price: Number(i.unit_price || 0),
      category: i.category || null,
    }));

    const sys = `You are an inventory advisor for a small business. Analyze stock levels and give practical monthly purchasing guidance in ${language || 'Hinglish (mix of Hindi and English in Roman script)'}. Be concise, friendly, action-oriented. Use bullet points and emojis. Group as: 🔴 Urgent Restock, 🟡 Restock Soon, 🟢 Healthy Stock, 🛑 Reduce Buying (overstocked). For each item suggest approx monthly buy quantity. Currency: ${currency || 'INR'}. Low-stock threshold: ${threshold}.`;

    const user = `Here is the current inventory (JSON):\n${JSON.stringify(itemList, null, 2)}\n\nGive me month-wise purchasing advice: kaun sa item kitna kharidna chahiye, kaun sa kam kharide. Keep it under 400 words. Use markdown.`;

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) return new Response(JSON.stringify({ error: 'Rate limit. Try again shortly.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (res.status === 402) return new Response(JSON.stringify({ error: 'AI credits exhausted. Add credits in Settings → Workspace → Usage.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      throw new Error(`AI gateway ${res.status}: ${txt}`);
    }

    const data = await res.json();
    const advice = data.choices?.[0]?.message?.content || 'No advice generated.';

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
