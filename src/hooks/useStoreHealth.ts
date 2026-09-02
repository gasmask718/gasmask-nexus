// ═══════════════════════════════════════════════════════════════
// Hook: Store Health Score — read from DB + client-side calc
// ═══════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateStoreHealth, type StoreHealthResult } from '@/lib/delivery/storeHealthEngine';
import { CANONICAL_BRAND_IDS } from '@/config/brands';

export function useStoreHealthScore(storeId: string | undefined) {
  return useQuery({
    queryKey: ['store-health-score', storeId],
    queryFn: async () => {
      if (!storeId) return null;

      // Check for persisted score first
      const { data: persisted } = await (supabase
        .from('store_health_scores' as any)
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle() as any);

      if (persisted) {
        return {
          overallScore: persisted.overall_score as number,
          healthStatus: persisted.health_status as 'healthy' | 'watch' | 'at_risk',
          dimensions: ((persisted.dimension_scores as any)?.dimensions || []) as any[],
          lastCalculated: persisted.calculated_at as string,
          totalVisits30d: persisted.total_visits_30d as number,
        };
      }

      // Calculate on the fly from available data
      return await calculateHealthFromData(storeId);
    },
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}

async function calculateHealthFromData(storeId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Parallel queries for health dimensions
  const [
    checklistsRes,
    contactsRes,
    storeRes,
    inventoryRes,
    summaryRes,
    invoiceDatesRes,

  ] = await Promise.all([
    supabase
      .from('delivery_checklists')
      .select('id, visit_date, status, tasks_completed, inventory_updates, growth_captures, sticker_status, contact_updates')
      .eq('store_id', storeId)
      .gte('visit_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('visit_date', { ascending: false }),
    // store_contacts has no `responsiveness` column — the old select failed
    // silently and made every store look like it had zero verified contacts.
    supabase
      .from('store_contacts')
      .select('id, name, phone, responsiveness_status, responsive_by_call, responsive_by_text, owner_confirmed, verified_at')
      .is('deleted_at', null)
      .eq('store_id', storeId)
      .limit(10),
    supabase
      .from('stores')
      .select('visit_frequency_target, sells_flowers, responsiveness, last_visit_date')
      .eq('id', storeId)
      .maybeSingle(),
    // Canonical inventory (P0 source of truth), not checklist snapshots.
    supabase
      .from('store_tube_inventory_status')
      .select('brand_id, current_tubes_left')
      .eq('store_id', storeId)
      .eq('is_simulation', false),
    // Canonical order cadence from the same view the Account Summary uses.
    (supabase as any)
      .from('v_store_summary')
      .select('last_order_date, days_since_last_order, total_sales')
      .eq('store_id', storeId)
      .maybeSingle(),
    // Invoice dates → average reorder gap (existing canonical order records).
    supabase
      .from('invoices')
      .select('business_date')
      .eq('store_id', storeId)
      .is('deleted_at', null)
      .order('business_date', { ascending: false })
      .limit(12),
  ]);


  const checklists = checklistsRes.data || [];
  const contacts = contactsRes.data || [];
  const store = storeRes.data;
  const inventoryRows = (inventoryRes.data || []) as any[];
  const summary = (summaryRes as any)?.data as
    | { last_order_date: string | null; days_since_last_order: number | null; total_sales: number | null }
    | null;

  // Derive inputs from data
  const expectedVisits = store?.visit_frequency_target
    ? Math.ceil(30 / store.visit_frequency_target)
    : 4; // default ~weekly

  const lastVisitDate = checklists[0]?.visit_date || store?.last_visit_date;
  const daysSinceLastVisit = lastVisitDate
    ? Math.floor((Date.now() - new Date(lastVisitDate as string).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Inventory accuracy: canonical parent brands with a tracked SKU count
  const trackedBrands = new Set<string>();
  inventoryRows.forEach((r) => {
    if (r.current_tubes_left == null) return;
    const key = String(r.brand_id || '').toLowerCase().replace(/[^a-z]/g, '');
    const parent = CANONICAL_BRAND_IDS.find((b) => key.includes(b.replace(/[^a-z]/g, '')));
    if (parent) trackedBrands.add(parent);
  });
  const brandsWithData = trackedBrands.size;

  const avgInventoryCount = inventoryRows.length
    ? inventoryRows.reduce((s, r) => s + Number(r.current_tubes_left ?? 0), 0) / inventoryRows.length
    : null;

  // Contact reliability
  const hasResponsive = contacts.some((c: any) =>
    c.responsiveness_status === 'responsive' || c.responsive_by_call || c.responsive_by_text || !!c.verified_at || c.owner_confirmed,
  ) || store?.responsiveness === 'call' || store?.responsiveness === 'text' || store?.responsiveness === 'both';
  const hasBossName = contacts.some((c: any) => c.name && c.name.length > 0);
  const hasBossPhone = contacts.some((c: any) => c.phone && c.phone.length > 0);

  // Stickers from latest checklist
  const latestChecklist = checklists[0];
  const stickerData = (latestChecklist?.sticker_status || {}) as Record<string, any>;
  const tasksCompleted = (latestChecklist?.tasks_completed || {}) as Record<string, any>;

  // Growth
  const newLeads = checklists.filter(cl => {
    const g = (cl.growth_captures || {}) as Record<string, any>;
    return g.new_store_name || g.new_store_address;
  }).length;

  const daysSinceLastOrder = summary?.days_since_last_order ?? null;

  const result = calculateStoreHealth({
    visitsLast30Days: checklists.length,
    expectedVisitsPerMonth: expectedVisits,
    daysSinceLastVisit,
    brandsWithInventoryData: brandsWithData,
    totalBrands: CANONICAL_BRAND_IDS.length,
    avgInventoryCount,
    hasRecentOrder: daysSinceLastOrder != null && daysSinceLastOrder <= 30,
    avgDaysBetweenOrders: null,
    daysSinceLastOrder,
    hasResponsiveContact: hasResponsive,
    bossNameConfirmed: hasBossName,
    bossPhoneConfirmed: hasBossPhone,
    stickersPresent: stickerData.present ?? tasksCompleted['stickers_present']?.metadata?.present ?? null,
    stickerConditionGood: stickerData.condition_good ?? tasksCompleted['stickers_condition']?.metadata?.good ?? null,
    sellsFlowers: store?.sells_flowers ?? null,
    newLeadsCaptured: newLeads,
  });


  return {
    ...result,
    lastCalculated: new Date().toISOString(),
    totalVisits30d: checklists.length,
  };
}
