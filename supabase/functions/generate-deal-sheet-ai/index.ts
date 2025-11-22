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

    const { lead_id, acquisition_id } = await req.json();

    console.log(`Generating deal sheet for lead: ${lead_id}`);

    // Fetch lead and comps
    const { data: lead, error: leadError } = await supabase
      .from("leads_raw")
      .select("*, ai_comps(*)")
      .eq("id", lead_id)
      .single();

    if (leadError) throw leadError;

    const comps = lead.ai_comps?.[0];

    // Generate marketing content with AI
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
            content: 'You are a real estate marketing expert. Create compelling deal sheets and marketing copy.'
          },
          {
            role: 'user',
            content: `Create marketing materials for this wholesale deal:

Property: ${lead.address}, ${lead.city}, ${lead.state} ${lead.zip_code}
Offer Price: $${comps?.offer_price || lead.estimated_value}
ARV: $${comps?.arv || 'N/A'}
Repair Cost: $${comps?.repair_cost || 'N/A'}
Assignment Fee: $${comps?.assignment_fee || 'N/A'}
Property Type: ${lead.property_type}

Generate:
1. A compelling email subject line and body (300 words)
2. SMS pitch (160 characters)
3. Social media post (280 characters)
4. Executive summary for pitch deck (200 words)

Format as JSON with keys: email_subject, email_body, sms_pitch, social_post, executive_summary`
          }
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    // Parse AI response
    let marketing;
    try {
      marketing = JSON.parse(content);
    } catch {
      marketing = {
        email_subject: "Exclusive Wholesale Deal",
        email_body: content,
        sms_pitch: "Hot deal! Contact for details.",
        social_post: "New wholesale opportunity!",
        executive_summary: content
      };
    }

    // Create deal sheet
    const { data: dealSheet, error: sheetError } = await supabase
      .from("deal_sheets")
      .insert([{
        lead_id,
        acquisition_id,
        title: `${lead.address} - Wholesale Deal`,
        summary: marketing.executive_summary,
        email_template: `Subject: ${marketing.email_subject}\n\n${marketing.email_body}`,
        sms_template: marketing.sms_pitch,
        social_media_copy: marketing.social_post,
      }])
      .select()
      .single();

    if (sheetError) throw sheetError;

    console.log(`Deal sheet created: ${dealSheet.id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        deal_sheet_id: dealSheet.id,
        marketing_preview: marketing
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating deal sheet:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});