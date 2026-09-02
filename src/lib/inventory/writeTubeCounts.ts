// ════════════════════════════════════════════════════════════════════
// CANONICAL STORE TUBE COUNT WRITER
//
// The ONE way the UI writes store tube counts.
// Target: public.store_tube_inventory_status
// Key:    (store_id, brand_id, is_simulation)  ← plain unique index
//
// public.store_tube_inventory is RETIRED — never write to it.
//
// Provenance written on every save (existing canonical columns):
//   last_updated_at        server-side "now"
//   last_updated_by        actor user id
//   last_updated_by_role   actor role (admin / ambassador / biker / …)
//   last_updated_method    how the count arrived (quick_view, manual_update, visit…)
//   tubes_updated_at       when the COUNT itself last changed
//   last_inventory_check_at / last_inventory_check_by
//                          → the existing "verified observation" stamps
//                            (set when countedAsCheck is true, default true)
// ════════════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';
import { normalizeTubeBrandId, tubeBrandName } from './tubeSkuKeys';

export interface TubeCountUpdate {
  /** legacy brand string, UI brand id, or canonical brand_id */
  brandId: string;
  count: number;
}

export interface WriteTubeCountsInput {
  storeId: string;
  updates: TubeCountUpdate[];
  isSimulation?: boolean;
  actorId?: string | null;
  actorRole?: string | null;
  /** provenance label, e.g. 'quick_view' | 'manual_update' | 'store_profile' */
  method?: string;
  /** treat this save as a physical inventory check (default true) */
  countedAsCheck?: boolean;
}

export async function writeStoreTubeCounts({
  storeId,
  updates,
  isSimulation = false,
  actorId = null,
  actorRole = null,
  method = 'manual_update',
  countedAsCheck = true,
}: WriteTubeCountsInput): Promise<void> {
  if (!storeId) throw new Error('writeStoreTubeCounts: storeId is required');
  if (!updates.length) return;

  const nowIso = new Date().toISOString();

  const rows = updates.map((u) => {
    const brandId = normalizeTubeBrandId(u.brandId);
    if (!brandId) throw new Error(`Unknown tube SKU "${u.brandId}" — no canonical brand_id mapping`);
    if (!Number.isFinite(u.count) || u.count < 0) throw new Error(`Invalid count for ${brandId}`);
    return {
      store_id: storeId,
      brand_id: brandId,
      brand_name: tubeBrandName(brandId),
      current_tubes_left: Math.trunc(u.count),
      is_simulation: isSimulation,
      tubes_updated_at: nowIso,
      last_updated_at: nowIso,
      last_updated_by: actorId,
      last_updated_by_role: actorRole,
      last_updated_method: method,
      ...(countedAsCheck
        ? { last_inventory_check_at: nowIso, last_inventory_check_by: actorId }
        : {}),
    };
  });

  const { error } = await supabase
    .from('store_tube_inventory_status')
    .upsert(rows as any, { onConflict: 'store_id,brand_id,is_simulation' });

  if (error) throw new Error(error.message);
}
