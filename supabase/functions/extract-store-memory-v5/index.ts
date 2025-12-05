import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { store_id } = await req.json();
    
    if (!store_id) {
      return new Response(
        JSON.stringify({ error: 'store_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[V5 Extractor] Processing store: ${store_id}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error('[V5 Extractor] LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all store data
    const [storeResult, interactionsResult, contactsResult, ordersResult, invoicesResult] = await Promise.all([
      supabase.from("store_master").select("*").eq("id", store_id).single(),
      supabase.from("contact_interactions").select("*").eq("store_id", store_id).order("created_at", { ascending: false }).limit(100),
      supabase.from("store_contacts").select("*").eq("store_id", store_id),
      supabase.from("wholesale_orders").select("*").eq("store_id", store_id).order("created_at", { ascending: false }).limit(50),
      supabase.from("store_invoices").select("*").eq("store_id", store_id).order("created_at", { ascending: false }).limit(50),
    ]);

    const store = storeResult.data;
    const interactions = interactionsResult.data || [];
    const contacts = contactsResult.data || [];
    const orders = ordersResult.data || [];
    const invoices = invoicesResult.data || [];

    if (!store) {
      return new Response(
        JSON.stringify({ error: 'Store not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[V5 Extractor] Data gathered - Interactions: ${interactions.length}, Contacts: ${contacts.length}, Orders: ${orders.length}`);

    // Build comprehensive data payload for AI
    const rawData = {
      store: {
        name: store.store_name,
        address: store.address,
        city: store.city,
        state: store.state,
        phone: store.phone,
        notes: store.notes,
        status: store.status,
        region: store.region,
      },
      contacts: contacts.map(c => ({
        name: c.name,
        role: c.role,
        phone: c.phone,
        notes: c.notes,
      })),
      interactions: interactions.map(i => ({
        type: i.interaction_type || i.type,
        notes: i.notes,
        date: i.created_at,
        outcome: i.outcome,
      })),
      orders_summary: {
        total_orders: orders.length,
        recent_orders: orders.slice(0, 10).map(o => ({
          date: o.created_at,
          total: o.total_amount,
          status: o.status,
        })),
      },
      invoices_summary: {
        total_invoices: invoices.length,
        unpaid_count: invoices.filter((i: any) => i.status !== 'paid').length,
      },
    };

    const prompt = `You are an expert CRM analyst for a tobacco grabba company (brands: GasMask, HotMama, Hot Scalati, Grabba R Us).

Analyze ALL the following customer history data and extract a comprehensive memory profile.

CUSTOMER DATA:
${JSON.stringify(rawData, null, 2)}

Extract and return ONLY valid JSON with this exact structure:
{
  "personal_profile": {
    "background": "Who they are - culture, origin, personality traits observed from interactions",
    "family_details": "Owner name, family members involved (brother, cousin, nephew, workers), family business structure",
    "communication_style": "How they prefer to communicate - texting, calls, response speed, tone",
    "relationship_notes": "Trust signals, rapport history, how we relate to them",
    "loyalty_triggers": "What makes them happy and loyal",
    "frustration_triggers": "What frustrates them or causes issues"
  },
  "operational_profile": {
    "store_type": "Type of store",
    "buying_behavior": "How they order - frequency, volume, patterns",
    "preferred_brands": ["array of preferred brands"],
    "payment_style": "How they pay - cash, credit, delays",
    "delivery_preferences": "Delivery or pickup preferences"
  },
  "red_flags": ["Array of risk behaviors, payment issues, reliability concerns"],
  "opportunities": ["Array of upsell potential, wholesale interest, ambassador potential, expansion possibilities"],
  "behavior_summary": "2-3 sentence summary of their overall behavior and relationship trajectory",
  "extraction_confidence": 0.0 to 1.0 based on data quality
}

Be concise but comprehensive. Extract real insights from the data provided.`;

    console.log('[V5 Extractor] Calling Lovable AI...');

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[V5 Extractor] AI error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const extractedText = aiData.choices?.[0]?.message?.content || '';

    console.log('[V5 Extractor] Raw AI response received');

    // Parse JSON from response
    let extracted;
    try {
      const jsonMatch = extractedText.match(/```json\s*([\s\S]*?)\s*```/) || 
                       extractedText.match(/```\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : extractedText;
      extracted = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[V5 Extractor] JSON parse error:', parseError);
      console.log('[V5 Extractor] Raw text:', extractedText.substring(0, 500));
      throw new Error('Failed to parse AI response as JSON');
    }

    // Upsert to store_extracted_profiles
    const profileData = {
      store_id,
      personal_profile: extracted.personal_profile || {},
      operational_profile: extracted.operational_profile || {},
      red_flags: extracted.red_flags || [],
      opportunities: extracted.opportunities || [],
      extraction_confidence: extracted.extraction_confidence || 0.7,
      source_notes_count: interactions.length + contacts.length,
      last_extracted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("store_extracted_profiles")
      .upsert(profileData, { onConflict: 'store_id' });

    if (upsertError) {
      console.error('[V5 Extractor] Upsert error:', upsertError);
      throw new Error(`Database error: ${upsertError.message}`);
    }

    console.log('[V5 Extractor] Profile saved successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        store_id,
        extracted_fields: Object.keys(extracted),
        data_sources: {
          interactions: interactions.length,
          contacts: contacts.length,
          orders: orders.length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[V5 Extractor] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
