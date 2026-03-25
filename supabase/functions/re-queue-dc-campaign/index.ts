import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: logEntry } = await supabase.from('re_automation_log').insert({
    automation_type: 'queue_dc_campaign',
    status: 'running',
    source: 'dynasty_connect',
  }).select().single();

  try {
    // Get queued leads, A-score first
    const { data: leads, error } = await supabase.from('re_leads')
      .select('*')
      .eq('status', 'queued')
      .not('phone', 'is', null)
      .order('deal_score', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) throw error;
    if (!leads || leads.length === 0) {
      await supabase.from('re_automation_log').update({
        status: 'completed', leads_processed: 0, completed_at: new Date().toISOString(),
      }).eq('id', logEntry?.id);
      return new Response(JSON.stringify({ success: true, queued: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create DC campaign
    const today = new Date().toISOString().split('T')[0];
    const { data: campaign } = await supabase.from('dialer_campaigns').insert({
      name: `RE-AUTO-${today}`,
      business_name: 'Dynasty Real Estate',
      status: 'active',
      total_leads: leads.length,
    }).select().single();

    // Insert into dc_leads
    const dcLeads = leads.map(l => ({
      business_name: 'Dynasty Real Estate',
      first_name: l.first_name,
      last_name: l.last_name,
      phone: l.phone,
      email: l.email,
      address: l.property_address,
      city: l.city,
      state: l.state,
      zip: l.zip,
      status: 'queued',
      campaign_id: campaign?.id,
      re_lead_id: l.id,
      metadata: {
        arv: l.arv,
        asking_price: l.asking_price,
        deal_score: l.deal_score,
        lead_type: l.lead_type,
        property_address: l.property_address,
      },
    }));

    await supabase.from('dc_leads').insert(dcLeads);

    // Update re_leads status
    const leadIds = leads.map(l => l.id);
    await supabase.from('re_leads')
      .update({ status: 'called' })
      .in('id', leadIds);

    await supabase.from('re_automation_log').update({
      status: 'completed',
      leads_processed: leads.length,
      leads_imported: leads.length,
      completed_at: new Date().toISOString(),
      metadata: { campaign_id: campaign?.id, campaign_name: `RE-AUTO-${today}` },
    }).eq('id', logEntry?.id);

    return new Response(JSON.stringify({
      success: true, queued: leads.length, campaign_id: campaign?.id,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    await supabase.from('re_automation_log').update({
      status: 'failed', error_message: error.message, completed_at: new Date().toISOString(),
    }).eq('id', logEntry?.id);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
