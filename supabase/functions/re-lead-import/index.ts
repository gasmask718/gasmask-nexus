import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TIER_1_STATES = ['FL', 'TX', 'GA', 'NC', 'OH', 'TN'];
const TIER_2_STATES = ['IN', 'MO', 'MI', 'PA', 'AZ', 'MD', 'NJ'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const targetStates = body.states || TIER_1_STATES;
  const sources = body.sources || ['propstream', 'zillow', 'batchleads'];

  // Create automation log
  const { data: logEntry } = await supabase.from('re_automation_log').insert({
    automation_type: 'lead_import',
    status: 'running',
    source: sources.join(','),
    states: targetStates,
  }).select().single();

  let totalImported = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  try {
    // === PROPSTREAM ===
    if (sources.includes('propstream')) {
      const PROPSTREAM_API_KEY = Deno.env.get('PROPSTREAM_API_KEY');
      if (PROPSTREAM_API_KEY) {
        for (const state of targetStates) {
          try {
            const res = await fetch('https://api.propstream.com/v2/properties/search', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${PROPSTREAM_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                state, equity_min: 40, max_price: 500000, limit: 500,
                lead_types: ['pre_foreclosure', 'tax_delinquent', 'vacant', 'high_equity'],
              }),
            });
            if (res.ok) {
              const data = await res.json();
              const leads = (data.results || data.properties || []).map((p: any) => ({
                first_name: p.owner_first_name || p.first_name,
                last_name: p.owner_last_name || p.last_name,
                property_address: p.address || p.property_address,
                city: p.city, state: p.state, zip: p.zip, county: p.county,
                bedrooms: p.bedrooms, bathrooms: p.bathrooms, sqft: p.sqft,
                year_built: p.year_built, estimated_value: p.estimated_value,
                arv: p.arv || p.estimated_value, asking_price: p.asking_price,
                equity_percentage: p.equity_percentage,
                lead_type: p.lead_type || 'pre_foreclosure',
                lead_source: 'propstream', status: 'new',
              }));
              const result = await dedupeAndInsert(supabase, leads);
              totalImported += result.imported;
              totalSkipped += result.skipped;
            } else {
              errors.push(`PropStream ${state}: ${res.status}`);
            }
          } catch (e) { errors.push(`PropStream ${state}: ${e.message}`); }
        }
      } else {
        errors.push('PROPSTREAM_API_KEY not configured');
      }
    }

    // === ZILLOW via RapidAPI ===
    if (sources.includes('zillow')) {
      const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY');
      if (RAPIDAPI_KEY) {
        for (const state of targetStates) {
          try {
            for (const searchType of ['fsbo', 'price_reduced', 'days_on_market_60']) {
              const res = await fetch(`https://zillow-com1.p.rapidapi.com/propertyExtendedSearch?state=${state}&status_type=ForSaleByOwner&home_type=Houses`, {
                headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': 'zillow-com1.p.rapidapi.com' },
              });
              if (res.ok) {
                const data = await res.json();
                const leads = (data.props || []).slice(0, 100).map((p: any) => ({
                  property_address: p.address || p.streetAddress,
                  city: p.city, state: p.state, zip: p.zipcode,
                  bedrooms: p.bedrooms, bathrooms: p.bathrooms, sqft: p.livingArea,
                  estimated_value: p.price, asking_price: p.price,
                  lead_type: searchType === 'fsbo' ? 'fsbo' : searchType === 'price_reduced' ? 'price_reduced' : 'stale_listing',
                  lead_source: 'zillow', status: 'new',
                }));
                const result = await dedupeAndInsert(supabase, leads);
                totalImported += result.imported;
                totalSkipped += result.skipped;
              }
            }
          } catch (e) { errors.push(`Zillow ${state}: ${e.message}`); }
        }
      } else {
        errors.push('RAPIDAPI_KEY not configured');
      }
    }

    // === BATCHLEADS ===
    if (sources.includes('batchleads')) {
      const BATCHLEADS_API_KEY = Deno.env.get('BATCHLEADS_API_KEY');
      if (BATCHLEADS_API_KEY) {
        for (const state of targetStates) {
          try {
            const res = await fetch('https://api.batchleads.io/api/v2/property/search', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${BATCHLEADS_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                state, equity_percent_min: 40, max_value: 500000, limit: 500,
                property_types: ['SFR'], statuses: ['pre_foreclosure', 'tax_delinquent', 'vacant', 'absentee_owner'],
              }),
            });
            if (res.ok) {
              const data = await res.json();
              const leads = (data.data || data.results || []).map((p: any) => ({
                first_name: p.owner_first_name, last_name: p.owner_last_name,
                property_address: p.property_address || p.address,
                city: p.city, state: p.state, zip: p.zip, county: p.county,
                bedrooms: p.bedrooms, bathrooms: p.bathrooms, sqft: p.sqft,
                year_built: p.year_built, estimated_value: p.estimated_value,
                equity_percentage: p.equity_percent,
                lead_type: p.status || 'absentee_owner',
                lead_source: 'batchleads', status: 'new',
              }));
              const result = await dedupeAndInsert(supabase, leads);
              totalImported += result.imported;
              totalSkipped += result.skipped;
            }
          } catch (e) { errors.push(`BatchLeads ${state}: ${e.message}`); }
        }
      } else {
        errors.push('BATCHLEADS_API_KEY not configured');
      }
    }

    // Update log
    await supabase.from('re_automation_log').update({
      status: errors.length > 0 && totalImported === 0 ? 'failed' : 'completed',
      leads_imported: totalImported,
      leads_skipped: totalSkipped,
      leads_processed: totalImported + totalSkipped,
      error_message: errors.length > 0 ? errors.join('; ') : null,
      completed_at: new Date().toISOString(),
    }).eq('id', logEntry?.id);

    // SMS David
    const DAVID_PHONE = Deno.env.get('DAVID_PHONE');
    if (DAVID_PHONE && totalImported > 0) {
      await supabase.functions.invoke('send-sms', {
        body: {
          to: DAVID_PHONE,
          message: `🏠 RE OS: ${totalImported} leads imported from ${sources.join(', ')} across ${targetStates.join(', ')}. ${totalSkipped} duplicates skipped.`,
        },
      });
    }

    return new Response(JSON.stringify({
      success: true, imported: totalImported, skipped: totalSkipped, errors,
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

async function dedupeAndInsert(supabase: any, leads: any[]) {
  let imported = 0, skipped = 0;
  for (const lead of leads) {
    if (!lead.property_address) { skipped++; continue; }
    const { data: existing } = await supabase.from('re_leads')
      .select('id').eq('property_address', lead.property_address).limit(1);
    if (existing && existing.length > 0) { skipped++; continue; }
    const { error } = await supabase.from('re_leads').insert(lead);
    if (error) { skipped++; } else { imported++; }
  }
  return { imported, skipped };
}
