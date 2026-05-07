/**
 * Global products & services catalogue page (/products).
 * Lists every Brandaro product/service with create/edit support.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Package, Repeat, Sparkles } from 'lucide-react';

const fmt = (n?: number | null) => `$${Number(n ?? 0).toLocaleString()}`;

export default function ProductsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    name: '', sku: '', description: '', category: 'service',
    product_type: 'one_time', billing_interval: null, price: 0, setup_fee: 0, is_active: true,
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['brandaro-products-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brandaro_products').select('*').order('sort_order').order('name');
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from('brandaro_products').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brandaro-products-all'] });
      setOpen(false);
      toast({ title: 'Product created' });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('brandaro_products').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brandaro-products-all'] }),
  });

  const grouped = products.reduce((acc: Record<string, any[]>, p: any) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Products & Services</h1>
            <p className="text-muted-foreground mt-1">Master catalogue of everything Brandaro sells.</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Product</Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="space-y-3">
              <h2 className="text-lg font-semibold capitalize">{category}</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((p: any) => (
                  <Card key={p.id} className={!p.is_active ? 'opacity-60' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          {p.product_type === 'recurring' ? <Repeat className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                          {p.name}
                        </CardTitle>
                        <Switch checked={p.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: p.id, is_active: v })} />
                      </div>
                      {p.sku && <div className="text-[10px] font-mono text-muted-foreground">{p.sku}</div>}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="text-xl font-bold">{fmt(p.price)}</div>
                        <Badge variant="outline">
                          {p.product_type === 'recurring' ? `/${p.billing_interval}` : 'one-time'}
                        </Badge>
                      </div>
                      {p.setup_fee > 0 && (
                        <div className="text-xs text-muted-foreground">Setup: {fmt(p.setup_fee)}</div>
                      )}
                      {Array.isArray(p.features) && p.features.length > 0 && (
                        <ul className="text-xs space-y-0.5 pt-2 border-t">
                          {p.features.slice(0, 4).map((f: string, i: number) => (
                            <li key={i} className="flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> {f}</li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>New Product</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="SKU (optional)" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                <Select value={form.product_type} onValueChange={(v) => setForm({ ...form, product_type: v, billing_interval: v === 'recurring' ? 'monthly' : null })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One-time</SelectItem>
                    <SelectItem value="recurring">Recurring</SelectItem>
                    <SelectItem value="addon">Add-on</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
                <Input type="number" placeholder="Setup Fee" value={form.setup_fee} onChange={(e) => setForm({ ...form, setup_fee: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button disabled={!form.name || create.isPending} onClick={() => create.mutate({ ...form, sku: form.sku || null })}>
                  {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
