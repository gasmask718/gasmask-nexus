import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Package, Plus, DollarSign, TrendingUp, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function KidsFamilyBundles() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ bundle_name: '', description: '', category: 'Birthday Party', city: '', base_cost: '', markup_pct: '20' });
  const queryClient = useQueryClient();

  const { data: bundles = [], isLoading } = useQuery({
    queryKey: ['kf-bundles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('kf_bundles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createBundle = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('kf_bundles').insert({
        bundle_name: form.bundle_name,
        description: form.description,
        category: form.category,
        city: form.city || null,
        base_cost: parseFloat(form.base_cost) || 0,
        markup_pct: parseFloat(form.markup_pct) || 20,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kf-bundles'] });
      toast.success('Bundle created');
      setShowCreate(false);
      setForm({ bundle_name: '', description: '', category: 'Birthday Party', city: '', base_cost: '', markup_pct: '20' });
    },
    onError: (e) => toast.error(e.message),
  });

  const totalRevenue = bundles.reduce((a: number, b: any) => a + ((b.final_price || 0) * (b.total_sold || 0)), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bundle Engine</h1>
          <p className="text-sm text-white/50">Create & manage experience bundles — the core money system</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80"><Plus className="h-4 w-4 mr-1" /> Create Bundle</Button>
          </DialogTrigger>
          <DialogContent className="bg-[#111] border-white/10 text-white">
            <DialogHeader><DialogTitle>Create New Bundle</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-white/60">Bundle Name</Label><Input value={form.bundle_name} onChange={e => setForm(f => ({ ...f, bundle_name: e.target.value }))} className="bg-white/5 border-white/10 text-white" /></div>
              <div><Label className="text-white/60">Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-white/5 border-white/10 text-white" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-white/60">Category</Label><Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="bg-white/5 border-white/10 text-white" /></div>
                <div><Label className="text-white/60">City</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="bg-white/5 border-white/10 text-white" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-white/60">Base Cost ($)</Label><Input type="number" value={form.base_cost} onChange={e => setForm(f => ({ ...f, base_cost: e.target.value }))} className="bg-white/5 border-white/10 text-white" /></div>
                <div><Label className="text-white/60">Markup %</Label><Input type="number" value={form.markup_pct} onChange={e => setForm(f => ({ ...f, markup_pct: e.target.value }))} className="bg-white/5 border-white/10 text-white" /></div>
              </div>
              <p className="text-sm text-[#C9A84C]">Final Price: ${((parseFloat(form.base_cost) || 0) * (1 + (parseFloat(form.markup_pct) || 0) / 100)).toFixed(2)}</p>
              <Button onClick={() => createBundle.mutate()} disabled={!form.bundle_name || createBundle.isPending} className="w-full bg-[#C9A84C] text-black">
                {createBundle.isPending ? 'Creating...' : 'Create Bundle'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Bundles', value: bundles.length, icon: Package, color: 'text-[#C9A84C]' },
          { label: 'Active', value: bundles.filter((b: any) => b.status === 'active').length, icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'AI Generated', value: bundles.filter((b: any) => b.is_ai_generated).length, icon: Sparkles, color: 'text-purple-400' },
          { label: 'Bundle Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-blue-400' },
        ].map(s => (
          <Card key={s.label} className="bg-white/5 border-white/10">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-xs text-white/40">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-white/50">Bundle</TableHead>
                <TableHead className="text-white/50">Category</TableHead>
                <TableHead className="text-white/50">City</TableHead>
                <TableHead className="text-white/50">Base Cost</TableHead>
                <TableHead className="text-white/50">Markup</TableHead>
                <TableHead className="text-white/50">Final Price</TableHead>
                <TableHead className="text-white/50">Sold</TableHead>
                <TableHead className="text-white/50">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-white/30 py-8">Loading...</TableCell></TableRow>
              ) : bundles.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-white/30 py-8">No bundles created yet</TableCell></TableRow>
              ) : bundles.map((b: any) => (
                <TableRow key={b.id} className="border-white/5 hover:bg-white/5">
                  <TableCell className="text-white font-medium">
                    <div className="flex items-center gap-2">
                      {b.bundle_name}
                      {b.is_ai_generated && <Sparkles className="h-3 w-3 text-purple-400" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-white/60">{b.category}</TableCell>
                  <TableCell className="text-white/60">{b.city || '—'}</TableCell>
                  <TableCell className="text-white/60">${b.base_cost?.toFixed(2)}</TableCell>
                  <TableCell className="text-amber-400">{b.markup_pct}%</TableCell>
                  <TableCell className="text-[#C9A84C] font-bold">${b.final_price?.toFixed(2)}</TableCell>
                  <TableCell className="text-white/60">{b.total_sold || 0}</TableCell>
                  <TableCell><Badge className={b.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}>{b.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
