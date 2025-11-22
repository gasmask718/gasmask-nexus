import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TrendingUp, Users, Phone, Calendar, Target, Loader2, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function Sales() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: prospects, isLoading } = useQuery({
    queryKey: ['sales-prospects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_prospects')
        .select('*')
        .order('priority', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: tasks } = useQuery({
    queryKey: ['sales-tasks-today'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('sales_tasks')
        .select('*')
        .eq('sales_user_id', user.user.id)
        .gte('due_date', today.toISOString())
        .lt('due_date', tomorrow.toISOString())
        .eq('status', 'pending');
      
      if (error) throw error;
      return data;
    }
  });

  const runScoringMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ai-sales-scorer');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('AI scoring complete');
      queryClient.invalidateQueries({ queryKey: ['sales-prospects'] });
    },
    onError: (error) => {
      toast.error('Scoring failed: ' + (error as Error).message);
    }
  });

  const stageGroups = prospects?.reduce((acc: any, p: any) => {
    if (!acc[p.pipeline_stage]) acc[p.pipeline_stage] = 0;
    acc[p.pipeline_stage]++;
    return acc;
  }, {}) || {};

  const stages = [
    { key: 'new', label: 'New', count: stageGroups.new || 0 },
    { key: 'contacted', label: 'Contacted', count: stageGroups.contacted || 0 },
    { key: 'follow-up', label: 'Follow-up', count: stageGroups['follow-up'] || 0 },
    { key: 'interested', label: 'Interested', count: stageGroups.interested || 0 },
    { key: 'qualified', label: 'Qualified', count: stageGroups.qualified || 0 },
    { key: 'activated', label: 'Activated', count: stageGroups.activated || 0 }
  ];

  const topProspects = prospects
    ?.filter(p => p.pipeline_stage !== 'closed-lost' && p.pipeline_stage !== 'activated')
    ?.sort((a, b) => (b.priority || 0) - (a.priority || 0))
    ?.slice(0, 5) || [];

  const getPriorityColor = (priority: number) => {
    if (priority >= 70) return 'text-red-500';
    if (priority >= 40) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Target className="h-8 w-8" />
              Sales Pipeline Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">
              Track prospects from first contact to activation
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/sales/prospects/new')}>
              Add Prospect
            </Button>
            <Button onClick={() => runScoringMutation.mutate()} disabled={runScoringMutation.isPending}>
              {runScoringMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scoring...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Run AI Scoring
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Prospects</CardDescription>
              <CardTitle className="text-3xl">{prospects?.length || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Active in pipeline
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tasks Today</CardDescription>
              <CardTitle className="text-3xl">{tasks?.length || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                <Calendar className="inline h-4 w-4 mr-1" />
                Due today
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>High Priority</CardDescription>
              <CardTitle className="text-3xl">
                {prospects?.filter(p => (p.priority || 0) >= 70).length || 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Needs immediate attention
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Conversion Rate</CardDescription>
              <CardTitle className="text-3xl">
                {prospects && prospects.length > 0
                  ? Math.round((stageGroups.activated || 0) / prospects.length * 100)
                  : 0}%
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Activated / Total
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Funnel</CardTitle>
            <CardDescription>Prospects by stage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stages.map((stage, idx) => (
              <div key={stage.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{stage.label}</span>
                  <span className="text-sm text-muted-foreground">{stage.count}</span>
                </div>
                <Progress 
                  value={prospects && prospects.length > 0 ? (stage.count / prospects.length) * 100 : 0} 
                  className="h-2"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top Prospects to Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              AI Top Prospects to Contact Today
            </CardTitle>
            <CardDescription>Highest priority prospects based on AI scoring</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : topProspects.length > 0 ? (
              <div className="space-y-3">
                {topProspects.map((prospect: any) => (
                  <div
                    key={prospect.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/sales/prospects/${prospect.id}`)}
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold">{prospect.store_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {prospect.contact_name} • {prospect.city}, {prospect.state}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={`text-xl font-bold ${getPriorityColor(prospect.priority || 0)}`}>
                          {prospect.priority || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Priority</div>
                      </div>
                      <Badge>{prospect.pipeline_stage}</Badge>
                      <div className="text-right">
                        <div className="text-sm font-medium">{prospect.likelihood_to_activate || 0}%</div>
                        <div className="text-xs text-muted-foreground">Likely</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No active prospects. Add your first prospect to get started.</p>
                <Button className="mt-4" onClick={() => navigate('/sales/prospects/new')}>
                  Add Prospect
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/sales/prospects')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                View All Prospects
              </CardTitle>
              <CardDescription>Manage your full pipeline</CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/sales/report')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Daily Sales Report
              </CardTitle>
              <CardDescription>Today's activity summary</CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/sales/prospects/new')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Add New Prospect
              </CardTitle>
              <CardDescription>Start a new conversation</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </Layout>
  );
}