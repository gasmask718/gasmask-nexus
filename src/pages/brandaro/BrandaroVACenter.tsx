import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Headset, Users, Phone, CheckCircle, BarChart3, Loader2, Brain, ArrowRight } from "lucide-react";

export default function BrandaroVACenter() {
  const queryClient = useQueryClient();

  // All VAs with performance
  const { data: vaPerformance = [], isLoading } = useQuery({
    queryKey: ["brandaro-va-center-perf"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_va_performance")
        .select("*")
        .order("total_closes", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Lead distribution stats
  const { data: leadStats } = useQuery({
    queryKey: ["brandaro-va-center-leads"],
    queryFn: async () => {
      const { data } = await supabase.from("brandaro_leads_master").select("assigned_va_id, status, language");
      const byVA: Record<string, { total: number; interested: number; closed: number }> = {};
      (data || []).forEach((l: any) => {
        if (!l.assigned_va_id) return;
        if (!byVA[l.assigned_va_id]) byVA[l.assigned_va_id] = { total: 0, interested: 0, closed: 0 };
        byVA[l.assigned_va_id].total++;
        if (l.status === "interested") byVA[l.assigned_va_id].interested++;
        if (l.status === "closed") byVA[l.assigned_va_id].closed++;
      });
      const unassigned = (data || []).filter((l: any) => !l.assigned_va_id).length;
      return { byVA, unassigned, total: (data || []).length };
    },
  });

  // Recent call notes
  const { data: recentNotes = [] } = useQuery({
    queryKey: ["brandaro-va-center-notes"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("brandaro_va_call_notes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  // Trigger auto-distribution
  const distribute = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("brandaro-auto-distribute", {
        body: { max_per_va: 20 },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brandaro-va-center-leads"] });
      toast.success("Auto distribution completed");
    },
    onError: () => toast.error("Distribution failed"),
  });

  const totalVAs = vaPerformance.length;
  const totalCalls = vaPerformance.reduce((s: number, v: any) => s + (v.total_calls || 0), 0);
  const totalCloses = vaPerformance.reduce((s: number, v: any) => s + (v.total_closes || 0), 0);

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <Headset className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">VA Command Center</h1>
            <p className="text-sm text-muted-foreground">Monitor all VAs, assignments & performance</p>
          </div>
        </div>
        <Button onClick={() => distribute.mutate()} disabled={distribute.isPending} size="sm">
          {distribute.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowRight className="h-4 w-4 mr-1" />}
          Auto Distribute
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{totalVAs}</p>
            <p className="text-xs text-muted-foreground">Active VAs</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <Phone className="h-5 w-5 text-violet-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{totalCalls}</p>
            <p className="text-xs text-muted-foreground">Total Calls</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{totalCloses}</p>
            <p className="text-xs text-muted-foreground">Total Closes</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-5 w-5 text-amber-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{leadStats?.total || 0}</p>
            <p className="text-xs text-muted-foreground">Total Leads</p>
          </CardContent>
        </Card>
        <Card className={`bg-card border-border ${(leadStats?.unassigned || 0) > 10 ? "border-destructive/50" : ""}`}>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 text-destructive mx-auto mb-1" />
            <p className={`text-2xl font-bold ${(leadStats?.unassigned || 0) > 10 ? "text-destructive" : "text-foreground"}`}>
              {leadStats?.unassigned || 0}
            </p>
            <p className="text-xs text-muted-foreground">Unassigned</p>
          </CardContent>
        </Card>
      </div>

      {/* VA Leaderboard */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-cyan-400" /> VA Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : vaPerformance.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No VA performance data yet.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-6 text-xs text-muted-foreground font-medium border-b border-border pb-2">
                <span>Rank</span><span>VA ID</span><span>Calls</span><span>Interested</span><span>Closes</span><span>Leads</span>
              </div>
              {vaPerformance.map((va: any, i: number) => {
                const vaLeads = leadStats?.byVA[va.va_id];
                return (
                  <div key={va.id} className="grid grid-cols-6 text-sm items-center">
                    <Badge variant={i < 3 ? "default" : "secondary"} className="w-fit text-xs">#{i + 1}</Badge>
                    <span className="text-muted-foreground truncate text-xs">{va.va_id?.slice(0, 8)}...</span>
                    <span className="font-medium text-foreground">{va.total_calls || 0}</span>
                    <span className="text-emerald-400">{va.total_interested || 0}</span>
                    <span className="font-bold text-green-400">{va.total_closes || 0}</span>
                    <span className="text-muted-foreground">{vaLeads?.total || 0}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-400" /> Recent VA Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No call notes yet.</p>
          ) : (
            recentNotes.map((note: any) => (
              <div key={note.id} className="text-xs bg-muted/30 rounded p-2.5 border border-border">
                <p className="text-foreground">{note.summary}</p>
                {note.objection && <p className="text-orange-400 mt-1">⚠️ {note.objection}</p>}
                {note.next_step && <p className="text-primary mt-1">→ {note.next_step}</p>}
                <p className="text-muted-foreground mt-1">{new Date(note.created_at).toLocaleDateString()}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
