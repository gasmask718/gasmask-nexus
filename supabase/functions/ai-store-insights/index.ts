import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storeId, storeName, notes, orders, invoices, interactions, metrics } = await req.json();

    console.log(`[AI-Store-Insights] Processing store: ${storeName} (${storeId})`);

    if (!LOVABLE_API_KEY) {
      console.error('[AI-Store-Insights] LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const systemPrompt = `You are an AI CRM strategist for a tobacco grabba company (GasMask, HotMama, Hot Scalati, Grabba R Us).
Based on notes, orders, invoices, and interactions, generate a structured JSON object describing:
- Next predicted order timing, product mix, and confidence
- Relationship phase and trend
- Risk, loyalty, health, and influence scores (0–100)
- Forecasted 12-month LTV (low, expected, high)
- Buying style and personality archetype
- Next best action
- Early warning flags and growth opportunities
- Timeline-style relationship chapters

Return ONLY valid JSON matching this structure:
{
  "next_order_date": "2025-01-15T00:00:00Z or null",
  "next_order_confidence": 0.0 to 1.0,
  "next_order_summary": "string",
  "mood_state": "high_buying_mood | neutral | frustrated | at_risk",
  "relationship_phase": "new | growth | loyal | decline | recovery",
  "relationship_trend": "up | down | stable",
  "risk_score": 0 to 100,
  "loyalty_score": 0 to 100,
  "health_score": 0 to 100,
  "influence_score": 0 to 100,
  "ltv_12m_low": number,
  "ltv_12m_expected": number,
  "ltv_12m_high": number,
  "buying_style": "whale | steady | impulse | renegotiator | sample_tester | variable",
  "personality_archetype": "string",
  "next_best_action": "string",
  "early_warning_flags": ["string"],
  "opportunity_flags": ["string"],
  "timeline_chapters": [
    {
      "phase": "First Contact | Growth | Loyalty | Decline | Recovery",
      "summary": "string",
      "from": "2024-01-01T00:00:00Z or null",
      "to": "2024-03-01T00:00:00Z or null"
    }
  ]
}`;

    const userPrompt = `Store: ${storeName}
Store ID: ${storeId}

Notes and interactions:
${notes || 'No notes available'}

Orders summary:
${JSON.stringify(orders || [], null, 2)}

Invoices summary:
${JSON.stringify(invoices || [], null, 2)}

Recent interactions:
${JSON.stringify(interactions || [], null, 2)}

Metrics:
${JSON.stringify(metrics || {}, null, 2)}

Generate a predictive intelligence profile for this store.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI-Store-Insights] AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'Payment required. Please add credits.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 402 }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content || '';

    console.log('[AI-Store-Insights] Raw AI response length:', extractedText.length);

    // Parse JSON from response
    let insights;
    try {
      const jsonMatch = extractedText.match(/```json\s*([\s\S]*?)\s*```/) || 
                       extractedText.match(/```\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : extractedText;
      insights = JSON.parse(jsonText.trim());
    } catch (parseError) {
      console.error('[AI-Store-Insights] JSON parse error:', parseError);
      console.error('[AI-Store-Insights] Raw text:', extractedText.substring(0, 500));
      throw new Error('Failed to parse AI response as JSON');
    }

    // Save to database
    const supabaseClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const insertData = {
      store_id: storeId,
      snapshot_date: new Date().toISOString(),
      next_order_date: insights.next_order_date || null,
      next_order_confidence: insights.next_order_confidence || null,
      next_order_summary: insights.next_order_summary || null,
      mood_state: insights.mood_state || null,
      relationship_phase: insights.relationship_phase || null,
      relationship_trend: insights.relationship_trend || null,
      risk_score: insights.risk_score || null,
      loyalty_score: insights.loyalty_score || null,
      health_score: insights.health_score || null,
      influence_score: insights.influence_score || null,
      ltv_12m_low: insights.ltv_12m_low || null,
      ltv_12m_expected: insights.ltv_12m_expected || null,
      ltv_12m_high: insights.ltv_12m_high || null,
      buying_style: insights.buying_style || null,
      personality_archetype: insights.personality_archetype || null,
      next_best_action: insights.next_best_action || null,
      early_warning_flags: insights.early_warning_flags || [],
      opportunity_flags: insights.opportunity_flags || [],
      timeline_chapters: insights.timeline_chapters || [],
      raw_ai_payload: insights,
    };

    const { error: insertError } = await supabaseClient
      .from('store_ai_insights')
      .insert([insertData]);

    if (insertError) {
      console.error('[AI-Store-Insights] DB insert error:', insertError);
      // Still return insights even if save fails
    } else {
      console.log('[AI-Store-Insights] Successfully saved insights for store:', storeId);
    }

    return new Response(
      JSON.stringify({ success: true, insights, storeId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AI-Store-Insights] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
