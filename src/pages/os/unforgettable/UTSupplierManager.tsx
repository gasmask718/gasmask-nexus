import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Download, BarChart3, Factory, Star, MapPin, Package, Mail } from 'lucide-react';

const PINK = '#E91E8C';

const STATUSES = [
  { value: 'contacted', label: '📬 Contacted', color: 'bg-gray-500' },
  { value: 'brand_kit_sent', label: '📨 Brand Kit Sent', color: 'bg-blue-500' },
  { value: 'sample_requested', label: '🔬 Sample Requested', color: 'bg-yellow-500' },
  { value: 'sample_received', label: '📦 Sample Received', color: 'bg-orange-500' },
  { value: 'sample_approved', label: '✅ Sample Approved', color: 'bg-green-500' },
  { value: 'active', label: '🟢 Active', color: 'bg-emerald-500' },
  { value: 'paused', label: '⏸️ Paused', color: 'bg-amber-500' },
  { value: 'rejected', label: '❌ Rejected', color: 'bg-red-500' },
];

const emptySupplier = {
  name: '', country: '', contact_name: '', contact_email: '', contact_phone: '',
  platform: '', platform_url: '', product_categories: [] as string[],
  supports_private_label: false, logo_methods: [] as string[], custom_moq: 0,
  branding_cost_per_unit: 0, sample_available: false, sample_cost: 0,
  white_label_available: false, production_time_days: 0, shipping_time_days: 0,
  notes: '',
};

