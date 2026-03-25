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

  const BATCH_SKIP_TRACE_API_KEY = Deno.env.get('BATCH_SKIP_TRACE_API_KEY');
  if (!BATCH_SKIP_TRACE_API_KEY) {
    return new Response(JSON.stringify({ error: 'BATCH_SKIP_TRACE_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json().catch(() => ({}));
  const singleLeadId = body.lead_id;

  // Create log
  const { data: logEntry } = await supabase.from('re_automation_log').insert({
    automation_type: 'skip_trace',
    status: 'running',
    source: 'batch_skip_tracing',
  }).select().single();

  try {
    let query = supabase.from('re_leads')
      .select('id, first_name, last_name, property_address, city, state, zip')
      .eq('skip_traced', false)
      .is('phone', null);

    if (singleLeadId) {
      query = query.eq('id', singleLeadId);
    } else {
      query = query.limit(200);
    }

    const { data: leads, error } = await query;
    if (error) throw error;
    if (!leads || leads.length === 0) {
      await supabase.from('re_automation_log').update({
        status: 'completed', leads_processed: 0, completed_at: new Date().toISOString(),
      }).eq('id', logEntry?.id);
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let phonesFound = 0, dncCount = 0, noPhone = 0;

    // Process in batches of 25
    for (let i = 0; i < leads.length; i += 25) {
      const batch = leads.slice(i, i + 25);
      const records = batch.map(l => ({
        firstName: l.first_name || '',
        lastName: l.last_name || '',
        address: l.property_address,
        city: l.city || '',
        state: l.state || '',
        zip: l.zip || '',
      }));

      try {
        const res = await fetch('https://api.batchskiptracing.com/api/v1/skip-trace', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${BATCH_SKIP_TRACE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ records }),
        });

        if (res.ok) {
          const data = await res.json();
          const results = data.results || data.data || [];

          for (let j = 0; j < batch.length; j++) {
            const lead = batch[j];
            const result = results[j];
            if (!result) {
              await supabase.from('re_leads').update({
                skip_traced: true, status: 'skip_trace_pending',
              }).eq('id', lead.id);
              noPhone++;
              continue;
            }

            const phone = result.phone || result.mobile_phone || result.landline;
            const email = result.email;
            const isDNC = result.dnc === true || result.is_dnc === true;

            if (isDNC) {
              await supabase.from('re_leads').update({
                phone, email, skip_traced: true, status: 'dnc',
              }).eq('id', lead.id);
              dncCount++;
            } else if (phone) {
              await supabase.from('re_leads').update({
                phone, email, skip_traced: true, status: 'queued',
              }).eq('id', lead.id);
              phonesFound++;
            } else {
              await supabase.from('re_leads').update({
                email, skip_traced: true,
              }).eq('id', lead.id);
              noPhone++;
            }
          }
        }
      } catch (e) {
        console.error('Skip trace batch error:', e);
      }
    }

    await supabase.from('re_automation_log').update({
      status: 'completed',
      leads_processed: leads.length,
      leads_imported: phonesFound,
      leads_skipped: dncCount,
      completed_at: new Date().toISOString(),
      metadata: { phones_found: phonesFound, dnc: dncCount, no_phone: noPhone },
    }).eq('id', logEntry?.id);

    return new Response(JSON.stringify({
      success: true, processed: leads.length, phones_found: phonesFound, dnc: dncCount, no_phone: noPhone,
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
