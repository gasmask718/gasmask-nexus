import { useMemo, useState } from "react";
import { useHealthChecks, useHealthRuns, runHealthCheck, useMonitoringControls, useUpdateMonitoringControl, type HealthCheck, type HealthStatus, type MonitoringControl } from "@/hooks/useHealthChecks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Activity, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

const CONTROL_LABELS: Record<MonitoringControl["system_name"], { title: string; description: string }> = {
  system_health_monitoring: { title: "Health Monitoring", description: "Run and persist OS-wide health checks." },
  system_health_sms: { title: "Health Failure SMS", description: "Send one aggregated SMS incident alert at most every six hours." },
  comms_health_monitoring: { title: "Communications Monitoring", description: "Run and persist communications diagnostics." },
  comms_health_sms: { title: "Communications Failure SMS", description: "Send one aggregated communications incident SMS at most every six hours." },
};

function MonitoringControls() {
  const { data: controls = [], isLoading, error } = useMonitoringControls();
  const updateControl = useUpdateMonitoringControl();
  const byName = new Map(controls.map((control) => [control.system_name, control]));
  const names = Object.keys(CONTROL_LABELS) as MonitoringControl["system_name"][];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Monitoring Controls</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border/50">
        {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        {error && <p className="text-sm text-destructive">{error.message}</p>}
        {!isLoading && names.map((name) => {
          const control = byName.get(name);
          const copy = CONTROL_LABELS[name];
          return (
            <div key={name} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{copy.title}</p>
                <p className="text-xs text-muted-foreground">{copy.description}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {control ? `Persisted ${formatDistanceToNow(new Date(control.updated_at), { addSuffix: true })}` : "Control unavailable — safe state applies"}
                </p>
              </div>
              <Switch
                checked={control?.alerts_enabled === true}
                disabled={!control || updateControl.isPending}
                onCheckedChange={(enabled) => updateControl.mutate(
                  { systemName: name, enabled },
                  {
                    onSuccess: () => toast.success(`${copy.title} ${enabled ? "enabled" : "disabled"}`),
                    onError: (mutationError) => toast.error(mutationError.message),
                  },
                )}
                aria-label={copy.title}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status: HealthStatus }) {
  const map = {
    pass: { c: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", I: CheckCircle2 },
    warn: { c: "border-amber-500/40 bg-amber-500/10 text-amber-300", I: AlertTriangle },
    fail: { c: "border-red-500/40 bg-red-500/10 text-red-300", I: XCircle },
    unknown: { c: "border-muted text-muted-foreground", I: Activity },
  } as const;
  const { c, I } = map[status];
  return (
    <Badge variant="outline" className={cn("text-[10px] gap-1", c)}>
      <I className="h-3 w-3" /> {status}
    </Badge>
  );
}

function Sparkline({ checkKey }: { checkKey: string }) {
  const { data: runs } = useHealthRuns(checkKey);
  const last = (runs ?? []).slice(0, 20).reverse();
  if (last.length === 0) return <div className="h-4 w-20 bg-muted/30 rounded" />;
  return (
    <div className="flex gap-[2px] items-end h-4">
      {last.map((r) => (
        <div
          key={r.id}
          title={`${r.status} — ${r.message ?? ""}`}
          className={cn(
            "w-1 rounded-sm",
            r.status === "pass" && "bg-emerald-400 h-3",
            r.status === "warn" && "bg-amber-400 h-2",
            r.status === "fail" && "bg-red-400 h-4",
          )}
        />
      ))}
    </div>
  );
}

function CheckRow({ c, onOpen }: { c: HealthCheck; onOpen: (k: string) => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border/50 hover:bg-muted/30">
      <StatusPill status={c.last_status} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{c.label}</div>
        <div className="text-xs text-muted-foreground truncate">{c.last_message ?? "—"}</div>
      </div>
      <Sparkline checkKey={c.check_key} />
      <div className="text-[10px] text-muted-foreground w-20 text-right">
        {c.last_run_at ? formatDistanceToNow(new Date(c.last_run_at), { addSuffix: true }) : "never"}
      </div>
      <Button size="sm" variant="ghost" className="h-7 px-2" disabled={busy} onClick={async () => {
        setBusy(true);
        try { await runHealthCheck(c.check_key); toast.success(`Ran ${c.label}`); qc.invalidateQueries({ queryKey: ["health_checks"] }); }
        catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
      }}>
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onOpen(c.check_key)}>Details</Button>
    </div>
  );
}

function BusinessFloorGrid({ checks, onOpen }: { checks: HealthCheck[]; onOpen: (k: string) => void }) {
  const grouped = useMemo(() => {
    const m = new Map<string, Map<string, HealthCheck[]>>();
    for (const c of checks) {
      const biz = c.business || "os";
      const floor = c.floor || "general";
      if (!m.has(biz)) m.set(biz, new Map());
      const f = m.get(biz)!;
      if (!f.has(floor)) f.set(floor, []);
      f.get(floor)!.push(c);
    }
    return m;
  }, [checks]);

  return (
    <div className="space-y-6">
      {[...grouped.entries()].map(([biz, floors]) => (
        <div key={biz} className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{biz}</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {[...floors.entries()].map(([floor, items]) => {
              const failing = items.filter(i => i.last_status === "fail").length;
              const warning = items.filter(i => i.last_status === "warn").length;
              const status: HealthStatus = failing ? "fail" : warning ? "warn" : "pass";
              return (
                <Card key={floor}>
                  <CardHeader className="py-2 px-3 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-xs flex items-center gap-2">
                      <StatusPill status={status} /> {floor} <span className="text-muted-foreground">({items.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 space-y-1">
                    {items.map(c => <CheckRow key={c.id} c={c} onOpen={onOpen} />)}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AllGreenBanner({ checks }: { checks: HealthCheck[] }) {
  const failing = checks.filter(c => c.last_status === "fail").length;
  const warning = checks.filter(c => c.last_status === "warn").length;
  if (failing === 0 && warning === 0) {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-4 py-3 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5" />
        <div className="font-medium">All systems operational — {checks.length} checks green</div>
      </div>
    );
  }
  return (
    <div className={cn("rounded-md border px-4 py-3 flex items-center gap-3",
      failing ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300")}>
      {failing ? <XCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
      <div className="font-medium">{failing} failing · {warning} degraded · {checks.length - failing - warning} green</div>
    </div>
  );
}

function CheckDetailDialog({ checkKey, onClose }: { checkKey: string | null; onClose: () => void }) {
  const { data: runs } = useHealthRuns(checkKey);
  return (
    <Dialog open={!!checkKey} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{checkKey}</DialogTitle></DialogHeader>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto text-xs font-mono">
          {(runs ?? []).map(r => (
            <div key={r.id} className="flex gap-2 py-1 border-b border-border/30">
              <StatusPill status={r.status} />
              <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              <span className="flex-1">{r.message}</span>
              <span className="text-muted-foreground">{r.duration_ms}ms</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── AI OPERATIONS TAB ──────────────────────────────────────────────────────
function AIOperationsTab() {
  const { data: agents } = useQuery({
    queryKey: ["health_agents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("health_checks" as any).select("*").eq("kind", "agent").eq("enabled", true);
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 30_000,
  });
  const { data: anomalies } = useQuery({
    queryKey: ["dd_anomaly_findings_recent"],
    queryFn: async () => {
      const { data } = await supabase.from("dd_anomaly_findings" as any).select("*").order("created_at", { ascending: false }).limit(10);
      return data as any[];
    },
  });
  const { data: drafts } = useQuery({
    queryKey: ["communication_drafts_recent"],
    queryFn: async () => {
      const { data } = await supabase.from("communication_drafts" as any).select("*").order("created_at", { ascending: false }).limit(10);
      return data as any[];
    },
  });
  const { data: triage } = useQuery({
    queryKey: ["dd_application_scores_recent"],
    queryFn: async () => {
      const { data } = await supabase.from("dd_application_scores" as any).select("*").order("created_at", { ascending: false }).limit(10);
      return data as any[];
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4" /> AI Agents</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {(agents ?? []).map((a: any) => (
            <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-md border border-border/40">
              <StatusPill status={a.last_status} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{a.label}</div>
                <div className="text-xs text-muted-foreground">{a.last_message ?? "—"}</div>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {a.last_run_at ? formatDistanceToNow(new Date(a.last_run_at), { addSuffix: true }) : "never"}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Anomalies ({(anomalies ?? []).length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs max-h-80 overflow-y-auto">
            {(anomalies ?? []).map((a: any) => (
              <div key={a.id} className="border-l-2 border-amber-500/40 pl-2">
                <div className="font-medium">{a.kind}</div>
                <div className="text-muted-foreground">{a.narrative || a.message || JSON.stringify(a.details).slice(0, 120)}</div>
              </div>
            ))}
            {(!anomalies || anomalies.length === 0) && <div className="text-muted-foreground">No anomalies recorded.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Drafts Awaiting Review ({(drafts ?? []).length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs max-h-80 overflow-y-auto">
            {(drafts ?? []).map((d: any) => (
              <div key={d.id} className="border-l-2 border-blue-500/40 pl-2">
                <div className="font-medium">{d.channel} · {d.kind ?? d.purpose ?? "draft"}</div>
                <div className="text-muted-foreground line-clamp-2">{d.body ?? d.content ?? ""}</div>
              </div>
            ))}
            {(!drafts || drafts.length === 0) && <div className="text-muted-foreground">Inbox clear.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Application Triage ({(triage ?? []).length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs max-h-80 overflow-y-auto">
            {(triage ?? []).map((t: any) => (
              <div key={t.id} className="border-l-2 border-emerald-500/40 pl-2">
                <div className="font-medium">Score {t.legit_score ?? t.score}</div>
                <div className="text-muted-foreground line-clamp-2">{t.reasoning ?? ""}</div>
              </div>
            ))}
            {(!triage || triage.length === 0) && <div className="text-muted-foreground">No scored applications yet.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── COMMS HEALTH (folded in, not rebuilt) ──────────────────────────────────
function CommsHealthFold() {
  const { data: rows } = useQuery({
    queryKey: ["comms_health_latest"],
    queryFn: async () => {
      const { data } = await supabase.from("v_comms_health_latest" as any).select("*").limit(50);
      return data as any[];
    },
    refetchInterval: 60_000,
  });
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Comms Health (live)</CardTitle></CardHeader>
      <CardContent className="space-y-1 max-h-80 overflow-y-auto">
        {(rows ?? []).map((r: any, i: number) => (
          <div key={i} className="flex items-center gap-3 text-xs border-b border-border/30 py-1">
            <StatusPill status={r.status} />
            <span className="font-mono w-32 text-muted-foreground truncate">{r.layer}</span>
            <span className="font-mono truncate flex-1">{r.target}</span>
            <span className="text-muted-foreground truncate">{r.message}</span>
          </div>
        ))}
        {(!rows || rows.length === 0) && <div className="text-xs text-muted-foreground">No comms-health rows yet — runs every 20 min.</div>}
      </CardContent>
    </Card>
  );
}

export default function SystemHealthPage() {
  const { data: checks, refetch, isLoading } = useHealthChecks();
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const runAll = async () => {
    setRunning(true);
    try { await runHealthCheck(); toast.success("All checks ran"); refetch(); }
    catch (e: any) { toast.error(e.message); } finally { setRunning(false); }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Activity className="h-6 w-6" /> System Health</h1>
          <p className="text-sm text-muted-foreground">OS-wide monitor — crons, functions, triggers, chains, integrations, data canaries, AI agents.</p>
        </div>
        <Button onClick={runAll} disabled={running}>
          {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Run All Now
        </Button>
      </div>

      <AllGreenBanner checks={checks ?? []} />
      <MonitoringControls />
      <CommsHealthFold />

      <Tabs defaultValue="grid">
        <TabsList>
          <TabsTrigger value="grid">Business × Floor</TabsTrigger>
          <TabsTrigger value="kind">By Kind</TabsTrigger>
          <TabsTrigger value="ai">AI Operations</TabsTrigger>
        </TabsList>
        <TabsContent value="grid" className="mt-4">
          {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <BusinessFloorGrid checks={checks ?? []} onOpen={setDetailKey} />}
        </TabsContent>
        <TabsContent value="kind" className="mt-4 space-y-4">
          {["cron", "integration", "trigger", "chain", "data_canary", "agent"].map(k => {
            const items = (checks ?? []).filter(c => c.kind === k);
            if (items.length === 0) return null;
            return (
              <Card key={k}>
                <CardHeader className="py-2"><CardTitle className="text-sm capitalize">{k} ({items.length})</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {items.map(c => <CheckRow key={c.id} c={c} onOpen={setDetailKey} />)}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
        <TabsContent value="ai" className="mt-4"><AIOperationsTab /></TabsContent>
      </Tabs>

      <CheckDetailDialog checkKey={detailKey} onClose={() => setDetailKey(null)} />
    </div>
  );
}
