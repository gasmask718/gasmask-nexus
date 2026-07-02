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
  HandHeart,
  Plus,
  Users,
  DollarSign,
  Repeat,
  TrendingUp,
  AlertTriangle,
  Mail,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNowStrict, differenceInDays } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════
// UBEN Donors — CRM & donation ledger
// ═══════════════════════════════════════════════════════════════════════

const GOLD = '#C9A84C';

const DONOR_TYPES = ['individual', 'corporate', 'foundation', 'government'] as const;
type DonorType = (typeof DONOR_TYPES)[number];

const DONATION_TYPES = ['one_time', 'monthly', 'annual', 'in_kind'] as const;
type DonationType = (typeof DONATION_TYPES)[number];

interface Donor {
  id: string;
  donor_name: string;
  donor_email: string | null;
  donor_phone: string | null;
  donor_type: string | null;
  total_donated: number | null;
  first_donation_date: string | null;
  last_donation_date: string | null;
  is_recurring: boolean | null;
  notes: string | null;
  created_at: string | null;
}

interface Donation {
  id: string;
  donor_id: string | null;
  donor_name: string | null;
  donor_email: string | null;
  amount: number;
  donation_type: string | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
}

function currency(n: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(n ?? 0));
}

function typeBadge(t: string | null) {
  const key = (t ?? 'individual') as DonorType;
  const cls =
    key === 'individual'
      ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
      : key === 'corporate'
      ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
      : key === 'government'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : ''; // foundation → gold inline
  if (key === 'foundation') {
    return (
      <Badge
        variant="outline"
        style={{ backgroundColor: `${GOLD}22`, borderColor: `${GOLD}66`, color: GOLD }}
        className="capitalize"
      >
        {key}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={`${cls} capitalize`}>
      {t ?? 'individual'}
    </Badge>
  );
}

function donationStatusBadge(s: string | null) {
  const cls =
    s === 'completed'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : s === 'pending'
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
      : s === 'failed' || s === 'refunded'
      ? 'bg-red-500/15 text-red-300 border-red-500/30'
      : 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30';
  return (
    <Badge variant="outline" className={`${cls} capitalize`}>
      {s ?? 'unknown'}
    </Badge>
  );
}

function donationTypeBadge(t: string | null) {
  return (
    <Badge variant="outline" className="bg-neutral-500/15 text-neutral-300 border-neutral-700 capitalize">
      {(t ?? 'one_time').replace('_', ' ')}
    </Badge>
  );
}

function daysSinceCell(dateStr: string | null) {
  if (!dateStr) return <span className="text-neutral-500 text-sm">—</span>;
  const d = differenceInDays(new Date(), parseISO(dateStr));
  let cls = 'text-neutral-400';
  if (d > 180) cls = 'text-red-400 font-semibold';
  else if (d > 90) cls = 'text-amber-300 font-semibold';
  return <span className={`text-sm ${cls}`}>{d}d</span>;
}

type TabKey = 'all' | 'individual' | 'corporate' | 'foundation' | 'recurring';

export default function UbenDonors() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addDonationOpen, setAddDonationOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const [donorForm, setDonorForm] = useState({
    donor_name: '',
    donor_email: '',
    donor_phone: '',
    donor_type: 'individual' as DonorType,
    notes: '',
  });

  const [donationForm, setDonationForm] = useState({
    amount: 0,
    donation_type: 'one_time' as DonationType,
    notes: '',
  });

  // ── Donors query ─────────────────────────────────────────────────────
  const { data: donors = [], isLoading } = useQuery({
    queryKey: ['uben_donors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uben_donors')
        .select('*')
        .order('total_donated', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Donor[];
    },
  });

  const selected = useMemo(
    () => donors.find((d) => d.id === selectedId) ?? null,
    [donors, selectedId]
  );

  // ── Donations for selected donor ─────────────────────────────────────
  const { data: donations = [] } = useQuery({
    queryKey: ['uben_donations', 'by_donor', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uben_donations')
        .select('*')
        .eq('donor_id', selectedId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Donation[];
    },
  });

  // ── Derived stats ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = donors.length;
    const totalDonated = donors.reduce((a, d) => a + Number(d.total_donated ?? 0), 0);
    const recurring = donors.filter((d) => d.is_recurring).length;
    const withGiving = donors.filter((d) => Number(d.total_donated ?? 0) > 0);
    const avg =
      withGiving.length === 0
        ? 0
        : withGiving.reduce((a, d) => a + Number(d.total_donated ?? 0), 0) / withGiving.length;
    return { total, totalDonated, recurring, avg };
  }, [donors]);

  // ── Lapsed recurring donors ──────────────────────────────────────────
  const lapsedCount = useMemo(
    () =>
      donors.filter(
        (d) =>
          d.is_recurring &&
          d.last_donation_date &&
          differenceInDays(new Date(), parseISO(d.last_donation_date)) > 180
      ).length,
    [donors]
  );

  // ── Filter tabs + search ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = donors;
    if (tab === 'recurring') list = list.filter((d) => d.is_recurring);
    else if (tab !== 'all') list = list.filter((d) => (d.donor_type ?? 'individual') === tab);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((d) =>
        [d.donor_name, d.donor_email, d.donor_phone]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    return list;
  }, [donors, tab, search]);

  // ── Mutations ────────────────────────────────────────────────────────
  const addDonor = useMutation({
    mutationFn: async () => {
      if (!donorForm.donor_name.trim()) throw new Error('Donor name is required');
      const { error } = await supabase.from('uben_donors').insert({
        donor_name: donorForm.donor_name.trim(),
        donor_email: donorForm.donor_email.trim() || null,
        donor_phone: donorForm.donor_phone.trim() || null,
        donor_type: donorForm.donor_type,
        notes: donorForm.notes.trim() || null,
        total_donated: 0,
        is_recurring: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Donor added');
      qc.invalidateQueries({ queryKey: ['uben_donors'] });
      setAddOpen(false);
      setDonorForm({
        donor_name: '',
        donor_email: '',
        donor_phone: '',
        donor_type: 'individual',
        notes: '',
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateDonorField = useMutation({
    mutationFn: async (payload: { id: string; patch: Partial<Donor> }) => {
      const { error } = await supabase
        .from('uben_donors')
        .update(payload.patch)
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['uben_donors'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const addDonation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('No donor selected');
      if (!donationForm.amount || donationForm.amount < 1)
        throw new Error('Amount must be at least $1');

      // Step 1 — insert donation
      const { error: insErr } = await supabase.from('uben_donations').insert({
        donor_id: selected.id,
        donor_name: selected.donor_name,
        donor_email: selected.donor_email,
        amount: donationForm.amount,
        donation_type: donationForm.donation_type,
        status: 'completed',
        notes: donationForm.notes.trim() || null,
      });
      if (insErr) throw insErr;

      // Step 2 — update donor rollup
      const nextTotal = Number(selected.total_donated ?? 0) + Number(donationForm.amount);
      const patch: Partial<Donor> = {
        total_donated: nextTotal,
        last_donation_date: new Date().toISOString().slice(0, 10),
      };
      if (donationForm.donation_type === 'monthly') patch.is_recurring = true;
      if (!selected.first_donation_date) {
        patch.first_donation_date = new Date().toISOString().slice(0, 10);
      }
      const { error: updErr } = await supabase
        .from('uben_donors')
        .update(patch)
        .eq('id', selected.id);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast.success('Donation recorded');
      qc.invalidateQueries({ queryKey: ['uben_donors'] });
      qc.invalidateQueries({ queryKey: ['uben_donations'] });
      setAddDonationOpen(false);
      setDonationForm({ amount: 0, donation_type: 'one_time', notes: '' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openDonor = (id: string) => {
    const d = donors.find((x) => x.id === id);
    setSelectedId(id);
    setNoteDraft(d?.notes ?? '');
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${GOLD}22`, border: `1px solid ${GOLD}55` }}
          >
            <HandHeart className="h-5 w-5" style={{ color: GOLD }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">UBEN Donors</h1>
            <p className="text-sm text-neutral-400">
              Donor CRM, giving history, and recurring pipeline.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          style={{ backgroundColor: GOLD, color: '#0a0a0a' }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Donor
        </Button>
      </div>

      {/* Lapsed banner */}
      {lapsedCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-300 mt-0.5" />
          <div className="text-sm text-amber-200">
            <span className="font-semibold">{lapsedCount}</span>{' '}
            recurring {lapsedCount === 1 ? 'donor has' : 'donors have'} not donated in 6+ months. Review their status.
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Donors" value={stats.total} icon={<Users className="h-4 w-4" />} />
        <StatCard
          label="Total Donated"
          value={currency(stats.totalDonated)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          label="Recurring Donors"
          value={stats.recurring}
          icon={<Repeat className="h-4 w-4" />}
        />
        <StatCard
          label="Avg Donation"
          value={currency(stats.avg)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* Table */}
      <Card className="bg-neutral-900/60 border-neutral-800">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
            <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
              <TabsList className="bg-neutral-800/60">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="individual">Individual</TabsTrigger>
                <TabsTrigger value="corporate">Corporate</TabsTrigger>
                <TabsTrigger value="foundation">Foundation</TabsTrigger>
                <TabsTrigger value="recurring">Recurring</TabsTrigger>
              </TabsList>
            </Tabs>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone…"
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
              <HandHeart className="h-8 w-8 mx-auto mb-3 opacity-60" />
              <p className="font-medium">No donors yet.</p>
              <p className="text-sm mt-1 mb-4">
                Add your first donor or connect your donation form to start tracking contributions.
              </p>
              <Button
                onClick={() => setAddOpen(true)}
                style={{ backgroundColor: GOLD, color: '#0a0a0a' }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Donor
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-neutral-800 hover:bg-transparent">
                    <TableHead>Donor</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Total Donated</TableHead>
                    <TableHead>Last Donation</TableHead>
                    <TableHead>Recurring</TableHead>
                    <TableHead>Days Since</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => (
                    <TableRow
                      key={d.id}
                      className="border-neutral-800 cursor-pointer hover:bg-neutral-800/40"
                      onClick={() => openDonor(d.id)}
                    >
                      <TableCell className="font-medium">{d.donor_name}</TableCell>
                      <TableCell className="text-sm text-neutral-300">
                        {d.donor_email ?? <span className="text-neutral-500">—</span>}
                      </TableCell>
                      <TableCell>{typeBadge(d.donor_type)}</TableCell>
                      <TableCell className="text-right font-semibold" style={{ color: GOLD }}>
                        {currency(d.total_donated)}
                      </TableCell>
                      <TableCell className="text-sm text-neutral-400">
                        {d.last_donation_date
                          ? formatDistanceToNowStrict(parseISO(d.last_donation_date), {
                              addSuffix: true,
                            })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {d.is_recurring ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          >
                            <Repeat className="h-3 w-3 mr-1" />
                            Monthly
                          </Badge>
                        ) : (
                          <span className="text-neutral-600 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>{daysSinceCell(d.last_donation_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add donor modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Add Donor</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Create a donor CRM record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={donorForm.donor_name}
                onChange={(e) => setDonorForm({ ...donorForm, donor_name: e.target.value })}
                className="bg-neutral-900 border-neutral-800"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={donorForm.donor_email}
                  onChange={(e) => setDonorForm({ ...donorForm, donor_email: e.target.value })}
                  className="bg-neutral-900 border-neutral-800"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={donorForm.donor_phone}
                  onChange={(e) => setDonorForm({ ...donorForm, donor_phone: e.target.value })}
                  className="bg-neutral-900 border-neutral-800"
                />
              </div>
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={donorForm.donor_type}
                onValueChange={(v) => setDonorForm({ ...donorForm, donor_type: v as DonorType })}
              >
                <SelectTrigger className="bg-neutral-900 border-neutral-800 capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DONOR_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={donorForm.notes}
                onChange={(e) => setDonorForm({ ...donorForm, notes: e.target.value })}
                className="bg-neutral-900 border-neutral-800 min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} className="border-neutral-700">
              Cancel
            </Button>
            <Button
              onClick={() => addDonor.mutate()}
              disabled={addDonor.isPending || !donorForm.donor_name.trim()}
              style={{ backgroundColor: GOLD, color: '#0a0a0a' }}
            >
              Add Donor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        <SheetContent className="w-full sm:max-w-xl bg-neutral-950 border-neutral-800 text-neutral-100 overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-neutral-100">{selected.donor_name}</SheetTitle>
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {typeBadge(selected.donor_type)}
                  {selected.is_recurring && (
                    <Badge
                      variant="outline"
                      className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    >
                      <Repeat className="h-3 w-3 mr-1" />
                      Monthly
                    </Badge>
                  )}
                  <span className="text-xs text-neutral-400">
                    Total given{' '}
                    <span className="font-semibold" style={{ color: GOLD }}>
                      {currency(selected.total_donated)}
                    </span>
                  </span>
                </div>
              </SheetHeader>

              <div className="mt-5 space-y-5">
                {/* Editable fields */}
                <section className="space-y-3">
                  <h3 className="text-xs uppercase tracking-wide text-neutral-500">Contact</h3>
                  <InlineText
                    label="Name"
                    value={selected.donor_name}
                    onSave={(v) =>
                      updateDonorField.mutateAsync({
                        id: selected.id,
                        patch: { donor_name: v },
                      })
                    }
                  />
                  <InlineText
                    label="Email"
                    value={selected.donor_email ?? ''}
                    onSave={(v) =>
                      updateDonorField.mutateAsync({
                        id: selected.id,
                        patch: { donor_email: v || null },
                      })
                    }
                  />
                  <InlineText
                    label="Phone"
                    value={selected.donor_phone ?? ''}
                    onSave={(v) =>
                      updateDonorField.mutateAsync({
                        id: selected.id,
                        patch: { donor_phone: v || null },
                      })
                    }
                  />
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wide text-neutral-500">Notes</h3>
                  <Textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Internal notes about this donor…"
                    className="bg-neutral-900 border-neutral-800 min-h-[90px]"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={
                        updateDonorField.isPending || noteDraft === (selected.notes ?? '')
                      }
                      onClick={() =>
                        updateDonorField.mutate(
                          { id: selected.id, patch: { notes: noteDraft || null } },
                          { onSuccess: () => toast.success('Notes saved') }
                        )
                      }
                    >
                      Save Notes
                    </Button>
                  </div>
                </section>

                {/* Actions */}
                <section className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800">
                  <Button
                    variant="outline"
                    className="border-neutral-700"
                    onClick={() =>
                      toast.info(
                        'Email feature coming soon — connect Resend to enable donor notifications'
                      )
                    }
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Send Thank You Email
                  </Button>
                  <Button
                    onClick={() => setAddDonationOpen(true)}
                    style={{ backgroundColor: GOLD, color: '#0a0a0a' }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Manual Donation
                  </Button>
                </section>

                {/* Donation history */}
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase tracking-wide text-neutral-500">
                      Donation History
                    </h3>
                    <span className="text-xs text-neutral-500">
                      {donations.length} {donations.length === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>
                  {donations.length === 0 ? (
                    <div className="text-sm text-neutral-500 py-4 text-center">
                      No donations recorded yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-neutral-800 hover:bg-transparent">
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {donations.map((d) => (
                            <TableRow key={d.id} className="border-neutral-800">
                              <TableCell className="text-sm text-neutral-400">
                                {d.created_at
                                  ? format(parseISO(d.created_at), 'MMM d, yyyy')
                                  : '—'}
                              </TableCell>
                              <TableCell
                                className="text-right font-semibold"
                                style={{ color: GOLD }}
                              >
                                {currency(d.amount)}
                              </TableCell>
                              <TableCell>{donationTypeBadge(d.donation_type)}</TableCell>
                              <TableCell>{donationStatusBadge(d.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Add manual donation modal */}
      <Dialog open={addDonationOpen} onOpenChange={setAddDonationOpen}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Add Manual Donation</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Record a donation for {selected?.donor_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount (USD) *</Label>
              <Input
                type="number"
                min={1}
                step="0.01"
                value={donationForm.amount}
                onChange={(e) =>
                  setDonationForm({ ...donationForm, amount: Number(e.target.value) })
                }
                className="bg-neutral-900 border-neutral-800"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={donationForm.donation_type}
                onValueChange={(v) =>
                  setDonationForm({ ...donationForm, donation_type: v as DonationType })
                }
              >
                <SelectTrigger className="bg-neutral-900 border-neutral-800 capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DONATION_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={donationForm.notes}
                onChange={(e) => setDonationForm({ ...donationForm, notes: e.target.value })}
                className="bg-neutral-900 border-neutral-800 min-h-[70px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDonationOpen(false)}
              className="border-neutral-700"
            >
              Cancel
            </Button>
            <Button
              onClick={() => addDonation.mutate()}
              disabled={addDonation.isPending || !donationForm.amount || donationForm.amount < 1}
              style={{ backgroundColor: GOLD, color: '#0a0a0a' }}
            >
              Record Donation
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
