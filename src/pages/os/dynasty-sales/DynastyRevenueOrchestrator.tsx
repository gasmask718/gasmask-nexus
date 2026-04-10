import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Activity, Zap, TrendingUp, Users, Phone, DollarSign, RefreshCw, ArrowRight, Shield, BarChart3 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const EVENT_COLORS: Record<string, string> = {
  call: 'bg-blue-500/20 text-blue-400',
  appointment: 'bg-purple-500/20 text-purple-400',
  deal: 'bg-green-500/20 text-green-400',
  payout: 'bg-[#C9A84C]/20 text-[#C9A84C]',
  lead_created: 'bg-cyan-500/20 text-cyan-400',
  lead_assigned: 'bg-indigo-500/20 text-indigo-400',
};

const SOURCE_COLORS: Record<string, string> = {
  dynasty_connect: 'bg-blue-500/20 text-blue-400',
  dsn: 'bg-green-500/20 text-green-400',
  affiliate: 'bg-purple-500/20 text-purple-400',
  ai_dialer: 'bg-cyan-500/20 text-cyan-400',
};

export default function DynastyRevenueOrchestrator() {
  const [activeTab, setActiveTab] = useState('overview');
  const queryClient = useQueryClient();

  // Revenue events
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['revenue-events'],
    queryFn: async () => {
      const { data } = await supabase.from('revenue_events').select('*').order('created_at', { ascending: false }).limit(200);
      return data || [];
    },
  });

  // DSN leads
  const { data: leads = [] } = useQuery({
    queryKey: ['dsn-leads-dro'],
    queryFn: async () => {
      const { data } = await supabase.from('dsn_leads').select('*').order('created_at', { ascending: false }).limit(100);
      return data || [];
    },
  });

  // DSN deals
  const { data: deals = [] } = useQuery({
    queryKey: ['dsn-deals-dro'],
    queryFn: async () => {
      const { data } = await supabase.from('dsn_deals').select('*').order('created_at', { ascending: false }).limit(100);
      return data || [];
    },
  });

  // Commissions
  const { data: commissions = [] } = useQuery({
    queryKey: ['dsn-commissions-dro'],
    queryFn: async () => {
      const { data } = await supabase.from('dsn_commissions').select('*').order('created_at', { ascending: false }).limit(100);
      return data || [];
    },
  });

  // Agents
  const { data: agents = [] } = useQuery({
    queryKey: ['dsn-agents-dro'],
    queryFn: async () => {
      const { data } = await supabase.from('dsn_sales_agents').select('*').order('performance_score', { ascending: false });
      return data || [];
    },
  });

  // KPIs
  const totalRevenue = deals.reduce((s: number, d: any) => s + (d.value || 0), 0);
  const closedDeals = deals.filter((d: any) => d.status === 'closed').length;
  const totalCommissions = commissions.reduce((s: number, c: any) => s + (c.closer_payout || 0) + (c.setter_payout || 0) + (c.affiliate_payout || 0), 0);
  const platformProfit = commissions.reduce((s: number, c: any) => s + (c.platform_total_profit || c.platform_fee || 0), 0);
  const activeLeads = leads.filter((l: any) => !['closed', 'lost', 'paid'].includes(l.status)).length;
  const callEvents = events.filter((e: any) => e.event_type === 'call').length;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Activity className="h-7 w-7 text-primary" />
            Dynasty Revenue Orchestrator
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Unified lead flow, call handling, deal tracking & commission distribution</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-green-500' },
          { label: 'Closed Deals', value: closedDeals, icon: TrendingUp, color: 'text-blue-500' },
          { label: 'Active Leads', value: activeLeads, icon: Zap, color: 'text-yellow-500' },
          { label: 'Call Events', value: callEvents, icon: Phone, color: 'text-purple-500' },
          { label: 'Commissions Paid', value: `$${totalCommissions.toLocaleString()}`, icon: Users, color: 'text-cyan-500' },
          { label: 'Platform Profit', value: `$${platformProfit.toLocaleString()}`, icon: BarChart3, color: 'text-primary' },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-xs text-muted-foreground uppercase">{kpi.label}</span>
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">Revenue Events</TabsTrigger>
          <TabsTrigger value="pipeline">Lead Pipeline</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="agents">Agent Performance</TabsTrigger>
          <TabsTrigger value="activation">Auto-Activation</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Revenue Flow */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Revenue Flow</CardTitle><CardDescription>How revenue moves through the system</CardDescription></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { from: 'Lead Created', to: 'Dynasty Connect Queue', count: leads.length },
                    { from: 'Call Completed', to: 'DSN Status Update', count: callEvents },
                    { from: 'Appointment Set', to: 'Closer Assigned', count: deals.length },
                    { from: 'Deal Closed', to: 'Commission Engine', count: closedDeals },
                  ].map((flow, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <span className="text-sm font-medium flex-1">{flow.from}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm flex-1">{flow.to}</span>
                      <Badge variant="secondary">{flow.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* By Vertical */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Revenue by Vertical</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['solar', 'real_estate', 'funding', 'surplus', 'sports'].map((v) => {
                    const vDeals = deals.filter((d: any) => d.business_vertical === v);
                    const vRevenue = vDeals.reduce((s: number, d: any) => s + (d.value || 0), 0);
                    return (
                      <div key={v} className="flex items-center justify-between">
                        <span className="text-sm capitalize">{v.replace(/_/g, ' ')}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${totalRevenue > 0 ? (vRevenue / totalRevenue) * 100 : 0}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">${vRevenue.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* REVENUE EVENTS */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Revenue Event Stream</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Source System</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Metadata</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No revenue events yet</TableCell></TableRow>
                  ) : events.slice(0, 50).map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell><Badge variant="outline" className={EVENT_COLORS[e.event_type] || 'bg-muted'}>{e.event_type}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={SOURCE_COLORS[e.source_system] || 'bg-muted'}>{e.source_system}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{e.lead_id?.slice(0, 8) || '—'}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate">{e.metadata ? JSON.stringify(e.metadata).slice(0, 60) : '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.created_at ? formatDistanceToNow(new Date(e.created_at), { addSuffix: true }) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PIPELINE */}
        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Lead Pipeline</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-3 mb-6">
                {['new', 'assigned', 'contacted', 'qualified', 'closed'].map((stage) => {
                  const count = leads.filter((l: any) => l.status === stage).length;
                  return (
                    <div key={stage} className="text-center p-3 rounded-lg bg-muted/30">
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground capitalize">{stage}</p>
                    </div>
                  );
                })}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Vertical</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.slice(0, 30).map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="capitalize">{l.source || '—'}</TableCell>
                      <TableCell className="capitalize">{l.category || '—'}</TableCell>
                      <TableCell className="capitalize">{l.business_vertical?.replace(/_/g, ' ') || '—'}</TableCell>
                      <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
                      <TableCell className="capitalize">{l.source_type || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.created_at ? formatDistanceToNow(new Date(l.created_at), { addSuffix: true }) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COMMISSIONS */}
        <TabsContent value="commissions" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Commission Distribution</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deal</TableHead>
                    <TableHead>Closer Payout</TableHead>
                    <TableHead>Setter Payout</TableHead>
                    <TableHead>Affiliate Payout</TableHead>
                    <TableHead>Platform Fee</TableHead>
                    <TableHead>Platform Profit</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No commissions yet</TableCell></TableRow>
                  ) : commissions.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.deal_id?.slice(0, 8) || '—'}</TableCell>
                      <TableCell className="text-green-500">${(c.closer_payout || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-blue-500">${(c.setter_payout || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-purple-500">${(c.affiliate_payout || 0).toLocaleString()}</TableCell>
                      <TableCell>${(c.platform_fee || 0).toLocaleString()}</TableCell>
                      <TableCell className="font-bold text-primary">${(c.platform_total_profit || 0).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline">{c.status || 'pending'}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AGENTS */}
        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Agent Leaderboard</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No agents yet</TableCell></TableRow>
                  ) : agents.map((a: any, i: number) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-bold">{i + 1}</TableCell>
                      <TableCell className="capitalize">{a.role}</TableCell>
                      <TableCell className="capitalize">{a.category}</TableCell>
                      <TableCell className="capitalize">{a.experience_level || '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (a.performance_score || 0))}%` }} />
                          </div>
                          <span className="text-xs">{a.performance_score || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className={a.status === 'active' ? 'bg-green-500/20 text-green-500' : ''}>{a.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUTO-ACTIVATION */}
        <TabsContent value="activation" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5" /> Affiliate Activation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>When an affiliate completes onboarding:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Generate referral links</li>
                  <li>Assign trending products</li>
                  <li>Enable commission tracking</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Phone className="h-5 w-5" /> Agent Activation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>When a sales agent is activated:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Assign 10 starter leads</li>
                  <li>Set category & call priority</li>
                  <li>Route to Dynasty Connect</li>
                  <li>Require certification first</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5" /> Performance Boost</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>High performers automatically receive:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Better quality leads</li>
                  <li>Higher payout rates</li>
                  <li>Priority campaign access</li>
                  <li>AI-optimized call windows</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
