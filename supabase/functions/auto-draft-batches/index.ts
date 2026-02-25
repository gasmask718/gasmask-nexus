import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Query brands needing production
    const { data: coverage, error: covError } = await supabase
      .from('v_inventory_coverage_intelligence')
      .select('*')
      .gt('recommended_lbs_to_produce', 0)
      .in('risk_level', ['red', 'critical']);

    if (covError) throw covError;

    // Get a default office
    const { data: offices } = await supabase
      .from('production_offices')
      .select('id')
      .eq('active', true)
      .limit(1);

    const defaultOfficeId = offices?.[0]?.id || null;
    let draftsCreated = 0;

    for (const item of coverage || []) {
      const { error: insertError } = await supabase
        .from('production_batches')
        .insert({
          brand: item.brand,
          tobacco_lbs: item.recommended_lbs_to_produce,
          status: 'draft',
          generated_by_system: true,
          system_generation_note: 'Auto-Drafted from Demand Intelligence',
          office_id: defaultOfficeId,
          inventory_state: 'pending',
        });

      if (insertError) {
        console.error(`Failed to draft batch for ${item.brand}:`, insertError.message);
        continue;
      }

      draftsCreated++;

      // Create visibility alert
      await supabase.from('system_alerts').insert({
        alert_type: 'auto_draft_created',
        brand: item.brand,
        severity: 'warning',
        message: `Auto-drafted batch for ${item.brand}: ${item.recommended_lbs_to_produce} lbs (${item.risk_level} risk).`,
        recommended_action: 'Review and approve or modify draft batch.',
        dashboard_link: '/portals/production',
        throttle_key: `auto_draft_${item.brand}`,
      });
    }

    return new Response(
      JSON.stringify({ success: true, drafts_created: draftsCreated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
