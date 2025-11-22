import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { lead_id, document_type, terms } = await req.json();

    // Fetch lead details
    const { data: lead, error: leadError } = await supabase
      .from("leads_raw")
      .select("*, ai_comps(*)")
      .eq("id", lead_id)
      .single();

    if (leadError) throw leadError;

    const comps = lead.ai_comps?.[0];

    console.log(`Generating ${document_type} for ${lead.address}`);

    // Use Lovable AI to generate contract
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a real estate attorney assistant. Generate professional real estate contracts.'
          },
          {
            role: 'user',
            content: `Generate a ${document_type} for this property:

Property: ${lead.address}, ${lead.city}, ${lead.state} ${lead.zip_code}
Seller: ${lead.owner_name}
Offer Price: $${comps?.offer_price || lead.estimated_value}
Property Type: ${lead.property_type}

Additional Terms: ${JSON.stringify(terms || {})}

Generate a professional, legally sound ${document_type} with all standard clauses and provisions.`
          }
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const contractText = aiData.choices[0].message.content;

    // Store contract in database
    const { data: document, error: docError } = await supabase
      .from("offer_documents")
      .insert([{
        lead_id,
        document_type,
        terms: {
          offer_price: comps?.offer_price || lead.estimated_value,
          property_address: `${lead.address}, ${lead.city}, ${lead.state} ${lead.zip_code}`,
          seller_name: lead.owner_name,
          ...terms,
          generated_text: contractText,
        },
      }])
      .select()
      .single();

    if (docError) throw docError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        document_id: document.id,
        contract_preview: contractText.substring(0, 500) + '...'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating contract:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});