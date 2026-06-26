import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const COLD_SELLER_PROMPT = `You are a real estate acquisition specialist calling homeowners about their property. Be friendly, professional, and respectful.

"Hi, may I speak with {{first_name}}?

Hi {{first_name}}, my name is Mike and I'm a local real estate investor calling about your property at {{address}}.

I'm not a realtor — I'm an investor who buys properties directly from homeowners, often in as-is condition with a fast close and no fees or commissions.

I'm currently looking for properties in {{city}} and wanted to reach out to see if you've had any thoughts about selling, or if there's any situation with the property where a quick cash offer might be helpful?"

If interested in selling: Qualify — Are you the owner? Any mortgage? How much owed? When are you looking to sell? Best number for my acquisitions manager?

If not interested: "No problem — would it be OK if I reached out in 6 months in case circumstances change?"`;

const FSBO_PROMPT = `You are calling about a For Sale By Owner property listing. Be interested and specific.

"Hi {{first_name}}, I saw your property at {{address}} listed for sale.

I'm a cash buyer — I can close in 14 days, no contingencies, no commissions.

What's the best price you'd consider?"

Qualify motivation, condition, timeline. Get a number.`;

const EXPIRED_PROMPT = `You are calling about an expired real estate listing. Be empathetic.

"Hi {{first_name}}, I saw your property at {{address}} was listed and the listing recently expired.

I'm a cash buyer — I can buy it as-is, no agent commissions, close fast.

Would you still consider selling if the price was right?"`;

const WARM_FOLLOWUP_PROMPT = `You are following up with a homeowner you spoke to previously.

"Hi {{first_name}}, this is Mike with the real estate team — we spoke a while back about your property at {{address}}.

I wanted to circle back and see if anything has changed on your end about possibly selling?"`;

const PROMPTS: Record<string, string> = {
  cold_seller: COLD_SELLER_PROMPT,
  fsbo: FSBO_PROMPT,
  expired: EXPIRED_PROMPT,
  warm_follow_up: WARM_FOLLOWUP_PROMPT,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const BLAND_API_KEY = Deno.env.get('BLAND_API_KEY');
    if (!BLAND_API_KEY) throw new Error('BLAND_API_KEY not configured');

    const body = await req.json();
    const ids: string[] = body.lead_ids || (body.lead_id ? [body.lead_id] : []);
    if (ids.length === 0) throw new Error('lead_ids or lead_id required');
    const agentType = body.agent_type || 'cold_seller';
    const basePrompt = PROMPTS[agentType] || COLD_SELLER_PROMPT;

    const { data: leads, error: leadsErr } = await supabase
      .from('re_leads')
      .select('*')
      .in('id', ids)
      .not('phone', 'is', null);
    if (leadsErr) throw leadsErr;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No callable leads found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dcLeadRows = leads.map((l: any) => ({
      business_id: 're',
      business_name: 'Real Estate OS',
      business: 're',
      first_name: l.first_name,
      last_name: l.last_name,
      phone: l.phone,
      email: l.email,
      address: l.property_address,
      city: l.city,
      state: l.state,
      lead_type: `re_seller_${agentType}`,
      lead_source: l.lead_source || 'csv_upload',
      status: 'queued',
      external_ref_id: l.id,
    }));
    await supabase.from('dc_leads').insert(dcLeadRows);

    const label = body.campaign_name || `RE_${agentType}_${new Date().toISOString().slice(0,10)}_${Date.now()}`;

    let blandSuccessCount = 0;
    let blandError: string | null = null;
    const blandCallIds: string[] = [];

    for (const l of leads as any[]) {
      const taskPrompt = basePrompt
        .replaceAll('{{first_name}}', l.first_name || 'there')
        .replaceAll('{{address}}', l.property_address || 'your property')
        .replaceAll('{{city}}', l.city || 'the area');

      const payload = {
        phone_number: l.phone,
        task: taskPrompt,
        voice: 'June',
        language: 'en-US',
        max_duration: 5,
        answered_by_enabled: true,
        wait_for_greeting: true,
        record: true,
        amd: true,
        request_data: {
          lead_id: l.id,
          hub: 're',
          agent_type: agentType,
          address: l.property_address,
        },
        webhook: `${SUPABASE_URL}/functions/v1/dc-bland-webhook`,
      };

      try {
        const blandRes = await fetch('https://api.bland.ai/v1/calls', {
          method: 'POST',
          headers: { 'Authorization': BLAND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const blandJson = await blandRes.json();
        if (blandRes.ok && blandJson.call_id) {
          blandSuccessCount++;
          blandCallIds.push(blandJson.call_id);
          await supabase.from('re_leads')
            .update({ bland_call_id: blandJson.call_id })
            .eq('id', l.id);
        } else {
          blandError = blandError || JSON.stringify(blandJson);
          console.error('[bland call failed]', l.id, blandJson);
        }
      } catch (e: any) {
        blandError = blandError || e.message;
        console.error('[bland call exception]', l.id, e);
      }
    }

    const { data: campaign } = await supabase
      .from('dc_campaigns')
      .insert({
        name: label,
        business: 're',
        agent_type: agentType,
        status: blandSuccessCount > 0 ? 'active' : 'failed',
        total_leads: leads.length,
        agent_name: `RE ${agentType}`,
      })
      .select()
      .single();

    await supabase
      .from('re_leads')
      .update({
        status: 'queued',
        dc_campaign_id: campaign?.id,
      })
      .in('id', leads.map((l: any) => l.id));

    return new Response(JSON.stringify({
      success: blandSuccessCount > 0,
      campaign_id: campaign?.id,
      bland_calls_started: blandSuccessCount,
      bland_call_ids: blandCallIds,
      leads_queued: leads.length,
      bland_error: blandError,
      message: blandSuccessCount > 0
        ? `Campaign started. ${blandSuccessCount}/${leads.length} calls initiated.`
        : 'Leads queued but no Bland calls succeeded.',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[re-trigger-bland-campaign] error', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
