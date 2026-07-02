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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  GraduationCap,
  Plus,
  Users,
  CheckCircle2,
  CalendarDays,
  UserPlus,
  Sparkles,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════
// UBEN Programs — program catalog & beneficiary enrollment
// ═══════════════════════════════════════════════════════════════════════

const GOLD = '#C9A84C';

const CATEGORY_OPTIONS = [
  'business',
  'workforce',
  'technology',
  'entrepreneurship',
  'community',
  'other',
] as const;
type Category = (typeof CATEGORY_OPTIONS)[number];

const CATEGORY_BADGE: Record<Category, string> = {
  business: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  workforce: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  technology: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  entrepreneurship: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  community: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  other: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30',
};

interface Program {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  participant_count: number | null;
  status: string;
  category: string | null;
  eligibility: string | null;
  how_to_apply: string | null;
  created_at: string;
  updated_at: string;
}

interface Beneficiary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  program_id: string | null;
  enrollment_date: string | null;
  status: string | null;
  outcome_notes: string | null;
  created_at: string | null;
}

const BENEFICIARY_STATUS_BADGE: Record<string, string> = {
  active: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  inactive: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30',
  dropped: 'bg-red-500/15 text-red-300 border-red-500/30',
};

function categoryBadge(cat: string | null) {
  const key = (cat ?? 'other') as Category;
  const cls = CATEGORY_BADGE[key] ?? CATEGORY_BADGE.other;
  return (
    <Badge variant="outline" className={`${cls} capitalize`}>
      {cat ?? 'other'}
    </Badge>
  );
}

function statusBadge(status: string) {
  const cls =
    status === 'active'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30';
  return (
    <Badge variant="outline" className={`${cls} capitalize`}>
      {status}
    </Badge>
  );
}

