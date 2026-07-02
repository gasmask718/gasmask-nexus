import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  Plus,
  Download,
  Settings,
  Save,
} from 'lucide-react';

const GOLD = '#C9A84C';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
interface CommissionConfig {
  id: string;
  business_unit: string;
  ambassador_commission_rate: number;
  staff_override_rate: number;
  updated_at: string;
}

interface CommissionLedgerRow {
  id: string;
  sale_date: string;
  ambassador_id: string;
  business_unit: string;
  sale_type: string;
  sale_amount: number;
  ambassador_commission: number;
  staff_override_amount: number;
  staff_recruiter_id: string | null;
  status: string;
  created_at: string;
}

interface Ambassador {
  id: string;
  full_name: string | null;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
const fmtMoney = (n: number | null | undefined) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(n || 0));

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const shortId = (id: string | null | undefined) =>
  id ? id.slice(0, 8) : '—';

const statusBadge = (status: string) => {
  const s = status?.toLowerCase() || 'pending';
  if (s === 'paid') return <Badge className="bg-emerald-600 hover:bg-emerald-600">Paid</Badge>;
  if (s === 'approved') return <Badge className="bg-blue-600 hover:bg-blue-600">Approved</Badge>;
  if (s === 'cancelled' || s === 'canceled')
    return <Badge variant="secondary">Cancelled</Badge>;
  return <Badge className="bg-amber-600 hover:bg-amber-600">Pending</Badge>;
};

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────
export default function UbenCommissions() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  // ── Queries ──
  const configQuery = useQuery({
    queryKey: ['uben_commission_config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uben_commission_config' as any)
        .select('*')
        .order('business_unit');
      if (error) throw error;
      return (data || []) as unknown as CommissionConfig[];
    },
  });

  const ledgerQuery = useQuery({
    queryKey: ['uben_commission_ledger'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uben_commission_ledger' as any)
        .select('*')
        .order('sale_date', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CommissionLedgerRow[];
    },
  });

  const ambassadorsQuery = useQuery({
    queryKey: ['uben_ambassadors_min'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uben_ambassadors' as any)
        .select('id, full_name')
        .order('full_name');
      if (error) throw error;
      return (data || []) as unknown as Ambassador[];
    },
  });

  const ambassadorMap = useMemo(() => {
    const m = new Map<string, string>();
    (ambassadorsQuery.data || []).forEach((a) => {
      m.set(a.id, a.full_name || shortId(a.id));
    });
    return m;
  }, [ambassadorsQuery.data]);

  const ambassadorName = (id: string | null | undefined) => {
    if (!id) return '—';
    return ambassadorMap.get(id) || shortId(id);
  };

  // ── Stats ──
  const stats = useMemo(() => {
    const rows = ledgerQuery.data || [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const total = rows.reduce(
      (s, r) => s + Number(r.ambassador_commission || 0) + Number(r.staff_override_amount || 0),
      0
    );
    const thisMonth = rows
      .filter((r) => new Date(r.sale_date) >= monthStart)
      .reduce(
        (s, r) => s + Number(r.ambassador_commission || 0) + Number(r.staff_override_amount || 0),
        0
      );
    const pending = rows
      .filter((r) => r.status === 'pending')
      .reduce(
        (s, r) => s + Number(r.ambassador_commission || 0) + Number(r.staff_override_amount || 0),
        0
      );
    const paid = rows
      .filter((r) => r.status === 'paid')
      .reduce(
        (s, r) => s + Number(r.ambassador_commission || 0) + Number(r.staff_override_amount || 0),
        0
      );
    return { total, thisMonth, pending, paid };
  }, [ledgerQuery.data]);

  const filteredLedger = useMemo(() => {
    const rows = ledgerQuery.data || [];
    if (statusFilter === 'all') return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [ledgerQuery.data, statusFilter]);

  // ── Mutations ──
  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('uben_commission_ledger' as any)
        .update({ status: 'paid' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uben_commission_ledger'] });
      toast.success('Marked as paid');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to mark paid'),
  });

  const updateConfig = useMutation({
    mutationFn: async (rows: CommissionConfig[]) => {
      for (const r of rows) {
        const { error } = await supabase
          .from('uben_commission_config' as any)
          .update({
            ambassador_commission_rate: r.ambassador_commission_rate,
            staff_override_rate: r.staff_override_rate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', r.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uben_commission_config'] });
      toast.success('Commission rates updated');
      setConfigOpen(false);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update config'),
  });

  const addEntry = useMutation({
    mutationFn: async (payload: Partial<CommissionLedgerRow>) => {
      const { error } = await supabase
        .from('uben_commission_ledger' as any)
        .insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uben_commission_ledger'] });
      toast.success('Commission entry added');
      setAddOpen(false);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to add entry'),
  });

  // ── Export ──
  const exportCSV = () => {
    const rows = ledgerQuery.data || [];
    if (rows.length === 0) {
      toast.error('No commissions to export');
      return;
    }
    const headers = [
      'sale_date',
      'ambassador',
      'business_unit',
      'sale_type',
      'sale_amount',
      'ambassador_commission',
      'staff_override_amount',
      'total',
      'status',
    ];
    const lines = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.sale_date,
          `"${(ambassadorName(r.ambassador_id) || '').replace(/"/g, '""')}"`,
          r.business_unit,
          r.sale_type,
          Number(r.sale_amount || 0).toFixed(2),
          Number(r.ambassador_commission || 0).toFixed(2),
          Number(r.staff_override_amount || 0).toFixed(2),
          (Number(r.ambassador_commission || 0) + Number(r.staff_override_amount || 0)).toFixed(2),
          r.status,
        ].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uben_commissions_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Exported CSV');
  };

  // ── Errors ──
  if (configQuery.error || ledgerQuery.error) {
    return (
      <div className="p-6">
        <Card className="border-red-500/40 bg-red-500/5">
          <CardContent className="p-6 text-red-500">
            Failed to load commissions:{' '}
            {(configQuery.error as any)?.message || (ledgerQuery.error as any)?.message}
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = configQuery.isLoading || ledgerQuery.isLoading;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: GOLD }}>
            UBEN Commissions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ambassador earnings, staff overrides, and rate configuration.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => setConfigOpen(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Configure Rates
          </Button>
          <Button
            onClick={() => setAddOpen(true)}
            style={{ backgroundColor: GOLD, color: '#000' }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Manual Entry
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<DollarSign className="w-5 h-5" style={{ color: GOLD }} />}
          label="Total Commissions"
          value={fmtMoney(stats.total)}
          loading={isLoading}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" style={{ color: GOLD }} />}
          label="This Month"
          value={fmtMoney(stats.thisMonth)}
          loading={isLoading}
        />
        <StatCard
          icon={<Clock className="w-5 h-5" style={{ color: GOLD }} />}
          label="Pending Payout"
          value={fmtMoney(stats.pending)}
          loading={isLoading}
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5" style={{ color: GOLD }} />}
          label="Paid Out"
          value={fmtMoney(stats.paid)}
          loading={isLoading}
        />
      </div>

      {/* Rate config summary */}
      <Card className="border" style={{ borderColor: `${GOLD}44` }}>
        <CardHeader>
          <CardTitle className="text-base" style={{ color: GOLD }}>
            Active Commission Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (configQuery.data || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No rate config found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(configQuery.data || []).map((c) => (
                <div
                  key={c.id}
                  className="border rounded-md p-3 bg-card"
                  style={{ borderColor: `${GOLD}33` }}
                >
                  <div className="font-medium">{c.business_unit}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Ambassador:{' '}
                    <span className="font-semibold" style={{ color: GOLD }}>
                      {Number(c.ambassador_commission_rate)}%
                    </span>{' '}
                    · Staff override:{' '}
                    <span className="font-semibold" style={{ color: GOLD }}>
                      {Number(c.staff_override_rate)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ledger */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg" style={{ color: GOLD }}>
              Commission Ledger
            </CardTitle>
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filteredLedger.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No commission entries yet. Add a manual entry or wait for sales to sync.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Ambassador</TableHead>
                    <TableHead>Business Unit</TableHead>
                    <TableHead>Sale Type</TableHead>
                    <TableHead className="text-right">Sale</TableHead>
                    <TableHead className="text-right">Ambassador</TableHead>
                    <TableHead className="text-right">Staff Override</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLedger.map((r) => {
                    const total =
                      Number(r.ambassador_commission || 0) +
                      Number(r.staff_override_amount || 0);
                    return (
                      <TableRow key={r.id}>
                        <TableCell>{fmtDate(r.sale_date)}</TableCell>
                        <TableCell>{ambassadorName(r.ambassador_id)}</TableCell>
                        <TableCell>{r.business_unit}</TableCell>
                        <TableCell className="capitalize">{r.sale_type}</TableCell>
                        <TableCell className="text-right">
                          {fmtMoney(r.sale_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtMoney(r.ambassador_commission)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtMoney(r.staff_override_amount)}
                        </TableCell>
                        <TableCell
                          className="text-right font-semibold"
                          style={{ color: GOLD }}
                        >
                          {fmtMoney(total)}
                        </TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell className="text-right">
                          {r.status !== 'paid' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={markPaid.isPending}
                              onClick={() => markPaid.mutate(r.id)}
                            >
                              Mark Paid
                            </Button>
                          )}
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

      {/* Add manual entry */}
      <AddEntryDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        ambassadors={ambassadorsQuery.data || []}
        businessUnits={(configQuery.data || []).map((c) => c.business_unit)}
        submitting={addEntry.isPending}
        onSubmit={(payload) => addEntry.mutate(payload)}
      />

      {/* Configure rates */}
      <ConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        config={configQuery.data || []}
        submitting={updateConfig.isPending}
        onSubmit={(rows) => updateConfig.mutate(rows)}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Stat card
// ────────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <Card className="border" style={{ borderColor: `${GOLD}33` }}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="mt-2 text-2xl font-bold" style={{ color: GOLD }}>
          {loading ? <Skeleton className="h-7 w-28" /> : value}
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// Add entry dialog
// ────────────────────────────────────────────────────────────
function AddEntryDialog({
  open,
  onOpenChange,
  ambassadors,
  businessUnits,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ambassadors: Ambassador[];
  businessUnits: string[];
  submitting: boolean;
  onSubmit: (payload: any) => void;
}) {
  const [form, setForm] = useState({
    sale_date: new Date().toISOString().split('T')[0],
    ambassador_id: '',
    business_unit: '',
    sale_type: 'sale',
    sale_amount: '',
    ambassador_commission: '',
    staff_override_amount: '',
    status: 'pending',
  });

  const reset = () =>
    setForm({
      sale_date: new Date().toISOString().split('T')[0],
      ambassador_id: '',
      business_unit: '',
      sale_type: 'sale',
      sale_amount: '',
      ambassador_commission: '',
      staff_override_amount: '',
      status: 'pending',
    });

  const submit = () => {
    if (!form.ambassador_id) {
      toast.error('Select an ambassador');
      return;
    }
    if (!form.business_unit) {
      toast.error('Select a business unit');
      return;
    }
    if (!form.sale_amount || Number(form.sale_amount) <= 0) {
      toast.error('Enter a valid sale amount');
      return;
    }
    onSubmit({
      sale_date: form.sale_date,
      ambassador_id: form.ambassador_id,
      business_unit: form.business_unit,
      sale_type: form.sale_type || 'sale',
      sale_amount: Number(form.sale_amount),
      ambassador_commission: Number(form.ambassador_commission || 0),
      staff_override_amount: Number(form.staff_override_amount || 0),
      status: form.status,
    });
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle style={{ color: GOLD }}>Add Manual Commission Entry</DialogTitle>
          <DialogDescription>
            Record a commission not captured by an automated sale sync.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-1">
            <Label>Sale Date</Label>
            <Input
              type="date"
              value={form.sale_date}
              onChange={(e) => setForm({ ...form, sale_date: e.target.value })}
            />
          </div>
          <div className="col-span-1">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Ambassador</Label>
            <Select
              value={form.ambassador_id}
              onValueChange={(v) => setForm({ ...form, ambassador_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select ambassador" />
              </SelectTrigger>
              <SelectContent>
                {ambassadors.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.full_name || shortId(a.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1">
            <Label>Business Unit</Label>
            <Select
              value={form.business_unit}
              onValueChange={(v) => setForm({ ...form, business_unit: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {businessUnits.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1">
            <Label>Sale Type</Label>
            <Input
              value={form.sale_type}
              onChange={(e) => setForm({ ...form, sale_type: e.target.value })}
              placeholder="sale, booking, donation…"
            />
          </div>
          <div className="col-span-2">
            <Label>Sale Amount ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.sale_amount}
              onChange={(e) => setForm({ ...form, sale_amount: e.target.value })}
            />
          </div>
          <div className="col-span-1">
            <Label>Ambassador Commission ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.ambassador_commission}
              onChange={(e) =>
                setForm({ ...form, ambassador_commission: e.target.value })
              }
            />
          </div>
          <div className="col-span-1">
            <Label>Staff Override ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.staff_override_amount}
              onChange={(e) =>
                setForm({ ...form, staff_override_amount: e.target.value })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={submitting}
            onClick={submit}
            style={{ backgroundColor: GOLD, color: '#000' }}
          >
            {submitting ? 'Saving…' : 'Add Entry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────
// Config dialog
// ────────────────────────────────────────────────────────────
function ConfigDialog({
  open,
  onOpenChange,
  config,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  config: CommissionConfig[];
  submitting: boolean;
  onSubmit: (rows: CommissionConfig[]) => void;
}) {
  const [rows, setRows] = useState<CommissionConfig[]>(config);

  // Sync when opened
  useMemo(() => {
    if (open) setRows(config);
  }, [open, config]);

  const update = (id: string, patch: Partial<CommissionConfig>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle style={{ color: GOLD }}>Configure Commission Rates</DialogTitle>
          <DialogDescription>
            Rates apply to future sales. Existing ledger entries are not recalculated.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No business units configured.</p>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end border rounded-md p-3"
                style={{ borderColor: `${GOLD}33` }}
              >
                <div>
                  <Label className="text-xs text-muted-foreground">Business Unit</Label>
                  <div className="font-medium mt-1">{r.business_unit}</div>
                </div>
                <div>
                  <Label>Ambassador %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={r.ambassador_commission_rate}
                    onChange={(e) =>
                      update(r.id, {
                        ambassador_commission_rate: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Staff Override %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={r.staff_override_rate}
                    onChange={(e) =>
                      update(r.id, {
                        staff_override_rate: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={submitting || rows.length === 0}
            onClick={() => onSubmit(rows)}
            style={{ backgroundColor: GOLD, color: '#000' }}
          >
            <Save className="w-4 h-4 mr-2" />
            {submitting ? 'Saving…' : 'Save Rates'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
