import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Phone, Plus, Trash2, Edit2, Unlock, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useNumberLastSessions, formatDateTime } from '@/hooks/useNumberLastSessions';

export default function AdminNumbersPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ phone_number: '', friendly_name: '', business: '' });
  const [releasingId, setReleasingId] = useState<string | null>(null);

  // Pool — single source of truth used by VA caller-ID switcher.
  const { data: numbers = [], isLoading } = useQuery({
    queryKey: ['admin-dc-phone-numbers'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('dc_phone_numbers')
        .select('id, phone_number, friendly_name, business, number_type, is_active, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Live "in use" derivation (va_sessions.is_active joined to numbers).
  const { data: sessionsData, refetch: refetchSessions } = useNumberLastSessions();
  const sessionsById = sessionsData?.byId;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-dc-phone-numbers'] });
    queryClient.invalidateQueries({ queryKey: ['brandaro-number-last-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['va-active-number-switcher'] });
    refetchSessions();
  };

  const handleSave = async () => {
    if (!form.phone_number || !form.friendly_name) {
      toast.error('Phone number and label required');
      return;
    }
    let phone = form.phone_number.replace(/\D/g, '');
    if (phone.length === 10) phone = '+1' + phone;
    else if (!phone.startsWith('+')) phone = '+' + phone;

    if (editId) {
      const { error } = await (supabase as any)
        .from('dc_phone_numbers')
        .update({ friendly_name: form.friendly_name, business: form.business || null })
        .eq('id', editId);
      if (error) { toast.error(error.message); return; }
      toast.success('Number updated');
    } else {
      const { error } = await (supabase as any).from('dc_phone_numbers').insert({
        phone_number: phone,
        friendly_name: form.friendly_name,
        business: form.business || 'Brandaro',
        number_type: 'local',
        is_active: true,
      });
      if (error) { toast.error(error.message); return; }
      toast.success('Number added');
    }
    setAddOpen(false);
    setEditId(null);
    setForm({ phone_number: '', friendly_name: '', business: '' });
    invalidate();
  };

  // Force release = end every active va_sessions row for this number.
  const forceRelease = async (numberId: string, phone: string) => {
    setReleasingId(numberId);
    try {
      const { error, count } = await (supabase as any)
        .from('va_sessions')
        .update(
          { is_active: false, ended_at: new Date().toISOString() },
          { count: 'exact' },
        )
        .eq('twilio_number_id', numberId)
        .eq('is_active', true);
      if (error) throw error;
      toast.success(`Released ${phone} (${count ?? 0} session${count === 1 ? '' : 's'} ended)`);
      invalidate();
    } catch (err: any) {
      toast.error(`Force release failed: ${err.message || err}`);
    } finally {
      setReleasingId(null);
    }
  };

  const deleteNumber = async (id: string, inUse: boolean) => {
    if (inUse) { toast.error('Force release the number first'); return; }
    if (!confirm('Delete this number from the pool? This cannot be undone.')) return;
    const { error } = await (supabase as any).from('dc_phone_numbers').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Number deleted');
    invalidate();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6 text-primary" /> Phone Number Pool
          </h1>
          <p className="text-sm text-muted-foreground">
            Caller-ID pool used by /va/dashboard. Force release any number stuck in an active session.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={invalidate}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button onClick={() => { setForm({ phone_number: '', friendly_name: '', business: '' }); setEditId(null); setAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Number
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {(numbers as any[]).map((num: any) => {
            const sess = sessionsById?.get(num.id);
            const inUse = !!sess?.session_active;
            const releasing = releasingId === num.id;
            return (
              <Card key={num.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <Phone className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{num.friendly_name || num.phone_number}</p>
                      <p className="text-sm text-muted-foreground font-mono">{num.phone_number}</p>
                      {inUse && (
                        <p className="text-[11px] text-red-600 mt-1">
                          In use by {sess?.va_name || sess?.va_email || 'unknown VA'} since {formatDateTime(sess?.started_at)}
                        </p>
                      )}
                    </div>
                    <Badge className={inUse ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                      {inUse ? '🔴 In Use' : '🟢 Available'}
                    </Badge>
                    {!num.is_active && <Badge variant="outline">Inactive</Badge>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {inUse && (
                      <Button size="sm" variant="outline" className="text-xs gap-1"
                        disabled={releasing}
                        onClick={() => forceRelease(num.id, num.phone_number)}>
                        {releasing
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Unlock className="h-3 w-3" />}
                        Force Release
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => {
                      setForm({ phone_number: num.phone_number, friendly_name: num.friendly_name || '', business: num.business || '' });
                      setEditId(num.id); setAddOpen(true);
                    }}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive"
                      onClick={() => deleteNumber(num.id, inUse)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {(numbers as any[]).length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-12">No numbers in pool yet.</p>
          )}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Edit Number' : 'Add Number'}</DialogTitle></DialogHeader>
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
            <div>
              <label className="text-sm font-medium">Business (optional)</label>
              <Input value={form.business} onChange={e => setForm(f => ({ ...f, business: e.target.value }))}
                placeholder="Brandaro" />
            </div>
            <Button onClick={handleSave} className="w-full">
              {editId ? 'Update' : 'Add Number'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
