import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bot, Users, Globe, TrendingUp, Phone, Send, Loader2, BarChart3, Zap } from "lucide-react";

export default function BrandaroGlobalControl() {
  const queryClient = useQueryClient();
  const [aiLanguage, setAiLanguage] = useState("spanish");
  const [batchSize, setBatchSize] = useState("5");

  // Fetch AI call stats
  const { data: aiCallStats } = useQuery({
    queryKey: ["brandaro-ai-call-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_ai_calls")
        .select("status, interest_level, language, duration_seconds");
      if (error) throw error;

      const total = data?.length || 0;
      const completed = data?.filter((c: any) => c.status === "completed").length || 0;
      const interested = data?.filter((c: any) => ["medium", "high"].includes(c.interest_level)).length || 0;
      const spanish = data?.filter((c: any) => c.language === "spanish").length || 0;
      const english = data?.filter((c: any) => c.language === "english").length || 0;

      return { total, completed, interested, spanish, english };
    },
  });

  // Fetch distribution stats
  const { data: distStats } = useQuery({
    queryKey: ["brandaro-distribution-stats"],
    queryFn: async () => {
      const { data: unassigned } = await supabase
        .from("brandaro_leads_master")
        .select("id", { count: "exact" })
        .is("assigned_va_id", null);

      const { data: assigned } = await supabase
        .from("brandaro_leads_master")
        .select("id", { count: "exact" })
        .not("assigned_va_id", "is", null);

      const { data: distributions } = await supabase
        .from("brandaro_lead_distributions")
        .select("id", { count: "exact" });

      return {
        unassigned: unassigned?.length || 0,
        assigned: assigned?.length || 0,
        totalDistributions: distributions?.length || 0,
      };
    },
  });

  // Fetch VA performance
  const { data: vaPerformance } = useQuery({
    queryKey: ["brandaro-va-perf-global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_va_performance")
        .select("*, profiles:va_id(name)")
        .order("total_closes", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch division revenue
  const { data: revenueData } = useQuery({
    queryKey: ["brandaro-division-revenue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_division_revenue")
        .select("*")
        .order("recorded_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // AI Caller mutation
  const aiCallerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("brandaro-ai-caller", {
        body: { batch_size: parseInt(batchSize), language_filter: aiLanguage },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`AI Caller: ${data.called} calls initiated`);
      queryClient.invalidateQueries({ queryKey: ["brandaro-ai-call-stats"] });
    },
    onError: (err) => toast.error(`AI Caller failed: ${err.message}`),
  });

  // Auto-distribute mutation
  const distributeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("brandaro-auto-distribute", {
        body: { language: aiLanguage },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Distributed ${data.distributed} leads to VAs`);
      queryClient.invalidateQueries({ queryKey: ["brandaro-distribution-stats"] });
    },
    onError: (err) => toast.error(`Distribution failed: ${err.message}`),
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Globe className="h-8 w-8 text-primary" />
            Global Sales Control
          </h1>
          <p className="text-muted-foreground mt-1">
            AI Calling • Auto Distribution • Revenue Tracking
          </p>
        </div>

        {/* Control Panel */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Execution Controls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <Select value={aiLanguage} onValueChange={setAiLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spanish">🇪🇸 Spanish</SelectItem>
                  <SelectItem value="english">🇺🇸 English</SelectItem>
                </SelectContent>
              </Select>

              <Select value={batchSize} onValueChange={setBatchSize}>
                <SelectTrigger>
                  <SelectValue placeholder="Batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 calls</SelectItem>
                  <SelectItem value="5">5 calls</SelectItem>
                  <SelectItem value="10">10 calls</SelectItem>
                  <SelectItem value="20">20 calls</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={() => aiCallerMutation.mutate()}
                disabled={aiCallerMutation.isPending}
                className="gap-2"
              >
                {aiCallerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                Launch AI Calls
              </Button>

              <Button
                onClick={() => distributeMutation.mutate()}
                disabled={distributeMutation.isPending}
                variant="secondary"
                className="gap-2"
              >
                {distributeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Auto-Distribute
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Bot className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{aiCallStats?.total || 0}</p>
                  <p className="text-sm text-muted-foreground">AI Calls Made</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Badge variant="secondary">🇪🇸 {aiCallStats?.spanish || 0}</Badge>
                <Badge variant="outline">🇺🇸 {aiCallStats?.english || 0}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Phone className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{aiCallStats?.interested || 0}</p>
                  <p className="text-sm text-muted-foreground">AI-Warmed Leads</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {aiCallStats?.total ? Math.round((aiCallStats.interested / aiCallStats.total) * 100) : 0}% interest rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{distStats?.assigned || 0}</p>
                  <p className="text-sm text-muted-foreground">Leads Assigned</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {distStats?.unassigned || 0} unassigned
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold">
                    ${revenueData?.reduce((sum: number, r: any) => sum + (r.amount || 0), 0).toLocaleString() || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* VA Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              VA Performance Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vaPerformance && vaPerformance.length > 0 ? (
              <div className="space-y-3">
                {vaPerformance.map((va: any, idx: number) => (
                  <div key={va.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground">#{idx + 1}</span>
                      <div>
                        <p className="font-medium">{(va.profiles as any)?.name || "Unknown VA"}</p>
                        <p className="text-xs text-muted-foreground">
                          {va.total_calls || 0} calls • {va.total_interested || 0} interested
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-lg font-bold text-primary">{va.total_closes || 0}</p>
                        <p className="text-xs text-muted-foreground">Closes</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-emerald-500">
                          {va.total_calls ? Math.round(((va.total_closes || 0) / va.total_calls) * 100) : 0}%
                        </p>
                        <p className="text-xs text-muted-foreground">Close Rate</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No VA performance data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Recent AI Calls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Recent AI Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RecentAICalls />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function RecentAICalls() {
  const { data: calls, isLoading } = useQuery({
    queryKey: ["brandaro-recent-ai-calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_ai_calls")
        .select("*, brandaro_leads_master(business_name, phone)")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!calls || calls.length === 0) {
    return <p className="text-center text-muted-foreground py-6">No AI calls yet — launch your first batch above</p>;
  }

  return (
    <div className="space-y-2">
      {calls.map((call: any) => (
        <div key={call.id} className="flex items-center justify-between p-3 rounded-lg border">
          <div>
            <p className="font-medium">{(call.brandaro_leads_master as any)?.business_name || "Unknown"}</p>
            <p className="text-xs text-muted-foreground">
              {call.language === "spanish" ? "🇪🇸" : "🇺🇸"} {(call.brandaro_leads_master as any)?.phone}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {call.duration_seconds && (
              <span className="text-xs text-muted-foreground">{call.duration_seconds}s</span>
            )}
            <Badge
              variant={
                call.status === "completed" ? "default" :
                call.status === "failed" ? "destructive" : "secondary"
              }
            >
              {call.status}
            </Badge>
            {call.interest_level && (
              <Badge
                variant={
                  call.interest_level === "high" ? "default" :
                  call.interest_level === "medium" ? "secondary" : "outline"
                }
              >
                {call.interest_level}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