export default function UTSupplierManager() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptySupplier);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [catInput, setCatInput] = useState('');

  const { data: suppliers = [] } = useQuery({
    queryKey: ['ut-suppliers'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_suppliers' as any).select('*').order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase.from('ut_suppliers' as any).insert(values);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ut-suppliers'] });
      setAddOpen(false);
      setForm(emptySupplier);
      toast.success('Supplier added');
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const update: any = { status, updated_at: new Date().toISOString() };
      if (status === 'brand_kit_sent') update.brand_kit_sent_at = new Date().toISOString();
      const { error } = await supabase.from('ut_suppliers').update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ut-suppliers'] });
      toast.success('Status updated');
    },
  });

  const stats = {
    total: suppliers.length,
    active: suppliers.filter(s => s.status === 'active').length,
    pending: suppliers.filter(s => !['active', 'rejected', 'paused'].includes(s.status || '')).length,
    preferred: suppliers.filter(s => s.preferred).length,
  };

  const avgScore = (s: any) => {
    const scores = [s.cost_score, s.speed_score, s.reliability_score].filter(Boolean);
    return scores.length ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1) : 'N/A';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: PINK }}>🏭 Supplier Manager</h1>
          <p className="text-muted-foreground">Track every supplier relationship from first contact to active partner</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add Supplier</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add New Supplier</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Supplier Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Country *</Label><Input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} /></div>
                <div><Label>Contact Name</Label><Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} /></div>
                <div><Label>Contact Email</Label><Input value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></div>
                <div><Label>Contact Phone</Label><Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} /></div>
                <div>
                  <Label>Platform</Label>
                  <Select value={form.platform} onValueChange={v => setForm({ ...form, platform: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {['Alibaba', 'DHgate', 'Local', 'Other'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Platform URL</Label><Input value={form.platform_url} onChange={e => setForm({ ...form, platform_url: e.target.value })} /></div>
                <div>
                  <Label>Product Categories</Label>
                  <div className="flex gap-1 mb-1 flex-wrap">
                    {form.product_categories.map((c: string) => <Badge key={c} variant="secondary">{c} <button onClick={() => setForm({ ...form, product_categories: form.product_categories.filter((x: string) => x !== c) })} className="ml-1">×</button></Badge>)}
                  </div>
                  <div className="flex gap-1">
                    <Input value={catInput} onChange={e => setCatInput(e.target.value)} placeholder="Add category" onKeyDown={e => { if (e.key === 'Enter' && catInput) { setForm({ ...form, product_categories: [...form.product_categories, catInput] }); setCatInput(''); } }} />
                  </div>
                </div>
                <div><Label>Custom MOQ</Label><Input type="number" value={form.custom_moq} onChange={e => setForm({ ...form, custom_moq: Number(e.target.value) })} /></div>
                <div><Label>Branding Cost/Unit ($)</Label><Input type="number" value={form.branding_cost_per_unit} onChange={e => setForm({ ...form, branding_cost_per_unit: Number(e.target.value) })} /></div>
                <div><Label>Production Time (days)</Label><Input type="number" value={form.production_time_days} onChange={e => setForm({ ...form, production_time_days: Number(e.target.value) })} /></div>
                <div><Label>Shipping Time (days)</Label><Input type="number" value={form.shipping_time_days} onChange={e => setForm({ ...form, shipping_time_days: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <Button onClick={() => addMutation.mutate(form)} disabled={!form.name || addMutation.isPending}>{addMutation.isPending ? 'Saving...' : 'Save Supplier'}</Button>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => toast.info('CSV export coming soon')}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Suppliers', value: stats.total },
          { label: 'Active', value: stats.active },
          { label: 'Pending Approval', value: stats.pending },
          { label: 'Preferred', value: stats.preferred },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></CardContent></Card>
        ))}
      </div>

      {/* Kanban */}
      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-4">
          {STATUSES.map(status => {
            const items = suppliers.filter(s => s.status === status.value);
            return (
              <div key={status.value} className="w-72 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold">{status.label}</span>
                  <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                </div>
                <div className="space-y-2">
                  {items.map(supplier => (
                    <Card key={supplier.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setSelectedSupplier(supplier)}>
                      <CardContent className="p-3 space-y-1">
                        <p className="font-semibold text-sm flex items-center gap-1">
                          <Factory className="h-3 w-3" /> {supplier.name}
                          {supplier.preferred && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                        </p>
                        {supplier.country && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {supplier.country}</p>}
                        {supplier.product_categories?.length > 0 && (
                          <div className="flex gap-1 flex-wrap">{(supplier.product_categories as string[]).slice(0, 3).map((c: string) => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}</div>
                        )}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>⭐ {avgScore(supplier)}</span>
                          {supplier.custom_moq && <span>MOQ: {supplier.custom_moq}</span>}
                        </div>
                        <div className="flex gap-1 pt-1">
                          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={e => { e.stopPropagation(); setSelectedSupplier(supplier); }}>View</Button>
                          {status.value !== 'active' && status.value !== 'rejected' && (
                            <Select onValueChange={v => { updateStatus.mutate({ id: supplier.id, status: v }); }}>
                              <SelectTrigger className="h-6 text-xs w-auto"><SelectValue placeholder="Move →" /></SelectTrigger>
                              <SelectContent>{STATUSES.filter(s => s.value !== status.value).map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                            </Select>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No suppliers</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Supplier Detail Dialog */}
      {selectedSupplier && (
        <Dialog open={!!selectedSupplier} onOpenChange={() => setSelectedSupplier(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Factory className="h-5 w-5" /> {selectedSupplier.name}
                {selectedSupplier.preferred && <Badge className="bg-yellow-500 text-black">⭐ Preferred</Badge>}
              </DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="scoring">Scoring</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Country:</span> {selectedSupplier.country}</div>
                  <div><span className="text-muted-foreground">Platform:</span> {selectedSupplier.platform}</div>
                  <div><span className="text-muted-foreground">Contact:</span> {selectedSupplier.contact_name}</div>
                  <div><span className="text-muted-foreground">Email:</span> {selectedSupplier.contact_email}</div>
                  <div><span className="text-muted-foreground">MOQ:</span> {selectedSupplier.custom_moq}</div>
                  <div><span className="text-muted-foreground">Branding Cost/Unit:</span> ${selectedSupplier.branding_cost_per_unit}</div>
                  <div><span className="text-muted-foreground">Production:</span> {selectedSupplier.production_time_days} days</div>
                  <div><span className="text-muted-foreground">Shipping:</span> {selectedSupplier.shipping_time_days} days</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { updateStatus.mutate({ id: selectedSupplier.id, status: 'brand_kit_sent' }); }}><Mail className="h-3 w-3 mr-1" /> Send Brand Kit</Button>
                </div>
                {selectedSupplier.notes && <div className="text-sm bg-muted/50 p-3 rounded">{selectedSupplier.notes}</div>}
              </TabsContent>
              <TabsContent value="scoring" className="space-y-4">
                {['cost_score', 'speed_score', 'reliability_score'].map(field => (
                  <div key={field} className="flex items-center gap-3">
                    <Label className="w-32 capitalize">{field.replace('_score', '')}</Label>
                    <div className="flex gap-1">{Array.from({ length: 10 }, (_, i) => (
                      <button key={i} className={`w-6 h-6 rounded text-xs ${(selectedSupplier[field] || 0) > i ? 'bg-yellow-500 text-black' : 'bg-muted'}`}
                        onClick={() => {
                          supabase.from('ut_suppliers').update({ [field]: i + 1 }).eq('id', selectedSupplier.id).then(() => {
                            queryClient.invalidateQueries({ queryKey: ['ut-suppliers'] });
                            setSelectedSupplier({ ...selectedSupplier, [field]: i + 1 });
                          });
                        }}>{i + 1}</button>
                    ))}</div>
                    <span className="text-sm font-bold">{selectedSupplier[field] || 0}/10</span>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground">Overall: ⭐ {avgScore(selectedSupplier)}/10 — {Number(avgScore(selectedSupplier)) >= 8 ? '⭐ Preferred Supplier' : 'Needs improvement'}</p>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
