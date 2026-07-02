import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShieldCheck,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Calendar as CalendarIcon,
  Clock,
  Pencil,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════
// UBEN Compliance — deadlines, filings, governance calendar
// ═══════════════════════════════════════════════════════════════════════

const GOLD = '#C9A84C';

type ComplianceRow = {
  id: string;
  title: string;
  due_date: string;
  category: string;
  notes: string | null;
  status: string;
  created_at: string;
};

const CATEGORY_OPTIONS = [
  'tax',
  'registration',
  'grant',
  'governance',
  'reporting',
  'filings',
  'other',
];

const categoryClass = (raw: string) => {
  const c = (raw || '').toLowerCase();
  switch (c) {
    case 'tax':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    case 'registration':
      return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    case 'grant':
      return 'border text-[#C9A84C] border-[#C9A84C]/40 bg-[#C9A84C]/10';
    case 'governance':
      return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    case 'reporting':
    case 'reports':
      return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
    case 'filings':
      return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
    default:
      return 'bg-zinc-700/40 text-zinc-300 border-zinc-600/40';
  }
};

const statusClass = (s: string) => {
  switch (s) {
    case 'pending':
      return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
    case 'in_progress':
      return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    case 'completed':
      return 'bg-green-500/15 text-green-300 border-green-500/30';
    case 'overdue':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    default:
      return 'bg-zinc-700/40 text-zinc-300 border-zinc-600/40';
  }
};

const dueDateColor = (dueISO: string, status: string) => {
  if (status === 'completed') return 'text-zinc-500 line-through';
  const days = differenceInCalendarDays(parseISO(dueISO), new Date());
  if (days < 0) return 'text-red-400 font-semibold';
  if (days <= 30) return 'text-amber-400';
  return 'text-emerald-400';
};

