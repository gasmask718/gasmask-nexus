import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Phone } from 'lucide-react';

export default function CallConsole() {
  const queryClient = useQueryClient();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [interestLevel, setInterestLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpNeeded, setFollowUpNeeded] = useState(false);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['call-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territory_tasks')
        .select('*, territory_addresses(full_address, city), territory_store_candidates:candidate_id(business_name, contact_phone, interest_level, source)')
        .eq('task_type', 'call')
        .in('status', ['open', 'in_progress'])
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const completeMutation = useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) => {
      const { data, error } = await supabase.rpc('complete_territory_task', {
        p_task_id: taskId,
        p_outcome: {
          interest_level: interestLevel,
          notes,
          follow_up_needed: followUpNeeded,
        } as any,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Call task completed');
      queryClient.invalidateQueries({ queryKey: ['call-tasks'] });
      resetForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetForm = () => {
    setActiveTaskId(null);
    setInterestLevel('');
    setNotes('');
    setFollowUpNeeded(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Phone className="h-6 w-6 text-cyan-400" /> Call Console</h1>
        <p className="text-muted-foreground text-sm">Call candidates, capture interest, schedule follow-ups</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : !tasks?.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No call tasks available.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task: any) => {
            const candidate = task.territory_store_candidates;
            return (
              <Card key={task.id}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{candidate?.business_name || 'Unknown Candidate'}</p>
                      <p className="text-sm text-muted-foreground">{task.territory_addresses?.full_address}</p>
                      {candidate?.contact_phone && <p className="text-sm font-mono mt-1">📞 {candidate.contact_phone}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={task.priority === 'high' ? 'bg-destructive text-destructive-foreground' : task.priority === 'medium' ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'}>{task.priority}</Badge>
                      {candidate?.interest_level && <Badge variant="outline" className="capitalize text-xs">{candidate.interest_level}</Badge>}
                    </div>
                  </div>

                  {activeTaskId === task.id ? (
                    <div className="space-y-3 pt-2 border-t border-border/50">
                      <Select value={interestLevel} onValueChange={setInterestLevel}>
                        <SelectTrigger><SelectValue placeholder="Interest Level" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="interested">Interested</SelectItem>
                          <SelectItem value="maybe">Maybe</SelectItem>
                          <SelectItem value="not_interested">Not Interested</SelectItem>
                          <SelectItem value="no_answer">No Answer</SelectItem>
                          <SelectItem value="wrong_number">Wrong Number</SelectItem>
                        </SelectContent>
                      </Select>
                      <Textarea placeholder="Call notes…" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                      <div className="flex items-center gap-2">
                        <Checkbox id="followup" checked={followUpNeeded} onCheckedChange={(v) => setFollowUpNeeded(!!v)} />
                        <label htmlFor="followup" className="text-sm">Follow-up needed</label>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" disabled={!interestLevel || completeMutation.isPending} onClick={() => completeMutation.mutate({ taskId: task.id })}>
                          {completeMutation.isPending ? 'Saving…' : 'Complete Call'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setActiveTaskId(task.id)}>Start Call</Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
