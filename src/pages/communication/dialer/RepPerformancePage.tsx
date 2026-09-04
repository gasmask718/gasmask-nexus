import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, TrendingUp, DollarSign, Phone, BarChart3, AlertTriangle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { useState } from 'react';
import { RepActivityBoard } from '@/components/communication/RepActivityBoard';

type SortField = 'total_revenue' | 'connect_rate' | 'positive_dispositions' | 'revenue_per_connect';

export default function RepPerformancePage() {
  const { currentBusiness } = useBusiness();
  const [sortBy, setSortBy] = useState<SortField>('total_revenue');

  const { data: metrics = [] } = useQuery({
    queryKey: ['rep-performance', currentBusiness?.id],
    queryFn: async () => {
      const client = supabase as any;
      const { data, error } = await client
        .from('rep_performance_metrics')
        .select('*')
        .eq('business_id', currentBusiness?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
    refetchInterval: 10000,
  });

  // Fetch revenue events for totals
  const { data: revenueStats } = useQuery({
    queryKey: ['revenue-totals', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_revenue_events')
        .select('amount')
        .eq('business_id', currentBusiness?.id);
      if (error) throw error;
      const total = (data || []).reduce((sum, r) => sum + (r.amount || 0), 0);
      return { totalRevenue: total, totalEvents: data?.length || 0 };
    },
    enabled: !!currentBusiness?.id,
  });

  // Fetch followup stats
  const { data: followupStats } = useQuery({
    queryKey: ['followup-totals', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dialer_followups')
        .select('status')
        .eq('business_id', currentBusiness?.id);
      if (error) throw error;
      const pending = (data || []).filter(f => f.status === 'pending').length;
      return { total: data?.length || 0, pending };
    },
    enabled: !!currentBusiness?.id,
  });

  const sorted = [...metrics].sort((a: any, b: any) => {
    return (Number(b[sortBy]) || 0) - (Number(a[sortBy]) || 0);
  });

  const topCards = [
    { icon: DollarSign, label: 'Total Revenue', value: `$${(revenueStats?.totalRevenue || 0).toLocaleString()}`, color: 'text-green-500' },
    { icon: Phone, label: 'Total Dials', value: metrics.reduce((s: number, m: any) => s + (Number(m.total_dials) || 0), 0), color: 'text-blue-500' },
    { icon: Users, label: 'Total Connects', value: metrics.reduce((s: number, m: any) => s + (Number(m.total_connects) || 0), 0), color: 'text-primary' },
    { icon: TrendingUp, label: 'Pending Follow-ups', value: followupStats?.pending || 0, color: 'text-amber-500' },
  ];

  return (
    <div className="w-full min-h-full space-y-6">
      {/* Real activity from the canonical communication log — shown first. */}
      <RepActivityBoard />

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
        <p className="text-sm font-semibold text-amber-700">SIMULATION DATA — the cards and table below reflect simulated call outcomes, not live revenue</p>
      </div>


      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Rep Performance Intelligence
          </h2>
          <p className="text-muted-foreground">Revenue, connect rates, and close rates per rep</p>
        </div>
        <Select value={sortBy} onValueChange={v => setSortBy(v as SortField)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="total_revenue">Sort by Revenue</SelectItem>
            <SelectItem value="connect_rate">Sort by Connect Rate</SelectItem>
            <SelectItem value="positive_dispositions">Sort by Close Rate</SelectItem>
            <SelectItem value="revenue_per_connect">Sort by Revenue Efficiency</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {topCards.map(card => (
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

      {/* Rep Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rep Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No rep data yet — run the dialer with dispositions</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rep</TableHead>
                  <TableHead className="text-right">Dials</TableHead>
                  <TableHead className="text-right">Connects</TableHead>
                  <TableHead className="text-right">Connect %</TableHead>
                  <TableHead className="text-right">Positive</TableHead>
                  <TableHead className="text-right">Negative</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Rev/Connect</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((rep: any, i: number) => (
                  <TableRow key={rep.rep_user_id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {i === 0 && <Badge className="bg-amber-500 text-white text-[10px]">🏆</Badge>}
                        {rep.rep_user_id?.slice(0, 8)}...
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{rep.total_dials}</TableCell>
                    <TableCell className="text-right">{rep.total_connects}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={Number(rep.connect_rate) > 20 ? 'text-green-600' : ''}>
                        {rep.connect_rate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-green-600">{rep.positive_dispositions}</TableCell>
                    <TableCell className="text-right text-red-600">{rep.negative_dispositions}</TableCell>
                    <TableCell className="text-right font-semibold">${Number(rep.total_revenue).toLocaleString()}</TableCell>
                    <TableCell className="text-right">${Number(rep.revenue_per_connect || 0).toFixed(2)}</TableCell>
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
