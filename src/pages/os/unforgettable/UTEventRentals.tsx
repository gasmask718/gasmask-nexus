import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEventRentals, useUpsertEventRental, useDeleteEventRental } from '@/hooks/useEventInventory';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';

const CATEGORIES = ['Tables', 'Chairs', 'Linens', 'Decor', 'Lighting', 'Sound', 'Tents', 'Inflatables', 'Tableware', 'Other'];

export default function UTEventRentals() {
  const { data: rentals = [], isLoading } = useEventRentals();
  const upsert = useUpsertEventRental();
  const remove = useDeleteEventRental();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  const handleSave = () => {
    if (!form.name) return;
    upsert.mutate(form, { onSuccess: () => { setOpen(false); setForm({}); } });
  };

  const handleEdit = (r: any) => { setForm(r); setOpen(true); };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🪑 Event Rentals</h1>
          <p className="text-muted-foreground">Floor 10 — Manage rental inventory (tables, chairs, decor, etc.)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm({})}><Plus className="w-4 h-4 mr-2" />Add Rental</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? 'Edit' : 'Add'} Rental</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Name" value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              <Select value={form.category || ''} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Price" value={form.price || ''} onChange={e => setForm(p => ({ ...p, price: +e.target.value }))} />
                <Select value={form.price_type || 'flat'} onValueChange={v => setForm(p => ({ ...p, price_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat</SelectItem>
                    <SelectItem value="per_hour">Per Hour</SelectItem>
                    <SelectItem value="per_day">Per Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="City" value={form.city || ''} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
                <Input placeholder="State" value={form.state || ''} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} />
              </div>
              <Input type="number" placeholder="Inventory Count" value={form.inventory_count || ''} onChange={e => setForm(p => ({ ...p, inventory_count: +e.target.value }))} />
              <Input placeholder="Image URL" value={form.image_url || ''} onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))} />
              <Button onClick={handleSave} disabled={upsert.isPending} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <p>Loading...</p> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rentals.map((r: any) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4" />{r.name}</CardTitle>
                  <Badge variant={r.status === 'active' ? 'default' : 'secondary'}>{r.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>{r.category} · {r.city}, {r.state}</p>
                <p>${r.price} / {r.price_type} · {r.inventory_count} in stock</p>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(r)}><Pencil className="w-3 h-3" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => remove.mutate(r.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {rentals.length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">No rentals yet. Add your first rental item.</p>}
        </div>
      )}
    </div>
  );
}
