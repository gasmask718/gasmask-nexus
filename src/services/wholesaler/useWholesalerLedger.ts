import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWholesalerProfile } from "./useWholesalerProfile";

/**
 * THE REAL MONEY SYSTEM.
 *
 * dd_split_ledger is the only place a wholesaler's money actually exists: one row
 * per settled order, written by the Dynasty Direct payment pipeline. The old
 * wholesaler_payouts table has zero rows and was showing $0.00 to every supplier
 * as if it were an earnings figure. Nothing here invents a number: if the ledger
 * is empty we say so plainly instead of rendering a total nobody can derive.
 *
 * Payout mechanism: Stripe Connect auto-transfer on approval. There is no
 * "request payout" — the supplier does not pull money, we push it.
 */

export interface LedgerEntry {
  id: string;
  order_id: string | null;
  fulfillment_id: string | null;
  entry_type: string | null;
  status: string | null;
  created_at: string | null;
  notes: string | null;
  stripe_transfer_id: string | null;
  /** dollars, derived from the *_cents columns */
  gross: number;
  processingFee: number;
  platformFee: number;
  net: number;
  reserveHeld: number;
  reserveReleased: number;
  reservePct: number | null;
  marginPct: number | null;
  /** null when the reserve is already released or nothing is held */
  reserveReleaseAt: string | null;
}

export interface LedgerSummary {
  hasSettledOrders: boolean;
  entryCount: number;
  grossTotal: number;
  processingFeeTotal: number;
  platformFeeTotal: number;
  netTotal: number;
  reserveHeldTotal: number;
  reserveReleasedTotal: number;
  paidOutTotal: number;
  awaitingTransferTotal: number;
  reserveHoldDays: number | null;
  rollingReserveEnabled: boolean;
}

const c = (v: unknown) => Number(v || 0) / 100;

export function useWholesalerLedger() {
  const { profile } = useWholesalerProfile();

  const configQuery = useQuery({
    queryKey: ['dd-config-reserve'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('dd_config')
        .select('reserve_hold_days, rolling_reserve_enabled')
        .eq('id', true)
        .maybeSingle();
      return data as { reserve_hold_days: number | null; rolling_reserve_enabled: boolean | null } | null;
    },
  });

  const ledgerQuery = useQuery({
    queryKey: ['wholesaler-split-ledger', profile?.id],
    queryFn: async () => {
      if (!profile) return [] as LedgerEntry[];
      const { data, error } = await (supabase as any)
        .from('dd_split_ledger')
        .select('*')
        .eq('wholesaler_id', profile.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const holdDays = configQuery.data?.reserve_hold_days ?? null;
      return ((data || []) as any[]).map((r): LedgerEntry => {
        const reserveHeld = c(r.reserve_held_cents);
        const reserveReleased = c(r.reserve_released_cents);
        const stillHeld = reserveHeld - reserveReleased > 0.004;
        let releaseAt: string | null = null;
        if (stillHeld && holdDays != null && r.created_at) {
          const d = new Date(r.created_at);
          d.setDate(d.getDate() + Number(holdDays));
          releaseAt = d.toISOString();
        }
        return {
          id: r.id,
          order_id: r.order_id,
          fulfillment_id: r.fulfillment_id,
          entry_type: r.entry_type,
          status: r.status,
          created_at: r.created_at,
          notes: r.notes,
          stripe_transfer_id: r.stripe_transfer_id,
          gross: c(r.gross_amount_cents),
          processingFee: c(r.stripe_fee_cents),
          platformFee: c(r.dd_margin_cents),
          net: c(r.supplier_transfer_cents),
          reserveHeld,
          reserveReleased,
          reservePct: r.reserve_pct_applied != null ? Number(r.reserve_pct_applied) : null,
          marginPct: r.margin_pct_applied != null ? Number(r.margin_pct_applied) : null,
          reserveReleaseAt: releaseAt,
        };
      });
    },
    enabled: !!profile,
  });

  const entries = ledgerQuery.data || [];
  const sum = (fn: (e: LedgerEntry) => number) => entries.reduce((s, e) => s + fn(e), 0);
  const isPaid = (e: LedgerEntry) => !!e.stripe_transfer_id || e.status === 'transferred' || e.status === 'paid';

  const summary: LedgerSummary = {
    hasSettledOrders: entries.length > 0,
    entryCount: entries.length,
    grossTotal: sum(e => e.gross),
    processingFeeTotal: sum(e => e.processingFee),
    platformFeeTotal: sum(e => e.platformFee),
    netTotal: sum(e => e.net),
    reserveHeldTotal: sum(e => e.reserveHeld - e.reserveReleased),
    reserveReleasedTotal: sum(e => e.reserveReleased),
    paidOutTotal: entries.filter(isPaid).reduce((s, e) => s + e.net, 0),
    awaitingTransferTotal: entries.filter(e => !isPaid(e)).reduce((s, e) => s + e.net, 0),
    reserveHoldDays: configQuery.data?.reserve_hold_days ?? null,
    rollingReserveEnabled: !!configQuery.data?.rolling_reserve_enabled,
  };

  return {
    entries,
    summary,
    isLoading: ledgerQuery.isLoading || configQuery.isLoading,
    error: ledgerQuery.error as Error | null,
  };
}
