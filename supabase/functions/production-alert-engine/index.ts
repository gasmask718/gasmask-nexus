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

    const alerts: any[] = [];
    const today = new Date().toISOString().split('T')[0];

    // 1. Critical stockouts
    const { data: coverage } = await supabase
      .from('v_inventory_coverage_intelligence')
      .select('*')
      .eq('risk_level', 'critical');

    for (const item of coverage || []) {
      const throttleKey = `stockout_critical_${item.brand}`;
      const { data: existing } = await supabase
        .from('system_alerts')
        .select('id')
        .eq('throttle_key', throttleKey)
        .gte('created_at', `${today}T00:00:00Z`)
        .limit(1);

      if (!existing || existing.length === 0) {
        alerts.push({
          alert_type: 'stockout_critical',
          brand: item.brand,
          severity: 'critical',
          message: `${item.brand} is at CRITICAL risk — ${item.days_of_inventory_remaining ?? 0} days of inventory remaining.`,
          recommended_action: `Produce ${item.recommended_lbs_to_produce ?? 0} lbs immediately.`,
          dashboard_link: '/portals/production/sales-velocity',
          throttle_key: throttleKey,
        });
      }
    }

    // 2. High overrides (>35%) in last 24h
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const { data: highOverrides } = await supabase
      .from('production_demand_overrides')
      .select('*')
      .gt('deviation_pct', 35)
      .gte('created_at', yesterday);

    for (const ovr of highOverrides || []) {
      const throttleKey = `high_override_${ovr.brand}`;
      const { data: existing } = await supabase
        .from('system_alerts')
        .select('id')
        .eq('throttle_key', throttleKey)
        .gte('created_at', `${today}T00:00:00Z`)
        .limit(1);

      if (!existing || existing.length === 0) {
        alerts.push({
          alert_type: 'high_override',
          brand: ovr.brand,
          severity: 'warning',
          message: `High override on ${ovr.brand}: ${ovr.deviation_pct}% deviation from recommendation.`,
          recommended_action: 'Review override justification and production alignment.',
          dashboard_link: '/portals/production/war-room',
          throttle_key: throttleKey,
        });
      }
    }

    // 3. Demand acceleration (14d velocity > 30d velocity * 1.20)
    const { data: allCoverage } = await supabase
      .from('v_inventory_coverage_intelligence')
      .select('*');

    for (const item of allCoverage || []) {
      if (
        item.avg_daily_velocity_14d &&
        item.avg_daily_velocity_30d &&
        item.avg_daily_velocity_14d > item.avg_daily_velocity_30d * 1.2
      ) {
        const throttleKey = `demand_accelerating_${item.brand}`;
        const { data: existing } = await supabase
          .from('system_alerts')
          .select('id')
          .eq('throttle_key', throttleKey)
          .gte('created_at', `${today}T00:00:00Z`)
          .limit(1);

        if (!existing || existing.length === 0) {
          alerts.push({
            alert_type: 'demand_accelerating',
            brand: item.brand,
            severity: 'warning',
            message: `${item.brand} demand is accelerating: 14d velocity (${item.avg_daily_velocity_14d?.toFixed(1)}) exceeds 30d (${item.avg_daily_velocity_30d?.toFixed(1)}) by 20%+.`,
            recommended_action: 'Increase production or verify inventory levels.',
            dashboard_link: '/portals/production/sales-velocity',
            throttle_key: throttleKey,
          });
        }
      }
    }

    // Insert all alerts
    if (alerts.length > 0) {
      const { error } = await supabase.from('system_alerts').insert(alerts);
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({ success: true, alerts_created: alerts.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
