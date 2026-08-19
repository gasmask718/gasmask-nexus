/**
 * War Room — Live Snapshot Panel
 *
 * Source-of-truth mapping (confirmed audit, no migrations):
 *   • Revenue        → brandaro_revenue_tracking + brandaro_qualified_leads (converted=true)
 *   • Pipeline funnel→ brandaro_qualified_leads grouped by pipeline_stage
 *   • Sara AI today  → brandaro_ai_calls WHERE created_at::date = today
 *   • Recent activity→ brandaro_ai_calls + brandaro_qualified_leads (latest updated_at)
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign, TrendingUp, Bot, Activity, Phone, User,
  ArrowRight,
} from "lucide-react";

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

function formatMoney(n: number) {
  return `$${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function relTime(ts?: string | null) {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/* ── 1. Revenue: tracked events + converted leads ─────────────────── */
function useRevenueSnapshot() {
  return useQuery({
    queryKey: ["war-room-live-revenue"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const [tracking, converted] = await Promise.all([
        (supabase as any)
          .from("brandaro_revenue_tracking")
          .select("revenue_amount, created_at"),
        (supabase as any)
          .from("brandaro_qualified_leads")
          .select("revenue_amount, conversion_date, converted")
          .eq("converted", true)
          .gt("revenue_amount", 0),
      ]);

      const trackingRows = (tracking.data || []) as { revenue_amount: number; created_at: string }[];
      const convertedRows = (converted.data || []) as { revenue_amount: number; conversion_date: string | null }[];

      const trackingTotal = trackingRows.reduce((s, r) => s + Number(r.revenue_amount || 0), 0);
      const convertedTotal = convertedRows.reduce((s, r) => s + Number(r.revenue_amount || 0), 0);

      const since = startOfToday();
      const trackingToday = trackingRows
        .filter(r => r.created_at >= since)
        .reduce((s, r) => s + Number(r.revenue_amount || 0), 0);
      const convertedToday = convertedRows
        .filter(r => r.conversion_date && r.conversion_date >= since)
        .reduce((s, r) => s + Number(r.revenue_amount || 0), 0);

      return {
        total: trackingTotal + convertedTotal,
        today: trackingToday + convertedToday,
        convertedCount: convertedRows.length,
        eventCount: trackingRows.length,
      };
    },
  });
}

/* ── 2. Pipeline funnel by pipeline_stage ─────────────────────────── */
const STAGE_ORDER = [
  "discovered", "new", "contacted", "qualified", "demo_sent",
  "proposal", "negotiation", "closed_won", "closed_lost",
];

function useFunnelSnapshot() {
  return useQuery({
    queryKey: ["war-room-live-funnel"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("brandaro_qualified_leads")
        .select("pipeline_stage");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data || []) as { pipeline_stage: string }[]) {
        const k = row.pipeline_stage || "unknown";
        counts[k] = (counts[k] || 0) + 1;
      }
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const ordered = Object.entries(counts).sort(([a], [b]) => {
        const ai = STAGE_ORDER.indexOf(a);
        const bi = STAGE_ORDER.indexOf(b);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
      return { stages: ordered, total };
    },
  });
}

/* ── 3. Sara AI activity today (brandaro_ai_calls) ────────────────── */
function useSaraTodaySnapshot() {
  return useQuery({
    queryKey: ["war-room-live-sara-today"],
    refetchInterval: 20_000,
    queryFn: async () => {
      const since = startOfToday();
      const { data, error } = await (supabase as any)
        .from("brandaro_ai_calls")
        .select("id, status, outcome, duration_seconds, created_at")
        .gte("created_at", since);
      if (error) throw error;
      const rows = (data || []) as {
        status: string | null;
        outcome: string | null;
        duration_seconds: number | null;
      }[];
      // Rows are written before dispatch — attempts, not outcomes.
      const attempted = rows.length;
      const failed = rows.filter(r =>
        ["failed", "error", "rejected", "canceled", "cancelled"].includes((r.status || "").toLowerCase()),
      ).length;
      const dispatched = attempted - failed;
      const connected = rows.filter(r =>
        ["completed", "connected", "answered"].includes((r.status || "").toLowerCase()),
      ).length;
      const positive = rows.filter(r =>
        ["interested", "booked", "callback", "hot"].includes((r.outcome || "").toLowerCase()),
      ).length;
      const totalSec = rows.reduce((s, r) => s + Number(r.duration_seconds || 0), 0);
      return {
        attempted,
        dispatched,
        failed,
        failureRate: attempted ? Math.round((failed / attempted) * 100) : 0,
        total: dispatched,
        connected,
        positive,
        avgSec: connected ? Math.round(totalSec / connected) : 0,
      };
    },
  });
}


