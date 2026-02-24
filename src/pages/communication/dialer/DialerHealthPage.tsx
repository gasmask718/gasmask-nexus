import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, Phone, PhoneCall, Users, Clock, TrendingUp, DollarSign, Voicemail 
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
      const totalDuration = sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
      const avgTalkTime = sessions.length > 0 ? Math.floor(totalDuration / sessions.length) : 0;
      const sales = sessions.filter(s => s.outcome === 'sale').length;
      const conversionRate = sessions.length > 0 ? ((sales / sessions.length) * 100).toFixed(1) : '0';

      return { totalSessions: sessions.length, avgTalkTime, sales, conversionRate };
    },
    enabled: !!currentBusiness?.id,
  });

  const stats = todayStats || { dialed: 0, connected: 0, voicemail: 0, noAnswer: 0, connectRate: '0', voicemailRate: '0' };
  const sessions = sessionStats || { totalSessions: 0, avgTalkTime: 0, sales: 0, conversionRate: '0' };

  const cards = [
    { icon: Phone, label: 'Calls Dialed Today', value: stats.dialed, color: 'text-blue-500' },
    { icon: Users, label: 'Humans Connected', value: stats.connected, color: 'text-green-500' },
    { icon: Voicemail, label: 'Voicemail Rate', value: `${stats.voicemailRate}%`, color: 'text-purple-500' },
    { icon: Clock, label: 'Avg Talk Time', value: `${Math.floor(sessions.avgTalkTime / 60)}m ${sessions.avgTalkTime % 60}s`, color: 'text-amber-500' },
    { icon: TrendingUp, label: 'Connect Rate', value: `${stats.connectRate}%`, color: 'text-emerald-500' },
    { icon: DollarSign, label: 'Conversion Rate', value: `${sessions.conversionRate}%`, color: 'text-primary' },
  ];

  return (
    <div className="w-full min-h-full space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Dialer Health Dashboard
        </h2>
        <p className="text-muted-foreground">Today's dialer performance at a glance</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
