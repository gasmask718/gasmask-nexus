import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SignalResult {
  signal_type: string;
  business_id: string;
  business_name: string;
  action: 'mission_created' | 'duplicate_detected' | 'context_appended';
  mission_id?: string;
  details: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Auth: owner/admin only ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['owner', 'admin'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ──────────────────────────────────────────────
    // STEP 1: Get active businesses with industry catalog links
    // ──────────────────────────────────────────────
    const { data: businesses, error: bizError } = await supabase
      .from('businesses')
      .select('id, name, industry_catalog_id, is_active, operational_status')
      .eq('is_active', true)
      .not('industry_catalog_id', 'is', null);

    if (bizError) throw bizError;
    if (!businesses || businesses.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        signals_detected: 0,
        missions_created: 0,
        duplicates_found: 0,
        results: [],
        note: 'No active businesses with industry catalog links found',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ──────────────────────────────────────────────
    // STEP 2: Get industry margin expectations
    // ──────────────────────────────────────────────
    const catalogIds = [...new Set(businesses.map(b => b.industry_catalog_id).filter(Boolean))];

    const { data: industries } = await supabase
      .from('industry_catalog')
      .select('id, industry_name, margin_expectation_low')
      .in('id', catalogIds);

    const industryMap = new Map(
      (industries || []).map(i => [i.id, i])
    );

    // Filter to businesses whose industry has a defined margin_expectation_low
    const eligibleBusinesses = businesses.filter(b => {
      const industry = industryMap.get(b.industry_catalog_id!);
      return industry && industry.margin_expectation_low != null && industry.margin_expectation_low > 0;
    });

    if (eligibleBusinesses.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        signals_detected: 0,
        missions_created: 0,
        duplicates_found: 0,
        results: [],
        note: 'No businesses with defined margin expectations found',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ──────────────────────────────────────────────
    // STEP 3: Get most recent financial snapshot per business
    // with confidence >= 0.7 and revenue > 0
    // ──────────────────────────────────────────────
    const bizIds = eligibleBusinesses.map(b => b.id);

    const { data: snapshots } = await supabase
      .from('business_financial_snapshots')
      .select('id, business_id, total_revenue, total_expenses, net_profit, confidence_score, snapshot_date, period_type')
      .in('business_id', bizIds)
      .gte('confidence_score', 70)
      .gt('total_revenue', 0)
      .order('snapshot_date', { ascending: false });

    // Get the most recent snapshot per business
    const latestSnapshotByBiz = new Map<string, typeof snapshots extends (infer T)[] | null ? T : never>();
    (snapshots || []).forEach(s => {
      if (!latestSnapshotByBiz.has(s.business_id)) {
        latestSnapshotByBiz.set(s.business_id, s);
      }
    });

    if (latestSnapshotByBiz.size === 0) {
      return new Response(JSON.stringify({
        success: true,
        signals_detected: 0,
        missions_created: 0,
        duplicates_found: 0,
        results: [],
        note: 'No qualifying financial snapshots found (confidence >= 70, revenue > 0)',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ──────────────────────────────────────────────
    // STEP 4: Detect margin deviations
    // ──────────────────────────────────────────────
    const deviations: Array<{
      business: typeof eligibleBusinesses[0];
      snapshot: NonNullable<typeof snapshots>[0];
      industry: NonNullable<typeof industries>[0];
      actualMargin: number;
      expectedMarginLow: number;
      marginGap: number;
    }> = [];

    for (const biz of eligibleBusinesses) {
      const snapshot = latestSnapshotByBiz.get(biz.id);
      if (!snapshot) continue;

      const industry = industryMap.get(biz.industry_catalog_id!);
      if (!industry || !industry.margin_expectation_low) continue;

      // Calculate actual margin: (Revenue - Expenses) / Revenue * 100
      const actualMargin = ((snapshot.total_revenue - snapshot.total_expenses) / snapshot.total_revenue) * 100;
      const expectedMarginLow = industry.margin_expectation_low;
      const marginGap = expectedMarginLow - actualMargin;

      // Signal threshold: gap >= 5 percentage points
      if (marginGap >= 5) {
        deviations.push({
          business: biz,
          snapshot,
          industry,
          actualMargin: Math.round(actualMargin * 10) / 10,
          expectedMarginLow,
          marginGap: Math.round(marginGap * 10) / 10,
        });
      }
    }

    if (deviations.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        signals_detected: 0,
        missions_created: 0,
        duplicates_found: 0,
        results: [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ──────────────────────────────────────────────
    // STEP 5: Duplicate prevention
    // ──────────────────────────────────────────────
    const sourceRefs = deviations.map(d =>
      `margin:${d.business.id}:${d.snapshot.period_type}`
    );

    const { data: existingMissions } = await supabase
      .from('owner_missions')
      .select('id, source_reference, status')
      .in('source_reference', sourceRefs)
      .in('status', ['pending', 'in_progress', 'blocked']);

    const existingRefMap = new Map(
      (existingMissions || []).map(m => [m.source_reference, m])
    );

    // ──────────────────────────────────────────────
    // STEP 6: Process signals — create missions or append context
    // ──────────────────────────────────────────────
    const results: SignalResult[] = [];

    for (const { business, snapshot, industry, actualMargin, expectedMarginLow, marginGap } of deviations) {
      const sourceRef = `margin:${business.id}:${snapshot.period_type}`;
      const severityScore = Math.min(10, Math.floor(marginGap / 2));

      let priority: string;
      if (marginGap >= 20) priority = 'critical';
      else if (marginGap >= 10) priority = 'high';
      else priority = 'medium';

      const existing = existingRefMap.get(sourceRef);

      if (existing) {
        // DUPLICATE: Append context, update severity
        await supabase.from('owner_mission_activity').insert({
          mission_id: existing.id,
          action: 'context_appended',
          details: `Margin gap now ${marginGap}%. Actual: ${actualMargin}%, Expected min: ${expectedMarginLow}%. Severity: ${severityScore}/10.`,
          performed_by: 'system',
        });

        await supabase
          .from('owner_missions')
          .update({
            severity_score: severityScore,
            priority,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        results.push({
          signal_type: 'margin_deviation',
          business_id: business.id,
          business_name: business.name,
          action: 'duplicate_detected',
          mission_id: existing.id,
          details: `Active mission exists. Context appended: ${marginGap}% gap.`,
        });
      } else {
        // NEW MISSION
        const title = `Margin below industry expectation: ${business.name}`;
        const description = `Actual margin: ${actualMargin}%\nExpected minimum (${industry.industry_name}): ${expectedMarginLow}%\nGap: ${marginGap}%.\nReview pricing, costs, and operational efficiency.`;

        const { data: newMission, error: createError } = await supabase
          .from('owner_missions')
          .insert({
            owner_id: user.id,
            title,
            description,
            category: 'strategic',
            priority,
            status: 'pending',
            source: 'floor_generated',
            floor_origin: 'floor5_finance',
            source_entity_type: 'business',
            source_entity_id: business.id,
            source_reference: sourceRef,
            severity_score: severityScore,
            business_id: business.id,
            tags: ['margin', 'strategy', 'profitability'],
          })
          .select('id')
          .single();

        if (createError) {
          console.error(`Failed to create mission for business ${business.id}:`, createError);
          continue;
        }

        // Log signal detection + mission creation
        await supabase.from('owner_mission_activity').insert([
          {
            mission_id: newMission.id,
            action: 'signal_detected',
            details: `Margin signal: ${business.name} operating at ${actualMargin}% vs ${expectedMarginLow}% expected (${industry.industry_name}). Gap: ${marginGap}%.`,
            performed_by: 'system',
          },
          {
            mission_id: newMission.id,
            action: 'mission_created',
            details: `Strategic mission auto-created from Floor 5 margin signal. Priority: ${priority}. Severity: ${severityScore}/10.`,
            performed_by: 'system',
          },
        ]);

        results.push({
          signal_type: 'margin_deviation',
          business_id: business.id,
          business_name: business.name,
          action: 'mission_created',
          mission_id: newMission.id,
          details: `New mission: ${actualMargin}% actual vs ${expectedMarginLow}% expected (${marginGap}% gap).`,
        });
      }
    }

    const missionsCreated = results.filter(r => r.action === 'mission_created').length;
    const duplicatesFound = results.filter(r => r.action === 'duplicate_detected').length;

    return new Response(JSON.stringify({
      success: true,
      signals_detected: deviations.length,
      missions_created: missionsCreated,
      duplicates_found: duplicatesFound,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Margin deviation scanner error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
