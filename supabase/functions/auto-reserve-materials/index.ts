import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const MIN_SURVIVAL_DAYS = 20;

/**
 * AUTO-RESERVE MATERIALS — Production-Grade Demand-Based Allocation Engine
 * 
 * For each office + product_type:
 * 1. Use product_type-specific velocity (no approximate splitting)
 * 2. Calculate target_lbs = daily_lbs_usage × coverage_target_days
 * 3. Scale proportionally if overcommitted
 * 4. Enforce survival floor (MIN_SURVIVAL_DAYS)
 * 5. Tiered buffer alerts (15% / 8% / 5%)
 * 6. Divergence detection against baseline ratio
 * 7. Full audit logging per run
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

    // Get velocity data (now includes product_type column)
    const { data: velocity } = await supabase
      .from('v_sku_sales_velocity')
      .select('*');

    // --- SECTION 1: Group velocity by product_type (no /2 split) ---
    const dailyUnitsByProduct: Record<string, number> = { tubes: 0, bags: 0 };
    for (const v of velocity || []) {
      const type = v.product_type;
      if (type && dailyUnitsByProduct.hasOwnProperty(type)) {
        dailyUnitsByProduct[type] += Number(v.avg_daily_velocity_30d) || 0;
      }
    }

    let updated = 0;
    let totalAlerts = 0;

    for (const inv of inventories) {
      const officeId = inv.office_id;
      const totalLbs = Number(inv.total_lbs_available) || 0;
      let runAlerts = 0;
      let survivalFloorEnforced = false;

      // Calculate demand per product type
      const productDemands: {
        product_type: string;
        target_lbs: number;
        coverage_days: number;
        daily_lbs_usage: number;
      }[] = [];

      for (const productType of ['tubes', 'bags']) {
        // Get baseline units_per_lb for this product
        const baseline = (baselines || []).find(
          (b: any) => b.product_type === productType && (b.office_id === officeId || b.office_id === null)
        );
        const unitsPerLb = baseline?.baseline_units_per_lb || (productType === 'tubes' ? 480 : 320);

        // --- True product-specific velocity ---
        const dailyUnits = dailyUnitsByProduct[productType] || 0;
        const dailyLbsUsage = dailyUnits / (unitsPerLb || 1);

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
          daily_lbs_usage: dailyLbsUsage,
        });
      }

      // Proportional scaling if overcommitted
      const totalDemand = productDemands.reduce((s, d) => s + d.target_lbs, 0);
      const scale = totalDemand > totalLbs && totalDemand > 0 ? totalLbs / totalDemand : 1;

      // --- SECTION 2: Enforce survival floor after scaling ---
      const finalAllocations: { product_type: string; scaledLbs: number; manualLbs: number; autoLbs: number }[] = [];

      for (const demand of productDemands) {
        let scaledLbs = Math.round(demand.target_lbs * scale * 100) / 100;

        // Survival floor enforcement
        const survivalFloor = demand.daily_lbs_usage * MIN_SURVIVAL_DAYS;
        if (scaledLbs < survivalFloor && survivalFloor > 0) {
          scaledLbs = survivalFloor;
          survivalFloorEnforced = true;
        }

        // Get existing allocation
        const { data: existing } = await supabase
          .from('raw_material_allocations')
          .select('*')
          .eq('office_id', officeId)
          .eq('product_type', demand.product_type)
          .maybeSingle();

        const manualLbs = Number(existing?.manual_reserved_lbs) || 0;
        let autoLbs = Math.max(0, scaledLbs - manualLbs);

        // --- SECTION 5: Guard against negative/NaN ---
        if (autoLbs < 0 || isNaN(autoLbs)) autoLbs = 0;

        finalAllocations.push({ product_type: demand.product_type, scaledLbs, manualLbs, autoLbs });

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

      // Check if survival floor caused over-allocation
      const totalAfterFloor = finalAllocations.reduce((s, a) => s + a.autoLbs + a.manualLbs, 0);
      if (survivalFloorEnforced && totalAfterFloor > totalLbs && totalLbs > 0) {
        await supabase.from('system_alerts').insert({
          alert_type: 'inventory_insufficient_survival_floor',
          severity: 'critical',
          message: `Insufficient tobacco to maintain minimum ${MIN_SURVIVAL_DAYS}-day survival coverage for all product types. Need ${totalAfterFloor.toFixed(0)} lbs, have ${totalLbs.toFixed(0)} lbs.`,
          recommended_action: 'Procure additional tobacco immediately or manually adjust allocations.',
          dashboard_link: '/portals/production',
          throttle_key: `survival_floor_${officeId}`,
        });
        runAlerts++;
      }

      // --- SECTION 4: Tiered buffer alerts ---
      const { data: allocsAfter } = await supabase
        .from('raw_material_allocations')
        .select('reserved_lbs')
        .eq('office_id', officeId);

      const totalReserved = (allocsAfter || []).reduce((s: number, a: any) => s + (Number(a.reserved_lbs) || 0), 0);
      const unallocatedPct = totalLbs > 0 ? ((totalLbs - totalReserved) / totalLbs) * 100 : 0;

      if (totalLbs > 0) {
        let bufferSeverity: string | null = null;
        if (unallocatedPct < 5) bufferSeverity = 'critical';
        else if (unallocatedPct < 8) bufferSeverity = 'high';
        else if (unallocatedPct < 15) bufferSeverity = 'warning';

        if (bufferSeverity) {
          await supabase.from('system_alerts').insert({
            alert_type: 'raw_buffer_risk',
            severity: bufferSeverity,
            message: `Raw material buffer at ${unallocatedPct.toFixed(1)}% — only ${(totalLbs - totalReserved).toFixed(0)} lbs unallocated.`,
            recommended_action: 'Procure additional tobacco or adjust allocations.',
            dashboard_link: '/portals/production',
            throttle_key: `raw_buffer_risk_${officeId}`,
          });
          runAlerts++;
        }
      }

      // --- SECTION 3: Divergence detection ---
      let divergenceRatio: number | null = null;
      const tubesVelocity = dailyUnitsByProduct.tubes;
      const bagsVelocity = dailyUnitsByProduct.bags;

      if (tubesVelocity > 0 && bagsVelocity > 0) {
        const currentRatio = bagsVelocity / tubesVelocity;
        divergenceRatio = currentRatio;

        // Fetch baseline
        const { data: baselineRow } = await supabase
          .from('product_velocity_ratio_baseline')
          .select('*')
          .eq('office_id', officeId)
          .maybeSingle();

        if (baselineRow) {
          const baselineRatio = Number(baselineRow.baseline_ratio) || 1;
          const deviation = Math.abs(currentRatio - baselineRatio) / (baselineRatio || 1);

          if (deviation > 0.25) {
            await supabase.from('system_alerts').insert({
              alert_type: 'demand_divergence_detected',
              severity: 'warning',
              message: `Demand divergence detected — bags/tubes ratio shifted from ${baselineRatio.toFixed(2)} to ${currentRatio.toFixed(2)} (${(deviation * 100).toFixed(0)}% deviation). Allocation review recommended.`,
              recommended_action: 'Review product mix and adjust allocations if trend persists.',
              dashboard_link: '/portals/production',
              throttle_key: `demand_divergence_${officeId}`,
            });
            runAlerts++;
          }

          // Update baseline
          await supabase
            .from('product_velocity_ratio_baseline')
            .update({ baseline_ratio: currentRatio, last_updated_at: new Date().toISOString() })
            .eq('id', baselineRow.id);
        } else {
          // Seed baseline
          await supabase
            .from('product_velocity_ratio_baseline')
            .insert({ office_id: officeId, baseline_ratio: currentRatio });
        }
      }

      totalAlerts += runAlerts;

      // --- SECTION 6: Audit logging ---
      await supabase.from('allocation_run_logs').insert({
        office_id: officeId,
        total_lbs: totalLbs,
        total_reserved: totalReserved,
        unallocated_pct: Math.round(unallocatedPct * 100) / 100,
        divergence_ratio: divergenceRatio,
        alerts_fired: runAlerts,
        survival_floor_enforced: survivalFloorEnforced,
      });
    }

    return new Response(
      JSON.stringify({ success: true, allocations_updated: updated, alerts_fired: totalAlerts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
