import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Users, Phone, Briefcase, DollarSign, TrendingUp, Search, Upload, Scale, UserPlus, Activity } from 'lucide-react';

const PIPELINE_STAGES = [
  { key: 'new', label: 'New Leads', color: 'bg-gray-500' },
  { key: 'phone_found', label: 'Phone Found', color: 'bg-blue-500' },
  { key: 'called', label: 'Called', color: 'bg-purple-500' },
  { key: 'interested', label: 'Qualified', color: 'bg-teal-500' },
  { key: 'agreement_signed', label: 'Agreement', color: 'bg-amber-500' },
  { key: 'case_filed', label: 'Filed', color: 'bg-orange-500' },
  { key: 'funds_released', label: 'Funds Released', color: 'bg-green-500' },
];

export default function SFCommandCenter() {
  const navigate = useNavigate();

  const { data: leads = [] } = useQuery({
    queryKey: ['sf-leads-all'],
    queryFn: async () => {
      const { data } = await supabase.from('surplus_funds_leads').select('status, surplus_amount');
      return data ?? [];
    },
  });

  const { data: cases = [] } = useQuery({
    queryKey: ['sf-cases-all'],
    queryFn: async () => {
      const { data } = await supabase.from('surplus_funds_cases').select('status, surplus_amount, amount_received, our_expected_fee, client_name, property_address, county, state, attorney_name, created_at');
      return data ?? [];
    },
  });

  const { data: recentActivity = [] } = useQuery({
    queryKey: ['sf-recent-activity'],
    queryFn: async () => {
      const { data } = await supabase
        .from('surplus_funds_leads')
        .select('first_name, last_name, status, updated_at, surplus_amount')
        .order('updated_at', { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const totalLeads = leads.length;
  const skipTraced = leads.filter(l => ['phone_found', 'queued', 'called', 'interested', 'consultation_booked', 'agreement_signed'].includes(l.status ?? '')).length;
  const consultationsBooked = leads.filter(l => l.status === 'consultation_booked').length;
  const activeCases = cases.filter(c => !['closed', 'lost', 'paid'].includes(c.status ?? '')).length;
  const totalRecovered = cases.reduce((s, c) => s + (Number(c.amount_received) || 0), 0);
  const pipelineValue = cases.filter(c => !['closed', 'lost', 'paid'].includes(c.status ?? '')).reduce((s, c) => s + (Number(c.our_expected_fee) || 0), 0);

  const stageCounts = PIPELINE_STAGES.map(s => ({
    ...s,
    count: leads.filter(l => l.status === s.key).length,
  }));

  // Top cases by expected fee
  const topCases = [...cases]
    .filter((c: any) => !['closed', 'lost', 'paid'].includes(c.status ?? ''))
    .sort((a: any, b: any) => (Number(b.our_expected_fee) || 0) - (Number(a.our_expected_fee) || 0))
    .slice(0, 3);

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      new: 'bg-gray-500/10 text-gray-400', interested: 'bg-teal-500/10 text-teal-500',
      consultation_booked: 'bg-amber-500/10 text-amber-500', agreement_signed: 'bg-amber-600/10 text-amber-600',
      case_filed: 'bg-orange-500/10 text-orange-500', funds_released: 'bg-green-500/10 text-green-500',
      called: 'bg-purple-500/10 text-purple-500',
    };
    return map[s] ?? 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-amber-500">💰 Penthouse — Command Center</h1>
        <p className="text-muted-foreground">Recovery pipeline — find money, claim it, get paid</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Leads', value: totalLeads, icon: Users },
          { label: 'Skip Traced', value: skipTraced, icon: Search },
          { label: 'Consultations', value: consultationsBooked, icon: Phone },
          { label: 'Active Cases', value: activeCases, icon: Briefcase },
          { label: 'Recovered', value: `$${totalRecovered.toLocaleString()}`, icon: DollarSign },
          { label: 'Pipeline Value', value: `$${pipelineValue.toLocaleString()}`, icon: TrendingUp },
        ].map(m => (
          <Card key={m.label} className="border-amber-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{m.label}</span>
                <m.icon className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline Funnel */}
      <Card className="border-amber-500/20">
        <CardHeader><CardTitle className="text-amber-500">Pipeline Funnel</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-40">
            {stageCounts.map((stage) => {
              const maxCount = Math.max(...stageCounts.map(s => s.count), 1);
              const height = Math.max((stage.count / maxCount) * 100, 8);
              const prevCount = stageCounts[stageCounts.indexOf(stage) - 1]?.count;
              const convRate = prevCount && prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : null;
              return (
                <div key={stage.key} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-sm font-bold">{stage.count}</span>
                  {convRate !== null && <span className="text-[9px] text-muted-foreground">{convRate}%</span>}
                  <div className={`w-full rounded-t ${stage.color}`} style={{ height: `${height}%` }} />
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">{stage.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="border-amber-500/20">
          <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => navigate('/surplus-funds/leads')} className="bg-amber-600 hover:bg-amber-700"><Upload className="h-4 w-4 mr-2" />Upload Leads</Button>
            <Button variant="outline" onClick={() => navigate('/surplus-funds/attorneys')}><Scale className="h-4 w-4 mr-2" />Add Attorney</Button>
            <Button variant="outline" onClick={() => navigate('/surplus-funds/cases')}><Briefcase className="h-4 w-4 mr-2" />View Cases</Button>
            <Button variant="outline" onClick={() => navigate('/surplus-funds/campaigns')}><Phone className="h-4 w-4 mr-2" />DC Campaign</Button>
          </CardContent>
        </Card>

        {/* Top Cases */}
        <Card className="border-amber-500/20">
          <CardHeader><CardTitle>Top Cases by Fee</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topCases.length === 0 && <p className="text-sm text-muted-foreground">No active cases yet.</p>}
              {topCases.map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                  <div>
                    <p className="font-medium">{c.property_address || c.client_name}</p>
                    <p className="text-xs text-muted-foreground">{c.county}, {c.state} • {c.attorney_name || 'No attorney'}</p>
                  </div>
                  <span className="text-amber-500 font-bold">${Number(c.our_expected_fee).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-amber-500/20">
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" />Live Activity</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-auto">
              {recentActivity.length === 0 && <p className="text-sm text-muted-foreground">No activity yet. Upload your first leads!</p>}
              {recentActivity.map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                  <span>{a.first_name} {a.last_name}</span>
                  <div className="flex items-center gap-2">
                    {a.surplus_amount && <span className="text-xs text-muted-foreground">${Number(a.surplus_amount).toLocaleString()}</span>}
                    <Badge variant="outline" className={statusColor(a.status)}>{a.status?.replace(/_/g, ' ')}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
