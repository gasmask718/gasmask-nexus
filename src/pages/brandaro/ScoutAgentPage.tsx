import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bot, Play, Pause, Settings, Brain, Map, Clock, Zap, CheckCircle2,
  XCircle, Loader2, TrendingUp, Target, Globe, ChevronDown, ChevronRight
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ALL_INDUSTRIES = [
  "cleaning service", "moving company", "painting contractor", "landscaping",
  "handyman", "auto detailing", "carpet cleaning", "junk removal",
  "pressure washing", "house cleaning", "plumber", "electrician",
  "hvac", "roofing contractor", "flooring", "window cleaning",
  "pool service", "tree service", "appliance repair", "locksmith",
];

const ALL_STATES = ["NY", "NJ", "FL", "TX", "GA", "PA", "MD", "CT", "MA", "IL"];

const MODE_CONFIG = {
  conservative: { label: "Conservative", desc: "5 searches per run, every 12 hours", icon: "🐢", searches: 5, hours: 12 },
  balanced: { label: "Balanced", desc: "10 searches per run, every 6 hours", icon: "⚖️", searches: 10, hours: 6 },
  aggressive: { label: "Aggressive", desc: "20 searches per run, every 3 hours", icon: "🚀", searches: 20, hours: 3 },
};

export default function ScoutAgentPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  // ── Queries ──
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["scout-config"],
    queryFn: async () => {
      const { data } = await supabase.from("brandaro_scout_config" as any).select("*").limit(1).single();
      return data as any;
    },
  });

  const { data: runs } = useQuery({
    queryKey: ["scout-runs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brandaro_scout_runs" as any)
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
    refetchInterval: isRunning ? 5000 : 30000,
  });

  const { data: memory } = useQuery({
    queryKey: ["scout-memory"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brandaro_scout_memory" as any)
        .select("*")
        .order("leads_imported", { ascending: false })
        .limit(500);
      return (data || []) as any[];
    },
  });

  // ── Derived stats ──
  const uniqueCities = new Set(memory?.map((m: any) => `${m.city},${m.state}`) || []);
  const uniqueStates = new Set(memory?.map((m: any) => m.state) || []);
  const totalMemoryLeads = memory?.reduce((s: number, m: any) => s + (m.leads_imported || 0), 0) || 0;
  const bestEntry = memory?.[0];
  const nextRunAt = config?.last_run_at
    ? new Date(new Date(config.last_run_at).getTime() + (config.min_hours_between_runs || 6) * 60 * 60 * 1000)
    : null;

  // ── Actions ──
  const toggleAgent = useCallback(async () => {
    if (!config) return;
    await supabase.from("brandaro_scout_config" as any).update({ is_active: !config.is_active } as any).eq("id", config.id);
    queryClient.invalidateQueries({ queryKey: ["scout-config"] });
    toast({ title: config.is_active ? "⏸ Agent paused" : "▶ Agent activated" });
  }, [config, queryClient, toast]);

  const runNow = useCallback(async () => {
    setIsRunning(true);
    toast({ title: "🤖 Scout Agent running...", description: "Deciding what to search and executing..." });
    try {
      const { data, error } = await supabase.functions.invoke("brandaro-scout-agent", {
        body: { manual: true },
      });
      if (error) throw error;
      toast({
        title: "✅ Scout run complete",
        description: `${data?.searches_completed || 0} searches — ${data?.total_imported || 0} leads imported`,
      });
    } catch (err: any) {
      toast({ title: "Scout run failed", description: err.message, variant: "destructive" });
    } finally {
      setIsRunning(false);
      queryClient.invalidateQueries({ queryKey: ["scout-runs"] });
      queryClient.invalidateQueries({ queryKey: ["scout-memory"] });
      queryClient.invalidateQueries({ queryKey: ["scout-config"] });
    }
  }, [toast, queryClient]);

  const updateMode = useCallback(
    async (mode: string) => {
      if (!config) return;
      const mc = MODE_CONFIG[mode as keyof typeof MODE_CONFIG];
      await supabase
        .from("brandaro_scout_config" as any)
        .update({
          mode,
          searches_per_run: mc.searches,
          min_hours_between_runs: mc.hours,
        } as any)
        .eq("id", config.id);
      queryClient.invalidateQueries({ queryKey: ["scout-config"] });
      toast({ title: `Mode: ${mc.label}`, description: mc.desc });
    },
    [config, queryClient, toast]
  );

  const toggleIndustry = useCallback(
    async (ind: string) => {
      if (!config) return;
      const current = (config.target_industries as string[]) || [];
      const updated = current.includes(ind) ? current.filter((i: string) => i !== ind) : [...current, ind];
      await supabase.from("brandaro_scout_config" as any).update({ target_industries: updated } as any).eq("id", config.id);
      queryClient.invalidateQueries({ queryKey: ["scout-config"] });
    },
    [config, queryClient]
  );

  const toggleState = useCallback(
    async (st: string) => {
      if (!config) return;
      const current = (config.target_states as string[]) || [];
      const updated = current.includes(st) ? current.filter((s: string) => s !== st) : [...current, st];
      await supabase.from("brandaro_scout_config" as any).update({ target_states: updated } as any).eq("id", config.id);
      queryClient.invalidateQueries({ queryKey: ["scout-config"] });
    },
    [config, queryClient]
  );

  if (configLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          Autonomous Scout Agent
        </h1>
        <p className="text-sm text-muted-foreground">AI-powered lead discovery that thinks, searches, learns, and never repeats</p>
      </div>

      {/* ── Section 1: Agent Status ── */}
      <Card>
        <CardContent className="py-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${config?.is_active ? "bg-green-500 animate-pulse" : "bg-destructive"}`} />
              <span className="font-semibold text-lg">{config?.is_active ? "Agent Active" : "Agent Paused"}</span>
              <Button variant="outline" size="sm" onClick={toggleAgent}>
                {config?.is_active ? <><Pause className="h-3.5 w-3.5 mr-1" /> Pause</> : <><Play className="h-3.5 w-3.5 mr-1" /> Resume</>}
              </Button>
            </div>
            <Button onClick={runNow} disabled={isRunning || !config?.is_active} className="gap-1.5">
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {isRunning ? "Running..." : "Run Now"}
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4">
            <div>
              <p className="text-2xl font-bold">{config?.total_searches || 0}</p>
              <p className="text-[10px] text-muted-foreground">Total Searches</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{config?.total_leads_imported || 0}</p>
              <p className="text-[10px] text-muted-foreground">Leads Imported</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{uniqueCities.size}</p>
              <p className="text-[10px] text-muted-foreground">Cities Covered</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{uniqueStates.size}</p>
              <p className="text-[10px] text-muted-foreground">States Covered</p>
            </div>
            <div>
              <p className="text-xs font-medium">{config?.last_run_at ? new Date(config.last_run_at).toLocaleString() : "Never"}</p>
              <p className="text-[10px] text-muted-foreground">Last Run</p>
            </div>
            <div>
              <p className="text-xs font-medium">{nextRunAt ? nextRunAt.toLocaleString() : "—"}</p>
              <p className="text-[10px] text-muted-foreground">Next Scheduled</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Configuration ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" /> Agent Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Mode</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {Object.entries(MODE_CONFIG).map(([key, mc]) => (
                <button
                  key={key}
                  onClick={() => updateMode(key)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    config?.mode === key ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/30"
                  }`}
                >
                  <p className="font-medium text-sm">
                    {mc.icon} {mc.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{mc.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Industries */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Target Industries</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_INDUSTRIES.map((ind) => {
                const active = ((config?.target_industries as string[]) || []).includes(ind);
                return (
                  <Button
                    key={ind}
                    variant={active ? "default" : "outline"}
                    size="sm"
                    className="text-[10px] h-6"
                    onClick={() => toggleIndustry(ind)}
                  >
                    {ind}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* States */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Target States</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATES.map((st) => {
                const active = ((config?.target_states as string[]) || []).includes(st);
                return (
                  <Button
                    key={st}
                    variant={active ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-7 w-12"
                    onClick={() => toggleState(st)}
                  >
                    {st}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Run Feed ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Run History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(!runs || runs.length === 0) ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No runs yet. Click "Run Now" to start the scout agent.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((run: any) => {
                const isExpanded = expandedRun === run.id;
                const decisions = (run.decisions as any[]) || [];
                return (
                  <div key={run.id} className="border rounded-lg">
                    <button
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                    >
                      <div className="flex items-center gap-3">
                        {run.status === "running" ? (
                          <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                        ) : run.status === "completed" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        <div>
                          <p className="text-xs font-medium">
                            {new Date(run.started_at).toLocaleString()} —{" "}
                            <span className="text-green-600">{run.total_imported} imported</span> from{" "}
                            {run.searches_completed}/{run.searches_attempted} searches
                          </p>
                        </div>
                      </div>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    {isExpanded && decisions.length > 0 && (
                      <div className="border-t px-3 py-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Industry</TableHead>
                              <TableHead className="text-xs">City</TableHead>
                              <TableHead className="text-xs">Status</TableHead>
                              <TableHead className="text-xs text-right">Imported</TableHead>
                              <TableHead className="text-xs">Reason</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {decisions.map((d: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="text-xs">{d.industry}</TableCell>
                                <TableCell className="text-xs">{d.city}, {d.state}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant={d.status === "completed" ? "default" : d.status === "skipped" ? "secondary" : "destructive"}
                                    className="text-[10px]"
                                  >
                                    {d.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-right font-medium text-green-600">{d.imported || 0}</TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{d.reason}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 4: Memory Map ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4" /> Scout Memory Map
          </CardTitle>
          <CardDescription>
            {uniqueCities.size} cities searched across {uniqueStates.size} states — {totalMemoryLeads} total leads discovered
            {bestEntry && bestEntry.leads_imported > 0 && (
              <> · Best: <span className="font-medium text-green-600">{bestEntry.industry}</span> in {bestEntry.city} ({bestEntry.leads_imported} leads)</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(!memory || memory.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-6">No searches in memory yet.</p>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Industry</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Found</TableHead>
                    <TableHead className="text-right">Imported</TableHead>
                    <TableHead className="text-right">Success %</TableHead>
                    <TableHead>Searched</TableHead>
                    <TableHead>Revisit?</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memory.map((m: any) => (
                    <TableRow
                      key={m.id}
                      className={
                        m.leads_imported >= 5
                          ? "bg-green-500/5"
                          : m.leads_imported >= 1
                          ? "bg-amber-500/5"
                          : ""
                      }
                    >
                      <TableCell className="text-xs font-medium">{m.industry}</TableCell>
                      <TableCell className="text-xs">{m.city}</TableCell>
                      <TableCell className="text-xs">{m.state}</TableCell>
                      <TableCell className="text-xs text-right">{m.leads_found}</TableCell>
                      <TableCell className="text-xs text-right font-medium text-green-600">{m.leads_imported}</TableCell>
                      <TableCell className="text-xs text-right">{m.success_rate}%</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(m.searched_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {m.worth_revisiting ? (
                          <Badge className="text-[10px] bg-green-600">Yes</Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">No</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
