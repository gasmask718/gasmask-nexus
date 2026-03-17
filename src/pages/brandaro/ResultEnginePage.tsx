import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Users, TrendingUp, Phone, MousePointerClick, Eye, AlertTriangle,
  Zap, BarChart3, CheckCircle, XCircle, ArrowUpRight, ArrowDownRight,
  RefreshCw, Brain, Search
} from 'lucide-react';

export default function ResultEnginePage() {
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const queryClient = useQueryClient();

  const { data: clients } = useQuery({
    queryKey: ['brandaro-clients-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brandaro_clients')
        .select('id, business_name, client_status, package_chosen, monthly_recurring')
        .eq('client_status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: metrics } = useQuery({
    queryKey: ['brandaro-client-metrics', selectedClient],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      let query = supabase
        .from('brandaro_client_metrics')
        .select('*')
        .gte('period_date', thirtyDaysAgo)
        .order('period_date', { ascending: false });
      if (selectedClient !== 'all') query = query.eq('client_id', selectedClient);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: alerts } = useQuery({
    queryKey: ['brandaro-alerts', selectedClient],
    queryFn: async () => {
      let query = supabase
        .from('brandaro_client_alerts')
        .select('*')
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })
        .limit(20);
      if (selectedClient !== 'all') query = query.eq('client_id', selectedClient);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: optimizations } = useQuery({
    queryKey: ['brandaro-optimizations', selectedClient],
    queryFn: async () => {
      let query = supabase
        .from('brandaro_optimization_tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      if (selectedClient !== 'all') query = query.eq('client_id', selectedClient);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: seoTasks } = useQuery({
    queryKey: ['brandaro-seo-tasks', selectedClient],
    queryFn: async () => {
      let query = supabase
        .from('brandaro_seo_tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      if (selectedClient !== 'all') query = query.eq('client_id', selectedClient);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const runOptimizer = useMutation({
    mutationFn: async (clientId: string) => {
      const { data, error } = await supabase.functions.invoke('brandaro-ai-optimizer', {
        body: { client_id: clientId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Created ${data.optimization_tasks_created} optimization tasks`);
      queryClient.invalidateQueries({ queryKey: ['brandaro-optimizations'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const approveOptimization = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('brandaro_optimization_tasks')
        .update({ status: 'approved' })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Optimization approved');
      queryClient.invalidateQueries({ queryKey: ['brandaro-optimizations'] });
    },
  });

  // Aggregate metrics
  const totalVisitors = metrics?.reduce((s, m) => s + (m.total_visitors || 0), 0) || 0;
  const totalLeads = metrics?.reduce((s, m) => s + (m.leads_generated || 0), 0) || 0;
  const totalCalls = metrics?.reduce((s, m) => s + (m.calls_generated || 0), 0) || 0;
  const totalClicks = metrics?.reduce((s, m) => s + (m.cta_clicks || 0), 0) || 0;
  const avgConversion = totalVisitors > 0 ? ((totalLeads / totalVisitors) * 100).toFixed(1) : '0';
  const totalMRR = clients?.reduce((s, c) => s + (c.monthly_recurring || 0), 0) || 0;

  const priorityColor = (p: string) => {
    switch (p) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Result Engine</h1>
          <p className="text-sm text-muted-foreground">Client performance tracking, optimization & revenue growth</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients?.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Eye className="h-4 w-4" />
              <span className="text-xs">Visitors</span>
            </div>
            <p className="text-2xl font-bold">{totalVisitors.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs">Leads</span>
            </div>
            <p className="text-2xl font-bold text-hud-green">{totalLeads}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Phone className="h-4 w-4" />
              <span className="text-xs">Calls</span>
            </div>
            <p className="text-2xl font-bold text-hud-cyan">{totalCalls}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MousePointerClick className="h-4 w-4" />
              <span className="text-xs">CTA Clicks</span>
            </div>
            <p className="text-2xl font-bold">{totalClicks}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">Conv Rate</span>
            </div>
            <p className="text-2xl font-bold text-hud-amber">{avgConversion}%</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs">MRR</span>
            </div>
            <p className="text-2xl font-bold text-hud-green">${totalMRR.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Active Alerts ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map(alert => (
              <div key={alert.id} className="flex items-center justify-between p-2 rounded bg-card/50 border border-border/30">
                <div className="flex items-center gap-2">
                  <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                    {alert.severity}
                  </Badge>
                  <span className="text-sm">{alert.message}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(alert.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="optimizations">
        <TabsList>
          <TabsTrigger value="optimizations">AI Optimizations</TabsTrigger>
          <TabsTrigger value="seo">SEO Tasks</TabsTrigger>
          <TabsTrigger value="clients">Client Health</TabsTrigger>
        </TabsList>

        <TabsContent value="optimizations" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">AI-Generated Optimization Tasks</h3>
            {selectedClient !== 'all' && (
              <Button
                size="sm"
                onClick={() => runOptimizer.mutate(selectedClient)}
                disabled={runOptimizer.isPending}
              >
                <Brain className="h-4 w-4 mr-1" />
                {runOptimizer.isPending ? 'Analyzing...' : 'Run AI Analysis'}
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {optimizations?.map(opt => (
              <Card key={opt.id} className="bg-card/50 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={priorityColor(opt.priority)}>{opt.priority}</Badge>
                        <Badge variant="outline">{opt.task_type?.replace(/_/g, ' ')}</Badge>
                        <Badge variant="outline">{opt.status}</Badge>
                      </div>
                      <p className="text-sm font-medium">{opt.page_target}</p>
                      <p className="text-xs text-muted-foreground">Current: {opt.current_value}</p>
                      <p className="text-xs text-hud-green">Suggested: {opt.suggested_value}</p>
                      {opt.ai_reasoning && (
                        <p className="text-xs text-muted-foreground italic mt-1">{opt.ai_reasoning}</p>
                      )}
                    </div>
                    {opt.status === 'pending' && (
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => approveOptimization.mutate(opt.id)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!optimizations || optimizations.length === 0) && (
              <p className="text-center text-muted-foreground py-8">
                No optimization tasks yet. Select a client and run AI Analysis.
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="seo" className="space-y-4">
          <h3 className="text-lg font-semibold">SEO & Traffic Generation</h3>
          <div className="space-y-3">
            {seoTasks?.map(task => (
              <Card key={task.id} className="bg-card/50 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="outline">{task.task_type?.replace(/_/g, ' ')}</Badge>
                        <Badge variant={task.status === 'published' ? 'default' : 'secondary'}>
                          {task.status}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">{task.title}</p>
                      {task.target_keyword && (
                        <p className="text-xs text-muted-foreground">Keyword: {task.target_keyword}</p>
                      )}
                    </div>
                    {task.published_url && (
                      <a href={task.published_url} target="_blank" className="text-xs text-hud-cyan hover:underline flex items-center gap-1">
                        <ArrowUpRight className="h-3 w-3" /> View
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!seoTasks || seoTasks.length === 0) && (
              <p className="text-center text-muted-foreground py-8">
                No SEO tasks yet. They auto-generate when client traffic is low.
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="clients" className="space-y-4">
          <h3 className="text-lg font-semibold">Client Health Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clients?.map(client => {
              const clientMetrics = metrics?.filter(m => m.client_id === client.id) || [];
              const cv = clientMetrics.reduce((s, m) => s + (m.total_visitors || 0), 0);
              const cl = clientMetrics.reduce((s, m) => s + (m.leads_generated || 0), 0);
              const cr = cv > 0 ? ((cl / cv) * 100).toFixed(1) : '0';
              const clientAlerts = alerts?.filter(a => a.client_id === client.id) || [];

              return (
                <Card key={client.id} className="bg-card/50 border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium">{client.business_name}</p>
                        <p className="text-xs text-muted-foreground">{client.package_chosen} tier</p>
                      </div>
                      <Badge variant={clientAlerts.length > 0 ? 'destructive' : 'default'}>
                        {clientAlerts.length > 0 ? `${clientAlerts.length} alerts` : 'Healthy'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold">{cv}</p>
                        <p className="text-xs text-muted-foreground">Visitors</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-hud-green">{cl}</p>
                        <p className="text-xs text-muted-foreground">Leads</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-hud-amber">{cr}%</p>
                        <p className="text-xs text-muted-foreground">Conv</p>
                      </div>
                    </div>
                    <div className="flex justify-end mt-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => runOptimizer.mutate(client.id)}
                        disabled={runOptimizer.isPending}
                      >
                        <Zap className="h-3 w-3 mr-1" />
                        Optimize
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
