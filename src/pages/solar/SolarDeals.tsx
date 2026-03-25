import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { DollarSign, TrendingUp, CheckCircle2, Clock, AlertTriangle, Sun, Plus, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const AMBER = '#E8A317';

const STAGE_COLORS: Record<string, string> = {
  sent: 'bg-blue-500/20 text-blue-400 border-blue-500',
  in_progress: 'bg-amber-500/20 text-amber-400 border-amber-500',
  closed_won: 'bg-green-500/20 text-green-400 border-green-500',
  closed_lost: 'bg-red-500/20 text-red-400 border-red-500',
};

const PAYOUT_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500',
  approved: 'bg-blue-500/20 text-blue-400 border-blue-500',
  paid: 'bg-green-500/20 text-green-400 border-green-500',
};

export default function SolarDeals() {
  const queryClient = useQueryClient();
  const [showAddDeal, setShowAddDeal] = useState(false);

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['solar-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_deals')
        .select('*, solar_leads(full_name, city, state, phone), solar_partners(company_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ['solar-deal-stats'],
    queryFn: async () => {
      const { data: allDeals } = await supabase.from('solar_deals').select('deal_value, commission_amount, stage, payout_status');
      const d = allDeals || [];
      return {
        totalDeals: d.length,
        totalRevenue: d.filter(x => x.stage === 'closed_won').reduce((s, x) => s + (Number(x.deal_value) || 0), 0),
        totalCommission: d.filter(x => x.stage === 'closed_won').reduce((s, x) => s + (Number(x.commission_amount) || 0), 0),
        pendingPayouts: d.filter(x => x.payout_status === 'pending' && x.stage === 'closed_won').reduce((s, x) => s + (Number(x.commission_amount) || 0), 0),
        inProgress: d.filter(x => x.stage === 'in_progress').length,
        won: d.filter(x => x.stage === 'closed_won').length,
        lost: d.filter(x => x.stage === 'closed_lost').length,
      };
    },
    refetchInterval: 30000,
  });

  const s = stats || { totalDeals: 0, totalRevenue: 0, totalCommission: 0, pendingPayouts: 0, inProgress: 0, won: 0, lost: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6" style={{ color: AMBER }} />
            Floor 6 — Deals & Commissions
          </h1>
          <p className="text-sm text-muted-foreground">Track deal stages, revenue, and partner payouts</p>
        </div>
        <Button style={{ backgroundColor: AMBER }} onClick={() => setShowAddDeal(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Deal
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Revenue', value: `$${s.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-green-400' },
          { label: 'Commission Earned', value: `$${s.totalCommission.toLocaleString()}`, icon: TrendingUp, color: 'text-amber-400' },
          { label: 'Pending Payouts', value: `$${s.pendingPayouts.toLocaleString()}`, icon: Clock, color: 'text-blue-400' },
          { label: 'Active Deals', value: s.inProgress, icon: FileText, color: 'text-purple-400' },
        ].map((m) => (
          <Card key={m.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={`h-4 w-4 ${m.color}`} />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              <p className="text-2xl font-bold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Sent', count: deals.filter((d: any) => d.stage === 'sent').length, color: 'bg-blue-500' },
          { label: 'In Progress', count: s.inProgress, color: 'bg-amber-500' },
          { label: 'Won', count: s.won, color: 'bg-green-500' },
          { label: 'Lost', count: s.lost, color: 'bg-red-500' },
        ].map((p) => (
          <div key={p.label} className="text-center p-4 rounded-lg border border-border/50">
            <div className={`w-3 h-3 rounded-full ${p.color} mx-auto mb-2`} />
            <p className="text-xl font-bold">{p.count}</p>
            <p className="text-xs text-muted-foreground">{p.label}</p>
          </div>
        ))}
      </div>

      {/* Deals Table */}
      <Card>
        <CardContent className="p-0">
          {deals.length === 0 ? (
            <div className="py-16 text-center">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="font-semibold mb-2">No deals yet</h3>
              <p className="text-sm text-muted-foreground">Deals are created when qualified leads are routed to partners</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Deal Value</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Payout</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((deal: any) => (
                  <TableRow key={deal.id}>
                    <TableCell>
                      <div className="font-medium">{deal.solar_leads?.full_name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{deal.solar_leads?.city}, {deal.solar_leads?.state}</div>
                    </TableCell>
                    <TableCell>{deal.solar_partners?.company_name || '—'}</TableCell>
                    <TableCell className="font-bold">${Number(deal.deal_value || 0).toLocaleString()}</TableCell>
                    <TableCell style={{ color: AMBER }}>${Number(deal.commission_amount || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STAGE_COLORS[deal.stage] || ''}>{deal.stage?.replace(/_/g, ' ')}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={PAYOUT_COLORS[deal.payout_status] || ''}>{deal.payout_status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(deal.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
