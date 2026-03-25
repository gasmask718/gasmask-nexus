import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Briefcase, DollarSign, Calendar, Scale, FileText, Clock } from 'lucide-react';

const CASE_TABS = [
  { value: 'all', label: 'All' },
  { value: 'intake', label: 'Intake' },
  { value: 'agreement_sent', label: 'Agreement Sent' },
  { value: 'filed', label: 'Filed' },
  { value: 'hearing_scheduled', label: 'Hearing' },
  { value: 'approved', label: 'Approved' },
  { value: 'funds_released', label: 'Released' },
  { value: 'closed', label: 'Closed' },
];

const caseStatusColor = (s: string) => {
  const map: Record<string, string> = {
    intake: 'bg-blue-500/10 text-blue-500 border-blue-500',
    agreement_sent: 'bg-purple-500/10 text-purple-500 border-purple-500',
    agreement_signed: 'bg-purple-600/10 text-purple-600 border-purple-600',
    referred: 'bg-amber-500/10 text-amber-500 border-amber-500',
    filed: 'bg-orange-500/10 text-orange-500 border-orange-500',
    hearing_scheduled: 'bg-amber-600/10 text-amber-600 border-amber-600',
    approved: 'bg-green-500/10 text-green-500 border-green-500',
    funds_released: 'bg-green-600/10 text-green-600 border-green-600',
    paid: 'bg-emerald-500/10 text-emerald-500 border-emerald-500',
    closed: 'bg-muted text-muted-foreground',
    lost: 'bg-red-500/10 text-red-500 border-red-500',
  };
  return map[s] ?? 'bg-muted text-muted-foreground';
};

export default function SFCases() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('all');
  const [detailCase, setDetailCase] = useState<any>(null);

  const { data: cases = [] } = useQuery({
    queryKey: ['sf-cases'],
    queryFn: async () => {
      const { data } = await supabase
        .from('surplus_funds_cases')
        .select('*')
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const filtered = tab === 'all' ? cases : cases.filter((c: any) => c.status === tab);
  const totalPipeline = cases.filter((c: any) => !['closed', 'lost', 'paid'].includes(c.status)).reduce((s: number, c: any) => s + (Number(c.our_expected_fee) || 0), 0);
  const totalReceived = cases.reduce((s: number, c: any) => s + (Number(c.amount_received) || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-amber-500">📋 Floor 3 — Case Management</h1>
        <p className="text-sm text-muted-foreground">{cases.length} total cases</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-amber-500/20"><CardContent className="pt-4"><span className="text-xs text-muted-foreground">Active Cases</span><p className="text-2xl font-bold">{cases.filter((c: any) => !['closed', 'lost', 'paid'].includes(c.status)).length}</p></CardContent></Card>
        <Card className="border-amber-500/20"><CardContent className="pt-4"><span className="text-xs text-muted-foreground">Pipeline Value</span><p className="text-2xl font-bold text-amber-500">${totalPipeline.toLocaleString()}</p></CardContent></Card>
        <Card className="border-amber-500/20"><CardContent className="pt-4"><span className="text-xs text-muted-foreground">Total Received</span><p className="text-2xl font-bold text-green-500">${totalReceived.toLocaleString()}</p></CardContent></Card>
        <Card className="border-amber-500/20"><CardContent className="pt-4"><span className="text-xs text-muted-foreground">Win Rate</span><p className="text-2xl font-bold">{cases.length > 0 ? Math.round((cases.filter((c: any) => ['approved', 'funds_released', 'paid', 'closed'].includes(c.status)).length / cases.length) * 100) : 0}%</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          {CASE_TABS.map(t => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="p-3 text-left">Client</th>
                  <th className="p-3 text-left">Property</th>
                  <th className="p-3 text-left">State</th>
                  <th className="p-3 text-left">Surplus</th>
                  <th className="p-3 text-left">Our Fee</th>
                  <th className="p-3 text-left">Attorney</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Actions</th>
                </tr></thead>
                <tbody>
                  {filtered.map((c: any) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-accent/30">
                      <td className="p-3 font-medium">{c.client_name}</td>
                      <td className="p-3 text-muted-foreground">{c.property_address || '—'}</td>
                      <td className="p-3">{c.state}</td>
                      <td className="p-3">${Number(c.surplus_amount).toLocaleString()}</td>
                      <td className="p-3 text-amber-500">${Number(c.our_expected_fee).toLocaleString()}</td>
                      <td className="p-3">{c.attorney_name || '—'}</td>
                      <td className="p-3"><Badge variant="outline" className={caseStatusColor(c.status)}>{c.status?.replace(/_/g, ' ')}</Badge></td>
                      <td className="p-3"><Button size="sm" variant="ghost" onClick={() => setDetailCase(c)}>View</Button></td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No cases found</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Case Detail Modal */}
      <Dialog open={!!detailCase} onOpenChange={() => setDetailCase(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-amber-500">{detailCase?.client_name}</DialogTitle></DialogHeader>
          {detailCase && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Property</span><p className="font-medium">{detailCase.property_address || '—'}</p></div>
                <div><span className="text-muted-foreground">County / State</span><p className="font-medium">{detailCase.county}, {detailCase.state}</p></div>
                <div><span className="text-muted-foreground">Case #</span><p className="font-medium">{detailCase.court_case_number || '—'}</p></div>
                <div><span className="text-muted-foreground">Surplus Amount</span><p className="font-medium">${Number(detailCase.surplus_amount).toLocaleString()}</p></div>
                <div><span className="text-muted-foreground">Our %</span><p className="font-medium">{detailCase.our_percentage}%</p></div>
                <div><span className="text-muted-foreground">Expected Fee</span><p className="font-medium text-amber-500">${Number(detailCase.our_expected_fee).toLocaleString()}</p></div>
                <div><span className="text-muted-foreground">Attorney</span><p className="font-medium">{detailCase.attorney_name || 'Not assigned'}</p></div>
                <div><span className="text-muted-foreground">Status</span><Badge variant="outline" className={caseStatusColor(detailCase.status)}>{detailCase.status?.replace(/_/g, ' ')}</Badge></div>
              </div>
              {detailCase.hearing_date && <div className="flex items-center gap-2 text-amber-500"><Calendar className="h-4 w-4" /><span>Hearing: {new Date(detailCase.hearing_date).toLocaleDateString()}</span></div>}
              {detailCase.amount_received && <div className="flex items-center gap-2 text-green-500"><DollarSign className="h-4 w-4" /><span>Received: ${Number(detailCase.amount_received).toLocaleString()}</span></div>}
              {detailCase.notes && <div><span className="text-muted-foreground">Notes</span><p>{detailCase.notes}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
