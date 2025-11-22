import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Brain, TrendingUp, AlertTriangle, Target, Zap, PlayCircle, PauseCircle, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export default function AICEOControlRoom() {
  const [loading, setLoading] = useState(false);
  const [aiMode, setAiMode] = useState<'off' | 'on' | 'full_auto'>('on');
  const [latestReport, setLatestReport] = useState<any>(null);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [kpiStatus, setKpiStatus] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchLatestData();
  }, []);

  const fetchLatestData = async () => {
    const [report, actions] = await Promise.all([
      supabase.from("ceo_reports").select("*").order("created_at", { ascending: false }).limit(1).single(),
      supabase.from("ceo_actions").select("*").eq("status", "pending").order("priority", { ascending: true })
    ]);

    if (report.data) setLatestReport(report.data);
    if (actions.data) setPendingActions(actions.data);
  };

  const generateCEOReport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-ceo-report');
      if (error) throw error;

      toast({
        title: "CEO Report Generated!",
        description: "Your weekly executive summary is ready",
      });

      fetchLatestData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const enforceKPIs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-kpi-enforcer');
      if (error) throw error;

      setKpiStatus(data.kpi_status);
      toast({
        title: "KPI Check Complete!",
        description: `Status: ${data.kpi_status.status}`,
      });

      fetchLatestData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateScalingStrategy = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-scaling-strategy');
      if (error) throw error;

      toast({
        title: "Scaling Strategy Generated!",
        description: "Your 90-day growth roadmap is ready",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getModeColor = () => {
    switch (aiMode) {
      case 'full_auto': return 'bg-green-500';
      case 'on': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getModeBadge = () => {
    switch (aiMode) {
      case 'full_auto': return <Badge className="bg-green-500">FULL AUTO</Badge>;
      case 'on': return <Badge className="bg-blue-500">AI ASSISTED</Badge>;
      default: return <Badge variant="outline">MANUAL</Badge>;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Brain className="h-10 w-10 text-primary" />
              AI CEO Control Room
            </h1>
            <p className="text-muted-foreground">
              Autonomous executive intelligence for your $10M/month real estate operation
            </p>
          </div>
          
          <Card className="w-fit">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="text-sm font-medium">AI CEO Mode:</div>
                {getModeBadge()}
                <div className="flex gap-2">
                  <Button
                    variant={aiMode === 'off' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAiMode('off')}
                  >
                    OFF
                  </Button>
                  <Button
                    variant={aiMode === 'on' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAiMode('on')}
                  >
                    ON
                  </Button>
                  <Button
                    variant={aiMode === 'full_auto' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAiMode('full_auto')}
                    className="bg-green-500 hover:bg-green-600"
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    FULL AUTO
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                Generate CEO Report
              </CardTitle>
              <CardDescription>Weekly executive summary with insights</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={generateCEOReport} disabled={loading} className="w-full">
                Generate Report
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-orange-500" />
                Enforce KPIs
              </CardTitle>
              <CardDescription>Check progress vs $10M target</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={enforceKPIs} disabled={loading} className="w-full">
                Run KPI Check
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-500" />
                Scaling Strategy
              </CardTitle>
              <CardDescription>90-day growth roadmap</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={generateScalingStrategy} disabled={loading} className="w-full">
                Generate Strategy
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* KPI Status */}
        {kpiStatus && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                KPI Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Current Revenue</p>
                  <p className="text-2xl font-bold">${kpiStatus.revenue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Target</p>
                  <p className="text-2xl font-bold">${kpiStatus.target.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Progress</p>
                  <p className="text-2xl font-bold">{kpiStatus.percent_of_target.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={
                    kpiStatus.status === 'critical' ? 'bg-red-500' :
                    kpiStatus.status === 'warning' ? 'bg-yellow-500' :
                    'bg-green-500'
                  }>
                    {kpiStatus.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Latest Report */}
        {latestReport && (
          <Card>
            <CardHeader>
              <CardTitle>Latest CEO Report</CardTitle>
              <CardDescription>
                Generated: {new Date(latestReport.created_at).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Recommendations:</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {latestReport.recommendations}
                </p>
              </div>
              
              {latestReport.bottlenecks?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Bottlenecks:
                  </h4>
                  <ul className="space-y-1">
                    {latestReport.bottlenecks.map((b: any, i: number) => (
                      <li key={i} className="text-sm">• {b.issue || b}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pending Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-500" />
              Pending AI Actions ({pendingActions.length})
            </CardTitle>
            <CardDescription>Actions recommended by the AI CEO</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingActions.slice(0, 10).map((action) => (
                <div key={action.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">{action.action_description}</p>
                    <p className="text-sm text-muted-foreground">
                      Due: {action.due_date ? new Date(action.due_date).toLocaleDateString() : 'ASAP'}
                    </p>
                  </div>
                  <Badge variant={
                    action.priority === 'high' ? 'destructive' :
                    action.priority === 'medium' ? 'default' :
                    'outline'
                  }>
                    {action.priority}
                  </Badge>
                </div>
              ))}

              {pendingActions.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No pending actions. Run KPI check to generate recommendations.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}