import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, PhoneCall, Radio, Rocket, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

const ACTIVE_STATUSES = new Set([
  "initiated",
  "queued",
  "ringing",
  "dialing",
  "in-progress",
  "in_progress",
  "answered",
]);

type LiveCall = {
  id: string;
  call_sid: string | null;
  business: string | null;
  agent_name: string | null;
  agent_type: string | null;
  from_number: string | null;
  to_number: string | null;
  status: string;
  lead_name: string | null;
  duration_seconds: number | null;
  created_at: string;
};

type LiveBatch = {
  id: string;
  business: string | null;
  agent_name: string | null;
  agent_type: string | null;
  status: string;
  concurrency: number;
  total_count: number;
  queued_count: number;
  dialing_count: number;
  connected_count: number;
  done_count: number;
  failed_count: number;
  skipped_count: number;
  created_at: string;
};

function statusVariant(status: string) {
  const s = status.toLowerCase();
  if (s === "in-progress" || s === "in_progress" || s === "answered")
    return "bg-green-500/15 text-green-600 border-green-500/30 animate-pulse";
  if (s === "ringing" || s === "dialing")
    return "bg-yellow-500/15 text-yellow-600 border-yellow-500/30 animate-pulse";
  if (s === "initiated" || s === "queued")
    return "bg-blue-500/15 text-blue-600 border-blue-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function fmtDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function Ticker({ start }: { start: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.floor((now - new Date(start).getTime()) / 1000);
  return <span className="font-mono tabular-nums">{fmtDuration(elapsed)}</span>;
}

export default function DCLiveCallsBoard() {
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [batches, setBatches] = useState<LiveBatch[]>([]);
  const [businessFilter, setBusinessFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [callsRes, batchesRes] = await Promise.all([
      supabase
        .from("dc_call_logs")
        .select(
          "id, call_sid, business, agent_name, agent_type, from_number, to_number, status, lead_name, duration_seconds, created_at"
        )
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("dc_bulk_batches")
        .select(
          "id, business, agent_name, agent_type, status, concurrency, total_count, queued_count, dialing_count, connected_count, done_count, failed_count, skipped_count, created_at"
        )
        .in("status", ["queued", "running"])
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (callsRes.data) setCalls(callsRes.data as LiveCall[]);
    if (batchesRes.data) setBatches(batchesRes.data as LiveBatch[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const poll = setInterval(fetchAll, 2000);

    const channel = supabase
      .channel("dc-live-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dc_call_logs" },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dc_bulk_batches" },
        () => fetchAll()
      )
      .subscribe();

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, []);

  const activeCalls = useMemo(
    () =>
      calls.filter(
        (c) =>
          ACTIVE_STATUSES.has((c.status || "").toLowerCase()) &&
          (businessFilter === "all" || (c.business || "unknown") === businessFilter)
      ),
    [calls, businessFilter]
  );

  const recentlyEnded = useMemo(
    () =>
      calls
        .filter(
          (c) =>
            !ACTIVE_STATUSES.has((c.status || "").toLowerCase()) &&
            (businessFilter === "all" || (c.business || "unknown") === businessFilter)
        )
        .slice(0, 10),
    [calls, businessFilter]
  );

  const businesses = useMemo(() => {
    const set = new Set<string>();
    calls.forEach((c) => set.add(c.business || "unknown"));
    batches.forEach((b) => set.add(b.business || "unknown"));
    return Array.from(set).sort();
  }, [calls, batches]);

  const grouped = useMemo(() => {
    const map = new Map<string, LiveCall[]>();
    activeCalls.forEach((c) => {
      const k = c.business || "unknown";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(c);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [activeCalls]);

  const visibleBatches = useMemo(
    () =>
      batches.filter(
        (b) => businessFilter === "all" || (b.business || "unknown") === businessFilter
      ),
    [batches, businessFilter]
  );

  return (
    <div className="w-full min-h-full space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Radio className="h-6 w-6 text-primary animate-pulse" />
          <div>
            <h1 className="text-2xl font-bold">Live Calls Board</h1>
            <p className="text-xs text-muted-foreground">
              All in-progress calls across providers • realtime + 2s poll
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={businessFilter} onValueChange={setBusinessFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All businesses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All businesses</SelectItem>
              {businesses.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button asChild size="sm">
            <Link to="/dynasty-connect/bulk-launch">
              <Rocket className="h-4 w-4 mr-1" />
              Bulk Launch
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Active Calls</div>
            <div className="text-2xl font-bold">{activeCalls.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Running Batches</div>
            <div className="text-2xl font-bold">{visibleBatches.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Businesses Live</div>
            <div className="text-2xl font-bold">{grouped.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Ended (last hr)</div>
            <div className="text-2xl font-bold">{recentlyEnded.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Batches */}
      {visibleBatches.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="h-4 w-4" /> Active Bulk Batches
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleBatches.map((b) => {
              const progress =
                b.total_count > 0
                  ? Math.round(
                      ((b.done_count + b.failed_count + b.skipped_count) / b.total_count) * 100
                    )
                  : 0;
              return (
                <div
                  key={b.id}
                  className="rounded border border-border bg-muted/30 p-3 flex flex-wrap items-center gap-3"
                >
                  <Badge variant="outline">{b.business || "unknown"}</Badge>
                  <span className="text-sm font-medium">
                    {b.agent_name || b.agent_type || "agent"}
                  </span>
                  <Badge className={statusVariant(b.status)}>{b.status}</Badge>
                  <span className="text-xs text-muted-foreground">
                    concurrency {b.concurrency}
                  </span>
                  <div className="flex-1 min-w-[200px]">
                    <div className="h-2 bg-border rounded overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xs flex gap-3">
                    <span>queued <b>{b.queued_count}</b></span>
                    <span className="text-yellow-600">dialing <b>{b.dialing_count}</b></span>
                    <span className="text-green-600">done <b>{b.done_count}</b></span>
                    <span className="text-destructive">fail <b>{b.failed_count}</b></span>
                    <span className="text-muted-foreground">skip <b>{b.skipped_count}</b></span>
                    <span>/ {b.total_count}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Live calls grouped by business */}
      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Loading live calls…
          </CardContent>
        </Card>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No active calls right now. Fire a{" "}
            <Link to="/dynasty-connect/bulk-launch" className="text-primary underline">
              bulk batch
            </Link>{" "}
            and watch them appear here.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([biz, list]) => (
            <Card key={biz}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-green-500" />
                  <span className="capitalize">{biz}</span>
                  <Badge variant="secondary">{list.length} live</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {list.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center gap-3 rounded border border-border bg-card p-3"
                  >
                    <Badge className={statusVariant(c.status)}>{c.status}</Badge>
                    <span className="text-sm font-medium min-w-[140px]">
                      {c.agent_name || c.agent_type || "agent"}
                    </span>
                    <span className="text-sm text-muted-foreground font-mono">
                      {c.from_number || "—"} → {c.to_number || "—"}
                    </span>
                    {c.lead_name && (
                      <span className="text-xs text-muted-foreground truncate">
                        {c.lead_name}
                      </span>
                    )}
                    <div className="ml-auto text-sm">
                      <Ticker start={c.created_at} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recently ended */}
      {recentlyEnded.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recently Ended</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentlyEnded.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 text-xs text-muted-foreground border-b border-border/50 py-1.5"
                >
                  <Badge variant="outline" className="text-[10px]">
                    {c.status}
                  </Badge>
                  <span>{c.business || "—"}</span>
                  <span className="font-mono">{c.to_number}</span>
                  {c.duration_seconds != null && (
                    <span>{fmtDuration(c.duration_seconds)}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