/* ── 4. Recent activity feed ──────────────────────────────────────── */
type Activity = {
  key: string;
  kind: "call" | "lead";
  title: string;
  subtitle: string;
  ts: string;
};

function useActivityFeed() {
  return useQuery({
    queryKey: ["war-room-live-activity"],
    refetchInterval: 20_000,
    queryFn: async (): Promise<Activity[]> => {
      const [calls, leads] = await Promise.all([
        (supabase as any)
          .from("brandaro_ai_calls")
          .select("id, lead_id, status, outcome, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
        (supabase as any)
          .from("brandaro_qualified_leads")
          .select("id, business_name, pipeline_stage, lead_status, updated_at")
          .order("updated_at", { ascending: false })
          .limit(8),
      ]);

      const items: Activity[] = [];
      for (const c of (calls.data || []) as any[]) {
        items.push({
          key: `c:${c.id}`,
          kind: "call",
          title: `Sara call · ${c.outcome || c.status || "in progress"}`,
          subtitle: c.lead_id ? `Lead ${String(c.lead_id).slice(0, 8)}` : "unassigned",
          ts: c.created_at,
        });
      }
      for (const l of (leads.data || []) as any[]) {
        items.push({
          key: `l:${l.id}`,
          kind: "lead",
          title: l.business_name || "Unnamed lead",
          subtitle: `${l.pipeline_stage || "—"} · ${l.lead_status || "—"}`,
          ts: l.updated_at,
        });
      }
      return items
        .filter(i => i.ts)
        .sort((a, b) => (a.ts < b.ts ? 1 : -1))
        .slice(0, 10);
    },
  });
}

/* ── Panel ────────────────────────────────────────────────────────── */
export function WarRoomLiveSnapshot() {
  const rev = useRevenueSnapshot();
  const funnel = useFunnelSnapshot();
  const sara = useSaraTodaySnapshot();
  const feed = useActivityFeed();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Revenue */}
      <Card className="border-emerald-500/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-emerald-500" /> Live Revenue
            </h3>
            <Link to="/brandaro/revenue" className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-0.5">
              Open <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {rev.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
                <p className="text-2xl font-bold tabular-nums text-emerald-600">
                  {formatMoney(rev.data?.total || 0)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Today</p>
                  <p className="font-semibold tabular-nums">{formatMoney(rev.data?.today || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Converted leads</p>
                  <p className="font-semibold tabular-nums">{rev.data?.convertedCount || 0}</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {rev.data?.eventCount || 0} revenue events tracked
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pipeline funnel */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-blue-500" /> Pipeline Funnel
            </h3>
            <Link to="/brandaro/leads" className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-0.5">
              Leads <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {funnel.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : funnel.data?.total === 0 ? (
            <p className="text-xs text-muted-foreground">No leads yet.</p>
          ) : (
            <div className="space-y-1.5">
              {funnel.data?.stages.map(([stage, count]) => {
                const pct = funnel.data!.total > 0 ? (count / funnel.data!.total) * 100 : 0;
                return (
                  <div key={stage} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="capitalize">{stage.replace(/_/g, " ")}</span>
                      <span className="tabular-nums text-muted-foreground">{count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500/70"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="text-[10px] text-muted-foreground pt-1">
                {funnel.data?.total} total leads
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sara AI today */}
      <Card className="border-purple-500/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-purple-500" /> Sara Today
            </h3>
            <Link to="/brandaro/calling" className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-0.5">
              Calling <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {sara.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Dialed today · {sara.data?.attempted || 0} attempted
                </p>
                <p className="text-2xl font-bold tabular-nums text-purple-600">
                  {sara.data?.dispatched || 0}
                </p>
                {!!sara.data?.failed && (
                  <p className="text-[10px] font-medium text-destructive">
                    {sara.data.failed} failed to dispatch ({sara.data.failureRate}%)
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Connected</p>
                  <p className="font-semibold tabular-nums">{sara.data?.connected || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Positive</p>
                  <p className="font-semibold tabular-nums text-emerald-600">{sara.data?.positive || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Avg sec</p>
                  <p className="font-semibold tabular-nums">{sara.data?.avgSec || 0}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent activity — spans full row */}
      <Card className="lg:col-span-3">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-amber-500" /> Recent Activity
            </h3>
            <Badge variant="outline" className="text-[10px]">Live — refreshes every 20s</Badge>
          </div>
          {feed.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : feed.data && feed.data.length > 0 ? (
            <ul className="divide-y divide-border/60">
              {feed.data.map(item => (
                <li key={item.key} className="py-2 flex items-center gap-3 text-xs">
                  <div className={
                    item.kind === "call"
                      ? "h-6 w-6 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center"
                      : "h-6 w-6 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center"
                  }>
                    {item.kind === "call" ? <Phone className="h-3 w-3" /> : <User className="h-3 w-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{relTime(item.ts)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No recent activity.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
