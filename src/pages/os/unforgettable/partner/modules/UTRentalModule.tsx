import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Package, DollarSign, Hash, Layers } from 'lucide-react';
import { useRentalInventory, useUpsertRentalItem } from '@/hooks/useUTPartnerPortal';

interface Props { partnerId: string; }

const RENTAL_CATEGORIES = [
  'chairs', 'tables', 'tents', 'bounce_houses', 'linens',
  'throne_chairs', 'backdrops', 'centerpieces', 'props',
  'lighting', 'photo_booths', 'decor_rentals', 'other'
];

export default function UTRentalModule({ partnerId }: Props) {
  const { data: items = [] } = useRentalInventory(partnerId);
  const upsert = useUpsertRentalItem();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [filter, setFilter] = useState('all');

  const update = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const save = () => {
    upsert.mutate({ ...form, partner_id: partnerId }, { onSuccess: () => { setOpen(false); setForm({}); } });
  };

  const filtered = filter === 'all' ? items : items.filter(i => i.category === filter);
  const categories = [...new Set(items.map(i => i.category).filter(Boolean))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> Rental Inventory
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{items.length} items across {categories.length} categories</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add Inventory Item</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Item Name</Label>
                  <Input value={form.item_name || ''} onChange={e => update('item_name', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input value={form.sku || ''} onChange={e => update('sku', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category || 'other'} onValueChange={v => update('category', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RENTAL_CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Input value={form.color || ''} onChange={e => update('color', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Price ($)</Label>
                  <Input type="number" value={form.rental_price || ''} onChange={e => update('rental_price', parseFloat(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Total Qty</Label>
                  <Input type="number" value={form.quantity_total || 1} onChange={e => update('quantity_total', parseInt(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Available</Label>
                  <Input type="number" value={form.quantity_available || 1} onChange={e => update('quantity_available', parseInt(e.target.value))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Delivery Fee ($)</Label>
                  <Input type="number" value={form.delivery_fee || 0} onChange={e => update('delivery_fee', parseFloat(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Setup Fee ($)</Label>
                  <Input type="number" value={form.setup_fee || 0} onChange={e => update('setup_fee', parseFloat(e.target.value))} />
                </div>
              </div>
              <Button onClick={save} disabled={upsert.isPending} className="w-full">Save Item</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <Badge variant={filter === 'all' ? 'default' : 'outline'} className="cursor-pointer text-[10px]" onClick={() => setFilter('all')}>
            All ({items.length})
          </Badge>
          {categories.map(cat => (
            <Badge key={cat} variant={filter === cat ? 'default' : 'outline'} className="cursor-pointer text-[10px]" onClick={() => setFilter(cat!)}>
              {(cat || '').replace(/_/g, ' ')} ({items.filter(i => i.category === cat).length})
            </Badge>
          ))}
        </div>
      )}

      {/* Items Grid */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No inventory items yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(item => (
            <Card key={item.id} className="border-border/50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between mb-1">
                  <h4 className="font-medium text-sm">{item.item_name}</h4>
                  <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                  {item.rental_price && (
                    <span className="flex items-center gap-0.5 font-medium text-foreground">
                      <DollarSign className="h-3 w-3" />{Number(item.rental_price).toFixed(2)}
                    </span>
                  )}
                  <span className="flex items-center gap-0.5">
                    <Hash className="h-3 w-3" />{item.quantity_available}/{item.quantity_total}
                  </span>
                  {item.color && <span>{item.color}</span>}
                  {item.sku && <span className="font-mono">{item.sku}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
