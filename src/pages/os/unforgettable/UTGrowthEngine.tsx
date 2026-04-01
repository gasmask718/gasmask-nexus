import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Zap, MessageSquare, Mail, Phone, Instagram, TrendingUp,
  Play, Pause, BarChart3, Send, Clock, CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';

const channelIcons: Record<string, any> = {
  sms: MessageSquare, email: Mail, instagram_dm: Instagram, call: Phone
};
const channelColors: Record<string, string> = {
  sms: 'bg-green-500/10 text-green-400', email: 'bg-blue-500/10 text-blue-400',
  instagram_dm: 'bg-pink-500/10 text-pink-400', call: 'bg-yellow-500/10 text-yellow-400'
};

export default function UTGrowthEngine() {
  const queryClient = useQueryClient();
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());

  const { data: campaigns = [] } = useQuery({
    queryKey: ['ut-campaigns'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_campaigns').select('*').order('created_at');
      return data || [];
    }
  });

  const { data: schedule = [] } = useQuery({
    queryKey: ['ut-schedule'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_automation_schedule').select('*').order('cron_expression');
      return data || [];
    }
  });

  const { data: outreachLog = [] } = useQuery({
    queryKey: ['ut-outreach-log'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_outreach_log').select('*').order('created_at', { ascending: false }).limit(50);
      return data || [];
    }
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['ut-growth-reports'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_growth_reports').select('*').order('report_date', { ascending: false }).limit(7);
      return data || [];
    }
  });

  const { data: leadStats } = useQuery({
    queryKey: ['ut-lead-stats-growth'],
    queryFn: async () => {
      const { count: total } = await supabase.from('ut_outreach_log').select('*', { count: 'exact', head: true });
      const { count: smsToday } = await supabase.from('ut_outreach_log').select('*', { count: 'exact', head: true })
        .eq('channel', 'sms').gte('created_at', new Date().toISOString().split('T')[0]);
      const { count: emailToday } = await supabase.from('ut_outreach_log').select('*', { count: 'exact', head: true })
        .eq('channel', 'email').gte('created_at', new Date().toISOString().split('T')[0]);
      const { count: dmToday } = await supabase.from('ut_outreach_log').select('*', { count: 'exact', head: true })
        .eq('channel', 'instagram_dm').gte('created_at', new Date().toISOString().split('T')[0]);
      const { count: responses } = await supabase.from('ut_outreach_log').select('*', { count: 'exact', head: true })
        .eq('status', 'replied');
      const { count: aLeads } = await supabase.from('ut_leads').select('*', { count: 'exact', head: true })
        .eq('grade', 'A').is('outreach_sent_at', null);
      const { count: bLeads } = await supabase.from('ut_leads').select('*', { count: 'exact', head: true })
        .eq('grade', 'B').is('outreach_sent_at', null);
      const { count: ambProspects } = await supabase.from('ut_ambassador_prospects').select('*', { count: 'exact', head: true })
        .eq('status', 'prospect');
      return { total: total || 0, smsToday: smsToday || 0, emailToday: emailToday || 0, dmToday: dmToday || 0, responses: responses || 0, aLeads: aLeads || 0, bLeads: bLeads || 0, ambProspects: ambProspects || 0 };
    }
  });

  const runJob = async (action: string, audience_type?: string, jobName?: string) => {
    const key = jobName || action;
    setRunningJobs(prev => new Set(prev).add(key));
    try {
      const { data, error } = await supabase.functions.invoke('ut-growth-engine', {
        body: { action, audience_type, limit: 50 }
      });
      if (error) throw error;
      toast.success(`✅ ${action} completed`, { description: `Sent: ${data?.sent || 0}` });
      queryClient.invalidateQueries({ queryKey: ['ut-outreach-log'] });
      queryClient.invalidateQueries({ queryKey: ['ut-lead-stats-growth'] });
      queryClient.invalidateQueries({ queryKey: ['ut-campaigns'] });
    } catch (err: any) {
      toast.error(`❌ ${action} failed`, { description: err.message });
    } finally {
      setRunningJobs(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  const activeChannels = schedule.filter(s => s.api_connected).length;
  const totalChannels = schedule.length;

  // Realtime
  useEffect(() => {
    const channel = supabase.channel('growth-outreach-log')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ut_outreach_log' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ut-outreach-log'] });
        queryClient.invalidateQueries({ queryKey: ['ut-lead-stats-growth'] });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">⚡ Autonomous Growth Engine</h1>
          <p className="text-muted-foreground">24/7 outreach across all channels</p>
        </div>
        <Badge className={activeChannels > 0 ? 'bg-green-500/20 text-green-400 text-base px-4 py-2' : 'bg-red-500/20 text-red-400 text-base px-4 py-2'}>
          {activeChannels > 0 ? `🟢 ${activeChannels}/${totalChannels} channels active` : `🔴 ${totalChannels - activeChannels} channels need API keys`}
        </Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'SMS Today', value: leadStats?.smsToday || 0, icon: MessageSquare, color: 'text-green-400' },
          { label: 'Emails Today', value: leadStats?.emailToday || 0, icon: Mail, color: 'text-blue-400' },
          { label: 'DMs Queued Today', value: leadStats?.dmToday || 0, icon: Instagram, color: 'text-pink-400' },
          { label: 'Total Outreach', value: leadStats?.total || 0, icon: Send, color: 'text-purple-400' },
          { label: 'Total Responses', value: leadStats?.responses || 0, icon: CheckCircle, color: 'text-emerald-400' },
          { label: 'Conversion Rate', value: leadStats?.total ? `${((leadStats.responses / leadStats.total) * 100).toFixed(1)}%` : '0%', icon: TrendingUp, color: 'text-yellow-400' },
          { label: 'Uncontacted A-Grade', value: leadStats?.aLeads || 0, icon: Zap, color: 'text-orange-400' },
          { label: 'Ambassador Prospects', value: leadStats?.ambProspects || 0, icon: Instagram, color: 'text-pink-400' },
        ].map((kpi, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <kpi.icon className={`h-8 w-8 ${kpi.color}`} />
              <div>
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="schedule" className="space-y-4">
        <TabsList>
          <TabsTrigger value="schedule">⏰ Automation Schedule</TabsTrigger>
          <TabsTrigger value="campaigns">📋 Campaigns</TabsTrigger>
          <TabsTrigger value="log">📊 Outreach Log</TabsTrigger>
          <TabsTrigger value="reports">📈 Growth Reports</TabsTrigger>
        </TabsList>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schedule.map(job => {
              const Icon = channelIcons[job.channel] || Zap;
              const isRunning = runningJobs.has(job.job_name);
              const actionMap: Record<string, { action: string; audience?: string }> = {
                venue_scrape_daily: { action: 'run_sms_outreach', audience: 'venue' },
                staff_scrape_daily: { action: 'run_sms_outreach', audience: 'staff' },
                ambassador_search_daily: { action: 'queue_instagram_dms' },
                party_owner_outreach: { action: 'run_email_outreach', audience: 'party_business_owner' },
                customer_acquisition: { action: 'run_email_outreach', audience: 'direct_customer' },
                sms_followup_sequence: { action: 'run_sms_outreach', audience: 'all' },
                email_sequence_day3: { action: 'run_email_outreach', audience: 'all' },
                daily_growth_report: { action: 'send_daily_report' },
                cold_call_campaign: { action: 'run_sms_outreach', audience: 'venue' },
              };
              const mapping = actionMap[job.job_name] || { action: 'send_daily_report' };

              return (
                <Card key={job.id} className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {job.job_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </CardTitle>
                      <Badge className={job.api_connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                        {job.api_connected ? '🟢 Active' : `🔴 Needs ${job.api_required}`}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Audience: {job.audience_type}</p>
                      <p>Channel: {job.channel}</p>
                      <p>⏰ {job.run_time_est}</p>
                      <p>Last run: {job.last_run_at ? new Date(job.last_run_at).toLocaleString() : 'Never'}</p>
                      <p>Total sent: {job.total_outreach_sent}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={isRunning}
                        onClick={() => runJob(mapping.action, mapping.audience, job.job_name)}>
                        {isRunning ? <><Zap className="h-3 w-3 animate-spin" /> Running...</> : <><Play className="h-3 w-3" /> Run Now</>}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map(c => {
              const Icon = channelIcons[c.channel] || Send;
              return (
                <Card key={c.id} className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">{c.name}</CardTitle>
                      <Badge className={c.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'}>
                        {c.status}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-1">
                      <Icon className="h-3 w-3" /> {c.channel.toUpperCase()} • {c.audience_type}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      <p>Cities: {(c.target_cities as string[] || []).join(', ')}</p>
                      <p>Daily limit: {c.daily_limit}</p>
                      <p>Total sent: {c.total_sent} • Responses: {c.total_responses}</p>
                      <p>Last run: {c.last_run_at ? new Date(c.last_run_at).toLocaleString() : 'Never'}</p>
                    </div>
                    {c.message_template && (
                      <div className="text-xs bg-muted/50 p-2 rounded max-h-20 overflow-y-auto">
                        {c.message_template}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Outreach Log Tab */}
        <TabsContent value="log">
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="p-3 text-left text-muted-foreground">Time</th>
                      <th className="p-3 text-left text-muted-foreground">Channel</th>
                      <th className="p-3 text-left text-muted-foreground">To</th>
                      <th className="p-3 text-left text-muted-foreground">Message</th>
                      <th className="p-3 text-left text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outreachLog.map(log => (
                      <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3 text-xs">{log.created_at ? new Date(log.created_at).toLocaleString() : '-'}</td>
                        <td className="p-3">
                          <Badge className={channelColors[log.channel] || 'bg-muted'}>{log.channel}</Badge>
                        </td>
                        <td className="p-3 text-xs font-mono">{log.to_number || log.to_email || log.to_instagram || '-'}</td>
                        <td className="p-3 text-xs max-w-xs truncate">{log.message_sent || '-'}</td>
                        <td className="p-3">
                          <Badge className={
                            log.status === 'sent' ? 'bg-green-500/20 text-green-400' :
                            log.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                            log.status === 'replied' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-muted text-muted-foreground'
                          }>{log.status}</Badge>
                        </td>
                      </tr>
                    ))}
                    {outreachLog.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No outreach logged yet. Run a campaign to get started.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => runJob('send_daily_report')} disabled={runningJobs.has('send_daily_report')}>
              {runningJobs.has('send_daily_report') ? '📱 Sending...' : '📱 Send Report Now'}
            </Button>
          </div>
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Date','Venues','Staff','Ambassadors','SMS','Emails','Bookings','Signups'].map(h => (
                        <th key={h} className="p-3 text-left text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map(r => (
                      <tr key={r.id} className="border-b border-border/50">
                        <td className="p-3 font-medium">{r.report_date}</td>
                        <td className="p-3">{r.venues_found}</td>
                        <td className="p-3">{r.staff_found}</td>
                        <td className="p-3">{r.ambassadors_found}</td>
                        <td className="p-3">{r.sms_sent}</td>
                        <td className="p-3">{r.emails_sent}</td>
                        <td className="p-3">{r.new_bookings}</td>
                        <td className="p-3">{r.new_signups}</td>
                      </tr>
                    ))}
                    {reports.length === 0 && (
                      <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No reports yet. Click "Send Report Now" to generate one.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
