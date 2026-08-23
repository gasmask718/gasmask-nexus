/**
 * New Arrivals — every store, contact and street-captured number from the last 90 days.
 * Owner/admin/employee/staff worklist. Data: v_new_arrivals + v_new_arrivals_summary.
 * Default sort: days_since_any_contact DESC — the most neglected record is always on top.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCall } from '@/components/communication/CallProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Phone, MessageSquare, ListPlus, CheckCircle2, Loader2, AlertTriangle, UserX,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ArrivalRow {
  record_id: string;
  kind: 'STORE' | 'CONTACT' | 'QUICK CAPTURE';
  name: string;
  address: string | null;
  phone: string | null;
  contact_name: string | null;
  neighborhood: string | null;
  borough: string | null;
  created_at: string;
  status: string | null;
  days_in_system: number;
  days_since_any_contact: number;
  orders: number;
  blocker: string;
  attention: string;
  parent_store: string | null;
  captured_by: string | null;
}

type AttentionFilter =
  | 'all' | 'lingering' | 'cold' | 'chase' | 'fresh' | 'converted'
  | 'no_phone' | 'no_address';

const ATTENTION_MATCH: Record<Exclude<AttentionFilter, 'all' | 'no_phone' | 'no_address'>, string> = {
  lingering: 'LINGERING',
  cold: 'GOING COLD',
  chase: 'CHASE THIS WEEK',
  fresh: 'FRESH',
  converted: 'CONVERTED',
};

function attentionStyle(attention: string): string {
  if (attention.includes('LINGERING')) return 'bg-destructive text-destructive-foreground';
  if (attention.includes('GOING COLD')) return 'bg-amber-500 text-white';
  if (attention.includes('CHASE')) return 'bg-blue-500 text-white';
  if (attention.includes('CONVERTED')) return 'bg-green-600 text-white';
  return 'bg-muted text-muted-foreground';
}

function attentionLabel(attention: string): string {
  if (attention.includes('LINGERING')) return 'LINGERING';
  if (attention.includes('GOING COLD')) return 'GOING COLD';
  if (attention.includes('CHASE')) return 'CHASE THIS WEEK';
  if (attention.includes('CONVERTED')) return 'CONVERTED';
  return 'FRESH';
}

export default function NewArrivals() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { initiateCall } = useCall();

  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [boroughFilter, setBoroughFilter] = useState('all');
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('');
  const [unreachableOnly, setUnreachableOnly] = useState(false);
  const [search, setSearch] = useState('');

  const [textTarget, setTextTarget] = useState<ArrivalRow | null>(null);
  const [textBody, setTextBody] = useState('');
  const [taskTarget, setTaskTarget] = useState<ArrivalRow | null>(null);
  const [taskText, setTaskText] = useState('');
  const [taskDue, setTaskDue] = useState('');

  // ── Summary strip ────────────────────────────────────────────────
  const { data: summary } = useQuery({
    queryKey: ['new-arrivals-summary'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_new_arrivals_summary')
        .select('*')
        .single();
      if (error) throw error;
      return data as Record<string, number>;
    },
  });

  // ── Main table ───────────────────────────────────────────────────
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['new-arrivals'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_new_arrivals')
        .select('*')
        .order('days_since_any_contact', { ascending: false });
      if (error) throw error;
      return (data || []) as ArrivalRow[];
    },
  });

  // ── Unassigned first-contact tasks ───────────────────────────────
  const { data: unassignedTasks = [] } = useQuery({
    queryKey: ['new-arrivals-unassigned-tasks'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ambassador_tasks')
        .select('id, task, store_id, due_date')
        .is('ambassador_id', null)
        .eq('is_done', false)
        .order('due_date', { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const boroughs = useMemo(
    () => [...new Set(rows.map((r) => r.borough).filter(Boolean))].sort() as string[],
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (attentionFilter !== 'all') {
        if (attentionFilter === 'no_phone') {
          if (!r.blocker?.startsWith('NO PHONE')) return false;
        } else if (attentionFilter === 'no_address') {
          if (!r.blocker?.startsWith('NO ADDRESS')) return false;
        } else if (!r.attention?.includes(ATTENTION_MATCH[attentionFilter])) {
          return false;
        }
      }
      if (kindFilter !== 'all' && r.kind !== kindFilter) return false;
      if (boroughFilter !== 'all' && r.borough !== boroughFilter) return false;
      if (neighborhoodFilter && !(r.neighborhood || '').toLowerCase().includes(neighborhoodFilter.toLowerCase())) return false;
      if (unreachableOnly && r.blocker === 'reachable') return false;
      if (search) {
        const t = search.toLowerCase();
        if (!r.name?.toLowerCase().includes(t) && !r.phone?.includes(t) && !r.address?.toLowerCase().includes(t)) return false;
      }
      return true;
    });
  }, [rows, attentionFilter, kindFilter, boroughFilter, neighborhoodFilter, unreachableOnly, search]);

  // ── Actions ──────────────────────────────────────────────────────
  const storeIdFor = (r: ArrivalRow) => (r.kind === 'STORE' ? r.record_id : r.parent_store);

  const handleCall = (r: ArrivalRow) => {
    if (!r.phone) return;
    initiateCall({
      destinationPhone: r.phone,
      entityType: 'store',
      entityId: storeIdFor(r) || undefined,
      entityName: r.name,
    });
  };

  const textMutation = useMutation({
    mutationFn: async () => {
      if (!textTarget?.phone || !textBody.trim()) throw new Error('Missing number or message');
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          to_number: textTarget.phone,
          message_body: textBody.trim(),
          idempotency_key: `new-arrivals-${textTarget.record_id}-${Date.now()}`,
          send_class: 'conversational',
          store_id: storeIdFor(textTarget) || undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.status === 'blocked' || (data as any)?.blocked) {
        throw new Error(`Suppressed: ${(data as any).reason || 'legal STOP / suppression'}`);
      }
      return data;
    },
    onSuccess: () => {
      toast.success('Text sent');
      setTextTarget(null);
      setTextBody('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const taskMutation = useMutation({
    mutationFn: async () => {
      if (!taskTarget) return;
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from('ambassador_tasks').insert({
        ambassador_id: null, // UNASSIGNED — surfaces in the unassigned queue
        ambassador_name: 'UNASSIGNED',
        task: taskText.trim() || `First contact: ${taskTarget.name}`,
        task_type: 'first_contact',
        store_id: storeIdFor(taskTarget),
        person_to_talk_to: taskTarget.contact_name || taskTarget.name,
        phone: taskTarget.phone,
        due_date: taskDue || new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
        priority: taskTarget.attention?.includes('LINGERING') ? 'high' : 'normal',
        is_done: false,
        created_by: userData.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['new-arrivals-unassigned-tasks'] });
      toast.success('Task added (UNASSIGNED queue)');
      setTaskTarget(null);
      setTaskText('');
      setTaskDue('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const contactMutation = useMutation({
    mutationFn: async (r: ArrivalRow) => {
      const { data: userData } = await supabase.auth.getUser();
      const storeId = storeIdFor(r);
      if (storeId) {
        const { error } = await (supabase as any).from('store_notes').insert({
          store_id: storeId,
          note_text: `First contact made via New Arrivals worklist (${r.kind.toLowerCase()}).`,
          source: 'new_arrivals',
          observed_on: new Date().toISOString().slice(0, 10),
          created_by: userData.user?.id,
        });
        if (error) throw error;
      } else {
        // Quick capture with no store yet — mark the quick_contacts row itself
        const { error } = await (supabase as any)
          .from('quick_contacts')
          .update({ status: 'contacted' })
          .eq('id', r.record_id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['new-arrivals'] });
      queryClient.invalidateQueries({ queryKey: ['new-arrivals-summary'] });
      toast.success('Marked contacted — drops off the lingering list');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openRow = (r: ArrivalRow) => {
    const storeId = storeIdFor(r);
    if (storeId) navigate(`/stores/${storeId}`);
  };

  const summaryCards: { key: AttentionFilter; label: string; value: number; cls: string }[] = [
    { key: 'lingering', label: 'LINGERING 30+ DAYS', value: summary?.lingering_30_days ?? 0, cls: 'border-destructive text-destructive' },
    { key: 'cold', label: 'GOING COLD', value: summary?.going_cold ?? 0, cls: 'border-amber-500 text-amber-600' },
    { key: 'chase', label: 'CHASE THIS WEEK', value: summary?.chase_this_week ?? 0, cls: 'border-blue-500 text-blue-600' },
    { key: 'fresh', label: 'FRESH', value: summary?.fresh_today ?? 0, cls: 'border-border text-foreground' },
    { key: 'converted', label: 'CONVERTED', value: summary?.converted ?? 0, cls: 'border-green-600 text-green-600' },
    { key: 'no_phone', label: 'CANNOT BE CALLED', value: summary?.cannot_be_called ?? 0, cls: 'border-border text-muted-foreground' },
    { key: 'no_address', label: 'CANNOT BE VISITED', value: summary?.cannot_be_visited ?? 0, cls: 'border-border text-muted-foreground' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold">New Arrivals</h1>
        <p className="text-sm text-muted-foreground">
          Every store, contact and street-captured number from the last 90 days — sorted so the most neglected record is always on top.
        </p>
      </div>

      {/* Header strip — biggest problem first, each count clickable */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {summaryCards.map((c) => (
          <button
            key={c.key}
            onClick={() => setAttentionFilter(attentionFilter === c.key ? 'all' : c.key)}
            className={cn(
              'rounded-lg border-2 p-3 text-left transition-colors hover:bg-accent',
              c.cls,
              attentionFilter === c.key && 'bg-accent ring-2 ring-offset-1 ring-current',
            )}
          >
            <div className="text-2xl font-bold tabular-nums">{c.value}</div>
            <div className="text-[10px] font-semibold leading-tight">{c.label}</div>
          </button>
        ))}
      </div>

      {/* Unassigned first-contact tasks — how a store gets forgotten */}
      {unassignedTasks.length > 0 && (
        <Card className="border-destructive">
          <CardContent className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <UserX className="h-4 w-4 text-destructive" />
              <span>
                <strong>{unassignedTasks.length}</strong> first-contact task{unassignedTasks.length === 1 ? '' : 's'} sitting{' '}
                <strong>UNASSIGNED</strong>
                {unassignedTasks[0]?.due_date && <> — oldest due {unassignedTasks[0].due_date}</>}
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate('/ambassadors/tasks')}>
              Open task queue
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search name / phone / address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56 h-9"
          />
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Kind" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kinds</SelectItem>
              <SelectItem value="STORE">Stores</SelectItem>
              <SelectItem value="CONTACT">Contacts</SelectItem>
              <SelectItem value="QUICK CAPTURE">Quick captures</SelectItem>
            </SelectContent>
          </Select>
          <Select value={boroughFilter} onValueChange={setBoroughFilter}>
            <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Borough" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All boroughs</SelectItem>
              {boroughs.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            placeholder="Neighborhood…"
            value={neighborhoodFilter}
            onChange={(e) => setNeighborhoodFilter(e.target.value)}
            className="w-36 h-9"
          />
          <label className="flex items-center gap-2 text-sm ml-1">
            <Switch checked={unreachableOnly} onCheckedChange={setUnreachableOnly} />
            Cannot be reached
          </label>
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} of {rows.length} records
          </span>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[130px]">Attention</TableHead>
                <TableHead className="w-[110px]">Kind</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Neighborhood</TableHead>
                <TableHead className="text-right">Days in system</TableHead>
                <TableHead className="text-right">Days since contact</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead>Blocker</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={12} className="text-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin inline-block" />
                </TableCell></TableRow>
              ) : error ? (
                <TableRow><TableCell colSpan={12} className="text-center py-10 text-destructive">
                  {(error as Error).message}
                </TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="text-center py-10 text-muted-foreground">
                  Nothing matches these filters.
                </TableCell></TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow
                    key={`${r.kind}-${r.record_id}`}
                    className={cn('text-sm', storeIdFor(r) && 'cursor-pointer')}
                    onClick={() => openRow(r)}
                  >
                    <TableCell>
                      <Badge className={cn('text-[10px] whitespace-nowrap', attentionStyle(r.attention))}>
                        {r.attention?.includes('LINGERING') && <AlertTriangle className="h-3 w-3 mr-1" />}
                        {attentionLabel(r.attention || '')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium">{r.kind}</TableCell>
                    <TableCell className="font-medium">
                      {r.name}
                      {r.captured_by && <div className="text-[10px] text-muted-foreground">via {r.captured_by}</div>}
                    </TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate">{r.address || '—'}</TableCell>
                    <TableCell className="text-xs">{r.phone || '—'}</TableCell>
                    <TableCell className="text-xs">{r.neighborhood || r.borough || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.days_in_system}</TableCell>
                    <TableCell className={cn('text-right tabular-nums font-semibold', r.days_since_any_contact >= 30 && 'text-destructive', r.days_since_any_contact >= 14 && r.days_since_any_contact < 30 && 'text-amber-600')}>
                      {r.days_since_any_contact}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.orders}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.blocker === 'reachable' ? '—' : r.blocker}</TableCell>
                    <TableCell className="text-xs">{r.status || '—'}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5">
                        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!r.phone} title="Call" onClick={() => handleCall(r)}>
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!r.phone} title="Text" onClick={() => setTextTarget(r)}>
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Add to task list" onClick={() => { setTaskTarget(r); setTaskText(`First contact: ${r.name}`); }}>
                          <ListPlus className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Mark contacted" disabled={contactMutation.isPending} onClick={() => contactMutation.mutate(r)}>
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Text dialog */}
      <Dialog open={!!textTarget} onOpenChange={(o) => !o && setTextTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Text {textTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{textTarget?.phone}</p>
            <Textarea
              value={textBody}
              onChange={(e) => setTextBody(e.target.value)}
              placeholder="Message…"
              rows={4}
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Sent via the shared send-sms path (conversational class) — legal-STOP suppression applies.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTextTarget(null)}>Cancel</Button>
            <Button onClick={() => textMutation.mutate()} disabled={textMutation.isPending || !textBody.trim()}>
              {textMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task dialog */}
      <Dialog open={!!taskTarget} onOpenChange={(o) => !o && setTaskTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add to task list — {taskTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="na-task">Task</Label>
              <Input id="na-task" value={taskText} onChange={(e) => setTaskText(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="na-due">Due date</Label>
              <Input id="na-due" type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Store, person and phone are prefilled. Left UNASSIGNED so it surfaces in the admin queue until someone claims it.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskTarget(null)}>Cancel</Button>
            <Button onClick={() => taskMutation.mutate()} disabled={taskMutation.isPending}>
              {taskMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Add task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