const daysLabel = (dueISO: string, status: string) => {
  if (status === 'completed') return '';
  const days = differenceInCalendarDays(parseISO(dueISO), new Date());
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} late`;
  if (days === 0) return 'Due today';
  return `Due in ${days} day${days === 1 ? '' : 's'}`;
};

// ═══════════════════════════════════════════════════════════════════════

interface FormState {
  title: string;
  due_date: string;
  category: string;
  status: string;
  notes: string;
}

const emptyForm: FormState = {
  title: '',
  due_date: '',
  category: 'other',
  status: 'pending',
  notes: '',
};

export default function UbenCompliance() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const overdueSectionRef = useRef<HTMLDivElement | null>(null);

  const { data: rows, isLoading, error } = useQuery({
    queryKey: ['uben-compliance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uben_compliance_calendar')
        .select('*')
        .order('due_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ComplianceRow[];
    },
  });

  const today = new Date();

  const { overdue, dueThisMonth, upcoming90, completed, sorted, samRow, irsRow, stateRow } =
    useMemo(() => {
      const list = rows ?? [];
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const in90 = new Date();
      in90.setDate(in90.getDate() + 90);

      const overdue = list.filter(
        (r) => r.status !== 'completed' && parseISO(r.due_date) < today,
      );
      const dueThisMonth = list.filter((r) => {
        if (r.status === 'completed') return false;
        const d = parseISO(r.due_date);
        return d >= monthStart && d <= monthEnd;
      });
      const upcoming90 = list.filter((r) => {
        if (r.status === 'completed') return false;
        const d = parseISO(r.due_date);
        return d >= today && d <= in90;
      });
      const completed = list.filter((r) => r.status === 'completed');

      const sorted = [...list].sort((a, b) => {
        const aC = a.status === 'completed' ? 1 : 0;
        const bC = b.status === 'completed' ? 1 : 0;
        if (aC !== bC) return aC - bC;
        return a.due_date.localeCompare(b.due_date);
      });

      const samCandidates = list
        .filter((r) => /sam/i.test(r.title))
        .sort((a, b) => a.due_date.localeCompare(b.due_date));
      const irsCandidates = list
        .filter((r) => /990/.test(r.title))
        .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.title.localeCompare(b.title));
      const stateCandidates = list
        .filter((r) => /state/i.test(r.title) && /registr/i.test(r.title))
        .sort((a, b) => a.due_date.localeCompare(b.due_date));

      return {
        overdue,
        dueThisMonth,
        upcoming90,
        completed,
        sorted,
        samRow: samCandidates[0] ?? null,
        irsRow: irsCandidates[0] ?? null,
        stateRow: stateCandidates[0] ?? null,
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows]);

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('uben_compliance_calendar')
        .update({ status: 'completed' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Marked complete');
      qc.invalidateQueries({ queryKey: ['uben-compliance'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to mark complete'),
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        due_date: form.due_date,
        category: form.category,
        status: form.status,
        notes: form.notes.trim() || null,
      };
      if (!payload.title || !payload.due_date) {
        throw new Error('Title and due date are required');
      }
      if (editId) {
        const { error } = await supabase
          .from('uben_compliance_calendar')
          .update(payload)
          .eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('uben_compliance_calendar').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? 'Deadline updated' : 'Deadline added');
      qc.invalidateQueries({ queryKey: ['uben-compliance'] });
      closeModal();
    },
    onError: (e: any) => toast.error(e.message ?? 'Save failed'),
  });

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };
  const openEdit = (r: ComplianceRow) => {
    setEditId(r.id);
    setForm({
      title: r.title,
      due_date: r.due_date,
      category: (r.category || 'other').toLowerCase(),
      status: r.status,
      notes: r.notes ?? '',
    });
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setEditId(null);
    setForm(emptyForm);
  };

  const scrollToOverdue = () => {
    overdueSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-lg flex items-center justify-center"
            style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}55` }}
          >
            <ShieldCheck className="h-6 w-6" style={{ color: GOLD }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Compliance Calendar</h1>
            <p className="text-sm text-zinc-400">
              Filings, registrations, and governance deadlines for UBEN.
            </p>
          </div>
        </div>
        <Button
          onClick={openAdd}
          className="text-black"
          style={{ background: GOLD }}
        >
          <Plus className="h-4 w-4 mr-1.5" /> Add Deadline
        </Button>
      </div>

      {/* Overdue banner */}
      {overdue.length > 0 && (
        <button
          type="button"
          onClick={scrollToOverdue}
          className="w-full text-left rounded-lg border border-red-500/40 bg-red-500/10 p-4 flex items-center gap-3 hover:bg-red-500/15 transition-colors"
        >
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <div className="flex-1">
            <div className="text-red-200 font-semibold text-sm">
              {overdue.length} compliance item{overdue.length === 1 ? '' : 's'} overdue.
              Review immediately.
            </div>
            <div className="text-xs text-red-300/70 mt-0.5">Click to jump to overdue items ↓</div>
          </div>
        </button>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Overdue"
          value={isLoading ? null : overdue.length}
          tone={overdue.length > 0 ? 'red' : 'gray'}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Due This Month"
          value={isLoading ? null : dueThisMonth.length}
          tone={dueThisMonth.length > 0 ? 'amber' : 'gray'}
          icon={<CalendarIcon className="h-4 w-4" />}
        />
        <StatCard
          label="Upcoming (90 days)"
          value={isLoading ? null : upcoming90.length}
          tone="gold"
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Completed"
          value={isLoading ? null : completed.length}
          tone="green"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      {/* Special cards */}
      {(samRow || irsRow || stateRow) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {samRow && (
            <SpecialCard
              title="SAM.gov Registration"
              row={samRow}
              footer={
                <a
                  href="https://sam.gov"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs inline-flex items-center gap-1 hover:underline"
                  style={{ color: GOLD }}
                >
                  Register at sam.gov <ExternalLink className="h-3 w-3" />
                </a>
              }
            />
          )}
          {irsRow && (
            <SpecialCard
              title="IRS Form 990 Annual Filing"
              row={irsRow}
              footer={
                <span className="text-xs text-zinc-400">
                  Required annually for 501(c)(3) status maintenance
                </span>
              }
            />
          )}
          {stateRow && (
            <SpecialCard
              title="State Registration"
              row={stateRow}
              highlightOverdue
              footer={
                <span className="text-xs text-zinc-400">
                  Annual state charity / non-profit filing
                </span>
              }
            />
          )}
        </div>
      )}

      {/* Table */}
      <div ref={overdueSectionRef}>
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: GOLD }} />
              All Deadlines
            </CardTitle>
            <span className="text-xs text-zinc-500">
              {rows?.length ?? 0} item{(rows?.length ?? 0) === 1 ? '' : 's'}
            </span>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="text-sm text-red-400 py-4">
                Failed to load: {(error as any).message}
              </div>
            )}
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full bg-zinc-800/60" />
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <div className="text-center py-14">
                <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-40" style={{ color: GOLD }} />
                <p className="text-sm text-zinc-400 mb-4">
                  No compliance deadlines tracked yet. Add your first deadline to start
                  monitoring UBEN's compliance calendar.
                </p>
                <Button onClick={openAdd} className="text-black" style={{ background: GOLD }}>
                  <Plus className="h-4 w-4 mr-1.5" /> Add Deadline
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-400">Item</TableHead>
                      <TableHead className="text-zinc-400">Category</TableHead>
                      <TableHead className="text-zinc-400">Due Date</TableHead>
                      <TableHead className="text-zinc-400">Days</TableHead>
                      <TableHead className="text-zinc-400">Status</TableHead>
                      <TableHead className="text-zinc-400">Notes</TableHead>
                      <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((r) => {
                      const isOverdue =
                        r.status !== 'completed' && parseISO(r.due_date) < today;
                      return (
                        <TableRow
                          key={r.id}
                          className={`border-zinc-800 ${
                            isOverdue ? 'bg-red-500/5' : ''
                          }`}
                        >
                          <TableCell className="font-medium">{r.title}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={categoryClass(r.category)}
                            >
                              {r.category}
                            </Badge>
                          </TableCell>
                          <TableCell className={dueDateColor(r.due_date, r.status)}>
                            {format(parseISO(r.due_date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span
                              className={
                                isOverdue
                                  ? 'text-red-400 font-semibold'
                                  : r.status === 'completed'
                                  ? 'text-zinc-600'
                                  : 'text-zinc-300'
                              }
                            >
                              {daysLabel(r.due_date, r.status)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusClass(r.status)}>
                              {r.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className="max-w-[240px] truncate text-xs text-zinc-400"
                            title={r.notes ?? ''}
                          >
                            {r.notes ?? '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {r.status !== 'completed' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 border-green-500/40 text-green-300 hover:bg-green-500/10"
                                  onClick={() => completeMutation.mutate(r.id)}
                                  disabled={completeMutation.isPending}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                  Complete
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-zinc-400 hover:text-zinc-100"
                                onClick={() => openEdit(r)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => (o ? setModalOpen(true) : closeModal())}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Deadline' : 'Add Deadline'}</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Track a compliance deadline, filing, or governance milestone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="bg-zinc-900 border-zinc-800 mt-1"
                placeholder="e.g. IRS Form 990 Filing"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Due Date *</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="bg-zinc-900 border-zinc-800 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v })}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-800 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="pending">pending</SelectItem>
                  <SelectItem value="in_progress">in_progress</SelectItem>
                  <SelectItem value="completed">completed</SelectItem>
                  <SelectItem value="overdue">overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="bg-zinc-900 border-zinc-800 mt-1 min-h-[80px]"
                placeholder="Optional context, links, or checklist"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              onClick={() => upsertMutation.mutate()}
              disabled={upsertMutation.isPending || !form.title || !form.due_date}
              className="text-black"
              style={{ background: GOLD }}
            >
              {upsertMutation.isPending ? 'Saving…' : editId ? 'Save Changes' : 'Add Deadline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════

function StatCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number | null;
  tone: 'red' | 'amber' | 'gold' | 'green' | 'gray';
  icon: React.ReactNode;
}) {
  const toneMap: Record<string, string> = {
    red: 'border-red-500/40 bg-red-500/10',
    amber: 'border-amber-500/40 bg-amber-500/10',
    gold: 'border-[#C9A84C]/40 bg-[#C9A84C]/5',
    green: 'border-green-500/40 bg-green-500/5',
    gray: 'border-zinc-800 bg-zinc-900/60',
  };
  const textTone: Record<string, string> = {
    red: 'text-red-300',
    amber: 'text-amber-300',
    gold: 'text-[#C9A84C]',
    green: 'text-green-300',
    gray: 'text-zinc-400',
  };
  return (
    <Card className={`${toneMap[tone]} border`}>
      <CardContent className="p-4">
        <div className={`flex items-center gap-2 text-xs ${textTone[tone]}`}>
          {icon}
          <span className="uppercase tracking-wide">{label}</span>
        </div>
        <div className="mt-2 text-3xl font-semibold text-zinc-100">
          {value === null ? <Skeleton className="h-8 w-16 bg-zinc-800" /> : value}
        </div>
      </CardContent>
    </Card>
  );
}

function SpecialCard({
  title,
  row,
  footer,
  highlightOverdue,
}: {
  title: string;
  row: ComplianceRow;
  footer?: React.ReactNode;
  highlightOverdue?: boolean;
}) {
  const isOverdue =
    row.status !== 'completed' && parseISO(row.due_date) < new Date();
  const border =
    highlightOverdue && isOverdue
      ? 'border-red-500/60 bg-red-500/10'
      : 'border-[#C9A84C]/40 bg-[#C9A84C]/5';
  return (
    <Card className={`${border} border`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-zinc-100 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" style={{ color: GOLD }} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-4 text-xs">
          <div>
            <div className="text-zinc-500">Due</div>
            <div className={dueDateColor(row.due_date, row.status)}>
              {format(parseISO(row.due_date), 'MMM d, yyyy')}
            </div>
          </div>
          <div>
            <div className="text-zinc-500">Status</div>
            <Badge variant="outline" className={statusClass(row.status)}>
              {row.status.replace('_', ' ')}
            </Badge>
          </div>
          <div>
            <div className="text-zinc-500">Countdown</div>
            <div
              className={
                isOverdue ? 'text-red-400 font-semibold' : 'text-zinc-200'
              }
            >
              {daysLabel(row.due_date, row.status) || '—'}
            </div>
          </div>
        </div>
        {footer}
      </CardContent>
    </Card>
  );
}
