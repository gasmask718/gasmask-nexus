import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bot, Play, Pause, Settings, Brain, Clock, Zap, CheckCircle2,
  XCircle, Loader2, Target, Globe, ChevronDown, ChevronRight,
  DollarSign, ShieldAlert, TrendingUp, BarChart3,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL_INDUSTRIES = [
  "cleaning service", "moving company", "painting contractor", "landscaping",
  "handyman", "auto detailing", "carpet cleaning", "junk removal",
  "pressure washing", "house cleaning", "plumber", "electrician",
  "hvac", "roofing contractor", "flooring", "window cleaning",
  "pool service", "tree service", "appliance repair", "locksmith",
];

const ALL_STATES = ["NY", "NJ", "FL", "TX", "GA", "PA", "MD", "CT", "MA", "IL"];

const MODE_CONFIG: Record<string, { label: string; desc: string; icon: string; searches: number; hours: number; dailyLimit: number }> = {
  conservative: { label: "Conservative", desc: "5 searches/run, every 12h · ~$0.50/day", icon: "🐢", searches: 5, hours: 12, dailyLimit: 0.5 },
  balanced: { label: "Balanced", desc: "10 searches/run, every 6h · ~$2/day", icon: "⚖️", searches: 10, hours: 6, dailyLimit: 2.0 },
  aggressive: { label: "Aggressive", desc: "20 searches/run, every 3h · ~$5/day", icon: "🚀", searches: 20, hours: 3, dailyLimit: 5.0 },
};

function budgetColor(pct: number) {
  if (pct >= 80) return "bg-destructive";
  if (pct >= 60) return "bg-amber-500";
  return "bg-green-500";
}

