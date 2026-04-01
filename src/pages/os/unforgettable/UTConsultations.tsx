import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Phone, MapPin } from 'lucide-react';

const PINK = '#E91E8C';

const COLUMNS = [
  { value: 'pending', label: '🟡 New', color: 'border-yellow-500' },
  { value: 'called', label: '🔵 Called', color: 'border-blue-500' },
  { value: 'quote_sent', label: '📋 Quote Sent', color: 'border-purple-500' },
  { value: 'closed_won', label: '✅ Won', color: 'border-green-500' },
  { value: 'closed_lost', label: '❌ Lost', color: 'border-red-500' },
];

export default function UTConsultations() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', best_time: '', kit_interest: '', budget: '', location: '', notes: '' });

  const { data: consultations = [] } = useQuery({
    queryKey: ['ut-consultations'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_business_consultations' as any).select('*').order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase.from('ut_business_consultations' as any).insert(values);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ut-consultations'] });
      setAddOpen(false);
      setForm({ name: '', email: '', phone: '', best_time: '', kit_interest: '', budget: '', location: '', notes: '' });
      toast.success('Consultation added');
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('ut_business_consultations' as any).update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ut-consultations'] });
      toast.success('Status updated');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: PINK }}>📞 Business Consultations</h1>
          <p className="text-muted-foreground">Track every consultation from first contact to close</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Manual Consultation</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Consultation</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email *</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Phone *</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Best Time</Label><Input value={form.best_time} onChange={e => setForm({ ...form, best_time: e.target.value })} /></div>
                <div><Label>Kit Interest</Label><Input value={form.kit_interest} onChange={e => setForm({ ...form, kit_interest: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Budget</Label><Input value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} /></div>
                <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <Button onClick={() => addMutation.mutate(form)} disabled={!form.name || !form.email || !form.phone}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban */}
      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-4">
          {COLUMNS.map(col => {
            const items = consultations.filter(c => c.status === col.value);
            return (
              <div key={col.value} className="w-64 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold">{col.label}</span>
                  <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                </div>
                <div className="space-y-2">
                  {items.map((c: any) => (
                    <Card key={c.id} className={`border-l-4 ${col.color}`}>
                      <CardContent className="p-3 space-y-1">
                        <p className="font-semibold text-sm">{c.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</p>
                        {c.kit_interest && <p className="text-xs">Kit: {c.kit_interest}</p>}
                        {c.budget && <p className="text-xs">Budget: {c.budget}</p>}
                        {c.location && <p className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> {c.location}</p>}
                        <Select onValueChange={v => updateStatus.mutate({ id: c.id, status: v })}>
                          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue placeholder="Move →" /></SelectTrigger>
                          <SelectContent>{COLUMNS.filter(x => x.value !== col.value).map(x => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  ))}
                  {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
