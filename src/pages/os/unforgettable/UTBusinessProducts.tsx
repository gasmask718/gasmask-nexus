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
  category: string;
  cost_price: number | null;
  sell_price: number | null;
  rental_price_estimate: number | null;
  margin_pct: number | null;
  is_active: boolean | null;
  product_type: string;
  created_at: string | null;
}

const emptyForm = { name: '', category: '', cost_price: '', sell_price: '', rental_price_estimate: '', product_type: 'business_asset' };

export default function UTBusinessProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('ut_products')
      .select('id, name, category, cost_price, sell_price, rental_price_estimate, margin_pct, is_active, product_type, created_at')
      .order('created_at', { ascending: false });
    if (data) setProducts(data);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (p: Product) => {
    setEditId(p.id);
    setForm({
      name: p.name,
      category: p.category || '',
      cost_price: String(p.cost_price ?? ''),
      sell_price: String(p.sell_price ?? ''),
      rental_price_estimate: String(p.rental_price_estimate ?? ''),
      product_type: p.product_type || 'business_asset',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const cost = parseFloat(form.cost_price) || 0;
    const sell = parseFloat(form.sell_price) || 0;
    const margin = sell > 0 ? Math.round(((sell - cost) / sell) * 100) : 0;
    const payload: any = {
      name: form.name,
      category: form.category,
      cost_price: cost,
      sell_price: sell,
      rental_price_estimate: parseFloat(form.rental_price_estimate) || null,
      margin_pct: margin,
      product_type: form.product_type as any,
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
    fetchProducts();
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
                  <th className="text-left p-3 font-medium">Sell Price</th>
                  <th className="text-left p-3 font-medium">Rental</th>
                  <th className="text-left p-3 font-medium">Margin</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No products yet</td></tr>
                ) : products.map(p => (
                  <tr key={p.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3">{p.category}</td>
                    <td className="p-3">${p.cost_price ?? '—'}</td>
                    <td className="p-3">${p.sell_price ?? '—'}</td>
                    <td className="p-3">{p.rental_price_estimate ? `$${p.rental_price_estimate}` : '—'}</td>
                    <td className="p-3">{p.margin_pct != null ? <Badge variant="outline">{p.margin_pct}%</Badge> : '—'}</td>
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
              <div><Label>Cost ($)</Label><Input type="number" value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} /></div>
              <div><Label>Sell Price ($)</Label><Input type="number" value={form.sell_price} onChange={e => setForm(f => ({ ...f, sell_price: e.target.value }))} /></div>
            </div>
            <div><Label>Rental Price Estimate ($)</Label><Input type="number" value={form.rental_price_estimate} onChange={e => setForm(f => ({ ...f, rental_price_estimate: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button disabled={saving || !form.name || !form.category} style={{ backgroundColor: PINK, color: 'white' }} onClick={handleSave}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
