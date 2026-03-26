import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Truck, Plus, Package, Star, Zap, Globe } from 'lucide-react';
import { useUTSuppliers, useUTProductMutations } from '@/hooks/useUTProducts';
import { toast } from 'sonner';

export default function UTSupplierConsole() {
  const navigate = useNavigate();
  const { data: suppliers = [], isLoading } = useUTSuppliers();
  const { createSupplier } = useUTProductMutations();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({
    name: '', supplier_type: 'dropship', source_platform: '', fulfillment_model: 'dropship',
    shipping_speed_days: '', min_order_qty: '', website: '', contact_name: '', email: '', phone: '',
  });

  const handleCreate = () => {
    if (!form.name) { toast.error('Name required'); return; }
    const payload: Record<string, any> = {
      name: form.name,
      supplier_type: form.supplier_type,
      fulfillment_model: form.fulfillment_model,
    };
    if (form.source_platform) payload.source_platform = form.source_platform;
    if (form.shipping_speed_days) payload.shipping_speed_days = Number(form.shipping_speed_days);
    if (form.min_order_qty) payload.min_order_qty = Number(form.min_order_qty);
    if (form.website) payload.website = form.website;
    if (form.contact_name) payload.contact_name = form.contact_name;
    if (form.email) payload.email = form.email;
    if (form.phone) payload.phone = form.phone;
    createSupplier.mutate(payload, { onSuccess: () => setShowCreate(false) });
  };

  const totalProducts = suppliers.reduce((s: number, sup: any) => s + (sup.product_count || 0), 0);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/os/unforgettable/products')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" /> Supplier Console
            </h1>
            <p className="text-sm text-muted-foreground">Dropship · Wholesale · Manufacturer · Curated Sellers</p>
          </div>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Supplier</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>New Supplier</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={form.supplier_type} onValueChange={v => setForm(f => ({ ...f, supplier_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dropship">Dropship</SelectItem>
                      <SelectItem value="wholesale">Wholesale</SelectItem>
                      <SelectItem value="manufacturer">Manufacturer</SelectItem>
                      <SelectItem value="curated_seller">Curated Seller</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Platform</Label>
                  <Select value={form.source_platform || '_none'} onValueChange={v => setForm(f => ({ ...f, source_platform: v === '_none' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      <SelectItem value="cj_dropshipping">CJ Dropshipping</SelectItem>
                      <SelectItem value="aliexpress">AliExpress</SelectItem>
                      <SelectItem value="alibaba">Alibaba</SelectItem>
                      <SelectItem value="etsy">Etsy</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Fulfillment</Label>
                  <Select value={form.fulfillment_model} onValueChange={v => setForm(f => ({ ...f, fulfillment_model: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dropship">Dropship</SelectItem>
                      <SelectItem value="warehouse">Warehouse</SelectItem>
                      <SelectItem value="on_demand">On Demand</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Ship Days</Label><Input type="number" value={form.shipping_speed_days} onChange={e => setForm(f => ({ ...f, shipping_speed_days: e.target.value }))} /></div>
              </div>
              <div><Label>MOQ</Label><Input type="number" value={form.min_order_qty} onChange={e => setForm(f => ({ ...f, min_order_qty: e.target.value }))} /></div>
              <div><Label>Website</Label><Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Contact</Label><Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
                <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={createSupplier.isPending}>Create Supplier</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border/50"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{suppliers.length}</p><p className="text-xs text-muted-foreground">Suppliers</p>
        </CardContent></Card>
        <Card className="bg-card border-border/50"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{totalProducts}</p><p className="text-xs text-muted-foreground">Products Linked</p>
        </CardContent></Card>
        <Card className="bg-card border-border/50"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">
            {suppliers.filter((s: any) => Number(s.reliability_score) >= 7).length}
          </p><p className="text-xs text-muted-foreground">High Reliability</p>
        </CardContent></Card>
        <Card className="bg-card border-border/50"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">
            {suppliers.filter((s: any) => s.api_enabled).length}
          </p><p className="text-xs text-muted-foreground">API Enabled</p>
        </CardContent></Card>
      </div>

      {/* Supplier Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading suppliers...</div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Truck className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No suppliers yet. Add your first supplier above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s: any) => (
            <Card key={s.id} className="bg-card border-border/50 hover:border-primary/30 transition-colors">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{s.name}</h3>
                    <div className="flex gap-1.5 mt-1">
                      <Badge variant="outline" className="text-[10px]">{s.supplier_type || 'dropship'}</Badge>
                      {s.source_platform && <Badge variant="outline" className="text-[10px]">{s.source_platform}</Badge>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-amber-400" />
                      <span className="text-sm font-bold">{Number(s.reliability_score || 0).toFixed(1)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">reliability</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Products</span>
                    <p className="font-semibold">{s.product_count || 0}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Avg Margin</span>
                    <p className="font-semibold">{s.avg_margin ? `${Number(s.avg_margin).toFixed(0)}%` : '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ship</span>
                    <p className="font-semibold">{s.shipping_speed_days ? `${s.shipping_speed_days}d` : '—'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{s.fulfillment_model}</span>
                  <div className="flex gap-1">
                    {s.gift_count > 0 && <Badge className="bg-pink-500/20 text-pink-400 text-[10px]">{s.gift_count} gifts</Badge>}
                    {s.asset_count > 0 && <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">{s.asset_count} assets</Badge>}
                    {s.trending_count > 0 && <Badge className="bg-orange-500/20 text-orange-400 text-[10px]">🔥 {s.trending_count}</Badge>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
