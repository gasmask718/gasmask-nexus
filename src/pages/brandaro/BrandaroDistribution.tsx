import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Zap, Users, Target, Loader2, ArrowRight, BarChart3 } from "lucide-react";

export default function BrandaroDistribution() {
  const queryClient = useQueryClient();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["brandaro-dist-page"],
    queryFn: async () => {
      const { data } = await supabase.from("brandaro_leads_master").select("assigned_va_id, status, language");
      const leads = data || [];
      const unassigned = leads.filter((l: any) => !l.assigned_va_id);
      const assigned = leads.filter((l: any) => l.assigned_va_id);

      // Group by VA
      const byVA: Record<string, number> = {};
      assigned.forEach((l: any) => {
        byVA[l.assigned_va_id] = (byVA[l.assigned_va_id] || 0) + 1;
      });

      return {
        total: leads.length,
        unassigned: unassigned.length,
        assigned: assigned.length,
        byVA: Object.entries(byVA).sort((a, b) => b[1] - a[1]),
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
      const { error } = await supabase.functions.invoke("brandaro-auto-distribute", {
        body: { max_per_va: 20 },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brandaro-dist-page"] });
      queryClient.invalidateQueries({ queryKey: ["brandaro-dist-history"] });
      toast.success("Distribution complete ✅");
    },
    onError: () => toast.error("Distribution failed"),
  });

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Zap className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Auto Distribution</h1>
            <p className="text-sm text-muted-foreground">Smart lead assignment based on VA performance</p>
          </div>
        </div>
        <Button onClick={() => runDistribution.mutate()} disabled={runDistribution.isPending}>
          {runDistribution.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowRight className="h-4 w-4 mr-1" />}
          Run Distribution
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <Target className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats?.total || 0}</p>
            <p className="text-xs text-muted-foreground">Total Leads</p>
          </CardContent>
        </Card>
        <Card className={`bg-card border-border ${(stats?.unassigned || 0) > 0 ? "border-amber-500/50" : ""}`}>
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
            <Zap className="h-5 w-5 text-cyan-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats?.byVA?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Active VAs</p>
          </CardContent>
        </Card>
      </div>

      {/* Unassigned Breakdown */}
      {(stats?.unassigned || 0) > 0 && (
        <Card className="bg-card border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-400">⚡ Unassigned Leads</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Badge className="bg-blue-500/20 text-blue-400">🇺🇸 English: {stats?.englishUnassigned || 0}</Badge>
            <Badge className="bg-cyan-500/20 text-cyan-400">🇪🇸 Spanish: {stats?.spanishUnassigned || 0}</Badge>
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
                  <span className="text-foreground">VA: {d.va_id?.slice(0, 8)}...</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
