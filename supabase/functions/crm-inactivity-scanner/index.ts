import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SignalResult {
  signal_type: string;
  store_id: string;
  store_name: string;
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
    // STEP 1: Get all active stores (exclude lost/closed/blacklisted)
    // ──────────────────────────────────────────────
    const excludedStatuses = ['lost', 'closed', 'blacklisted', 'inactive'];

    const { data: allStores, error: storeError } = await supabase
      .from('store_master')
      .select('id, store_name, owner_name, health_status, last_order_at, last_visit_at, brand_id')
      .not('health_status', 'in', `(${excludedStatuses.join(',')})`);

    if (storeError) throw storeError;
    if (!allStores || allStores.length === 0) {
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

    const storeIds = allStores.map(s => s.id);

    // ──────────────────────────────────────────────
    // STEP 2: Determine high-value stores (have wholesale orders with meaningful revenue)
    // ──────────────────────────────────────────────
    const { data: orderAgg } = await supabase
      .from('wholesale_orders')
      .select('store_id, total')
      .in('store_id', storeIds);

    // Aggregate total revenue per store
    const revenueByStore = new Map<string, number>();
    (orderAgg || []).forEach(o => {
      const current = revenueByStore.get(o.store_id) || 0;
      revenueByStore.set(o.store_id, current + Number(o.total || 0));
    });

    // High-value threshold: stores with >= $500 lifetime revenue OR >= 3 orders
    const orderCountByStore = new Map<string, number>();
    (orderAgg || []).forEach(o => {
      orderCountByStore.set(o.store_id, (orderCountByStore.get(o.store_id) || 0) + 1);
    });

    const highValueStoreIds = new Set<string>();
    storeIds.forEach(id => {
      const revenue = revenueByStore.get(id) || 0;
      const orderCount = orderCountByStore.get(id) || 0;
      if (revenue >= 500 || orderCount >= 3) {
        highValueStoreIds.add(id);
      }
    });

    if (highValueStoreIds.size === 0) {
      return new Response(JSON.stringify({
        success: true,
        signals_detected: 0,
        missions_created: 0,
        duplicates_found: 0,
        results: [],
        note: 'No high-value stores found matching threshold criteria',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const hvStoreIds = [...highValueStoreIds];

    // ──────────────────────────────────────────────
    // STEP 3: Find last activity date for each high-value store
    // Activity = most recent of: contact_interactions, wholesale_orders, last_visit_at, last_order_at
    // ──────────────────────────────────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get last interaction per store
    const { data: recentInteractions } = await supabase
      .from('contact_interactions')
      .select('store_id, created_at')
      .in('store_id', hvStoreIds)
      .order('created_at', { ascending: false });

    const lastInteractionByStore = new Map<string, string>();
    (recentInteractions || []).forEach(i => {
      if (i.store_id && !lastInteractionByStore.has(i.store_id)) {
        lastInteractionByStore.set(i.store_id, i.created_at!);
      }
    });

    // Get last order per store
    const { data: recentOrders } = await supabase
      .from('wholesale_orders')
      .select('store_id, created_at')
      .in('store_id', hvStoreIds)
      .order('created_at', { ascending: false });

    const lastOrderByStore = new Map<string, string>();
    (recentOrders || []).forEach(o => {
      if (!lastOrderByStore.has(o.store_id)) {
        lastOrderByStore.set(o.store_id, o.created_at!);
      }
    });

    // ──────────────────────────────────────────────
    // STEP 4: Detect inactive stores (no activity for >30 days)
    // ──────────────────────────────────────────────
    const now = new Date();
    const inactiveStores: Array<{
      store: typeof allStores[0];
      daysInactive: number;
      lastActivityType: string;
      lastActivityDate: string;
    }> = [];

    for (const storeId of hvStoreIds) {
      const store = allStores.find(s => s.id === storeId);
      if (!store) continue;

      // Gather all activity dates
      const activityDates: Array<{ type: string; date: string }> = [];

      const lastInteraction = lastInteractionByStore.get(storeId);
      if (lastInteraction) activityDates.push({ type: 'interaction', date: lastInteraction });

      const lastOrder = lastOrderByStore.get(storeId);
      if (lastOrder) activityDates.push({ type: 'order', date: lastOrder });

      if (store.last_visit_at) activityDates.push({ type: 'visit', date: store.last_visit_at });
      if (store.last_order_at) activityDates.push({ type: 'order', date: store.last_order_at });

      // Find most recent activity
      if (activityDates.length === 0) {
        // No recorded activity at all — treat as inactive since creation
        inactiveStores.push({
          store,
          daysInactive: 90, // Cap at 90 for stores with no activity record
          lastActivityType: 'none',
          lastActivityDate: 'No recorded activity',
        });
        continue;
      }

      activityDates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const mostRecent = activityDates[0];
      const lastActivityDate = new Date(mostRecent.date);
      const daysInactive = Math.floor((now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysInactive >= 30) {
        inactiveStores.push({
          store,
          daysInactive,
          lastActivityType: mostRecent.type,
          lastActivityDate: mostRecent.date.split('T')[0],
        });
      }
    }

    if (inactiveStores.length === 0) {
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
    // STEP 5: Duplicate prevention — check existing active missions
    // ──────────────────────────────────────────────
    const sourceRefs = inactiveStores.map(s => `crm:${s.store.id}`);

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

    for (const { store, daysInactive, lastActivityType, lastActivityDate } of inactiveStores) {
      const sourceRef = `crm:${store.id}`;
      const severityScore = Math.min(10, Math.floor(daysInactive / 6));

      let priority: string;
      if (daysInactive >= 60) priority = 'critical';
      else if (daysInactive >= 45) priority = 'high';
      else priority = 'medium';

      const storeLabel = store.store_name || store.owner_name || `Store ${store.id.slice(0, 8)}`;
      const existing = existingRefMap.get(sourceRef);

      if (existing) {
        // DUPLICATE: Append context, update severity
        await supabase.from('owner_mission_activity').insert({
          mission_id: existing.id,
          action: 'context_appended',
          details: `Client now inactive for ${daysInactive} days. Last activity: ${lastActivityType} on ${lastActivityDate}.`,
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
          signal_type: 'crm_inactivity',
          store_id: store.id,
          store_name: storeLabel,
          action: 'duplicate_detected',
          mission_id: existing.id,
          details: `Active mission exists. Context appended: ${daysInactive} days inactive.`,
        });
      } else {
        // NEW MISSION
        const title = `High-value client inactive: ${storeLabel}`;
        const description = `${storeLabel} has had no activity for ${daysInactive} days.\nLast interaction: ${lastActivityType} on ${lastActivityDate}.`;

        const { data: newMission, error: createError } = await supabase
          .from('owner_missions')
          .insert({
            owner_id: user.id,
            title,
            description,
            category: 'operational',
            priority,
            status: 'pending',
            source: 'floor_generated',
            floor_origin: 'floor1_crm',
            source_entity_type: 'store',
            source_entity_id: store.id,
            source_reference: sourceRef,
            severity_score: severityScore,
            tags: ['crm', 'follow_up', 'inactivity'],
          })
          .select('id')
          .single();

        if (createError) {
          console.error(`Failed to create mission for store ${store.id}:`, createError);
          continue;
        }

        // Log signal detection + mission creation
        await supabase.from('owner_mission_activity').insert([
          {
            mission_id: newMission.id,
            action: 'signal_detected',
            details: `CRM signal: ${storeLabel} inactive for ${daysInactive} days. Last: ${lastActivityType} on ${lastActivityDate}.`,
            performed_by: 'system',
          },
          {
            mission_id: newMission.id,
            action: 'mission_created',
            details: `Mission auto-created from Floor 1 CRM signal. Priority: ${priority}. Severity: ${severityScore}/10.`,
            performed_by: 'system',
          },
        ]);

        results.push({
          signal_type: 'crm_inactivity',
          store_id: store.id,
          store_name: storeLabel,
          action: 'mission_created',
          mission_id: newMission.id,
          details: `New mission created: ${daysInactive} days inactive, ${lastActivityType} on ${lastActivityDate}.`,
        });
      }
    }

    const missionsCreated = results.filter(r => r.action === 'mission_created').length;
    const duplicatesFound = results.filter(r => r.action === 'duplicate_detected').length;

    return new Response(JSON.stringify({
      success: true,
      signals_detected: inactiveStores.length,
      missions_created: missionsCreated,
      duplicates_found: duplicatesFound,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('CRM inactivity scanner error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
