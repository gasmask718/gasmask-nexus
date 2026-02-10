import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { MapPin, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

type ScoutOutcome = 'not_a_store' | 'no_tobacco' | 'possible_store' | 'confirmed_candidate';

const outcomeOptions: { value: ScoutOutcome; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'confirmed_candidate', label: 'Possible Store', icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-500' },
  { value: 'possible_store', label: 'Needs Verification', icon: <AlertTriangle className="h-4 w-4" />, color: 'text-amber-500' },
  { value: 'no_tobacco', label: 'No Tobacco', icon: <XCircle className="h-4 w-4" />, color: 'text-orange-500' },
  { value: 'not_a_store', label: 'Not a Store', icon: <XCircle className="h-4 w-4" />, color: 'text-destructive' },
];

export default function ScoutConsole() {
  const queryClient = useQueryClient();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<ScoutOutcome | ''>('');
  const [notes, setNotes] = useState('');

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['scout-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territory_tasks')
        .select('*, territory_addresses(full_address, city, neighborhood_id, territory_neighborhoods(name))')
        .eq('task_type', 'scout')
        .in('status', ['open', 'in_progress'])
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const completeMutation = useMutation({
    mutationFn: async ({ taskId, outcome, taskNotes }: { taskId: string; outcome: ScoutOutcome; taskNotes: string }) => {
      const { data, error } = await supabase.rpc('complete_territory_task', {
        p_task_id: taskId,
        p_outcome: {
          interest_level: outcome === 'confirmed_candidate' ? 'interested' : outcome === 'possible_store' ? 'unknown' : 'not_interested',
          notes: taskNotes,
          scout_classification: outcome,
        } as any,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Scout task completed');
      queryClient.invalidateQueries({ queryKey: ['scout-tasks'] });
      setActiveTaskId(null);
      setSelectedOutcome('');
      setNotes('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Group tasks by neighborhood
  const grouped = (tasks || []).reduce<Record<string, typeof tasks>>((acc, t: any) => {
    const hood = t.territory_addresses?.territory_neighborhoods?.name || 'Unassigned';
    if (!acc[hood]) acc[hood] = [];
    acc[hood]!.push(t);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><MapPin className="h-6 w-6 text-cyan-400" /> Scout Console</h1>
        <p className="text-muted-foreground text-sm">Walk neighborhoods, confirm addresses, classify stores</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No scout tasks available. Generate tasks from the execution engine.</CardContent></Card>
      ) : (
        Object.entries(grouped).map(([hood, hoodTasks]) => (
          <Card key={hood}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">🏘️ {hood} <Badge variant="outline" className="text-xs">{(hoodTasks as any[]).length} tasks</Badge></CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(hoodTasks as any[]).map((task: any) => (
                <div key={task.id} className="border border-border/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{task.territory_addresses?.full_address || '—'}</p>
                      <p className="text-xs text-muted-foreground">{task.territory_addresses?.city}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={task.priority === 'high' ? 'bg-destructive text-destructive-foreground' : task.priority === 'medium' ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'} >{task.priority}</Badge>
                      <Badge variant="outline" className="text-xs">{task.status}</Badge>
                    </div>
                  </div>

                  {activeTaskId === task.id ? (
                    <div className="space-y-3 pt-2 border-t border-border/50">
                      <div className="grid grid-cols-2 gap-2">
                        {outcomeOptions.map((opt) => (
                          <Button
                            key={opt.value}
                            variant={selectedOutcome === opt.value ? 'default' : 'outline'}
                            size="sm"
                            className="justify-start gap-2"
                            onClick={() => setSelectedOutcome(opt.value)}
                          >
                            <span className={opt.color}>{opt.icon}</span>
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                      <Textarea placeholder="Notes (what did you observe?)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={!selectedOutcome || completeMutation.isPending}
                          onClick={() => completeMutation.mutate({ taskId: task.id, outcome: selectedOutcome as ScoutOutcome, taskNotes: notes })}
                        >
                          {completeMutation.isPending ? 'Saving…' : 'Complete Task'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setActiveTaskId(null); setSelectedOutcome(''); setNotes(''); }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setActiveTaskId(task.id)}>Start Scouting</Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
