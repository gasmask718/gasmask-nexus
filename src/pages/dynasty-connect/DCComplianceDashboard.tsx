/**
 * Dynasty Connect — Compliance Dashboard (P4 Step 5)
 *
 * Five panels stitched into one operator surface:
 *   1. Kill-switch status per business unit (reuses KillSwitchButton)
 *   2. Compliance-hold count per unit (dc_unified_leads.compliance_hold=true)
 *   3. DNC summary (dnc_list totals + last-7d + per-business breakdown)
 *   4. Call volume last 7d + opt-out rate per unit (dc_call_logs)
 *   5. Live sync-log error feed (dc_lead_sync_log where success=false),
 *      auto-refresh every 60s
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { AlertTriangle, ShieldCheck, PhoneOff, PhoneCall, Activity, RefreshCw } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import KillSwitchButton from './components/KillSwitchButton';

// Canonical DC business units. Order = display order in Panel 1.
const UNITS: { key: string; label: string; color: string }[] = [
  { key: 'top_tier', label: 'Top Tier', color: 'bg-purple-500' },
  { key: 'unforgettable_times', label: 'Unforgettable Times', color: 'bg-orange-500' },
  { key: 'surplus_funds', label: 'Surplus Funds', color: 'bg-blue-500' },
  { key: 'real_estate', label: 'Real Estate', color: 'bg-green-500' },
  { key: 'dynasty_direct', label: 'Dynasty Direct', color: 'bg-yellow-500' },
  { key: 'gasmask', label: 'GasMask', color: 'bg-red-500' },
  { key: 'brandaro', label: 'Brandaro', color: 'bg-cyan-500' },
];

export default function DCComplianceDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compliance Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Kill-switch state, compliance holds, DNC, call volume, and live sync errors across all Dynasty Connect units.
        </p>
      </div>

      <KillSwitchPanel />
      <ComplianceHoldPanel />
      <DNCPanel />
      <CallVolumePanel />
      <SyncErrorFeed />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PANEL 1 — Kill switch status
// ─────────────────────────────────────────────────────────────────
function KillSwitchPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['dc-compliance', 'killswitch'],
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('kill_switch_state')
        .select('business_unit_key,is_active,triggered_at,trigger_reason')
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const activeByUnit = new Map<string, any>();
  (data ?? []).forEach((r) => {
    if (r.business_unit_key) activeByUnit.set(r.business_unit_key, r);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Kill-Switch Status
        </CardTitle>
        <CardDescription>One card per business unit. Toggle requires typed confirmation.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {UNITS.map((u) => <Skeleton key={u.key} className="h-32" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {UNITS.map((u) => {
              const active = activeByUnit.get(u.key);
              return (
                <div
                  key={u.key}
                  className={`rounded-lg border p-3 ${active ? 'border-destructive bg-destructive/5' : 'border-border'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={`${u.color} text-white`}>{u.label}</Badge>
                    <span className={`h-2 w-2 rounded-full ${active ? 'bg-destructive animate-pulse' : 'bg-green-500'}`} />
                  </div>
                  {active ? (
                    <>
                      <p className="text-xs font-semibold text-destructive mb-1">KILLED</p>
                      <p className="text-[11px] text-muted-foreground mb-1">
                        {active.triggered_at ? formatDistanceToNow(new Date(active.triggered_at), { addSuffix: true }) : '—'}
                      </p>
                      <p className="text-[11px] line-clamp-2 mb-3" title={active.trigger_reason ?? ''}>
                        {active.trigger_reason ?? '—'}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground mb-3">Active — dispatch allowed</p>
                  )}
                  <KillSwitchButton
                    scope={{ kind: 'business_unit', businessUnitKey: u.key, label: u.label }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
// PANEL 2 — Compliance hold count per unit
// ─────────────────────────────────────────────────────────────────
function ComplianceHoldPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['dc-compliance', 'holds'],
    queryFn: async () => {
      const results = await Promise.all(
        UNITS.map(async (u) => {
          const { count, error } = await (supabase as any)
            .from('dc_unified_leads')
            .select('lead_id', { count: 'exact', head: true })
            .eq('business_unit_key', u.key)
            .eq('compliance_hold', true);
          if (error) throw error;
          return { key: u.key, count: count ?? 0 };
        }),
      );
      return Object.fromEntries(results.map((r) => [r.key, r.count])) as Record<string, number>;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" /> Compliance Holds
        </CardTitle>
        <CardDescription>
          Leads flagged compliance_hold=true. Only Top Tier and Dynasty Direct source tables carry this column; other units always report 0.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {UNITS.map((u) => <Skeleton key={u.key} className="h-20" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {UNITS.map((u) => {
              const n = data?.[u.key] ?? 0;
              return (
                <Link
                  key={u.key}
                  to={`/dynasty-connect/leads?unit=${u.key}&compliance_hold=1`}
                  className="rounded-lg border p-3 hover:bg-accent transition-colors"
                >
                  <Badge className={`${u.color} text-white text-[10px]`}>{u.label}</Badge>
                  <div className="text-2xl font-bold mt-2">{n}</div>
                  <div className="text-[10px] text-muted-foreground">on hold</div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
// PANEL 3 — DNC summary
// ─────────────────────────────────────────────────────────────────
function DNCPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['dc-compliance', 'dnc'],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [totalRes, recentRes, breakdownRes] = await Promise.all([
        (supabase as any).from('dnc_list').select('id', { count: 'exact', head: true }),
        (supabase as any).from('dnc_list').select('id', { count: 'exact', head: true }).gte('added_at', sevenDaysAgo),
        (supabase as any).from('dnc_list').select('business'),
      ]);
      if (totalRes.error) throw totalRes.error;
      if (recentRes.error) throw recentRes.error;
      if (breakdownRes.error) throw breakdownRes.error;
      const byBiz = new Map<string, number>();
      (breakdownRes.data ?? []).forEach((r: any) => {
        const k = r.business ?? '(none)';
        byBiz.set(k, (byBiz.get(k) ?? 0) + 1);
      });
      return {
        total: totalRes.count ?? 0,
        recent: recentRes.count ?? 0,
        breakdown: Array.from(byBiz.entries()).sort((a, b) => b[1] - a[1]),
      };
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <PhoneOff className="h-5 w-5" /> DNC Summary
          </CardTitle>
          <CardDescription>Do-Not-Call list totals and per-business breakdown.</CardDescription>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/dynasty-connect/dnc">Manage DNC →</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">Total entries</div>
              <div className="text-3xl font-bold">{data?.total ?? 0}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">Added last 7 days</div>
              <div className="text-3xl font-bold">{data?.recent ?? 0}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground mb-2">By business</div>
              {(data?.breakdown ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground">No entries</div>
              ) : (
                <ul className="space-y-1 text-sm">
                  {data!.breakdown.map(([biz, n]) => (
                    <li key={biz} className="flex justify-between">
                      <span className="truncate">{biz}</span>
                      <span className="font-semibold">{n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
// PANEL 4 — Call volume last 7 days
// ─────────────────────────────────────────────────────────────────
function CallVolumePanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['dc-compliance', 'callvol'],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await (supabase as any)
        .from('dc_call_logs')
        .select('source_business,outcome')
        .gte('created_at', sevenDaysAgo);
      if (error) throw error;
      const agg = new Map<string, { calls: number; optouts: number }>();
      (data ?? []).forEach((r: any) => {
        const k = r.source_business ?? '(unknown)';
        const cur = agg.get(k) ?? { calls: 0, optouts: 0 };
        cur.calls += 1;
        if (r.outcome === 'dnc') cur.optouts += 1;
        agg.set(k, cur);
      });
      return Array.from(agg.entries()).map(([unit, v]) => ({
        unit,
        ...v,
        rate: v.calls > 0 ? (v.optouts / v.calls) * 100 : 0,
      }));
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PhoneCall className="h-5 w-5" /> Call Volume (Last 7 Days)
        </CardTitle>
        <CardDescription>Calls and opt-out rate per business unit.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : (data ?? []).length === 0 ? (
          <EmptyState title="No calls in the last 7 days" description="Volume will populate as Bland campaigns dispatch." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2">Business Unit</th>
                  <th className="py-2 text-right">Calls</th>
                  <th className="py-2 text-right">Opt-outs</th>
                  <th className="py-2 text-right">Opt-out Rate</th>
                </tr>
              </thead>
              <tbody>
                {data!.map((r) => (
                  <tr key={r.unit} className="border-b last:border-0">
                    <td className="py-2">{r.unit}</td>
                    <td className="py-2 text-right font-semibold">{r.calls}</td>
                    <td className="py-2 text-right">{r.optouts}</td>
                    <td className="py-2 text-right">
                      <span className={r.rate > 5 ? 'text-destructive font-semibold' : ''}>
                        {r.rate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
// PANEL 5 — Sync log error feed (auto-refresh 60s)
// ─────────────────────────────────────────────────────────────────
function SyncErrorFeed() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ['dc-compliance', 'sync-errors'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('dc_lead_sync_log')
        .select('id,created_at,business_unit_key,sync_source,error_message')
        .eq('success', false)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" /> Sync Error Feed
          </CardTitle>
          <CardDescription>
            Last 20 failed sync-log rows. Auto-refreshes every 60s. Click a row to expand the full error.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            Updated {dataUpdatedAt ? formatDistanceToNow(dataUpdatedAt, { addSuffix: true }) : '—'}
          </span>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : (data ?? []).length === 0 ? (
          <EmptyState title="No sync errors" description="All recent syncs succeeded." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2">When</th>
                  <th className="py-2">Unit</th>
                  <th className="py-2">Source</th>
                  <th className="py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {data!.map((r) => {
                  const isOpen = expanded === r.id;
                  const msg = r.error_message ?? '';
                  return (
                    <tr
                      key={r.id}
                      className="border-b last:border-0 cursor-pointer hover:bg-accent/50"
                      onClick={() => setExpanded(isOpen ? null : r.id)}
                    >
                      <td className="py-2 text-xs text-muted-foreground whitespace-nowrap" title={format(new Date(r.created_at), 'PPpp')}>
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </td>
                      <td className="py-2 text-xs">{r.business_unit_key ?? '—'}</td>
                      <td className="py-2 text-xs">{r.sync_source ?? '—'}</td>
                      <td className="py-2 text-xs">
                        {isOpen ? (
                          <pre className="whitespace-pre-wrap break-all font-mono text-[11px]">{msg}</pre>
                        ) : (
                          <span className="line-clamp-1">{msg.slice(0, 100)}{msg.length > 100 ? '…' : ''}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
