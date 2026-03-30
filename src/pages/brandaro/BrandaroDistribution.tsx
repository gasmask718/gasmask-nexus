import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Zap, Users, Target, Loader2, ArrowRight, BarChart3, Flame, Clock, Snowflake, RefreshCw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function BrandaroDistribution() {
  const queryClient = useQueryClient();
  const [lastResult, setLastResult] = useState<any>(null);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["brandaro-dist-page"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("brandaro_leads_master")
        .select("assigned_va_id, status, language, intent_score, priority_tier");
      const leads = data || [];
      const unassigned = leads.filter((l: any) => !l.assigned_va_id);
      const assigned = leads.filter((l: any) => l.assigned_va_id);

      const byVA: Record<string, number> = {};
      assigned.forEach((l: any) => {
        byVA[l.assigned_va_id] = (byVA[l.assigned_va_id] || 0) + 1;
      });

      const tierCount = (tier: string) => unassigned.filter((l: any) => l.priority_tier === tier).length;

      return {
        total: leads.length,
        unassigned: unassigned.length,
        assigned: assigned.length,
        byVA: Object.entries(byVA).sort((a, b) => (b[1] as number) - (a[1] as number)),
        hotUnassigned: tierCount("hot"),
        warmUnassigned: tierCount("warm"),
        coldUnassigned: tierCount("cold"),
        spanishUnassigned: unassigned.filter((l: any) => l.language === "spanish").length,
        englishUnassigned: unassigned.filter((l: any) => l.language !== "spanish").length,
      };
    },
  });

  const { data: distributions = [] } = useQuery({
    queryKey: ["brandaro-dist-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brandaro_lead_distributions")
        .select("*")
        .order("distributed_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const runDistribution = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("brandaro-auto-distribute", {
        body: { max_per_va: 20 },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setLastResult(data);
      queryClient.invalidateQueries({ queryKey: ["brandaro-dist-page"] });
      queryClient.invalidateQueries({ queryKey: ["brandaro-dist-history"] });
      const tiers = data?.by_tier || {};
      toast.success(`Distributed: 🔥${tiers.hot || 0} HOT, ⚡${tiers.warm || 0} WARM, ❄️${tiers.cold || 0} COLD`);
    },
    onError: () => toast.error("Distribution failed"),
  });

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Priority Distribution</h1>
            <p className="text-sm text-muted-foreground">🔥 HOT leads assigned first → best VAs</p>
          </div>
        </div>
        <Button onClick={() => runDistribution.mutate()} disabled={runDistribution.isPending}>
          {runDistribution.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowRight className="h-4 w-4 mr-1" />}
          Run Priority Distribution
        </Button>
      </div>

      {/* Priority Pipeline */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 text-center">
            <Flame className="h-5 w-5 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-amber-500">{stats?.hotUnassigned || 0}</p>
            <p className="text-xs text-muted-foreground">🔥 HOT Unassigned</p>
            <p className="text-[10px] text-amber-500/70 mt-1">Assign FIRST → Call immediately</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/40 bg-blue-500/5">
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-blue-500">{stats?.warmUnassigned || 0}</p>
            <p className="text-xs text-muted-foreground">⚡ WARM Unassigned</p>
            <p className="text-[10px] text-blue-500/70 mt-1">After HOT exhausted</p>
          </CardContent>
        </Card>
        <Card className="border-muted bg-muted/20">
          <CardContent className="p-4 text-center">
            <Snowflake className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-2xl font-bold text-muted-foreground">{stats?.coldUnassigned || 0}</p>
            <p className="text-xs text-muted-foreground">❄️ COLD Unassigned</p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">Low priority queue</p>
          </CardContent>
        </Card>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <Target className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats?.total || 0}</p>
            <p className="text-xs text-muted-foreground">Total Leads</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 text-amber-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-amber-400">{stats?.unassigned || 0}</p>
            <p className="text-xs text-muted-foreground">Unassigned</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-emerald-400">{stats?.assigned || 0}</p>
            <p className="text-xs text-muted-foreground">Assigned</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <Zap className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats?.byVA?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Active VAs</p>
          </CardContent>
        </Card>
      </div>

      {/* Last Distribution Result */}
      {lastResult && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Last Distribution Result
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 text-sm">
            <Badge className="bg-amber-500/20 text-amber-500">🔥 HOT: {lastResult.by_tier?.hot || 0}</Badge>
            <Badge className="bg-blue-500/20 text-blue-500">⚡ WARM: {lastResult.by_tier?.warm || 0}</Badge>
            <Badge className="bg-muted text-muted-foreground">❄️ COLD: {lastResult.by_tier?.cold || 0}</Badge>
            <Badge variant="outline">Total: {lastResult.distributed || 0}</Badge>
          </CardContent>
        </Card>
      )}

      {/* Language Breakdown */}
      {(stats?.unassigned || 0) > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Unassigned by Language</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Badge variant="outline">🇺🇸 English: {stats?.englishUnassigned || 0}</Badge>
            <Badge variant="outline">🇪🇸 Spanish: {stats?.spanishUnassigned || 0}</Badge>
          </CardContent>
        </Card>
      )}

      {/* VA Workload */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">VA Workload</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
          ) : (stats?.byVA || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No leads assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {stats?.byVA?.map(([vaId, count]: [string, number], i: number) => (
                <div key={vaId} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">VA {i + 1} ({vaId.slice(0, 8)}...)</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min((count / 30) * 100, 100)}%` }} />
                    </div>
                    <Badge variant="secondary" className="text-xs">{count}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distribution History */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Distribution History</CardTitle>
        </CardHeader>
        <CardContent>
          {distributions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No distributions yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {distributions.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between text-xs bg-muted/30 rounded p-2 border border-border">
                  <span className="text-muted-foreground">{new Date(d.distributed_at).toLocaleString()}</span>
                  <span className="text-foreground truncate max-w-[200px]">{d.distribution_reason}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
