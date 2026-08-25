import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SFRecruitingQueue } from './components/SFRecruitingQueue';
import { toast } from 'sonner';
import { Plus, Scale, Phone, Mail } from 'lucide-react';


export default function SFAttorneys() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data: attorneys = [] } = useQuery({
    queryKey: ['sf-attorneys'],
    queryFn: async () => {
      const { data } = await supabase.from('surplus_funds_attorneys').select('*').order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const addAttorney = useMutation({
    mutationFn: async (atty: any) => {
      const { error } = await supabase.from('surplus_funds_attorneys').insert(atty);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sf-attorneys'] }); toast.success('Attorney added'); setAddOpen(false); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amber-500">⚖️ Floor 4 — Attorney Network</h1>
          <p className="text-sm text-muted-foreground">{attorneys.length} attorney partners</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild><Button className="bg-amber-600 hover:bg-amber-700"><Plus className="h-4 w-4 mr-2" />Add Attorney</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Attorney Partner</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); addAttorney.mutate({ name: fd.get('name'), firm: fd.get('firm'), phone: fd.get('phone'), email: fd.get('email'), states: (fd.get('states') as string)?.split(',').map(s => s.trim()).filter(Boolean) || [], fee_split: Number(fd.get('fee_split')) || 35, notes: fd.get('notes') }); }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name *</Label><Input name="name" required /></div>
                <div><Label>Firm</Label><Input name="firm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Phone</Label><Input name="phone" /></div>
                <div><Label>Email</Label><Input name="email" type="email" /></div>
              </div>
              <div><Label>Licensed States (comma-separated)</Label><Input name="states" placeholder="FL, TX, CA" /></div>
              <div><Label>Fee Split %</Label><Input name="fee_split" type="number" defaultValue={35} /></div>
              <div><Label>Notes</Label><Input name="notes" /></div>
              <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700">Add Attorney</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Firm</th>
              <th className="p-3 text-left">States</th>
              <th className="p-3 text-left">Cases</th>
              <th className="p-3 text-left">Win Rate</th>
              <th className="p-3 text-left">Fee Split</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Contact</th>
            </tr></thead>
            <tbody>
              {attorneys.map((a: any) => (
                <tr key={a.id} className="border-b border-border/50 hover:bg-accent/30">
                  <td className="p-3 font-medium">{a.name}</td>
                  <td className="p-3">{a.firm || '—'}</td>
                  <td className="p-3"><div className="flex flex-wrap gap-1">{(a.states ?? []).map((s: string) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}</div></td>
                  <td className="p-3">{a.cases_total}</td>
                  <td className="p-3">{a.cases_total > 0 ? Math.round((a.cases_won / a.cases_total) * 100) : 0}%</td>
                  <td className="p-3">{a.fee_split}%</td>
                  <td className="p-3"><Badge variant="outline" className={a.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500' : 'bg-muted text-muted-foreground'}>{a.status}</Badge></td>
                  <td className="p-3 flex gap-1">
                    {a.phone && <Button size="sm" variant="ghost"><Phone className="h-3 w-3" /></Button>}
                    {a.email && <Button size="sm" variant="ghost"><Mail className="h-3 w-3" /></Button>}
                  </td>
                </tr>
              ))}
              {attorneys.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No attorneys yet. Add your first partner!</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