export default function ScoutAgentPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [editBudget, setEditBudget] = useState(false);
  const [budgetDaily, setBudgetDaily] = useState("");
  const [budgetMonthly, setBudgetMonthly] = useState("");
  const [memoryFilter, setMemoryFilter] = useState<{ state: string; industry: string }>({ state: "", industry: "" });

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

  // ── Derived ──
  const uniqueCities = new Set(memory?.map((m: any) => `${m.city},${m.state}`) || []);
  const uniqueStates = new Set(memory?.map((m: any) => m.state) || []);
  const totalMemoryLeads = memory?.reduce((s: number, m: any) => s + (m.leads_imported || 0), 0) || 0;
  const bestEntry = memory?.[0];
  const zeroLeadSearches = memory?.filter((m: any) => m.leads_imported === 0).length || 0;
  const nextRunAt = config?.last_run_at
    ? new Date(new Date(config.last_run_at).getTime() + (config.min_hours_between_runs || 6) * 60 * 60 * 1000)
    : null;

  const dailyPct = config ? Math.min(100, ((config.daily_spend_today || 0) / (config.daily_spend_limit || 2)) * 100) : 0;
  const monthlyPct = config ? Math.min(100, ((config.monthly_spend_this_month || 0) / (config.monthly_spend_limit || 20)) * 100) : 0;
  const costPerLead = config?.total_spent_all_time && config?.total_leads_imported
    ? (config.total_spent_all_time / config.total_leads_imported).toFixed(4)
    : "—";

  // Coverage heatmap data
  const coverageByState: Record<string, { searches: number; leads: number; industries: Record<string, { cities: number; leads: number }> }> = {};
  memory?.forEach((m: any) => {
    if (!coverageByState[m.state]) coverageByState[m.state] = { searches: 0, leads: 0, industries: {} };
    coverageByState[m.state].searches++;
    coverageByState[m.state].leads += m.leads_imported || 0;
    if (!coverageByState[m.state].industries[m.industry]) coverageByState[m.state].industries[m.industry] = { cities: 0, leads: 0 };
    coverageByState[m.state].industries[m.industry].cities++;
    coverageByState[m.state].industries[m.industry].leads += m.leads_imported || 0;
  });

  // Filtered memory
  const filteredMemory = memory?.filter((m: any) => {
    if (memoryFilter.state && m.state !== memoryFilter.state) return false;
    if (memoryFilter.industry && m.industry !== memoryFilter.industry) return false;
    return true;
  }) || [];

  // ── Actions ──
  const toggleAgent = useCallback(async () => {
    if (!config) return;
    await supabase.from("brandaro_scout_config" as any).update({ is_active: !config.is_active } as any).eq("id", config.id);
    queryClient.invalidateQueries({ queryKey: ["scout-config"] });
    toast({ title: config.is_active ? "⏸ Agent paused" : "▶ Agent activated" });
  }, [config, queryClient, toast]);

  const runNow = useCallback(async () => {
    setIsRunning(true);
    toast({ title: "🤖 Scout Agent running...", description: "AI is deciding what to search..." });
    try {
      const { data, error } = await supabase.functions.invoke("brandaro-scout-agent", { body: { manual: true } });
      if (error) throw error;
      if (data?.status === "budget_limit" || data?.status === "monthly_limit") {
        toast({ title: "💰 Budget limit reached", description: data.message, variant: "destructive" });
      } else {
        toast({
          title: "✅ Scout run complete",
          description: `${data?.searches_completed || 0} searches — ${data?.total_imported || 0} leads — Cost: ${data?.run_cost || "$0"}`,
        });
      }
    } catch (err: any) {
      toast({ title: "Scout failed", description: err.message, variant: "destructive" });
    } finally {
      setIsRunning(false);
      queryClient.invalidateQueries({ queryKey: ["scout-runs", "scout-memory", "scout-config"] });
    }
  }, [toast, queryClient]);

  const updateMode = useCallback(async (mode: string) => {
    if (!config) return;
    const mc = MODE_CONFIG[mode];
    await supabase.from("brandaro_scout_config" as any).update({
      mode, searches_per_run: mc.searches, min_hours_between_runs: mc.hours, daily_spend_limit: mc.dailyLimit,
    } as any).eq("id", config.id);
    queryClient.invalidateQueries({ queryKey: ["scout-config"] });
    toast({ title: `Mode: ${mc.label}` });
  }, [config, queryClient, toast]);

  const saveBudget = useCallback(async () => {
    if (!config) return;
    const updates: any = {};
    if (budgetDaily) updates.daily_spend_limit = parseFloat(budgetDaily);
    if (budgetMonthly) updates.monthly_spend_limit = parseFloat(budgetMonthly);
    await supabase.from("brandaro_scout_config" as any).update(updates).eq("id", config.id);
    queryClient.invalidateQueries({ queryKey: ["scout-config"] });
    setEditBudget(false);
    toast({ title: "Budget updated" });
  }, [config, budgetDaily, budgetMonthly, queryClient, toast]);

  const toggleIndustry = useCallback(async (ind: string) => {
    if (!config) return;
    const current = (config.target_industries as string[]) || [];
    const updated = current.includes(ind) ? current.filter((i: string) => i !== ind) : [...current, ind];
    await supabase.from("brandaro_scout_config" as any).update({ target_industries: updated } as any).eq("id", config.id);
    queryClient.invalidateQueries({ queryKey: ["scout-config"] });
  }, [config, queryClient]);

  const toggleState = useCallback(async (st: string) => {
    if (!config) return;
    const current = (config.target_states as string[]) || [];
    const updated = current.includes(st) ? current.filter((s: string) => s !== st) : [...current, st];
    await supabase.from("brandaro_scout_config" as any).update({ target_states: updated } as any).eq("id", config.id);
    queryClient.invalidateQueries({ queryKey: ["scout-config"] });
  }, [config, queryClient]);

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
          <Bot className="h-6 w-6 text-primary" /> Autonomous Scout Agent
        </h1>
        <p className="text-sm text-muted-foreground">AI-powered lead discovery with built-in budget controls</p>
      </div>

      {/* ── Status + Budget ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Agent status */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${config?.is_active ? "bg-green-500 animate-pulse" : "bg-destructive"}`} />
                <span className="font-semibold">{config?.is_active ? "Active" : "Paused"}</span>
              </div>
              <Button variant="outline" size="sm" onClick={toggleAgent}>
                {config?.is_active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <Button onClick={runNow} disabled={isRunning || !config?.is_active} className="w-full gap-1.5" size="sm">
              {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              {isRunning ? "Running..." : "Run Now"}
            </Button>
            <div className="mt-3 space-y-1">
              <p className="text-[10px] text-muted-foreground">Last: {config?.last_run_at ? new Date(config.last_run_at).toLocaleString() : "Never"}</p>
              <p className="text-[10px] text-muted-foreground">Next: {nextRunAt ? nextRunAt.toLocaleString() : "—"}</p>
            </div>
          </CardContent>
        </Card>

        {/* Daily budget */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium flex items-center gap-1"><DollarSign className="h-3 w-3" /> Daily Budget</span>
              <span className="text-xs text-muted-foreground">Resets midnight</span>
            </div>
            <Progress value={dailyPct} className={`h-3 mb-1 [&>div]:${budgetColor(dailyPct)}`} />
            <p className="text-sm font-medium">
              ${(config?.daily_spend_today || 0).toFixed(4)} / ${(config?.daily_spend_limit || 2).toFixed(2)}
            </p>
          </CardContent>
        </Card>

        {/* Monthly budget */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium flex items-center gap-1"><BarChart3 className="h-3 w-3" /> Monthly Budget</span>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => { setEditBudget(!editBudget); setBudgetDaily(String(config?.daily_spend_limit || 2)); setBudgetMonthly(String(config?.monthly_spend_limit || 20)); }}>
                Edit
              </Button>
            </div>
            <Progress value={monthlyPct} className={`h-3 mb-1 [&>div]:${budgetColor(monthlyPct)}`} />
            <p className="text-sm font-medium">
              ${(config?.monthly_spend_this_month || 0).toFixed(4)} / ${(config?.monthly_spend_limit || 20).toFixed(2)}
            </p>
            {editBudget && (
              <div className="mt-2 space-y-2 border-t pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-[10px]">Daily $</label><Input value={budgetDaily} onChange={(e) => setBudgetDaily(e.target.value)} className="h-7 text-xs" /></div>
                  <div><label className="text-[10px]">Monthly $</label><Input value={budgetMonthly} onChange={(e) => setBudgetMonthly(e.target.value)} className="h-7 text-xs" /></div>
                </div>
                <Button size="sm" className="h-6 text-[10px] w-full" onClick={saveBudget}>Save</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Lifetime Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold text-green-600">{config?.total_leads_imported || 0}</p>
          <p className="text-[10px] text-muted-foreground">Total Leads Imported</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold">{config?.total_searches || 0}</p>
          <p className="text-[10px] text-muted-foreground">Total Searches</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold">${(config?.total_spent_all_time || 0).toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">Total Spent</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold">${costPerLead}</p>
          <p className="text-[10px] text-muted-foreground">Cost Per Lead</p>
        </CardContent></Card>
      </div>

      {/* ── Configuration ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" /> Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Mode</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {Object.entries(MODE_CONFIG).map(([key, mc]) => (
                <button key={key} onClick={() => updateMode(key)}
                  className={`p-3 rounded-lg border text-left transition-all ${config?.mode === key ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/30"}`}>
                  <p className="font-medium text-sm">{mc.icon} {mc.label}</p>
                  <p className="text-[10px] text-muted-foreground">{mc.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Target Industries</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_INDUSTRIES.map((ind) => (
                <Button key={ind} variant={((config?.target_industries as string[]) || []).includes(ind) ? "default" : "outline"}
                  size="sm" className="text-[10px] h-6" onClick={() => toggleIndustry(ind)}>{ind}</Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Target States</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATES.map((st) => (
                <Button key={st} variant={((config?.target_states as string[]) || []).includes(st) ? "default" : "outline"}
                  size="sm" className="text-xs h-7 w-12" onClick={() => toggleState(st)}>{st}</Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Run History ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Run History</CardTitle>
        </CardHeader>
        <CardContent>
          {(!runs || runs.length === 0) ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No runs yet. Click "Run Now" to start.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((run: any) => {
                const isExp = expandedRun === run.id;
                const decisions = (run.decisions as any[]) || [];
                return (
                  <div key={run.id} className="border rounded-lg">
                    <button className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30" onClick={() => setExpandedRun(isExp ? null : run.id)}>
                      <div className="flex items-center gap-3">
                        {run.status === "running" ? <Loader2 className="h-4 w-4 animate-spin text-amber-500" /> :
                          run.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                          run.status === "stopped_budget" ? <ShieldAlert className="h-4 w-4 text-amber-500" /> :
                          <XCircle className="h-4 w-4 text-destructive" />}
                        <div>
                          <p className="text-xs font-medium">
                            {new Date(run.started_at).toLocaleString()} — <span className="text-green-600">{run.total_imported} leads</span> · {run.searches_completed}/{run.searches_attempted} searches
                            {run.estimated_cost ? <span className="text-muted-foreground"> · ${Number(run.estimated_cost).toFixed(4)}</span> : null}
                          </p>
                          {run.stop_reason && <p className="text-[10px] text-amber-500">{run.stop_reason}</p>}
                        </div>
                      </div>
                      {isExp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    {isExp && decisions.length > 0 && (
                      <div className="border-t px-3 py-2 max-h-[300px] overflow-auto">
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead className="text-xs">Industry</TableHead>
                            <TableHead className="text-xs">City</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs text-right">Imported</TableHead>
                            <TableHead className="text-xs text-right">Cost</TableHead>
                            <TableHead className="text-xs">Reason</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {decisions.map((d: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="text-xs">{d.industry}</TableCell>
                                <TableCell className="text-xs">{d.city}, {d.state}</TableCell>
                                <TableCell>
                                  <Badge variant={d.status === "completed" ? "default" : d.status?.includes("budget") ? "secondary" : d.status === "skipped_duplicate" ? "outline" : "destructive"} className="text-[10px]">
                                    {d.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-right font-medium text-green-600">{d.imported || 0}</TableCell>
                                <TableCell className="text-xs text-right">{d.cost ? `$${Number(d.cost).toFixed(4)}` : "—"}</TableCell>
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

      {/* ── Scout Memory ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4" /> Scout Memory</CardTitle>
          <CardDescription>
            {uniqueCities.size} cities · {uniqueStates.size} states · {totalMemoryLeads} leads · {zeroLeadSearches} zero-lead searches
            {bestEntry && bestEntry.leads_imported > 0 && <> · Best: <span className="font-medium text-green-600">{bestEntry.industry}</span> in {bestEntry.city} ({bestEntry.leads_imported})</>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Select value={memoryFilter.state} onValueChange={(v) => setMemoryFilter((p) => ({ ...p, state: v === "all" ? "" : v }))}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="All states" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                {ALL_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={memoryFilter.industry} onValueChange={(v) => setMemoryFilter((p) => ({ ...p, industry: v === "all" ? "" : v }))}>
              <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="All industries" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All industries</SelectItem>
                {ALL_INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {filteredMemory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No searches in memory yet.</p>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Industry</TableHead><TableHead>City</TableHead><TableHead>St</TableHead>
                  <TableHead className="text-right">Found</TableHead><TableHead className="text-right">Imported</TableHead>
                  <TableHead className="text-right">Rate</TableHead><TableHead>Date</TableHead><TableHead>Revisit</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredMemory.map((m: any) => (
                    <TableRow key={m.id} className={m.leads_imported >= 5 ? "bg-green-500/5" : m.leads_imported >= 1 ? "bg-amber-500/5" : ""}>
                      <TableCell className="text-xs font-medium">{m.industry}</TableCell>
                      <TableCell className="text-xs">{m.city}</TableCell>
                      <TableCell className="text-xs">{m.state}</TableCell>
                      <TableCell className="text-xs text-right">{m.leads_found}</TableCell>
                      <TableCell className="text-xs text-right font-medium text-green-600">{m.leads_imported}</TableCell>
                      <TableCell className="text-xs text-right">{m.success_rate}%</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(m.searched_at).toLocaleDateString()}</TableCell>
                      <TableCell>{m.worth_revisiting ? <Badge className="text-[10px] bg-green-600">Yes</Badge> : <span className="text-[10px] text-muted-foreground">No</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Coverage Heatmap ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Coverage Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(coverageByState).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No coverage data yet.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(coverageByState).sort((a, b) => b[1].leads - a[1].leads).map(([state, data]) => (
                <div key={state}>
                  <p className="font-semibold text-sm mb-1">
                    {state} — <span className="text-muted-foreground font-normal">{data.searches} searches, </span>
                    <span className="text-green-600">{data.leads} leads</span>
                  </p>
                  <div className="pl-4 space-y-0.5">
                    {Object.entries(data.industries).sort((a, b) => b[1].leads - a[1].leads).map(([ind, stats]) => (
                      <p key={ind} className="text-xs text-muted-foreground">
                        {ind}: <span className="text-foreground">{stats.cities} cities</span>, <span className="text-green-600">{stats.leads} leads</span>
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
