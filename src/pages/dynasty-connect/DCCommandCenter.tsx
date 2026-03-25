import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Target, TrendingUp, Brain, Clock, Activity, Zap, BarChart3, Loader2, Building2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const outcomeStyle = (o: string) => {
  switch (o) {
    case 'booked': return 'bg-green-500/10 text-green-500 border-green-500';
    case 'interested': return 'bg-teal-500/10 text-teal-500 border-teal-500';
    case 'callback': case 'callback_requested': return 'bg-amber-500/10 text-amber-500 border-amber-500';
    case 'not-interested': case 'not_interested': return 'bg-red-500/10 text-red-500 border-red-500';
    case 'wrong-number': case 'wrong_number': return 'bg-red-500/10 text-red-500 border-red-500';
    default: return 'bg-muted text-muted-foreground';
  }
};

export default function DCCommandCenter() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [triggeringSelfLearn, setTriggeringSelfLearn] = useState(false);

  // ── Calls Today ──
  const { data: todayCalls = 0 } = useQuery({
    queryKey: ['dc-today-calls'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('ai_call_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  // ── Active Campaigns (dialer_campaigns) ──
  const { data: activeCampaigns = 0 } = useQuery({
    queryKey: ['dc-active-campaigns'],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('dialer_campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      return count ?? 0;
    },
  });

  // ── Win Rate This Month ──
  const { data: winRate = '0' } = useQuery({
    queryKey: ['dc-win-rate'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await supabase
        .from('ai_call_logs')
        .select('outcome')
        .gte('created_at', thirtyDaysAgo);
      if (!data || data.length === 0) return '0';
      const wins = data.filter((c: any) =>
        ['booked', 'interested', 'callback', 'callback_requested', 'reached'].includes(c.outcome)
      ).length;
      return ((wins / data.length) * 100).toFixed(1);
    },
  });

  // ── Live Calls ──
  const { data: liveCallCount = 0 } = useQuery({
    queryKey: ['dc-live-count'],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('live_calls')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      return count ?? 0;
    },
    refetchInterval: 5000,
  });

  // ── Latest Playbook (Self-Learn) ──
  const { data: latestPlaybook } = useQuery({
    queryKey: ['dc-latest-playbook'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('playbook_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // ── Business Pipelines Overview ──
  const { data: pipelines = [] } = useQuery({
    queryKey: ['dc-pipelines-overview'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('dc_business_pipelines').select('*');
      return data || [];
    },
  });

  // ── Live Calls Detail ──
  const { data: liveCalls = [] } = useQuery({
    queryKey: ['dc-live-calls-detail'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('live_calls')
        .select('*')
        .eq('status', 'active');
      return data || [];
    },
    refetchInterval: 5000,
  });

  // ── Recent 10 Calls ──
  const { data: recentCalls = [] } = useQuery({
    queryKey: ['dc-recent-calls'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_call_logs')
        .select('id, phone_number, outcome, duration_seconds, full_transcript, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  // ── Realtime ──
  useEffect(() => {
    const ch1 = supabase
      .channel('dc-live-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_calls' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dc-live-count'] });
      })
      .subscribe();

    const ch2 = supabase
      .channel('dc-logs-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_call_logs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dc-recent-calls'] });
        queryClient.invalidateQueries({ queryKey: ['dc-today-calls'] });
        queryClient.invalidateQueries({ queryKey: ['dc-win-rate'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [queryClient]);

  const triggerSelfLearn = async () => {
    setTriggeringSelfLearn(true);
    try {
      const { data, error } = await supabase.functions.invoke('agent-self-learn');
      if (error) throw error;
      toast.success(`Self-learn complete — ${data?.calls_analyzed || 0} calls analyzed`);
      queryClient.invalidateQueries({ queryKey: ['dc-latest-playbook'] });
    } catch (e: any) {
      toast.error('Self-learn failed: ' + e.message);
    } finally {
      setTriggeringSelfLearn(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header with Live Indicator ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Phone className="h-8 w-8 text-[#0F6E56]" />
            Dynasty Connect — Command Center
          </h1>
          <p className="text-muted-foreground mt-1">AI-powered call center for all Dynasty businesses</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card/80">
          <div className={cn(
            'h-2.5 w-2.5 rounded-full',
            liveCallCount > 0
              ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]'
              : 'bg-muted-foreground/40'
          )} />
          <span className="text-sm font-medium">
            {liveCallCount > 0 ? `${liveCallCount} Live Call${liveCallCount > 1 ? 's' : ''}` : 'No active calls'}
          </span>
        </div>
      </div>

      {/* ── 4 KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#0F6E56]/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#0F6E56]/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-[#0F6E56]" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono">{todayCalls}</p>
                <p className="text-xs text-muted-foreground">Total Calls Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F6E56]/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#0F6E56]/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-[#0F6E56]" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono">{activeCampaigns}</p>
                <p className="text-xs text-muted-foreground">Active Campaigns</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F6E56]/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#0F6E56]/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-[#0F6E56]" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono">{winRate}%</p>
                <p className="text-xs text-muted-foreground">Win Rate This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          'border-[#0F6E56]/20',
          liveCallCount > 0 && 'border-green-500/40 shadow-[0_0_15px_rgba(34,197,94,0.1)]'
        )}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-10 w-10 rounded-lg flex items-center justify-center',
                liveCallCount > 0 ? 'bg-green-500/10' : 'bg-[#0F6E56]/10'
              )}>
                <Activity className={cn(
                  'h-5 w-5',
                  liveCallCount > 0 ? 'text-green-500' : 'text-[#0F6E56]'
                )} />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono flex items-center gap-2">
                  {liveCallCount}
                  {liveCallCount > 0 && (
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  )}
                </p>
                <p className="text-xs text-muted-foreground">Live Calls Right Now</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Self-Learn Engine Card ── */}
      <Card className="border-[#0F6E56]/30 bg-[#0F6E56]/[0.08]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4 text-[#0F6E56]" /> Self-Learn Engine
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {latestPlaybook ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Last run: {latestPlaybook.date || new Date(latestPlaybook.created_at).toLocaleDateString()}</p>
                <p className="text-sm leading-relaxed">{latestPlaybook.top_insight}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{latestPlaybook.calls_analyzed || 0} calls analyzed</span>
                <span>{latestPlaybook.wins_analyzed || 0} wins</span>
                <span>{latestPlaybook.losses_analyzed || 0} losses</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Awaiting first call — run self-learn after first AI call completes
            </p>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Next run: 2am ET</p>
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-[#0F6E56]/40 hover:bg-[#0F6E56]/10"
              onClick={triggerSelfLearn}
              disabled={triggeringSelfLearn}
            >
              {triggeringSelfLearn ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Running…</>
              ) : (
                <><Zap className="h-3 w-3 mr-1" /> Run Now</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Business Pipeline Overview ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-[#0F6E56]" /> Business Pipelines
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => navigate('/dynasty-connect/pipelines')}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {pipelines.slice(0, 6).map((p: any) => (
              <div key={p.id} className="p-3 rounded-lg bg-muted/30 border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate('/dynasty-connect/pipelines')}>
                <p className="font-medium text-sm truncate">{p.business_name}</p>
                <p className="text-xs text-muted-foreground mt-1">Calls as: {p.caller_id}</p>
                <Badge variant="outline" className={cn('text-[10px] mt-2',
                  p.pipeline_type === 'internal' ? 'bg-teal-500/10 text-teal-500 border-teal-500' : 'bg-amber-500/10 text-amber-500 border-amber-500'
                )}>{p.pipeline_type}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Live Call Monitor ── */}
      {liveCalls.length > 0 && (
        <Card className="border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
              Live Calls ({liveCalls.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {liveCalls.map((call: any) => (
                <div key={call.id} className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                  <div>
                    <p className="text-sm font-medium">{call.contact_name || call.phone_number || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{call.business_name || 'Dynasty Connect'}</p>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500">
                    Active
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Recent Calls Feed ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-[#0F6E56]" /> Recent AI Calls
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentCalls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No calls yet — make your first AI campaign call to populate this feed</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentCalls.map((call: any) => {
                const preview = call.full_transcript
                  ? call.full_transcript.substring(0, 80) + (call.full_transcript.length > 80 ? '…' : '')
                  : null;
                return (
                  <div key={call.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{call.phone_number || 'Unknown'}</p>
                      {preview && <p className="text-xs text-muted-foreground truncate">{preview}</p>}
                      <p className="text-xs text-muted-foreground">
                        {new Date(call.created_at).toLocaleString()}
                        {call.duration_seconds ? ` · ${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : ''}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn('shrink-0 ml-2', outcomeStyle(call.outcome || ''))}>
                      {call.outcome || 'pending'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
