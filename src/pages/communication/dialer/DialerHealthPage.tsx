import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, Phone, Users, Clock, TrendingUp, DollarSign, Voicemail, Activity, AlertTriangle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';

export default function DialerHealthPage() {
  const { currentBusiness } = useBusiness();

  // Today's stats from outbound_call_queue
  const { data: todayStats } = useQuery({
    queryKey: ['dialer-health-today', currentBusiness?.id],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('outbound_call_queue')
        .select('status, attempt_count')
        .eq('business_id', currentBusiness?.id)
        .gte('updated_at', todayStart.toISOString());
      if (error) throw error;

      const items = data || [];
      const dialed = items.length;
      const connected = items.filter(i => i.status === 'answered' || i.status === 'bridged' || i.status === 'completed').length;
      const voicemail = items.filter(i => i.status === 'voicemail').length;
      const noAnswer = items.filter(i => i.status === 'no_answer' || i.status === 'failed').length;
      const connectRate = dialed > 0 ? ((connected / dialed) * 100).toFixed(1) : '0';
      const voicemailRate = dialed > 0 ? ((voicemail / dialed) * 100).toFixed(1) : '0';

      return { dialed, connected, voicemail, noAnswer, connectRate, voicemailRate };
    },
    enabled: !!currentBusiness?.id,
    refetchInterval: 5000,
  });

  // Session stats
  const { data: sessionStats } = useQuery({
    queryKey: ['dialer-session-stats', currentBusiness?.id],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('live_call_sessions')
        .select('duration_seconds, outcome')
        .eq('business_id', currentBusiness?.id)
        .gte('created_at', todayStart.toISOString());
      if (error) throw error;

      const sessions = data || [];
      const completedSessions = sessions.filter(s => s.duration_seconds != null);
      const totalDuration = completedSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
      const avgTalkTime = completedSessions.length > 0 ? Math.floor(totalDuration / completedSessions.length) : 0;
      const sales = sessions.filter(s => s.outcome === 'sale').length;
      const conversionRate = sessions.length > 0 ? ((sales / sessions.length) * 100).toFixed(1) : '0';

      return { totalSessions: sessions.length, avgTalkTime, sales, conversionRate };
    },
    enabled: !!currentBusiness?.id,
    refetchInterval: 5000,
  });

  // Agent utilization
  const { data: agentStats } = useQuery({
    queryKey: ['dialer-agent-utilization', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dialer_agent_availability')
        .select('status')
        .eq('business_id', currentBusiness?.id);
      if (error) throw error;

      const agents = data || [];
      const total = agents.length;
      const busy = agents.filter(a => a.status === 'busy' || a.status === 'wrap_up').length;
      const utilization = total > 0 ? ((busy / total) * 100).toFixed(0) : '0';
      return { total, busy, utilization };
    },
    enabled: !!currentBusiness?.id,
    refetchInterval: 5000,
  });

  const stats = todayStats || { dialed: 0, connected: 0, voicemail: 0, noAnswer: 0, connectRate: '0', voicemailRate: '0' };
  const sessions = sessionStats || { totalSessions: 0, avgTalkTime: 0, sales: 0, conversionRate: '0' };
  const agents = agentStats || { total: 0, busy: 0, utilization: '0' };

  const cards = [
    { icon: Phone, label: 'Calls Dialed Today', value: stats.dialed, color: 'text-blue-500' },
    { icon: Users, label: 'Humans Connected', value: stats.connected, color: 'text-green-500' },
    { icon: Voicemail, label: 'Voicemail Rate', value: `${stats.voicemailRate}%`, color: 'text-purple-500' },
    { icon: Clock, label: 'Avg Talk Time', value: `${Math.floor(sessions.avgTalkTime / 60)}m ${sessions.avgTalkTime % 60}s`, color: 'text-amber-500' },
    { icon: TrendingUp, label: 'Sim Connect Rate', value: `${stats.connectRate}%`, color: 'text-emerald-500' },
    { icon: Activity, label: 'Agent Utilization', value: `${agents.utilization}%`, color: 'text-blue-500' },
    { icon: DollarSign, label: 'Conversion Rate', value: `${sessions.conversionRate}%`, color: 'text-primary' },
  ];

  return (
    <div className="w-full min-h-full space-y-6">
      {/* Simulation Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">SIMULATION METRICS — All data reflects simulated outcomes</p>
      </div>

      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Dialer Health Dashboard
        </h2>
        <p className="text-muted-foreground">Today's dialer performance at a glance (auto-refreshes)</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(card => (
          <Card key={card.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${card.color}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Outcome Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Call Outcome Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 border rounded-lg text-center">
              <p className="text-xl font-bold text-green-500">{stats.connected}</p>
              <p className="text-xs text-muted-foreground">Connected</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-xl font-bold text-purple-500">{stats.voicemail}</p>
              <p className="text-xs text-muted-foreground">Voicemail</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-xl font-bold text-orange-500">{stats.noAnswer}</p>
              <p className="text-xs text-muted-foreground">No Answer / Failed</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-xl font-bold text-primary">{sessions.sales}</p>
              <p className="text-xs text-muted-foreground">Sales / Interested</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-xl font-bold text-blue-500">{agents.busy}/{agents.total}</p>
              <p className="text-xs text-muted-foreground">Agents Active</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