export default function UbenPrograms() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addBeneficiaryOpen, setAddBeneficiaryOpen] = useState(false);

  // Add-program form
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'business' as Category,
    status: 'active',
    eligibility: '',
    how_to_apply: '',
  });

  // Add-beneficiary form
  const [benForm, setBenForm] = useState({
    name: '',
    email: '',
    phone: '',
    enrollment_date: new Date().toISOString().slice(0, 10),
    status: 'active',
  });

  // ── Queries ──────────────────────────────────────────────────────────
  const { data: programs = [], isLoading } = useQuery({
    queryKey: ['uben_programs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uben_programs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Program[];
    },
  });

  const { data: completedCount = 0 } = useQuery({
    queryKey: ['uben_beneficiaries', 'completed_count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('uben_beneficiaries')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');
      if (error) throw error;
      return count ?? 0;
    },
  });

  const selected = useMemo(
    () => programs.find((p) => p.id === selectedId) ?? null,
    [programs, selectedId]
  );

  const { data: participants = [] } = useQuery({
    queryKey: ['uben_beneficiaries', 'by_program', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uben_beneficiaries')
        .select('*')
        .eq('program_id', selectedId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Beneficiary[];
    },
  });

  // ── Derived stats ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const yearStart = new Date();
    yearStart.setMonth(0, 1);
    yearStart.setHours(0, 0, 0, 0);
    return {
      active: programs.filter((p) => p.status === 'active').length,
      totalParticipants: programs.reduce((acc, p) => acc + (p.participant_count ?? 0), 0),
      completed: completedCount,
      thisYear: programs.filter((p) => parseISO(p.created_at) >= yearStart).length,
    };
  }, [programs, completedCount]);

  // ── Mutations ────────────────────────────────────────────────────────
  const addProgram = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Program name is required');
      const { error } = await supabase.from('uben_programs').insert({
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        status: form.status,
        eligibility: form.eligibility.trim() || null,
        how_to_apply: form.how_to_apply.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Program created');
      qc.invalidateQueries({ queryKey: ['uben_programs'] });
      setAddOpen(false);
      setForm({
        name: '',
        description: '',
        category: 'business',
        status: 'active',
        eligibility: '',
        how_to_apply: '',
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProgramField = useMutation({
    mutationFn: async (payload: { id: string; patch: Partial<Program> }) => {
      const { error } = await supabase
        .from('uben_programs')
        .update(payload.patch)
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uben_programs'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleDeactivate = useMutation({
    mutationFn: async (payload: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('uben_programs')
        .update({ status: payload.active ? 'active' : 'inactive' })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uben_programs'] });
      toast.success('Program status updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addBeneficiary = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('No program selected');
      if (!benForm.name.trim()) throw new Error('Name is required');

      const { error: insErr } = await supabase.from('uben_beneficiaries').insert({
        name: benForm.name.trim(),
        email: benForm.email.trim() || null,
        phone: benForm.phone.trim() || null,
        program_id: selected.id,
        enrollment_date: benForm.enrollment_date || null,
        status: benForm.status,
      });
      if (insErr) throw insErr;

      const { error: updErr } = await supabase
        .from('uben_programs')
        .update({ participant_count: (selected.participant_count ?? 0) + 1 })
        .eq('id', selected.id);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast.success('Beneficiary enrolled');
      qc.invalidateQueries({ queryKey: ['uben_programs'] });
      qc.invalidateQueries({ queryKey: ['uben_beneficiaries'] });
      setAddBeneficiaryOpen(false);
      setBenForm({
        name: '',
        email: '',
        phone: '',
        enrollment_date: new Date().toISOString().slice(0, 10),
        status: 'active',
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${GOLD}22`, border: `1px solid ${GOLD}55` }}
          >
            <GraduationCap className="h-5 w-5" style={{ color: GOLD }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">UBEN Programs</h1>
            <p className="text-sm text-neutral-400">
              Manage program catalog, participants, and outcomes.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          style={{ backgroundColor: GOLD, color: '#0a0a0a' }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Program
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Programs" value={stats.active} icon={<Sparkles className="h-4 w-4" />} />
        <StatCard
          label="Total Participants"
          value={stats.totalParticipants}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Programs This Year"
          value={stats.thisYear}
          icon={<CalendarDays className="h-4 w-4" />}
        />
      </div>

      {/* Program grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full bg-neutral-800/60" />
          ))}
        </div>
      ) : programs.length === 0 ? (
        <Card className="bg-neutral-900/60 border-neutral-800">
          <CardContent className="py-16 text-center text-neutral-400">
            <GraduationCap className="h-8 w-8 mx-auto mb-3 opacity-60" />
            <p className="font-medium">No programs yet.</p>
            <p className="text-sm mt-1 mb-4">
              Add your first UBEN program to start tracking participants and outcomes.
            </p>
            <Button
              onClick={() => setAddOpen(true)}
              style={{ backgroundColor: GOLD, color: '#0a0a0a' }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Program
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.map((p) => (
            <Card
              key={p.id}
              className="bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 transition-colors flex flex-col"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold text-neutral-100 leading-tight">
                    {p.name}
                  </CardTitle>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {categoryBadge(p.category)}
                  {statusBadge(p.status)}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between gap-4">
                <p className="text-sm text-neutral-400 line-clamp-2 min-h-[2.5rem]">
                  {p.description ?? 'No description'}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-neutral-500" />
                    <span className="font-medium" style={{ color: GOLD }}>
                      {p.participant_count ?? 0}
                    </span>
                    <span className="text-neutral-500">participants</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-neutral-700"
                    onClick={() => setSelectedId(p.id)}
                  >
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add program modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-neutral-100 max-w-lg">
          <DialogHeader>
            <DialogTitle>New Program</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Create a new UBEN program.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-neutral-900 border-neutral-800"
                placeholder="e.g. Workforce Readiness Bootcamp"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="bg-neutral-900 border-neutral-800 min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as Category })}
                >
                  <SelectTrigger className="bg-neutral-900 border-neutral-800 capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger className="bg-neutral-900 border-neutral-800 capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Eligibility</Label>
              <Textarea
                value={form.eligibility}
                onChange={(e) => setForm({ ...form, eligibility: e.target.value })}
                className="bg-neutral-900 border-neutral-800 min-h-[70px]"
                placeholder="Who can join this program"
              />
            </div>
            <div>
              <Label>How to Apply</Label>
              <Textarea
                value={form.how_to_apply}
                onChange={(e) => setForm({ ...form, how_to_apply: e.target.value })}
                className="bg-neutral-900 border-neutral-800 min-h-[70px]"
                placeholder="Application steps"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} className="border-neutral-700">
              Cancel
            </Button>
            <Button
              onClick={() => addProgram.mutate()}
              disabled={addProgram.isPending || !form.name.trim()}
              style={{ backgroundColor: GOLD, color: '#0a0a0a' }}
            >
              Create Program
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail slide-over */}
      <Sheet
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <SheetContent className="w-full sm:max-w-xl bg-neutral-950 border-neutral-800 text-neutral-100 overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-neutral-100">{selected.name}</SheetTitle>
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {categoryBadge(selected.category)}
                  {statusBadge(selected.status)}
                  <span className="text-xs text-neutral-400">
                    Created {format(parseISO(selected.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </SheetHeader>

              <Tabs defaultValue="details" className="mt-5">
                <TabsList className="bg-neutral-800/60">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="participants">
                    Participants ({participants.length})
                  </TabsTrigger>
                </TabsList>

                {/* Details tab */}
                <TabsContent value="details" className="space-y-4 mt-4">
                  <InlineText
                    label="Name"
                    value={selected.name}
                    onSave={(v) =>
                      updateProgramField.mutateAsync({ id: selected.id, patch: { name: v } })
                    }
                  />
                  <InlineTextarea
                    label="Description"
                    value={selected.description ?? ''}
                    onSave={(v) =>
                      updateProgramField.mutateAsync({
                        id: selected.id,
                        patch: { description: v || null },
                      })
                    }
                  />
                  <InlineSelect
                    label="Category"
                    value={(selected.category ?? 'other') as string}
                    options={CATEGORY_OPTIONS as readonly string[]}
                    onSave={(v) =>
                      updateProgramField.mutateAsync({
                        id: selected.id,
                        patch: { category: v },
                      })
                    }
                  />
                  <InlineTextarea
                    label="Eligibility"
                    value={selected.eligibility ?? ''}
                    onSave={(v) =>
                      updateProgramField.mutateAsync({
                        id: selected.id,
                        patch: { eligibility: v || null },
                      })
                    }
                  />
                  <InlineTextarea
                    label="How to Apply"
                    value={selected.how_to_apply ?? ''}
                    onSave={(v) =>
                      updateProgramField.mutateAsync({
                        id: selected.id,
                        patch: { how_to_apply: v || null },
                      })
                    }
                  />

                  <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
                    <div>
                      <div className="text-sm font-medium">Active</div>
                      <div className="text-xs text-neutral-500">
                        Deactivate to hide from active program lists
                      </div>
                    </div>
                    <Switch
                      checked={selected.status === 'active'}
                      onCheckedChange={(checked) =>
                        toggleDeactivate.mutate({ id: selected.id, active: checked })
                      }
                    />
                  </div>
                </TabsContent>

                {/* Participants tab */}
                <TabsContent value="participants" className="mt-4 space-y-3">
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => setAddBeneficiaryOpen(true)}
                      style={{ backgroundColor: GOLD, color: '#0a0a0a' }}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Beneficiary
                    </Button>
                  </div>

                  {participants.length === 0 ? (
                    <div className="py-10 text-center text-neutral-400 text-sm">
                      No participants enrolled yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-neutral-800 hover:bg-transparent">
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Enrolled</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Outcome</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {participants.map((b) => (
                            <TableRow key={b.id} className="border-neutral-800">
                              <TableCell className="font-medium">{b.name}</TableCell>
                              <TableCell className="text-sm text-neutral-300">
                                {b.email ?? '—'}
                              </TableCell>
                              <TableCell className="text-sm text-neutral-400">
                                {b.enrollment_date
                                  ? format(parseISO(b.enrollment_date), 'MMM d, yyyy')
                                  : '—'}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`capitalize ${
                                    BENEFICIARY_STATUS_BADGE[b.status ?? 'active'] ??
                                    BENEFICIARY_STATUS_BADGE.active
                                  }`}
                                >
                                  {b.status ?? 'active'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-neutral-400 max-w-[180px] truncate">
                                {b.outcome_notes ?? '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Add beneficiary modal */}
      <Dialog open={addBeneficiaryOpen} onOpenChange={setAddBeneficiaryOpen}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Add Beneficiary</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Enroll a participant in {selected?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={benForm.name}
                onChange={(e) => setBenForm({ ...benForm, name: e.target.value })}
                className="bg-neutral-900 border-neutral-800"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={benForm.email}
                  onChange={(e) => setBenForm({ ...benForm, email: e.target.value })}
                  className="bg-neutral-900 border-neutral-800"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={benForm.phone}
                  onChange={(e) => setBenForm({ ...benForm, phone: e.target.value })}
                  className="bg-neutral-900 border-neutral-800"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Enrollment Date</Label>
                <Input
                  type="date"
                  value={benForm.enrollment_date}
                  onChange={(e) =>
                    setBenForm({ ...benForm, enrollment_date: e.target.value })
                  }
                  className="bg-neutral-900 border-neutral-800"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={benForm.status}
                  onValueChange={(v) => setBenForm({ ...benForm, status: v })}
                >
                  <SelectTrigger className="bg-neutral-900 border-neutral-800 capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="dropped">Dropped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddBeneficiaryOpen(false)}
              className="border-neutral-700"
            >
              Cancel
            </Button>
            <Button
              onClick={() => addBeneficiary.mutate()}
              disabled={addBeneficiary.isPending || !benForm.name.trim()}
              style={{ backgroundColor: GOLD, color: '#0a0a0a' }}
            >
              Enroll
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

function InlineText({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (v: string) => Promise<unknown>;
}) {
  const [v, setV] = useState(value);
  return (
    <div className="space-y-1">
      <Label className="text-xs text-neutral-500 uppercase tracking-wide">{label}</Label>
      <Input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          if (v !== value) onSave(v).then(() => toast.success(`${label} saved`));
        }}
        className="bg-neutral-900 border-neutral-800"
      />
    </div>
  );
}

function InlineTextarea({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (v: string) => Promise<unknown>;
}) {
  const [v, setV] = useState(value);
  return (
    <div className="space-y-1">
      <Label className="text-xs text-neutral-500 uppercase tracking-wide">{label}</Label>
      <Textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          if (v !== value) onSave(v).then(() => toast.success(`${label} saved`));
        }}
        className="bg-neutral-900 border-neutral-800 min-h-[80px]"
      />
    </div>
  );
}

function InlineSelect({
  label,
  value,
  options,
  onSave,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onSave: (v: string) => Promise<unknown>;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-neutral-500 uppercase tracking-wide">{label}</Label>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v !== value) onSave(v).then(() => toast.success(`${label} saved`));
        }}
      >
        <SelectTrigger className="bg-neutral-900 border-neutral-800 capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o} className="capitalize">
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
