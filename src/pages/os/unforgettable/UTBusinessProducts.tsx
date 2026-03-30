import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Pencil } from 'lucide-react';

const PINK = '#E91E8C';

interface Product {
  id: string;
  name: string;
  category: string | null;
  cost: number;
  rental_price: number;
  roi_tag: string | null;
  active: boolean;
  created_at: string;
}

const emptyForm = { name: '', category: '', cost: '', rental_price: '', roi_tag: '' };

export default function UTBusinessProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    const { data } = await supabase.from('ut_products').select('*').order('created_at', { ascending: false });
    if (data) setProducts(data as Product[]);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (p: Product) => {
    setEditId(p.id);
    setForm({ name: p.name, category: p.category || '', cost: String(p.cost), rental_price: String(p.rental_price), roi_tag: p.roi_tag || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      name: form.name,
      category: form.category || null,
      cost: parseFloat(form.cost) || 0,
      rental_price: parseFloat(form.rental_price) || 0,
      roi_tag: form.roi_tag || null,
    };
    if (editId) {
      await supabase.from('ut_products').update(payload).eq('id', editId);
      toast.success('Product updated');
    } else {
      await supabase.from('ut_products').insert(payload);
      toast.success('Product added');
    }
    setDialogOpen(false);
    setSaving(false);
    fetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: PINK }}>Floor 5 — Products</h1>
          <p className="text-sm text-muted-foreground">Manage business products & rental items</p>
        </div>
        <Button onClick={openNew} style={{ backgroundColor: PINK, color: 'white' }}><Plus className="h-4 w-4 mr-1" /> Add Product</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Cost</th>
                  <th className="text-left p-3 font-medium">Rental Price</th>
                  <th className="text-left p-3 font-medium">ROI Tag</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No products yet</td></tr>
                ) : products.map(p => (
                  <tr key={p.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3">{p.category || '—'}</td>
                    <td className="p-3">${p.cost}</td>
                    <td className="p-3">${p.rental_price}</td>
                    <td className="p-3">{p.roi_tag ? <Badge variant="outline">{p.roi_tag}</Badge> : '—'}</td>
                    <td className="p-3">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Edit Product' : 'Add Product'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Category</Label><Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cost ($)</Label><Input type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} /></div>
              <div><Label>Rental Price ($)</Label><Input type="number" value={form.rental_price} onChange={e => setForm(f => ({ ...f, rental_price: e.target.value }))} /></div>
            </div>
            <div><Label>ROI Tag</Label><Input value={form.roi_tag} onChange={e => setForm(f => ({ ...f, roi_tag: e.target.value }))} placeholder="e.g. High ROI" /></div>
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
