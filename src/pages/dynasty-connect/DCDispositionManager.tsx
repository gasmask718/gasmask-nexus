import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AlertTriangle, Search, CheckCircle2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const UNIT_COLORS: Record<string, string> = {
  top_tier: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
  unforgettable_times: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  surplus_funds: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  real_estate: 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30',
  dynasty_direct: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
  gasmask: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  brandaro: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
};

const CATEGORY_COLORS: Record<string, string> = {
  positive: 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30',
  negative: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  neutral: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  compliance: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
};

const SUPPORTED_UNITS = new Set([
  'top_tier', 'unforgettable_times', 'surplus_funds', 'real_estate',
  'dynasty_direct', 'gasmask', 'brandaro',
]);

type DispositionCode = {
  code: string;
  label: string;
  category: string;
  created_at: string;
};

type UnifiedLead = {
  lead_id: string;
  business_unit_key: string;
  source_table: string;
  lead_name: string | null;
  phone: string | null;
  last_disposition: string | null;
};

// --- Registry Tab ---
function DispositionRegistry() {
  const [category, setCategory] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newCategory, setNewCategory] = useState<string>('neutral');
  const qc = useQueryClient();

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ['dc-disposition-codes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dc_disposition_codes')
        .select('code, label, category, created_at')
        .order('category')
        .order('code');
      if (error) throw error;
      return (data ?? []) as DispositionCode[];
    },
  });

  const filtered = category === 'all' ? codes : codes.filter((c) => c.category === category);

  const addCode = useMutation({
    mutationFn: async () => {
      const codeNorm = newCode.trim().toLowerCase();
      if (!/^[a-z0-9_]+$/.test(codeNorm)) {
        throw new Error('Code must be lowercase letters, numbers, and underscores only.');
      }
      if (!newLabel.trim()) throw new Error('Label is required.');
      const { error } = await supabase.from('dc_disposition_codes').insert({
        code: codeNorm,
        label: newLabel.trim(),
        category: newCategory,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Disposition code added');
      setDialogOpen(false);
      setNewCode(''); setNewLabel(''); setNewCategory('neutral');
      qc.invalidateQueries({ queryKey: ['dc-disposition-codes'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Disposition Codes Registry</CardTitle>
          <CardDescription>
            Canonical dispositions available across all Dynasty Connect business units.
          </CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Code</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Disposition Code</DialogTitle>
              <DialogDescription className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>This code will be available across all business units. Use canonical codes only.</span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Code (lowercase, underscores)</Label>
                <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="e.g. call_back_later" />
              </div>
              <div>
                <Label>Label</Label>
                <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Human-readable label" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => addCode.mutate()} disabled={addCode.isPending}>
                {addCode.isPending ? 'Adding…' : 'Add Code'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Tabs value={category} onValueChange={setCategory} className="mb-4">
          <TabsList>
            <TabsTrigger value="all">All ({codes.length})</TabsTrigger>
            <TabsTrigger value="positive">Positive</TabsTrigger>
            <TabsTrigger value="negative">Negative</TabsTrigger>
            <TabsTrigger value="neutral">Neutral</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>
        </Tabs>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={4} className="text-muted-foreground text-center py-6">Loading…</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-muted-foreground text-center py-6">No codes in this category.</TableCell></TableRow>
            )}
            {filtered.map((c) => (
              <TableRow key={c.code}>
                <TableCell className="font-mono text-xs">{c.code}</TableCell>
                <TableCell>{c.label}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={CATEGORY_COLORS[c.category] ?? ''}>{c.category}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {c.created_at ? formatDistanceToNow(new Date(c.created_at), { addSuffix: true }) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// --- Manual Override Tab ---
function ManualOverride() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<UnifiedLead | null>(null);
  const [newDisp, setNewDisp] = useState<string>('');
  const [reason, setReason] = useState('');
  const [lastResult, setLastResult] = useState<{ old: string | null; next: string; name: string | null } | null>(null);
  const qc = useQueryClient();

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['dc-disp-search', search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const term = search.replace(/[%,()]/g, '').trim();
      const { data, error } = await supabase
        .from('dc_unified_leads')
        .select('lead_id, business_unit_key, source_table, lead_name, phone, last_disposition')
        .or(`lead_name.ilike.%${term}%,phone.ilike.%${term}%`)
        .limit(25);
      if (error) throw error;
      return (data ?? []) as UnifiedLead[];
    },
  });

  const { data: codes = [] } = useQuery({
    queryKey: ['dc-disposition-codes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dc_disposition_codes')
        .select('code, label, category')
        .order('category')
        .order('code');
      if (error) throw error;
      return (data ?? []) as { code: string; label: string; category: string }[];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('No lead selected');
      if (!newDisp) throw new Error('Select a new disposition');
      if (reason.trim().length < 10) throw new Error('Reason must be at least 10 characters');
      if (!SUPPORTED_UNITS.has(selected.business_unit_key)) {
        throw new Error(`Business unit "${selected.business_unit_key}" is not supported for manual override yet.`);
      }
      const { data, error } = await supabase.functions.invoke('dc-manual-disposition', {
        body: {
          lead_id: selected.lead_id,
          business_unit_key: selected.business_unit_key,
          new_disposition: newDisp,
          reason: reason.trim(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { old_disposition: string | null; new_disposition: string };
    },
    onSuccess: (data) => {
      setLastResult({ old: data.old_disposition, next: data.new_disposition, name: selected?.lead_name ?? null });
      setSelected(null);
      setNewDisp('');
      setReason('');
      qc.invalidateQueries({ queryKey: ['dc-disp-search'] });
      qc.invalidateQueries({ queryKey: ['dc-unified-leads'] });
      toast.success('Disposition overridden');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Find Lead</CardTitle>
          <CardDescription>Search by lead name or phone (min 2 chars).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="border rounded-md max-h-[420px] overflow-auto">
            {isFetching && <div className="p-3 text-sm text-muted-foreground">Searching…</div>}
            {!isFetching && search.trim().length >= 2 && results.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">No matches.</div>
            )}
            {results.map((r) => (
              <button
                key={`${r.source_table}-${r.lead_id}`}
                onClick={() => setSelected(r)}
                className={`w-full text-left p-3 border-b hover:bg-accent transition-colors ${
                  selected?.lead_id === r.lead_id && selected?.source_table === r.source_table ? 'bg-accent' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium truncate">{r.lead_name || '(no name)'}</div>
                  <Badge variant="outline" className={UNIT_COLORS[r.business_unit_key] ?? ''}>
                    {r.business_unit_key}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
                  <span>{r.phone || 'no phone'}</span>
                  <span>· current: <span className="font-mono">{r.last_disposition ?? '—'}</span></span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Override Disposition</CardTitle>
          <CardDescription>Manual overrides are recorded to the sync log.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selected && !lastResult && (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Select a lead from search results to override.
            </div>
          )}

          {lastResult && !selected && (
            <div className="rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-4 w-4" /> Override applied
              </div>
              <div className="mt-2 text-muted-foreground">
                {lastResult.name || '(lead)'}: <span className="font-mono">{lastResult.old ?? '—'}</span>
                {' → '}<span className="font-mono">{lastResult.next}</span>
              </div>
            </div>
          )}

          {selected && (
            <>
              <div className="rounded-md border p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{selected.lead_name || '(no name)'}</div>
                  <Badge variant="outline" className={UNIT_COLORS[selected.business_unit_key] ?? ''}>
                    {selected.business_unit_key}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">{selected.phone || 'no phone'}</div>
                <div className="text-xs">
                  Current: <span className="font-mono">{selected.last_disposition ?? '—'}</span>
                </div>
              </div>

              <div>
                <Label>New disposition</Label>
                <Select value={newDisp} onValueChange={setNewDisp}>
                  <SelectTrigger><SelectValue placeholder="Choose disposition…" /></SelectTrigger>
                  <SelectContent>
                    {codes.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label} <span className="text-muted-foreground text-xs ml-1">({c.code})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Reason (min 10 chars)</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this override needed?"
                  rows={3}
                />
                <div className="text-xs text-muted-foreground mt-1">{reason.trim().length} / 10</div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setSelected(null); setNewDisp(''); setReason(''); }}>
                  Cancel
                </Button>
                <Button
                  onClick={() => submit.mutate()}
                  disabled={submit.isPending || !newDisp || reason.trim().length < 10}
                >
                  {submit.isPending ? 'Applying…' : 'Apply Override'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DCDispositionManager() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Disposition Management</h1>
        <p className="text-muted-foreground text-sm">
          Manage the canonical disposition code registry and apply manual overrides.
        </p>
      </div>
      <Tabs defaultValue="registry">
        <TabsList>
          <TabsTrigger value="registry">Codes Registry</TabsTrigger>
          <TabsTrigger value="override">Manual Override</TabsTrigger>
        </TabsList>
        <TabsContent value="registry" className="mt-4"><DispositionRegistry /></TabsContent>
        <TabsContent value="override" className="mt-4"><ManualOverride /></TabsContent>
      </Tabs>
    </div>
  );
}
