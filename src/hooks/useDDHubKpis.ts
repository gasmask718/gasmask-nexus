/**
 * One shared hook driving every Dynasty Direct hub tile badge.
 * Single round-trip via parallel queries; 60s refresh.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DDHubKpis {
  // Orders
  unpaidOrders: number;
  awaitingLabel: number;
  paidThisWeek: number;
  // Fulfillment
  unroutedFulfillments: number;
  routingFailures24h: number;
  // Network
  needGeocode: number;
  activeSuppliers: number;
  // Growth
  openInvites: number;
  pendingApplications: number;
  affiliatesActive: number;
  affiliatePayoutDue: number;
  // Content
  contentBriefs: number;
  // System
  twilioBalanceUsd: number | null;
  lastHealthCheck: string | null;
  commsHealthFails: number;
  // Inbox
  newContactMessages: number;
  // Lifecycle (cart recovery)
  cartRecoveryQueued: number;
  cartRecoverySent: number;
  // SLA + Anomalies (Phase D PASS 3)
  slowSuppliers: number;
  openAnomalies: number;
  criticalAnomalies: number;
}

async function fetchDDHubKpis(): Promise<DDHubKpis> {
  const [
    unpaid, awaitingLabel, paidWeek, unrouted, routingFails,
    needGeocode, activeSup, openInvites, pendingApps, affiliates,
    payoutRows, briefs, twilioBalance, commsFails, newMessages,
    cartQueued, cartSent, slaRows, openAnoms, critAnoms,
  ] = await Promise.all([
    supabase.from('marketplace_orders').select('id', { count: 'exact', head: true }).eq('payment_status', 'unpaid'),
    supabase.from('marketplace_fulfillments').select('id', { count: 'exact', head: true }).eq('status', 'label_pending'),
    supabase.from('marketplace_orders').select('id', { count: 'exact', head: true })
      .eq('payment_status', 'paid')
      .gte('created_at', startOfWeekIso()),
    supabase.from('marketplace_fulfillments').select('id', { count: 'exact', head: true }).is('wholesaler_id', null),
    supabase.from('dd_routing_audit').select('id', { count: 'exact', head: true })
      .ilike('event_type', '%fail%')
      .gte('created_at', new Date(Date.now() - 86_400_000).toISOString()),
    supabase.from('wholesaler_profiles').select('id', { count: 'exact', head: true })
      .is('warehouse_lat', null)
      .not('warehouse_street', 'is', null),
    supabase.from('wholesaler_profiles').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('invites').select('id', { count: 'exact', head: true })
      .eq('status', 'pending').is('accepted_at', null),
    supabase.from('store_applications' as any).select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('dd_affiliates').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('dd_affiliate_events').select('commission_amount').eq('status', 'earned'),
    supabase.from('dd_content_briefs' as any).select('id', { count: 'exact', head: true }),
    supabase.from('comms_health_checks').select('detail, created_at')
      .eq('target', 'twilio_balance').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('comms_health_checks').select('id', { count: 'exact', head: true })
      .eq('status', 'fail').gte('created_at', new Date(Date.now() - 3_600_000).toISOString()),
    supabase.from('contact_messages').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('notification_queue' as any).select('id', { count: 'exact', head: true })
      .eq('related_kind', 'cart_recovery').eq('status', 'queued'),
    supabase.from('notification_queue' as any).select('id', { count: 'exact', head: true })
      .eq('related_kind', 'cart_recovery').eq('status', 'sent'),
    supabase.from('dd_sla_snapshots' as any).select('p50_hours, late_threshold_hours')
      .gte('computed_at', new Date(Date.now() - 36 * 3_600_000).toISOString()),
    supabase.from('dd_anomaly_findings' as any).select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('dd_anomaly_findings' as any).select('id', { count: 'exact', head: true })
      .eq('status', 'open').eq('severity', 'critical'),
  ]);

  const payoutDue = (payoutRows.data || []).reduce(
    (s: number, r: any) => s + Number(r.commission_amount || 0), 0
  );
  const balanceDetail = (twilioBalance.data as any)?.detail ?? null;

  return {
    unpaidOrders: unpaid.count ?? 0,
    awaitingLabel: awaitingLabel.count ?? 0,
    paidThisWeek: paidWeek.count ?? 0,
    unroutedFulfillments: unrouted.count ?? 0,
    routingFailures24h: routingFails.count ?? 0,
    needGeocode: needGeocode.count ?? 0,
    activeSuppliers: activeSup.count ?? 0,
    openInvites: openInvites.count ?? 0,
    pendingApplications: pendingApps.count ?? 0,
    affiliatesActive: affiliates.count ?? 0,
    affiliatePayoutDue: Number(payoutDue.toFixed(2)),
    contentBriefs: briefs.count ?? 0,
    twilioBalanceUsd: balanceDetail?.balance_usd ?? null,
    lastHealthCheck: (twilioBalance.data as any)?.created_at ?? null,
    commsHealthFails: commsFails.count ?? 0,
    newContactMessages: newMessages.count ?? 0,
    cartRecoveryQueued: cartQueued.count ?? 0,
    cartRecoverySent: cartSent.count ?? 0,
    slowSuppliers: ((slaRows.data as any[]) ?? [])
      .filter((r) => Number(r?.p50_hours ?? 0) > Number(r?.late_threshold_hours ?? 72)).length,
    openAnomalies: openAnoms.count ?? 0,
    criticalAnomalies: critAnoms.count ?? 0,
  };
}

function startOfWeekIso(): string {
  const d = new Date();
  const day = d.getDay() || 7; // Sun=0 → 7
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString();
}

export function useDDHubKpis() {
  return useQuery({
    queryKey: ['dd-hub-kpis'],
    queryFn: fetchDDHubKpis,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
