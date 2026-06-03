// Task 19b — universal client-side wrapper around promote_store_to_route_board RPC.
// Bulk-promotes a list of stores into pending_route_stops with a given signal_source/reason.
// Dedup-aware on the DB side: existing open candidate for same store+source+reason is reused.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type RouteBoardSignalSource =
  | "ai_score"
  | "sell_through"
  | "brand_crm"
  | "opportunities"
  | "ai_call_outcome"
  | "sms_outcome"
  | "manual_disposition"
  | "owner_order"
  | "coverage_gap"
  | "manual";

export interface PromoteStoreInput {
  storeId: string;
  reason: string;
  sourceRef?: string | null;
  business?: string | null;
  priority?: number;
  estimatedRevenue?: number | null;
  urgency?: "today" | "this_week" | "next_week" | "no_rush";
  intentSummary?: string | null;
}

export interface PromoteBatchOptions {
  signalSource: RouteBoardSignalSource;
  defaultReason?: string;
  defaultBusiness?: string | null;
  defaultPriority?: number;
}

export function usePromoteToRouteBoard(opts: PromoteBatchOptions) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (stores: PromoteStoreInput[]) => {
      if (!stores?.length) return { promoted: 0, deduped: 0, ids: [] as string[] };

      const ids: string[] = [];
      let promoted = 0;
      let deduped = 0;

      // Sequential to keep dedup deterministic and surface the first error fast.
      for (const s of stores) {
        const reason = s.reason || opts.defaultReason || `Sent from ${opts.signalSource}`;
        const { data, error } = await (supabase as any).rpc("promote_store_to_route_board", {
          _store_id: s.storeId,
          _signal_source: opts.signalSource,
          _reason: reason,
          _source_ref: s.sourceRef ?? null,
          _business: s.business ?? opts.defaultBusiness ?? null,
          _priority: s.priority ?? opts.defaultPriority ?? 3,
          _estimated_revenue: s.estimatedRevenue ?? null,
          _urgency: s.urgency ?? "this_week",
          _intent_summary: s.intentSummary ?? reason,
        });
        if (error) throw error;
        if (data) {
          ids.push(data as string);
          // We can't tell from the return whether it was a dedup hit, but the RPC is idempotent.
          promoted += 1;
        } else {
          deduped += 1;
        }
      }

      return { promoted, deduped, ids };
    },
    onSuccess: ({ promoted, ids }) => {
      const unique = new Set(ids).size;
      const dupes = promoted - unique;
      toast.success(
        dupes > 0
          ? `Sent ${unique} to Route Board (${dupes} already pending — deduped)`
          : `Sent ${promoted} to Route Board`
      );
      qc.invalidateQueries({ queryKey: ["route-candidates"] });
      qc.invalidateQueries({ queryKey: ["pending_route_stops"] });
    },
    onError: (e: any) => {
      toast.error(`Send to Route Board failed: ${e?.message || e}`);
    },
  });
}
