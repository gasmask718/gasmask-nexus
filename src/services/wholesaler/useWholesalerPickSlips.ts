import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWholesalerProfile } from "./useWholesalerProfile";

/**
 * PICK SLIP. "3 items" is a count — a picker cannot act on a count.
 * v_wholesaler_pick_slip returns the actual item names and quantities plus the
 * box _shared/ddBoxing.ts already chose when it rated the shipment, so the box
 * on the bench matches the box the rate was bought for.
 */
export interface PickItem {
  name: string;
  qty: number;
  sku?: string | null;
}

export interface PickSlip {
  fulfillment_id: string;
  order_id: string | null;
  box_name: string | null;
  box_count: number | null;
  billable_weight_oz: number | null;
  length_in: number | null;
  width_in: number | null;
  height_in: number | null;
  pick_items: PickItem[];
}

export function useWholesalerPickSlips() {
  const { profile } = useWholesalerProfile();

  const query = useQuery({
    queryKey: ['wholesaler-pick-slips', profile?.id],
    queryFn: async () => {
      if (!profile) return {} as Record<string, PickSlip>;
      const { data, error } = await (supabase as any)
        .from('v_wholesaler_pick_slip')
        .select('*')
        .eq('wholesaler_id', profile.id);
      if (error) throw error;
      const map: Record<string, PickSlip> = {};
      for (const r of (data || []) as any[]) {
        const raw = Array.isArray(r.pick_items) ? r.pick_items : [];
        map[r.fulfillment_id] = {
          fulfillment_id: r.fulfillment_id,
          order_id: r.order_id,
          box_name: r.box_name,
          box_count: r.box_count,
          billable_weight_oz: r.billable_weight_oz,
          length_in: r.length_in,
          width_in: r.width_in,
          height_in: r.height_in,
          pick_items: raw.map((i: any) => ({
            name: i?.name ?? i?.product_name ?? i?.title ?? 'Item',
            qty: Number(i?.qty ?? i?.quantity ?? 1),
            sku: i?.sku ?? null,
          })),
        };
      }
      return map;
    },
    enabled: !!profile,
  });

  return {
    pickSlips: query.data || {},
    isLoading: query.isLoading,
  };
}
