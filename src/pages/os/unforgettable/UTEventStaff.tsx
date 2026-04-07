import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEventStaff, useUpsertEventStaff, useDeleteEventStaff } from '@/hooks/useEventInventory';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';

const ROLES = ['DJ', 'Photographer', 'Videographer', 'Bartender', 'Chef', 'Server', 'Security', 'MC/Host', 'Decorator', 'Coordinator', 'Entertainer', 'Other'];

export default function UTEventStaff() {
  const { data: staff = [], isLoading } = useEventStaff();
  const upsert = useUpsertEventStaff();
  const remove = useDeleteEventStaff();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  const handleSave = () => {
    if (!form.name) return;
    upsert.mutate(form, { onSuccess: () => { setOpen(false); setForm({}); } });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🧑‍🍳 Event Staff</h1>
          <p className="text-muted-foreground">Floor 11 — Manage DJs, photographers, bartenders, and more</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm({})}><Plus className="w-4 h-4 mr-2" />Add Staff</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? 'Edit' : 'Add'} Staff</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Full Name" value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              <Select value={form.role || ''} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" placeholder="Hourly Rate ($)" value={form.hourly_rate || ''} onChange={e => setForm(p => ({ ...p, hourly_rate: +e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="City" value={form.city || ''} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
                <Input placeholder="State" value={form.state || ''} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} />
              </div>
              <Select value={form.availability_status || 'available'} onValueChange={v => setForm(p => ({ ...p, availability_status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Profile Image URL" value={form.profile_image || ''} onChange={e => setForm(p => ({ ...p, profile_image: e.target.value }))} />
              <Button onClick={handleSave} disabled={upsert.isPending} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <p>Loading...</p> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {staff.map((s: any) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" />{s.name}</CardTitle>
                  <Badge variant={s.availability_status === 'available' ? 'default' : 'secondary'}>{s.availability_status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>{s.role} · {s.city}, {s.state}</p>
                <p>${s.hourly_rate}/hr · ⭐ {s.rating || 'N/A'}</p>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => { setForm(s); setOpen(true); }}><Pencil className="w-3 h-3" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => remove.mutate(s.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {staff.length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">No staff yet. Add your first team member.</p>}
        </div>
      )}
    </div>
  );
}
