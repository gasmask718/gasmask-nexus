import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * AUTO-RESERVE MATERIALS — Nightly Demand-Based Allocation Engine
 * 
 * For each office + product_type:
 * 1. Calculate daily_lbs_usage from velocity + baseline_units_per_lb
 * 2. Calculate target_lbs = daily_lbs_usage × coverage_target_days
 * 3. Set auto_reserved_lbs, scale proportionally if overcommitted
 * 4. Fire alerts if unallocated buffer < 10%
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get all offices with tobacco inventory
    const { data: inventories, error: invErr } = await supabase
      .from('raw_material_inventory')
      .select('*')
      .eq('material_type', 'tobacco');

    if (invErr) throw invErr;
    if (!inventories?.length) {
      return new Response(
        JSON.stringify({ success: true, message: 'No tobacco inventory found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get baselines for unit-to-lb conversion
    const { data: baselines } = await supabase
      .from('production_conversion_baseline')
      .select('*');

    // Get velocity data
    const { data: velocity } = await supabase
      .from('v_sku_sales_velocity')
      .select('*');

    let updated = 0;
    let alerts = 0;

    for (const inv of inventories) {
      const officeId = inv.office_id;
      const totalLbs = Number(inv.total_lbs_available) || 0;

      // Calculate demand per product type
      const productDemands: { product_type: string; target_lbs: number; coverage_days: number }[] = [];

      for (const productType of ['tubes', 'bags']) {
        // Get baseline units_per_lb for this product
        const baseline = (baselines || []).find(
          (b: any) => b.product_type === productType && (b.office_id === officeId || b.office_id === null)
        );
        const unitsPerLb = baseline?.baseline_units_per_lb || (productType === 'tubes' ? 480 : 320);

        // Get velocity (aggregate daily units across all brands)
        const dailyUnits = (velocity || []).reduce(
          (sum: number, v: any) => sum + (Number(v.avg_daily_velocity_30d) || 0), 0
        ) / 2; // rough split — in future, use product_type-specific velocity

        const dailyLbsUsage = dailyUnits / unitsPerLb;

        // Get existing allocation for coverage_target_days
        const { data: alloc } = await supabase
          .from('raw_material_allocations')
          .select('*')
          .eq('office_id', officeId)
          .eq('product_type', productType)
          .maybeSingle();

        const coverageDays = alloc?.coverage_target_days || 30;
        const targetLbs = dailyLbsUsage * coverageDays;
        const manualLbs = Number(alloc?.manual_reserved_lbs) || 0;

        productDemands.push({
          product_type: productType,
          target_lbs: targetLbs + manualLbs,
          coverage_days: coverageDays,
        });
      }

      // Proportional scaling if overcommitted
      const totalDemand = productDemands.reduce((s, d) => s + d.target_lbs, 0);
      const scale = totalDemand > totalLbs ? totalLbs / totalDemand : 1;

      for (const demand of productDemands) {
        const scaledLbs = Math.round(demand.target_lbs * scale * 100) / 100;

        // Get existing allocation
        const { data: existing } = await supabase
          .from('raw_material_allocations')
          .select('*')
          .eq('office_id', officeId)
          .eq('product_type', demand.product_type)
          .maybeSingle();

        const manualLbs = Number(existing?.manual_reserved_lbs) || 0;
        const autoLbs = Math.max(0, scaledLbs - manualLbs);

        if (existing) {
          await supabase
            .from('raw_material_allocations')
            .update({
              auto_reserved_lbs: autoLbs,
              reserved_lbs: autoLbs + manualLbs,
              last_updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('raw_material_allocations')
            .insert({
              office_id: officeId,
              product_type: demand.product_type,
              auto_reserved_lbs: autoLbs,
              manual_reserved_lbs: 0,
              reserved_lbs: autoLbs,
              coverage_target_days: demand.coverage_days,
            });
        }
        updated++;
      }

      // Check unallocated buffer
      const { data: allocsAfter } = await supabase
        .from('raw_material_allocations')
        .select('reserved_lbs')
        .eq('office_id', officeId);

      const totalReserved = (allocsAfter || []).reduce((s: number, a: any) => s + Number(a.reserved_lbs), 0);
      const unallocatedPct = totalLbs > 0 ? ((totalLbs - totalReserved) / totalLbs) * 100 : 0;

      if (unallocatedPct < 10 && totalLbs > 0) {
        await supabase.from('system_alerts').insert({
          alert_type: 'raw_buffer_risk',
          severity: 'warning',
          message: `Raw material buffer at ${unallocatedPct.toFixed(1)}% — only ${(totalLbs - totalReserved).toFixed(0)} lbs unallocated.`,
          recommended_action: 'Procure additional tobacco or adjust allocations.',
          dashboard_link: '/portals/production',
          throttle_key: `raw_buffer_risk_${officeId}`,
        });
        alerts++;
      }
    }

    // Demand divergence detection
    if (velocity?.length) {
      // Simplified: check if total velocity is heavily skewed
      // In production, this would compare product-type-specific velocities
      const totalVelocity = (velocity || []).reduce(
        (s: number, v: any) => s + (Number(v.avg_daily_velocity_30d) || 0), 0
      );
      if (totalVelocity > 0) {
        // Future: compare bags_velocity / tubes_velocity against baseline
      }
    }

    return new Response(
      JSON.stringify({ success: true, allocations_updated: updated, alerts_fired: alerts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
