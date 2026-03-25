import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Phone, Plus, Target, TrendingUp } from 'lucide-react';

export default function SFCampaigns() {
  const navigate = useNavigate();

  const { data: campaigns = [] } = useQuery({
    queryKey: ['sf-campaigns'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('ai_call_campaigns')
        .select('*')
        .ilike('name', '%surplus%')
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const { data: callStats } = useQuery({
    queryKey: ['sf-call-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_call_logs')
        .select('outcome, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      const all = data ?? [];
      const total = all.length;
      const wins = all.filter(c => ['booked', 'interested'].includes(c.outcome ?? '')).length;
      return { total, wins, winRate: total > 0 ? Math.round((wins / total) * 100) : 0 };
    },
  });

  const statusStyle = (s: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-500/10 text-green-500', paused: 'bg-amber-500/10 text-amber-500',
      completed: 'bg-muted text-muted-foreground', draft: 'bg-blue-500/10 text-blue-500',
    };
    return map[s] ?? 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amber-500">Call Campaigns</h1>
          <p className="text-sm text-muted-foreground">Surplus Funds outbound campaigns via Dynasty Connect</p>
        </div>
        <Button onClick={() => navigate('/dynasty-connect/campaigns/builder')} className="bg-amber-600 hover:bg-amber-700">
          <Plus className="h-4 w-4 mr-2" />New Campaign
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-amber-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Total Calls</span>
              <Phone className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold">{callStats?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Win Rate</span>
              <TrendingUp className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold">{callStats?.winRate ?? 0}%</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Campaigns</span>
              <Target className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold">{campaigns.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign List */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className="p-3 text-left">Campaign</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Targets</th>
              <th className="p-3 text-left">Completed</th>
              <th className="p-3 text-left">Created</th>
            </tr></thead>
            <tbody>
              {campaigns.map((c: any) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-accent/30">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3"><Badge variant="outline" className={statusStyle(c.status)}>{c.status}</Badge></td>
                  <td className="p-3">{c.total_targets ?? 0}</td>
                  <td className="p-3">{c.completed_calls ?? 0}</td>
                  <td className="p-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {campaigns.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No campaigns yet. Create one from Dynasty Connect.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
