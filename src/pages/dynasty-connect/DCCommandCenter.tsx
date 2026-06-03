import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Brain, Zap, Building2, Music, Sparkles, Shield, Wrench, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { OutreachLauncherDialog } from '@/components/dynasty-connect/OutreachLauncherDialog';

const BUSINESSES = [
  { key: 'gasmask', name: 'GasMask / Hot Mama', icon: Building2, color: 'bg-green-500', phoneDefault: '+18484004179', agents: ['Sales', 'Follow-up', 'Reactivation'], isLive: true },
  { key: 'unforgettable_times', name: 'Unforgettable Times', icon: Sparkles, color: 'bg-purple-500', agents: ['Partner Outreach', 'Event Concierge', 'Ambassador Help Line'], isLive: false },
  { key: 'real_estate', name: 'Real Estate', icon: Building2, color: 'bg-blue-500', agents: ['Lead Qualifier', 'Wholesale Specialist', 'Closer'], isLive: false },
  { key: 'surplus_funds', name: 'Surplus Funds', icon: Shield, color: 'bg-amber-500', agents: ['Client Outreach', 'Attorney Acquisition'], isLive: false },
  { key: 'top_tier', name: 'Top Tier Experience', icon: Sparkles, color: 'bg-rose-500', agents: ['Luxury Concierge', 'Ambassador Help Line'], isLive: false },
  { key: 'brandaro', name: 'Brandaro Digital', icon: Zap, color: 'bg-indigo-500', agents: ['Sales Expert', 'Closer', 'Relationship', 'Spanish Closer', 'Spanish Rel.'], isLive: false },
  { key: 'iclean', name: 'iClean WeClean', icon: Wrench, color: 'bg-cyan-500', agents: ['Booking Agent'], isLive: false },
  { key: 'playboxxx', name: 'PlayBoxxx', icon: Music, color: 'bg-pink-500', agents: ['Manager', 'Affiliate', 'Production'], isLive: false, isInternal: true },
];

export default function DCCommandCenter() {
  const navigate = useNavigate();
  const [launcherBiz, setLauncherBiz] = useState<{ key: string; name: string; phone?: string } | null>(null);
  const { data: agents = [] } = useQuery({
    queryKey: ['dc-agents-all'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('dc_agents').select('*').order('business');
      return data || [];
    },
  });
  const { data: callsToday = [] } = useQuery({
    queryKey: ['dc-calls-today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await (supabase as any).from('dc_call_logs').select('id, duration_seconds, status, business').gte('created_at', today);
      return data || [];
    },
    refetchInterval: 10000,
  });
  const { data: phoneNumbers = [] } = useQuery({
    queryKey: ['dc-phone-numbers-all'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('dc_phone_numbers').select('*');
      return data || [];
    },
  });

  const totalCallsToday = callsToday.length;
  const totalMinutesToday = Math.round(callsToday.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0) / 60);
  const activeAgents = agents.filter((a: any) => a.is_active).length;

  const getBusinessStats = (bizKey: string) => {
    const bizAgents = agents.filter((a: any) => a.business === bizKey);
    const bizCalls = callsToday.filter((c: any) => c.business === bizKey);
    const bizPhone = phoneNumbers.find((p: any) => p.business === bizKey);
    return { agentCount: bizAgents.length, callCount: bizCalls.length, phone: bizPhone?.phone_number };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dynasty Connect Command Center</h1>
          <p className="text-sm text-muted-foreground">AI Call Center Command Center</p>
        </div>
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <Badge className="bg-green-500/10 text-green-500 border-green-500">🟢 System Online</Badge>
          <span className="text-muted-foreground">{activeAgents} Agents Active</span>
          <span className="font-medium">{totalCallsToday} Calls Today</span>
          <span className="font-medium">{totalMinutesToday} Min Today</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {BUSINESSES.map((biz) => {
          const stats = getBusinessStats(biz.key);
          const isLive = biz.isLive || !!stats.phone;
          const Icon = biz.icon;
          return (
            <Card key={biz.key} className="relative overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-1 ${biz.color}`} />
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {biz.name}
                  {biz.isInternal && <Badge variant="outline" className="text-xs ml-auto">Internal</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground"><span>Phone:</span><span className="font-mono text-xs">{stats.phone || biz.phoneDefault || 'Not set'}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Agents:</span><span>{stats.agentCount} active{stats.agentCount === 0 ? ' (not seeded)' : ''}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Calls Today:</span><span>{stats.callCount}</span></div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    {isLive
                      ? <Badge className="bg-green-500/10 text-green-500 border-green-500 text-xs">🟢 Live</Badge>
                      : <Badge className="bg-amber-500/10 text-amber-500 border-amber-500 text-xs">🟡 Number needed</Badge>}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{biz.agents.join(', ')}</div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 text-xs"
                    disabled={stats.agentCount === 0}
                    onClick={() =>
                      setLauncherBiz({
                        key: biz.key,
                        name: biz.name,
                        phone: stats.phone || biz.phoneDefault,
                      })
                    }
                  >
                    <Rocket className="h-3 w-3 mr-1" /> Launch
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => navigate('/dynasty-connect/intelligence')}><Brain className="h-3 w-3 mr-1" /> Calls</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{agents.length}</div><p className="text-xs text-muted-foreground">Total Agents</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{phoneNumbers.length}</div><p className="text-xs text-muted-foreground">Phone Numbers</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{totalCallsToday}</div><p className="text-xs text-muted-foreground">Calls Today</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{totalMinutesToday}</div><p className="text-xs text-muted-foreground">Minutes Today</p></CardContent></Card>
      </div>
    </div>
  );
}
