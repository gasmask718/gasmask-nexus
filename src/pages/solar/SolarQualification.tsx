import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Brain, CheckCircle, XCircle, Clock, TrendingUp, Zap, Filter } from 'lucide-react';

const AMBER = '#E8A317';

type QualStatus = 'all' | 'new' | 'qualified' | 'nurture' | 'dead';

export default function SolarQualification() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<QualStatus>('all');

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['solar-qual-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_leads')
        .select('*')
        .order('lead_score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('solar_leads').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solar-qual-leads'] });
      toast.success('Lead status updated');
    },
  });

  const filtered = filter === 'all' ? leads : leads.filter((l: any) => {
    if (filter === 'qualified') return l.status === 'qualified';
    if (filter === 'nurture') return ['contacted', 'new'].includes(l.status);
    if (filter === 'dead') return l.status === 'dead';
    return l.status === filter;
  });

  const qualifiedCount = leads.filter((l: any) => l.status === 'qualified').length;
  const nurtureCount = leads.filter((l: any) => ['contacted', 'new'].includes(l.status)).length;
  const deadCount = leads.filter((l: any) => l.status === 'dead').length;
  const avgScore = leads.length ? (leads.reduce((a: number, l: any) => a + (l.lead_score || 0), 0) / leads.length).toFixed(0) : '0';

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getGrade = (score: number) => {
    if (score >= 80) return { grade: 'A', bg: 'bg-green-500/20 text-green-400 border-green-500/30' };
    if (score >= 60) return { grade: 'B', bg: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
    if (score >= 40) return { grade: 'C', bg: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
    return { grade: 'D', bg: 'bg-red-500/20 text-red-400 border-red-500/30' };
  };

  const filters: { key: QualStatus; label: string; count: number }[] = [
    { key: 'all', label: 'All Leads', count: leads.length },
    { key: 'qualified', label: 'Qualified', count: qualifiedCount },
    { key: 'nurture', label: 'Nurture', count: nurtureCount },
    { key: 'dead', label: 'Dead', count: deadCount },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6" style={{ color: AMBER }} />
          Floor 3 — AI Qualification Engine
        </h1>
        <p className="text-muted-foreground">AI-powered lead scoring, qualification, and routing decisions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: leads.length, icon: Filter, color: 'text-blue-400' },
          { label: 'Qualified', value: qualifiedCount, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Avg Score', value: avgScore, icon: TrendingUp, color: 'text-yellow-400' },
          { label: 'Dead Leads', value: deadCount, icon: XCircle, color: 'text-red-400' },
        ].map((s) => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Qualification Criteria */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" style={{ color: AMBER }} />
            AI Qualification Criteria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              { check: 'Homeowner Status', desc: 'Must own property' },
              { check: 'Electric Bill', desc: '$100+/month' },
              { check: 'Credit Range', desc: '600+ score' },
              { check: 'Roof Viability', desc: 'No major obstructions' },
            ].map((c) => (
              <div key={c.check} className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">{c.check}</p>
                  <p className="text-xs text-muted-foreground">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {filters.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f.key)}
            style={filter === f.key ? { backgroundColor: AMBER, color: '#000' } : undefined}
          >
            {f.label} ({f.count})
          </Button>
        ))}
      </div>

      {/* Qualification Table */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Homeowner</TableHead>
                <TableHead>Monthly Bill</TableHead>
                <TableHead>Credit</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : !filtered.length ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No leads to qualify</TableCell></TableRow>
              ) : (
                filtered.map((lead: any) => {
                  const { grade, bg } = getGrade(lead.lead_score || 0);
                  return (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <p className="font-medium">{lead.full_name}</p>
                        <p className="text-xs text-muted-foreground">{lead.city}, {lead.state}</p>
                      </TableCell>
                      <TableCell>
                        <span className={`font-bold text-lg ${getScoreColor(lead.lead_score || 0)}`}>
                          {lead.lead_score || 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${bg} border`}>{grade}</Badge>
                      </TableCell>
                      <TableCell>
                        {lead.homeowner_status ? (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{lead.monthly_bill_range || '—'}</TableCell>
                      <TableCell className="text-sm">{lead.credit_range || '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(lead.interest_level || 0) * 10}%`,
                                backgroundColor: AMBER,
                              }}
                            />
                          </div>
                          <span className="text-xs">{lead.interest_level || 0}/10</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          lead.status === 'qualified' ? 'default' :
                          lead.status === 'dead' ? 'destructive' : 'secondary'
                        }>
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => updateLead.mutate({ id: lead.id, status: 'qualified' })}
                          >
                            Qualify
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 text-red-400"
                            onClick={() => updateLead.mutate({ id: lead.id, status: 'dead' })}
                          >
                            Dead
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
