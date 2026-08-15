import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errText } from "../_shared/errText.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { context } = await req.json();
    const { supplier_name, action, negotiation, rfq_responses, recent_conversation, competitor_prices } = context;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Build AI prompt
    let prompt = '';
    const competitorInfo = competitor_prices?.length
      ? `Competitor quotes: ${competitor_prices.map((c: any) => `${c.supplier}: $${c.price}/unit, MOQ ${c.moq}`).join('; ')}`
      : '';

    const negInfo = negotiation
      ? `Current negotiation round ${negotiation.round}. Current offer: $${negotiation.current_price}/unit, MOQ ${negotiation.current_moq}, shipping $${negotiation.shipping_cost}. Target price: $${negotiation.target_price}. Best offer so far: $${negotiation.best_offer}.`
      : '';

    const rfqInfo = rfq_responses?.length
      ? `Their quotes: ${rfq_responses.map((r: any) => `$${r.unit_price}/unit, MOQ ${r.moq}, ${r.production_days}d production, shipping $${r.shipping_cost}`).join('; ')}`
      : '';

    switch (action) {
      case 'first_message':
        prompt = `You are a professional procurement specialist for Unforgettable Times, a premium event rental company in the US. Write a professional first outreach message to supplier "${supplier_name}". 
Ask about: bulk pricing, MOQ flexibility, private labeling/branding capabilities, shipping to US (east coast), sample availability.
${competitorInfo}
Keep it professional but warm. Under 200 words. Do not use subject lines or email formatting.`;
        break;

      case 'counter_offer':
        prompt = `You are a skilled procurement negotiator for Unforgettable Times. Write a counter-offer message to "${supplier_name}".
${negInfo}
${rfqInfo}
${competitorInfo}
Strategy: Never accept first offer. Reference competitive pricing without naming competitors directly. Push for 10-15% below current offer. Suggest volume commitment in exchange for better pricing. Be firm but professional. Under 200 words.`;
        break;

      case 'shipping_negotiation':
        prompt = `You are negotiating shipping terms with supplier "${supplier_name}" for Unforgettable Times.
${rfqInfo}
Ask about: FOB vs CIF pricing, sea freight vs air freight options, consolidation discounts, freight forwarder recommendations, insurance, customs documentation support.
Goal: Reduce per-unit shipping cost. Under 200 words.`;
        break;

      case 'close_deal':
        prompt = `You are closing a procurement deal with "${supplier_name}" for Unforgettable Times.
${negInfo}
${rfqInfo}
Write a message confirming you want to proceed. Request: final pricing confirmation, payment terms (30% deposit, 70% before shipping), production timeline, quality assurance process, shipping details.
Professional and decisive tone. Under 200 words.`;
        break;

      case 'suggested_reply':
        prompt = `You are responding to supplier "${supplier_name}" on behalf of Unforgettable Times.
Recent conversation:
${recent_conversation || 'No previous messages'}
${rfqInfo}
Write a professional, helpful reply that moves the conversation forward. Under 150 words.`;
        break;

      default:
        return new Response(JSON.stringify({ message: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // Call AI
    const aiResponse = await fetch(`${supabaseUrl}/functions/v1/ai-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a professional procurement specialist. Write concise, professional business messages. No email headers, no subject lines, just the message body.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 500,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI proxy error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const message = aiData?.choices?.[0]?.message?.content || aiData?.content || 'Failed to generate message.';

    return new Response(JSON.stringify({ message, action }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Negotiation AI error:', errText(error));
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
