import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowDown, Phone } from 'lucide-react';
import { toast } from 'sonner';

const PINK = '#E91E8C';

export default function UTBizOwnerDashboard() {
  const { data: quizResults = [] } = useQuery({
    queryKey: ['ut-quiz-results'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_quiz_results').select('*').order('created_at', { ascending: false }).limit(10);
      return data || [];
    },
  });

  const { data: consultations = [] } = useQuery({
    queryKey: ['ut-consultations-recent'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_business_consultations').select('*').order('created_at', { ascending: false }).limit(5);
      return data || [];
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['ut-kit-orders-recent'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_kit_orders').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_paid || 0), 0);

  const stats = {
    quizLeads: quizResults.length,
    consultationsPending: consultations.filter(c => c.status === 'pending').length,
    kitOrders: orders.length,
    revenue: totalRevenue,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: PINK }}>🚀 Business Owner Pipeline</h1>
        <p className="text-muted-foreground">Manage everyone who wants to start a party rental business</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Quiz Leads', value: stats.quizLeads },
          { label: 'Consultations Pending', value: stats.consultationsPending },
          { label: 'Kit Orders', value: stats.kitOrders },
          { label: 'Revenue This Month', value: `$${stats.revenue.toLocaleString()}` },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></CardContent></Card>
        ))}
      </div>

      {/* Funnel */}
      <Card>
        <CardHeader><CardTitle>Pipeline Funnel</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2">
            {[
              { label: 'Quiz Completed', value: stats.quizLeads },
              { label: 'Email Captured', value: quizResults.filter(q => q.email).length },
              { label: 'Consultation Booked', value: consultations.length },
              { label: 'Quote Sent', value: consultations.filter(c => c.status === 'quote_sent').length },
              { label: 'Kit Ordered', value: orders.length },
            ].map((step, i, arr) => (
              <div key={step.label} className="text-center">
                <div className="bg-muted/50 rounded-lg px-8 py-3 min-w-[200px]">
                  <p className="text-lg font-bold">{step.value}</p>
                  <p className="text-xs text-muted-foreground">{step.label}</p>
                </div>
                {i < arr.length - 1 && (
                  <div className="flex flex-col items-center my-1">
                    <ArrowDown className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{arr[i + 1].value > 0 && step.value > 0 ? `${Math.round((arr[i + 1].value / step.value) * 100)}%` : '0%'}</span>
                  </div>
                )}
              </div>
            ))}
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-8 py-3 mt-2">
              <p className="text-lg font-bold text-green-600">💰 ${stats.revenue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Revenue</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Quiz Leads */}
      <Card>
        <CardHeader><CardTitle>Recent Quiz Leads</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Business Type</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Kit Match</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quizResults.map((q: any) => (
                <TableRow key={q.id}>
                  <TableCell>{q.email || '—'}</TableCell>
                  <TableCell>{q.business_type || '—'}</TableCell>
                  <TableCell>{q.budget_range || '—'}</TableCell>
                  <TableCell><Badge variant="outline">{q.recommended_kit || '—'}</Badge></TableCell>
                  <TableCell className="text-xs">{new Date(q.created_at).toLocaleDateString()}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => toast.info('Follow up SMS triggered')}><Phone className="h-3 w-3 mr-1" /> Follow Up</Button></TableCell>
                </TableRow>
              ))}
              {quizResults.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No quiz leads yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Consultations */}
      <Card>
        <CardHeader><CardTitle>Recent Consultations</CardTitle></CardHeader>
        <CardContent>
          {consultations.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">No consultations yet</p>
          ) : (
            <div className="space-y-2">
              {consultations.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.kit_interest} • {c.budget}</p>
                  </div>
                  <Badge variant="outline">{c.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
