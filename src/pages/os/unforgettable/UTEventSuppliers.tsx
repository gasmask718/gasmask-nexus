import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEventSuppliers, useUpsertEventSupplier, useDeleteEventSupplier } from '@/hooks/useEventInventory';
import { Plus, Pencil, Trash2, Factory } from 'lucide-react';

const TYPES = ['Venue', 'Rental', 'Catering', 'Entertainment', 'Photography', 'Decor', 'Transport', 'Staffing', 'Other'];

export default function UTEventSuppliers() {
  const { data: suppliers = [], isLoading } = useEventSuppliers();
  const upsert = useUpsertEventSupplier();
  const remove = useDeleteEventSupplier();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  const handleSave = () => {
    if (!form.company_name) return;
    upsert.mutate(form, { onSuccess: () => { setOpen(false); setForm({}); } });
  };

  const statusColor = (s: string) => s === 'approved' ? 'default' : s === 'pending' ? 'secondary' : 'destructive';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🏢 Event Suppliers</h1>
          <p className="text-muted-foreground">Floor 12 — Manage vendor companies for the event marketplace</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm({})}><Plus className="w-4 h-4 mr-2" />Add Supplier</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? 'Edit' : 'Add'} Supplier</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Company Name" value={form.company_name || ''} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} />
              <Select value={form.type || ''} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Contact Email" value={form.contact_email || ''} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} />
              <Input placeholder="Phone" value={form.phone || ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="City" value={form.city || ''} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
                <Input placeholder="State" value={form.state || ''} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} />
              </div>
              <Select value={form.status || 'pending'} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSave} disabled={upsert.isPending} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <p>Loading...</p> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s: any) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><Factory className="w-4 h-4" />{s.company_name}</CardTitle>
                  <Badge variant={statusColor(s.status)}>{s.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>{s.type} · {s.city}, {s.state}</p>
                <p>{s.contact_email} · {s.phone}</p>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => { setForm(s); setOpen(true); }}><Pencil className="w-3 h-3" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => remove.mutate(s.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {suppliers.length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">No suppliers yet. Add your first vendor company.</p>}
        </div>
      )}
    </div>
  );
}
