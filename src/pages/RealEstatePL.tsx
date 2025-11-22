import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, Target, Clock, BarChart3, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export default function RealEstatePL() {
  const [metrics, setMetrics] = useState<any>(null);
  const [actionPlan, setActionPlan] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const { data: closings, error: closingsError } = await supabase
        .from("deal_closings")
        .select("assignment_fee, net_profit, closing_date, created_at");

      const { data: pipeline, error: pipelineError } = await supabase
        .from("acquisitions_pipeline")
        .select("status, expected_assignment_fee, offer_amount");

      const { data: leads, error: leadsError } = await supabase
        .from("leads_raw")
        .select("status, created_at");

      if (closingsError || pipelineError || leadsError) throw closingsError || pipelineError || leadsError;

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const thisMonthClosings = closings?.filter(c => new Date(c.closing_date) >= thisMonthStart) || [];
      const lastMonthClosings = closings?.filter(
        c => new Date(c.closing_date) >= lastMonthStart && new Date(c.closing_date) < thisMonthStart
      ) || [];

      const totalRevenue = closings?.reduce((sum, c) => sum + (c.assignment_fee || 0), 0) || 0;
      const netProfit = closings?.reduce((sum, c) => sum + (c.net_profit || 0), 0) || 0;
      const thisMonthRevenue = thisMonthClosings.reduce((sum, c) => sum + (c.assignment_fee || 0), 0);
      const lastMonthRevenue = lastMonthClosings.reduce((sum, c) => sum + (c.assignment_fee || 0), 0);
      const avgFee = closings?.length ? totalRevenue / closings.length : 0;
      const avgCloseTime = closings?.length 
        ? closings.reduce((sum, c) => {
            const days = Math.floor((new Date(c.closing_date).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24));
            return sum + days;
          }, 0) / closings.length
        : 0;

      const pipelineValue = pipeline?.reduce((sum, p) => sum + (p.expected_assignment_fee || 0), 0) || 0;
      const contractedDeals = pipeline?.filter(p => p.status === 'signed').length || 0;
      const conversionRate = leads?.length ? (contractedDeals / leads.length) * 100 : 0;

      const goalProgress = (thisMonthRevenue / 10000000) * 100;
      const monthOverMonth = lastMonthRevenue > 0 
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
        : 0;

      setMetrics({
        totalRevenue,
        netProfit,
        thisMonthRevenue,
        avgFee,
        avgCloseTime,
        pipelineValue,
        contractedDeals,
        conversionRate,
        goalProgress,
        monthOverMonth,
        totalClosings: closings?.length || 0,
        thisMonthClosings: thisMonthClosings.length,
      });
    } catch (error) {
      console.error("Error fetching metrics:", error);
      toast.error("Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  const runScaleEngine = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("scale-engine");
      if (error) throw error;
      setActionPlan(data.action_plan);
      toast.success("AI Analysis Complete");
    } catch (error) {
      console.error("Error running scale engine:", error);
      toast.error("Failed to run analysis");
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen p-6">Loading metrics...</div>;
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2">Real Estate P&L Dashboard</h1>
          <p className="text-muted-foreground">Financial performance and scaling insights</p>
        </div>
        <Button onClick={runScaleEngine} disabled={analyzing}>
          <Zap className="h-4 w-4 mr-2" />
          {analyzing ? "Analyzing..." : "Run Scale Engine"}
        </Button>
      </div>

      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-2xl">$10M/Month Goal Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">
                ${(metrics.thisMonthRevenue / 1000000).toFixed(2)}M / $10M
              </span>
              <span className="text-sm text-muted-foreground">
                {metrics.goalProgress.toFixed(1)}%
              </span>
            </div>
            <Progress value={metrics.goalProgress} className="h-3" />
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold">
                ${(metrics.thisMonthRevenue / 1000).toFixed(0)}K
              </div>
              <div className="text-sm text-muted-foreground">This Month</div>
            </div>
            <div>
              <div className={`text-3xl font-bold ${metrics.monthOverMonth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.monthOverMonth >= 0 ? '+' : ''}{metrics.monthOverMonth.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">MoM Growth</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${(metrics.totalRevenue / 1000000).toFixed(2)}M</div>
            <p className="text-xs text-muted-foreground mt-1">All-time assignment fees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${(metrics.netProfit / 1000000).toFixed(2)}M</div>
            <p className="text-xs text-muted-foreground mt-1">After expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Assignment Fee</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${(metrics.avgFee / 1000).toFixed(1)}K</div>
            <p className="text-xs text-muted-foreground mt-1">Per deal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Close Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{Math.round(metrics.avgCloseTime)} days</div>
            <p className="text-xs text-muted-foreground mt-1">Lead to close</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${(metrics.pipelineValue / 1000000).toFixed(2)}M</div>
            <p className="text-xs text-muted-foreground mt-1">{metrics.contractedDeals} contracted deals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Lead to contract</p>
          </CardContent>
        </Card>
      </div>

      {actionPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Weekly AI Action Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">
              {actionPlan}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
