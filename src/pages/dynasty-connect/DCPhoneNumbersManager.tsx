import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Upload, Download, Search, Pencil, Trash2 } from 'lucide-react';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY',
  'LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH',
  'OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
];

const TABLE = 'dc_phone_numbers';
const DEFAULT_BUSINESS = 'brandaro';
const QK = ['dc-phone-numbers', DEFAULT_BUSINESS];

export default function DCPhoneNumbersManager() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [businessFilter, setBusinessFilter] = useState<string>(DEFAULT_BUSINESS);
  const [showAdd, setShowAdd] = useState(false);
  const [newNum, setNewNum] = useState({ phone_number: '', friendly_name: '', state: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ friendly_name: '', state: '' });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['dc-phone-numbers'] });

  const { data: numbers = [], isLoading } = useQuery({
    queryKey: ['dc-phone-numbers', businessFilter],
    queryFn: async () => {
      let q = (supabase as any).from(TABLE).select('*').order('state');
      if (businessFilter !== 'all') q = q.eq('business', businessFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (num: typeof newNum) => {
      const { error } = await (supabase as any).from(TABLE).insert({ ...num, business: DEFAULT_BUSINESS });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Number added'); setShowAdd(false); setNewNum({ phone_number: '', friendly_name: '', state: '' }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const { error } = await (supabase as any).from(TABLE).update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Updated'); setEditId(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await (supabase as any).from(TABLE).update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Deleted'); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = text.split('\n').slice(1).filter(r => r.trim());
    const items = rows.map(r => {
      const [phone_number, friendly_name, state] = r.split(',').map(s => s.trim().replace(/"/g, ''));
      return { phone_number, friendly_name, state, business: DEFAULT_BUSINESS };
    }).filter(i => i.phone_number && i.state);

    if (!items.length) { toast.error('No valid rows found'); return; }
    const { error } = await (supabase as any).from(TABLE).insert(items);
    if (error) toast.error(error.message);
    else { toast.success(`${items.length} numbers imported`); invalidate(); }
  };

  const handleExport = () => {
    const csv = 'phone_number,friendly_name,state,is_active,bland_registered\n' + numbers.map((n: any) =>
      `${n.phone_number},${n.friendly_name || ''},${n.state || ''},${n.is_active},${n.bland_registered ?? false}`
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'brandaro_phone_numbers.csv'; a.click();
  };

  const filtered = numbers.filter((n: any) => {
    if (stateFilter !== 'all' && n.state !== stateFilter) return false;
    if (search && !n.phone_number.includes(search) && !n.friendly_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stateCount = numbers.reduce((acc: any, n: any) => { if (n.state) acc[n.state] = (acc[n.state] || 0) + 1; return acc; }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📞 Brandaro Phone Pool</h1>
          <p className="text-sm text-muted-foreground">Manage Twilio numbers for caller-ID matching by state. Toggle <span className="font-medium">Bland</span> after registering a number as BYON in the Bland dashboard.</p>
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer">
            <input type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
            <Button variant="outline" size="sm" asChild><span><Upload className="h-4 w-4 mr-1" /> Import CSV</span></Button>
          </label>
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" /> Export</Button>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Number</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Phone Number</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Phone Number</Label><Input value={newNum.phone_number} onChange={e => setNewNum(p => ({ ...p, phone_number: e.target.value }))} placeholder="+1XXXXXXXXXX" /></div>
                <div><Label>Friendly Name</Label><Input value={newNum.friendly_name} onChange={e => setNewNum(p => ({ ...p, friendly_name: e.target.value }))} placeholder="Main Line" /></div>
                <div><Label>State</Label>
                  <Select value={newNum.state} onValueChange={v => setNewNum(p => ({ ...p, state: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">Business: <span className="font-mono">{DEFAULT_BUSINESS}</span> (default)</p>
                <Button onClick={() => addMutation.mutate(newNum)} disabled={!newNum.phone_number || !newNum.state || addMutation.isPending} className="w-full">
                  {addMutation.isPending ? 'Adding…' : 'Add Number'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{numbers.length}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{numbers.filter((n: any) => n.is_active).length}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{numbers.filter((n: any) => n.bland_registered).length}</p><p className="text-xs text-muted-foreground">Bland-BYON</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{Object.keys(stateCount).length}</p><p className="text-xs text-muted-foreground">States</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{50 - Object.keys(stateCount).length}</p><p className="text-xs text-muted-foreground">Missing</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search numbers..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {US_STATES.map(s => <SelectItem key={s} value={s}>{s} ({stateCount[s] || 0})</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={businessFilter} onValueChange={setBusinessFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="brandaro">Brandaro (default)</SelectItem>
            <SelectItem value="all">All businesses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3">Phone</th><th className="p-3">Friendly Name</th><th className="p-3">State</th><th className="p-3">Active</th><th className="p-3">Bland</th><th className="p-3">Ops</th><th className="p-3">Actions</th>
              </tr></thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No numbers found</td></tr>
                ) : filtered.map((n: any) => (
                  <tr key={n.id} className="border-b border-border/50 hover:bg-accent/50">
                    <td className="p-3 font-mono text-xs">{n.phone_number}</td>
                    <td className="p-3">
                      {editId === n.id ? (
                        <Input value={editData.friendly_name} onChange={e => setEditData(p => ({ ...p, friendly_name: e.target.value }))} className="h-7 text-xs" />
                      ) : n.friendly_name || '-'}
                    </td>
                    <td className="p-3">
                      {editId === n.id ? (
                        <Select value={editData.state} onValueChange={v => setEditData(p => ({ ...p, state: v }))}>
                          <SelectTrigger className="h-7 w-20"><SelectValue /></SelectTrigger>
                          <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : n.state ? <Badge variant="outline" className="bg-primary/10 text-primary">{n.state}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="p-3">
                      <Switch checked={!!n.is_active} onCheckedChange={v => toggleMutation.mutate({ id: n.id, patch: { is_active: v } })} />
                    </td>
                    <td className="p-3">
                      <Switch checked={!!n.bland_registered} onCheckedChange={v => toggleMutation.mutate({ id: n.id, patch: { bland_registered: v } })} />
                    </td>
                    <td className="p-3 text-[10px] text-muted-foreground whitespace-nowrap">
                      <div>calls {n.total_calls ?? 0} · ans {n.total_answered ?? 0}</div>
                      <div>today {n.daily_call_count ?? 0}/{n.daily_call_cap ?? '∞'} · risk {n.risk_score ?? 0}</div>
                    </td>
                    <td className="p-3">
                      {editId === n.id ? (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: n.id, ...editData })}>
                            {updateMutation.isPending ? '…' : 'Save'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditId(n.id); setEditData({ friendly_name: n.friendly_name || '', state: n.state || '' }); }}><Pencil className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(n.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
