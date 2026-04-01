import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, Phone, MessageSquare, ArrowRight } from 'lucide-react';

const PINK = '#E91E8C';

export default function UTQuizResults() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');

  const { data: results = [] } = useQuery({
    queryKey: ['ut-quiz-results-all'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_quiz_results').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (quiz: any) => {
      const { error } = await supabase.from('ut_business_consultations').insert({
        name: quiz.email?.split('@')[0] || 'Lead',
        email: quiz.email || '',
        phone: quiz.phone || '',
        kit_interest: quiz.recommended_kit,
        budget: quiz.budget_range,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Converted to consultation');
      queryClient.invalidateQueries({ queryKey: ['ut-consultations'] });
    },
  });

  const filtered = filter === 'all' ? results : results.filter(r => {
    const d = new Date(r.created_at);
    const now = new Date();
    if (filter === 'today') return d.toDateString() === now.toDateString();
    if (filter === 'week') return (now.getTime() - d.getTime()) < 7 * 86400000;
    if (filter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: PINK }}>🎯 Quiz Leads</h1>
          <p className="text-muted-foreground">All quiz completions from public site /start-a-business page</p>
        </div>
        <Button variant="outline" onClick={() => toast.info('CSV export coming soon')}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['all', 'today', 'week', 'month'].map(f => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)} className="capitalize">{f === 'all' ? 'All' : f === 'week' ? 'This Week' : f === 'month' ? 'This Month' : 'Today'}</Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Business Type</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Kit Match</TableHead>
                <TableHead>Timeline</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r: any, i: number) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell>{r.email || '—'}</TableCell>
                  <TableCell>{r.business_type || '—'}</TableCell>
                  <TableCell>{r.budget_range || '—'}</TableCell>
                  <TableCell><Badge variant="outline">{r.recommended_kit || '—'}</Badge></TableCell>
                  <TableCell>{r.launch_timeline || '—'}</TableCell>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => toast.info('Call triggered')}><Phone className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => toast.info('SMS triggered')}><MessageSquare className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => convertMutation.mutate(r)}><ArrowRight className="h-3 w-3" /> Convert</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No quiz results yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
