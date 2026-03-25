import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sun, Target, Phone, DollarSign, Users, TrendingUp, Flame, Zap, Calendar, Brain } from 'lucide-react';

const AMBER = '#E8A317';

export default function SolarCommandCenter() {
  const { data: stats } = useQuery({
    queryKey: ['solar-stats'],
    queryFn: async () => {
      const [totalR, qualifiedR, appointedR, closedR, dealsR, partnersR] = await Promise.all([
        supabase.from('solar_leads').select('id', { count: 'exact', head: true }),
        supabase.from('solar_leads').select('id', { count: 'exact', head: true }).eq('status', 'qualified'),
        supabase.from('solar_leads').select('id', { count: 'exact', head: true }).eq('status', 'appointment_booked'),
        supabase.from('solar_deals').select('id', { count: 'exact', head: true }).eq('stage', 'closed_won'),
        supabase.from('solar_deals').select('deal_value, commission_amount'),
        supabase.from('solar_partners').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      ]);
      const totalRevenue = (dealsR.data || []).reduce((s, d) => s + (Number(d.deal_value) || 0), 0);
      const totalComm = (dealsR.data || []).reduce((s, d) => s + (Number(d.commission_amount) || 0), 0);
      return {
        total: totalR.count || 0,
        qualified: qualifiedR.count || 0,
        appointed: appointedR.count || 0,
        closed: closedR.count || 0,
        revenue: totalRevenue,
        commission: totalComm,
        partners: partnersR.count || 0,
      };
    },
    refetchInterval: 30000,
  });

  const s = stats || { total: 0, qualified: 0, appointed: 0, closed: 0, revenue: 0, commission: 0, partners: 0 };

  const metricCards = [
    { label: 'Total Leads', value: s.total, icon: Target, color: 'text-blue-400' },
    { label: 'Qualified', value: s.qualified, icon: Flame, color: 'text-orange-400' },
    { label: 'Appointments', value: s.appointed, icon: Calendar, color: 'text-purple-400' },
    { label: 'Deals Closed', value: s.closed, icon: Zap, color: 'text-green-400' },
    { label: 'Revenue', value: `$${s.revenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-400' },
    { label: 'Commission', value: `$${s.commission.toLocaleString()}`, icon: TrendingUp, color: 'text-amber-400' },
    { label: 'Partners', value: s.partners, icon: Users, color: 'text-cyan-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sun className="h-7 w-7" style={{ color: AMBER }} />
            BrightSun Solar — Command Center
          </h1>
          <p className="text-sm text-muted-foreground">AI-Powered Solar Acquisition & Closing Engine</p>
        </div>
        <Badge className="text-sm px-3 py-1" style={{ backgroundColor: `${AMBER}20`, color: AMBER, borderColor: AMBER }}>
          ☀️ LIVE
        </Badge>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {metricCards.map((m) => (
          <Card key={m.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={`h-4 w-4 ${m.color}`} />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              <p className="text-xl font-bold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5" style={{ color: AMBER }} />
            Solar Pipeline Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'New', count: s.total - s.qualified - s.appointed - s.closed, color: 'bg-gray-500' },
              { label: 'Contacted', count: 0, color: 'bg-blue-500' },
              { label: 'Qualified', count: s.qualified, color: 'bg-orange-500' },
              { label: 'Appointment', count: s.appointed, color: 'bg-purple-500' },
              { label: 'Negotiation', count: 0, color: 'bg-amber-500' },
              { label: 'Closed Won', count: s.closed, color: 'bg-green-500' },
              { label: 'Dead', count: 0, color: 'bg-red-500' },
            ].map((stage) => (
              <div key={stage.label} className="text-center p-3 rounded-lg border border-border/50">
                <div className={`w-3 h-3 rounded-full ${stage.color} mx-auto mb-2`} />
                <p className="text-lg font-bold">{stage.count}</p>
                <p className="text-xs text-muted-foreground">{stage.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Modules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'AI Outreach Engine', desc: 'Auto SMS + calls within 30sec of lead entry', icon: Phone, status: 'Active' },
          { title: 'Qualification AI', desc: 'Homeowner, bill, roof viability scoring', icon: Brain, status: 'Active' },
          { title: 'Deal Router', desc: 'Match leads to best installer partner by state', icon: Zap, status: 'Active' },
          { title: 'Live Call Assist', desc: 'Real-time transcript + AI suggestions', icon: Phone, status: 'Ready' },
          { title: 'Self-Learning Engine', desc: 'Analyze transcripts, improve scripts nightly', icon: Brain, status: 'Ready' },
          { title: 'Commission Tracker', desc: 'Auto-calculate and track partner payouts', icon: DollarSign, status: 'Active' },
        ].map((mod) => (
          <Card key={mod.title} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <mod.icon className="h-4 w-4" style={{ color: AMBER }} />
                  <span className="font-medium text-sm">{mod.title}</span>
                </div>
                <Badge variant="outline" className={mod.status === 'Active' ? 'text-green-400 border-green-400' : 'text-amber-400 border-amber-400'}>
                  {mod.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{mod.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
