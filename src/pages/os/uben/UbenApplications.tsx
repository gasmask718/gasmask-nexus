import { useState, useMemo } from 'react';
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Users,
  Mail,
  Phone,
  Clock,
  CheckCircle2,
  XCircle,
  UserPlus,
  Inbox,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════
// UBEN Applications Manager — ambassador application intake & review
// ═══════════════════════════════════════════════════════════════════════

const GOLD = '#C9A84C';

type TabKey = 'all' | 'applied' | 'reviewing' | 'approved' | 'denied';

interface Application {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  business_unit_interest: string | null;
  referred_by: string | null;
  application_status: string;
  assigned_staff_id: string | null;
  notes: string | null;
  created_at: string;
}

interface Program {
  id: string;
  name: string;
  status: string | null;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  applied: { label: 'Applied', className: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  reviewing: { label: 'Reviewing', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  approved: { label: 'Approved', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  denied: { label: 'Denied', className: 'bg-red-500/15 text-red-300 border-red-500/30' },
};

function statusBadge(status: string) {
  const cfg = STATUS_BADGE[status] ?? {
    label: status,
    className: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30',
  };
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}

function daysWaitingCell(createdAt: string, status: string) {
  const days = differenceInDays(new Date(), parseISO(createdAt));
  const isPending = status === 'applied' || status === 'reviewing';
  let color = 'text-neutral-300';
  if (isPending && days > 14) color = 'text-red-400 font-semibold';
  else if (isPending && days > 7) color = 'text-amber-300 font-semibold';
  return <span className={color}>{days}d</span>;
}

export default function UbenApplications() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [denyOpen, setDenyOpen] = useState(false);
  const [denyReason, setDenyReason] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [noteDraft, setNoteDraft] = useState('');

  // ── Applications list ────────────────────────────────────────────────
  const { data: apps = [], isLoading } = useQuery({
    queryKey: ['uben_ambassador_applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uben_ambassador_applications')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Application[];
    },
  });

  // ── Active programs (for assignment) ─────────────────────────────────
  const { data: programs = [] } = useQuery({
    queryKey: ['uben_programs', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uben_programs')
        .select('id, name, status')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return (data ?? []) as Program[];
    },
  });

  const selected = useMemo(
    () => apps.find((a) => a.id === selectedId) ?? null,
    [apps, selectedId]
  );

  // ── Derived stats ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = apps.length;
    const pending = apps.filter((a) => a.application_status === 'applied').length;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const approvedThisMonth = apps.filter(
      (a) => a.application_status === 'approved' && parseISO(a.created_at) >= monthStart
    ).length;
    const nonApplied = apps.filter((a) => a.application_status !== 'applied');
    const avgDays =
      nonApplied.length === 0
        ? null
        : Math.round(
            (nonApplied.reduce(
              (acc, a) => acc + differenceInDays(new Date(), parseISO(a.created_at)),
              0
            ) /
              nonApplied.length) *
              10
          ) / 10;
    return { total, pending, approvedThisMonth, avgDays };
  }, [apps]);

  // ── Filtered list ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = apps;
    if (tab !== 'all') list = list.filter((a) => a.application_status === tab);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((a) =>
        [a.first_name, a.last_name, a.email, a.phone, a.business_unit_interest, a.referred_by]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    return list;
  }, [apps, tab, search]);

  // ── Mutations ────────────────────────────────────────────────────────
  const updateStatus = useMutation({
    mutationFn: async (payload: { id: string; status: string; notes?: string | null }) => {
      const patch: Record<string, unknown> = { application_status: payload.status };
      if (payload.notes !== undefined) patch.notes = payload.notes;
      const { error } = await supabase
        .from('uben_ambassador_applications')
        .update(patch)
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uben_ambassador_applications'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNotes = useMutation({
    mutationFn: async (payload: { id: string; notes: string }) => {
      const { error } = await supabase
        .from('uben_ambassador_applications')
        .update({ notes: payload.notes })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Notes saved');
      qc.invalidateQueries({ queryKey: ['uben_ambassador_applications'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enrollBeneficiary = useMutation({
    mutationFn: async (payload: { app: Application; programId: string }) => {
      const fullName = `${payload.app.first_name} ${payload.app.last_name}`.trim();
      const { error: insErr } = await supabase.from('uben_beneficiaries').insert({
        name: fullName,
        email: payload.app.email,
        program_id: payload.programId,
        enrollment_date: new Date().toISOString().slice(0, 10),
        status: 'active',
      });
      if (insErr) throw insErr;

      // Increment participant_count on the program
      const { data: prog, error: progErr } = await supabase
        .from('uben_programs')
        .select('participant_count')
        .eq('id', payload.programId)
        .single();
      if (progErr) throw progErr;
      const { error: bumpErr } = await supabase
        .from('uben_programs')
        .update({ participant_count: (prog?.participant_count ?? 0) + 1 })
        .eq('id', payload.programId);
      if (bumpErr) throw bumpErr;

      if (payload.app.application_status !== 'approved') {
        const { error: updErr } = await supabase
          .from('uben_ambassador_applications')
          .update({ application_status: 'approved' })
          .eq('id', payload.app.id);
        if (updErr) throw updErr;
      }
    },
    onSuccess: () => {
      toast.success('Enrolled in program & marked approved');
      qc.invalidateQueries({ queryKey: ['uben_ambassador_applications'] });
      qc.invalidateQueries({ queryKey: ['uben_beneficiaries'] });
      qc.invalidateQueries({ queryKey: ['uben_programs'] });
      setAssignOpen(false);
      setSelectedProgram('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Handlers ─────────────────────────────────────────────────────────
  const openApp = (id: string) => {
    const a = apps.find((x) => x.id === id);
    setSelectedId(id);
    setNoteDraft(a?.notes ?? '');
  };

  const handleApprove = () => {
    if (!selected) return;
    updateStatus.mutate(
      { id: selected.id, status: 'approved' },
      { onSuccess: () => toast.success('Application approved') }
    );
  };

  const handleReviewing = () => {
    if (!selected) return;
    updateStatus.mutate(
      { id: selected.id, status: 'reviewing' },
      { onSuccess: () => toast.success('Marked as reviewing') }
    );
  };

  const handleDenyConfirm = () => {
    if (!selected) return;
    if (denyReason.trim().length < 10) {
      toast.error('Please provide a reason of at least 10 characters');
      return;
    }
    const stamp = format(new Date(), 'MMM d, yyyy · h:mm a');
    const combined = [selected.notes?.trim(), `[${stamp}] Denied: ${denyReason.trim()}`]
      .filter(Boolean)
      .join('\n\n');
    updateStatus.mutate(
      { id: selected.id, status: 'denied', notes: combined },
      {
        onSuccess: () => {
          toast.success('Application denied');
          setDenyOpen(false);
          setDenyReason('');
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${GOLD}22`, border: `1px solid ${GOLD}55` }}
            >
              <Users className="h-5 w-5" style={{ color: GOLD }} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Ambassador Applications</h1>
              <p className="text-sm text-neutral-400">
                Review incoming applicants and enroll approved candidates into programs.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Applications" value={stats.total} icon={<Inbox className="h-4 w-4" />} />
        <StatCard label="Pending Review" value={stats.pending} icon={<Clock className="h-4 w-4" />} />
        <StatCard
          label="Approved This Month"
          value={stats.approvedThisMonth}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Avg Response (days)"
          value={stats.avgDays ?? '—'}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Toolbar */}
      <Card className="bg-neutral-900/60 border-neutral-800">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
            <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
              <TabsList className="bg-neutral-800/60">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="applied">Applied</TabsTrigger>
                <TabsTrigger value="reviewing">Reviewing</TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="denied">Denied</TabsTrigger>
              </TabsList>
            </Tabs>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone, interest…"
              className="md:w-80 bg-neutral-950 border-neutral-800"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-neutral-800/60" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-neutral-400">
              <Inbox className="h-8 w-8 mx-auto mb-3 opacity-60" />
              <p className="font-medium">No applications yet.</p>
              <p className="text-sm mt-1">
                Applications submitted through the UBEN public site will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-neutral-800 hover:bg-transparent">
                    <TableHead>Applicant</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Interest</TableHead>
                    <TableHead>Referred By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Waiting</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow
                      key={a.id}
                      className="border-neutral-800 cursor-pointer hover:bg-neutral-800/40"
                      onClick={() => openApp(a.id)}
                    >
                      <TableCell className="font-medium">
                        {a.first_name} {a.last_name}
                      </TableCell>
                      <TableCell className="text-sm text-neutral-300">
                        <div className="flex flex-col">
                          {a.email && <span>{a.email}</span>}
                          {a.phone && <span className="text-neutral-400">{a.phone}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.business_unit_interest ?? <span className="text-neutral-500">—</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.referred_by ?? <span className="text-neutral-500">—</span>}
                      </TableCell>
                      <TableCell>{statusBadge(a.application_status)}</TableCell>
                      <TableCell>{daysWaitingCell(a.created_at, a.application_status)}</TableCell>
                      <TableCell className="text-sm text-neutral-400">
                        {format(parseISO(a.created_at), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail slide-over */}
      <Sheet
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setNoteDraft('');
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-lg bg-neutral-950 border-neutral-800 text-neutral-100 overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-neutral-100">
                  {selected.first_name} {selected.last_name}
                </SheetTitle>
                <div className="flex items-center gap-2 pt-1">
                  {statusBadge(selected.application_status)}
                  <span className="text-xs text-neutral-400">
                    Submitted {format(parseISO(selected.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                <section className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wide text-neutral-500">Contact</h3>
                  <div className="text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-neutral-500" />
                      {selected.email ?? <span className="text-neutral-500">No email</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-neutral-500" />
                      {selected.phone ?? <span className="text-neutral-500">No phone</span>}
                    </div>
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wide text-neutral-500">Application</h3>
                  <DetailRow
                    label="Program Interest"
                    value={selected.business_unit_interest ?? '—'}
                  />
                  <DetailRow label="Referred By" value={selected.referred_by ?? '—'} />
                  <DetailRow
                    label="Assigned Staff"
                    value={selected.assigned_staff_id ?? 'Unassigned'}
                  />
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wide text-neutral-500">
                    Internal Notes
                  </h3>
                  <Textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Add internal notes about this applicant…"
                    className="min-h-[110px] bg-neutral-900 border-neutral-800"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={saveNotes.isPending || noteDraft === (selected.notes ?? '')}
                      onClick={() => saveNotes.mutate({ id: selected.id, notes: noteDraft })}
                    >
                      Save Notes
                    </Button>
                  </div>
                </section>

                <section className="space-y-2 pt-2 border-t border-neutral-800">
                  <h3 className="text-xs uppercase tracking-wide text-neutral-500">Actions</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="border-neutral-700"
                      onClick={handleReviewing}
                      disabled={updateStatus.isPending || selected.application_status === 'reviewing'}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Mark Reviewing
                    </Button>
                    <Button
                      onClick={handleApprove}
                      disabled={updateStatus.isPending || selected.application_status === 'approved'}
                      style={{ backgroundColor: GOLD, color: '#0a0a0a' }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="border-neutral-700"
                      onClick={() => setAssignOpen(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Enroll in Program
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setDenyReason('');
                        setDenyOpen(true);
                      }}
                      disabled={selected.application_status === 'denied'}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Deny
                    </Button>
                  </div>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Deny modal */}
      <Dialog open={denyOpen} onOpenChange={setDenyOpen}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Deny Application</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Provide a reason (minimum 10 characters). It will be appended to the internal notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              placeholder="Explain why this application is being denied…"
              className="min-h-[110px] bg-neutral-900 border-neutral-800"
            />
            <p className="text-xs text-neutral-500">{denyReason.trim().length} / 10 min</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyOpen(false)} className="border-neutral-700">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDenyConfirm}
              disabled={updateStatus.isPending || denyReason.trim().length < 10}
            >
              Confirm Deny
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enroll modal */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Enroll in Program</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Select an active program. This creates a beneficiary record and marks the
              application as approved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Active Program</Label>
            <Select value={selectedProgram} onValueChange={setSelectedProgram}>
              <SelectTrigger className="bg-neutral-900 border-neutral-800">
                <SelectValue placeholder="Select a program…" />
              </SelectTrigger>
              <SelectContent>
                {programs.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-neutral-500">No active programs</div>
                ) : (
                  programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignOpen(false)}
              className="border-neutral-700"
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                selected &&
                selectedProgram &&
                enrollBeneficiary.mutate({ app: selected, programId: selectedProgram })
              }
              disabled={!selectedProgram || enrollBeneficiary.isPending}
              style={{ backgroundColor: GOLD, color: '#0a0a0a' }}
            >
              Confirm Enrollment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Small subcomponents ────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="bg-neutral-900/60 border-neutral-800">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium text-neutral-400">{label}</CardTitle>
        <span className="text-neutral-500">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold" style={{ color: GOLD }}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm gap-4">
      <span className="text-neutral-400">{label}</span>
      <span className="text-neutral-100 text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}
