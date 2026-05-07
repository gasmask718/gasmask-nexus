import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Phone, Plus, Trash2, Edit2, Unlock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminNumbersPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ phone_number: '', friendly_name: '' });

  const { data: numbers = [], isLoading } = useQuery({
    queryKey: ['admin-phone-numbers'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brandaro_phone_numbers')
        .select('id, phone_number, friendly_name, in_use, assigned_va_id, is_active, created_at')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-phone-numbers'] });

  const handleSave = async () => {
    if (!form.phone_number || !form.friendly_name) { toast.error('Phone number and label required'); return; }

    let phone = form.phone_number.replace(/\D/g, '');
    if (phone.length === 10) phone = '+1' + phone;
    else if (!phone.startsWith('+')) phone = '+' + phone;

    if (editId) {
      await (supabase as any).from('brandaro_phone_numbers').update({ friendly_name: form.friendly_name }).eq('id', editId);
      toast.success('Label updated');
    } else {
      const { error } = await (supabase as any).from('brandaro_phone_numbers').insert({
        phone_number: phone, friendly_name: form.friendly_name, brand: 'Brandaro', is_active: true, in_use: false,
      });
      if (error) { toast.error(error.message); return; }
      toast.success('Number added');
    }
    setAddOpen(false); setEditId(null); setForm({ phone_number: '', friendly_name: '' }); invalidate();
  };

  const forceRelease = async (id: string) => {
    await (supabase as any).from('brandaro_phone_numbers').update({ in_use: false, assigned_va_id: null }).eq('id', id);
    await (supabase as any)
      .from('brandaro_number_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('number_id', id)
      .is('ended_at', null);
    toast.success('Number released'); invalidate();
  };

  const deleteNumber = async (id: string, inUse: boolean) => {
    if (inUse) { toast.error('Cannot delete a number that is currently in use'); return; }
    if (!confirm('Are you sure you want to delete this number?')) return;
    await (supabase as any).from('brandaro_phone_numbers').delete().eq('id', id);
    toast.success('Number deleted'); invalidate();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6 text-primary" /> Phone Number Pool
          </h1>
          <p className="text-sm text-muted-foreground">Manage Twilio numbers for VA sessions</p>
        </div>
        <Button onClick={() => { setForm({ phone_number: '', friendly_name: '' }); setEditId(null); setAddOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Number
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {(numbers as any[]).map((num: any) => (
            <Card key={num.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{num.friendly_name}</p>
                    <p className="text-sm text-muted-foreground font-mono">{num.phone_number}</p>
                  </div>
                  <Badge className={num.in_use ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                    {num.in_use ? '🔴 In Use' : '🟢 Available'}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  {num.in_use && (
                    <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => forceRelease(num.id)}>
                      <Unlock className="h-3 w-3" /> Force Release
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => {
                    setForm({ phone_number: num.phone_number, friendly_name: num.friendly_name });
                    setEditId(num.id); setAddOpen(true);
                  }}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteNumber(num.id, num.in_use)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Edit Label' : 'Add Number'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Phone Number</label>
              <Input value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
                placeholder="+17185551234" disabled={!!editId} />
            </div>
            <div>
              <label className="text-sm font-medium">Label / Alias</label>
              <Input value={form.friendly_name} onChange={e => setForm(f => ({ ...f, friendly_name: e.target.value }))}
                placeholder="English Line 1" />
            </div>
            <Button onClick={handleSave} className="w-full">
              {editId ? 'Update Label' : 'Add Number'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
