/**
 * AmbassadorTasks — Personal task list for the logged-in ambassador.
 *
 * READS: ambassador_tasks WHERE ambassador_name = current ambassador's name.
 * Open tasks sort by due date (soonest first, undated last); overdue rows are
 * highlighted red. Done tasks collapse into a muted section at the bottom.
 *
 * WRITES: inserts carry ambassador_name + ambassador_id + created_by.
 * Marking done sets is_done, done_at, and an optional outcome.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentAmbassador } from '@/hooks/useAmbassadorComms';
import { useAmbassadorPortfolio } from '@/hooks/useAmbassadorPortfolio';
import { AmbassadorLayout } from '@/components/ambassador/AmbassadorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ClipboardList, Plus, Loader2, Phone, Store, User, Calendar, CheckCircle2, Circle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const TASK_TYPES = ['general', 'call', 'visit', 'collect', 'followup', 'wholesale_lead'] as const;

interface AmbassadorTask {
  id: string;
  ambassador_name: string;
  ambassador_id: string | null;
  task: string;
  task_type: string | null;
  store_id: string | null;
  person_to_talk_to: string | null;
  phone: string | null;
  due_date: string | null;
  priority: number | null;
  is_done: boolean | null;
  done_at: string | null;
  outcome: string | null;
  created_at: string | null;
}

const TYPE_BADGE: Record<string, string> = {
  general: 'bg-muted text-muted-foreground border-border',
  call: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  visit: 'bg-green-500/15 text-green-600 border-green-500/30',
  collect: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  followup: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
  wholesale_lead: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/30',
};

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

export default function AmbassadorTasks() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const ambQ = useCurrentAmbassador();
  const ambassador = ambQ.data;
  const { stores } = useAmbassadorPortfolio();

  const [addOpen, setAddOpen] = useState(false);
  const [doneTarget, setDoneTarget] = useState<AmbassadorTask | null>(null);
  const [outcome, setOutcome] = useState('');
  const [form, setForm] = useState({
    task: '',
    task_type: 'general',
    store_id: '',
    person_to_talk_to: '',
    phone: '',
    due_date: '',
    priority: '3',
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['ambassador-tasks', ambassador?.name],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_tasks')
        .select('*')
        .eq('ambassador_name', ambassador!.name!)
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as AmbassadorTask[];
    },
    enabled: !!ambassador?.name,
  });

  const storeNameById = useMemo(
    () => new Map(stores.map((s) => [s.store_id, s.store_name])),
    [stores],
  );

  const { open, done } = useMemo(() => {
    const open: AmbassadorTask[] = [];
    const done: AmbassadorTask[] = [];
    for (const t of tasks) (t.is_done ? done : open).push(t);
    return { open, done };
  }, [tasks]);

  const addTask = useMutation({
    mutationFn: async () => {
      if (!form.task.trim()) throw new Error('Task text is required');
      if (!ambassador?.name) throw new Error('Ambassador not resolved');
      const { error } = await supabase.from('ambassador_tasks').insert({
        ambassador_name: ambassador.name,
        ambassador_id: ambassador.id,
        task: form.task.trim(),
        task_type: form.task_type,
        store_id: form.store_id || null,
        person_to_talk_to: form.person_to_talk_to.trim() || null,
        phone: form.phone.trim() || null,
        due_date: form.due_date || null,
        priority: Number(form.priority) || 3,
        created_by: user?.id ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Task added');
      setAddOpen(false);
      setForm({ task: '', task_type: 'general', store_id: '', person_to_talk_to: '', phone: '', due_date: '', priority: '3' });
      qc.invalidateQueries({ queryKey: ['ambassador-tasks', ambassador?.name] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to add task'),
  });

  const markDone = useMutation({
    mutationFn: async ({ task, outcome }: { task: AmbassadorTask; outcome: string }) => {
      const { error } = await supabase
        .from('ambassador_tasks')
        .update({
          is_done: true,
          done_at: new Date().toISOString(),
          outcome: outcome.trim() || null,
        } as any)
        .eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Task marked done');
      setDoneTarget(null);
      setOutcome('');
      qc.invalidateQueries({ queryKey: ['ambassador-tasks', ambassador?.name] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update task'),
  });

  const isOverdue = (t: AmbassadorTask) =>
    !t.is_done && !!t.due_date && t.due_date < todayStr();

  const renderTask = (t: AmbassadorTask) => {
    const overdue = isOverdue(t);
    return (
      <li
        key={t.id}
        className={`rounded-md border px-3 py-2 ${
          overdue
            ? 'border-destructive/50 bg-destructive/10'
            : t.is_done
              ? 'border-border/40 bg-muted/30 opacity-60'
              : 'border-border/40 bg-background/40'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            {t.is_done ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
            ) : (
              <Circle className={`h-4 w-4 mt-0.5 shrink-0 ${overdue ? 'text-destructive' : 'text-muted-foreground'}`} />
            )}
            <div className="min-w-0">
              <p className={`text-sm break-words ${t.is_done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {t.task}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${TYPE_BADGE[t.task_type || 'general'] || TYPE_BADGE.general}`}>
                  {(t.task_type || 'general').replace('_', ' ')}
                </Badge>
                {t.due_date && (
                  <span className={`inline-flex items-center gap-1 ${overdue ? 'text-destructive font-semibold' : ''}`}>
                    <Calendar className="h-3 w-3" />
                    {overdue ? 'OVERDUE · ' : ''}{format(new Date(t.due_date + 'T00:00:00'), 'MMM d, yyyy')}
                  </span>
                )}
                {t.store_id && storeNameById.get(t.store_id) && (
                  <span className="inline-flex items-center gap-1">
                    <Store className="h-3 w-3" />{storeNameById.get(t.store_id)}
                  </span>
                )}
                {t.person_to_talk_to && (
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3 w-3" />{t.person_to_talk_to}
                  </span>
                )}
                {t.phone && (
                  <a href={`tel:${t.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                    <Phone className="h-3 w-3" />{t.phone}
                  </a>
                )}
              </div>
              {t.is_done && t.outcome && (
                <p className="mt-1 text-[11px] italic text-muted-foreground">Outcome: {t.outcome}</p>
              )}
            </div>
          </div>
          {!t.is_done && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 shrink-0 text-xs"
              onClick={() => { setDoneTarget(t); setOutcome(''); }}
            >
              Done
            </Button>
          )}
        </div>
      </li>
    );
  };

  return (
    <AmbassadorLayout title="My Tasks" subtitle="Your personal follow-ups, calls and visits">
      <Card className="glass-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-primary" />
            Open tasks
            {open.length > 0 && <Badge variant="secondary">{open.length}</Badge>}
          </CardTitle>
          <Button size="sm" onClick={() => setAddOpen(true)} disabled={!ambassador}>
            <Plus className="h-4 w-4 mr-1" /> Add task
          </Button>
        </CardHeader>
        <CardContent>
          {ambQ.isLoading || isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : !ambassador ? (
            <p className="text-sm italic text-muted-foreground">No ambassador profile found for this account.</p>
          ) : open.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">No open tasks. Add one above.</p>
          ) : (
            <ul className="space-y-2">{open.map(renderTask)}</ul>
          )}

          {done.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Completed ({done.length})
              </p>
              <ul className="space-y-2">{done.map(renderTask)}</ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add task */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a task</DialogTitle>
            <DialogDescription>Free text, optionally linked to a store, person and due date.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="task-text">Task</Label>
              <Textarea
                id="task-text"
                value={form.task}
                onChange={(e) => setForm((f) => ({ ...f, task: e.target.value }))}
                placeholder="e.g. Call Ahmed about the September invoice"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.task_type} onValueChange={(v) => setForm((f) => ({ ...f, task_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Priority (1–5)</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['1', '2', '3', '4', '5'].map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Store (optional)</Label>
              <Select value={form.store_id} onValueChange={(v) => setForm((f) => ({ ...f, store_id: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="No store" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No store</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.store_id} value={s.store_id}>{s.store_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="task-person">Person to talk to</Label>
                <Input
                  id="task-person"
                  value={form.person_to_talk_to}
                  onChange={(e) => setForm((f) => ({ ...f, person_to_talk_to: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="task-phone">Phone</Label>
                <Input
                  id="task-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => addTask.mutate()} disabled={addTask.isPending || !form.task.trim()}>
              {addTask.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Add task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark done */}
      <Dialog open={!!doneTarget} onOpenChange={(o) => !o && setDoneTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark task done</DialogTitle>
            <DialogDescription className="break-words">{doneTarget?.task}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="task-outcome">Outcome (optional)</Label>
            <Textarea
              id="task-outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="e.g. Spoke to Ahmed — paying Friday"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDoneTarget(null)}>Cancel</Button>
            <Button
              onClick={() => doneTarget && markDone.mutate({ task: doneTarget, outcome })}
              disabled={markDone.isPending}
            >
              {markDone.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Mark done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AmbassadorLayout>
  );
}
