import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storeId, storeName, notesText, notesCount } = await req.json();

    console.log(`[ProfileExtraction] Processing store: ${storeName} (${storeId})`);
    console.log(`[ProfileExtraction] Notes count: ${notesCount}`);

    if (!openAIApiKey) {
      console.warn('[ProfileExtraction] OpenAI API key not configured');
      return new Response(
        JSON.stringify({ 
          profile: null,
          error: 'AI extraction not configured' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are an expert CRM analyst for Grabba (tobacco leaf brands: GasMask, HotMama, Hot Scalati, Grabba R Us).

Extract a structured profile from customer notes focusing on:
1. Personal/relationship details (owner name, communication style, loyalty triggers)
2. Operational patterns (store type, order frequency, preferred brands, payment/delivery preferences)
3. Red flags (payment issues, reliability concerns)
4. Growth opportunities (ambassador potential, expansion possibilities)

Return ONLY valid JSON matching this structure:
{
  "personal_profile": {
    "owner_name": "string or null",
    "nicknames": ["array of strings"],
    "background_notes": "string or null",
    "communication_style": "string or null",
    "loyalty_triggers": ["array of strings"],
    "frustration_triggers": ["array of strings"],
    "favorite_products": ["array of strings"],
    "restock_habits_summary": "string or null",
    "personal_rapport_notes": "string or null"
  },
  "operational_profile": {
    "store_type": "string or null",
    "average_monthly_spend": number or null,
    "typical_order_pattern": "string or null",
    "preferred_brands": ["array of strings"],
    "payment_preferences": "string or null",
    "delivery_preference": "string or null",
    "delivery_window": "string or null",
    "inventory_style": "string or null",
    "promo_preference": "string or null",
    "ambassador_potential": boolean,
    "ambassador_potential_note": "string or null",
    "can_host_posters": boolean,
    "wants_affiliate_system": boolean
  },
  "red_flags": {
    "notes": ["array of string warnings"]
  },
  "opportunities": {
    "notes": ["array of opportunity statements"]
  },
  "extraction_confidence": 0.0 to 1.0
}`;

    const userPrompt = `Store: ${storeName}

Customer notes and interactions:
${notesText}

Extract a structured profile from these notes.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ProfileExtraction] OpenAI error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const extractedText = data.choices[0].message.content;

    console.log('[ProfileExtraction] Raw AI response:', extractedText);

    // Parse JSON from response
    let profile;
    try {
      // Try to extract JSON if wrapped in code blocks
      const jsonMatch = extractedText.match(/```json\s*([\s\S]*?)\s*```/) || 
                       extractedText.match(/```\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : extractedText;
      profile = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[ProfileExtraction] JSON parse error:', parseError);
      throw new Error('Failed to parse AI response as JSON');
    }

    console.log('[ProfileExtraction] Successfully extracted profile');

    return new Response(
      JSON.stringify({ profile }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ProfileExtraction] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        profile: null 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
