import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Pencil } from 'lucide-react';

const PINK = '#E91E8C';

interface Package {
  id: string;
  name: string;
  description: string | null;
  estimated_cost: number;
  estimated_monthly_profit: number;
  active: boolean;
  created_at: string;
}

const emptyForm = { name: '', description: '', estimated_cost: '', estimated_monthly_profit: '' };

export default function UTBusinessPackages() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchPkgs = async () => {
    const { data } = await supabase.from('ut_business_packages').select('*').order('created_at', { ascending: false });
    if (data) setPackages(data as Package[]);
    setLoading(false);
  };

  useEffect(() => { fetchPkgs(); }, []);

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (p: Package) => {
    setEditId(p.id);
    setForm({ name: p.name, description: p.description || '', estimated_cost: String(p.estimated_cost), estimated_monthly_profit: String(p.estimated_monthly_profit) });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description || null,
      estimated_cost: parseFloat(form.estimated_cost) || 0,
      estimated_monthly_profit: parseFloat(form.estimated_monthly_profit) || 0,
    };
    if (editId) {
      await supabase.from('ut_business_packages').update(payload).eq('id', editId);
      toast.success('Package updated');
    } else {
      await supabase.from('ut_business_packages').insert(payload);
      toast.success('Package created');
    }
    setDialogOpen(false);
    setSaving(false);
    fetchPkgs();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: PINK }}>Floor 5 — Business Packages</h1>
          <p className="text-sm text-muted-foreground">Create and manage starter packages for business owners</p>
        </div>
        <Button onClick={openNew} style={{ backgroundColor: PINK, color: 'white' }}><Plus className="h-4 w-4 mr-1" /> Add Package</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="col-span-full text-center text-muted-foreground p-8">Loading...</p>
        ) : packages.length === 0 ? (
          <p className="col-span-full text-center text-muted-foreground p-8">No packages yet</p>
        ) : packages.map(p => (
          <Card key={p.id} className="relative">
            <CardContent className="p-5 space-y-2">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-lg">{p.name}</h3>
                <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /></Button>
              </div>
              {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
              <div className="flex justify-between text-sm pt-2 border-t">
                <div>
                  <p className="text-muted-foreground">Est. Cost</p>
                  <p className="font-bold text-lg">${p.estimated_cost.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Monthly Profit</p>
                  <p className="font-bold text-lg text-green-600">${p.estimated_monthly_profit.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Edit Package' : 'Create Package'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Package Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Est. Cost ($)</Label><Input type="number" value={form.estimated_cost} onChange={e => setForm(f => ({ ...f, estimated_cost: e.target.value }))} /></div>
              <div><Label>Monthly Profit ($)</Label><Input type="number" value={form.estimated_monthly_profit} onChange={e => setForm(f => ({ ...f, estimated_monthly_profit: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button disabled={saving || !form.name} style={{ backgroundColor: PINK, color: 'white' }} onClick={handleSave}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
