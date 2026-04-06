import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTopTierData, postTopTierData, patchTopTierData, deleteTopTierData, logPenthouseAction } from '@/lib/toptierApi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Gift, Plus, Edit, Trash2, Loader2 } from 'lucide-react';

type FormMode = 'create' | 'edit';

export default function PenthouseGiftExperiences() {
  const qc = useQueryClient();

  const { data: experiences = [], isLoading } = useQuery({
    queryKey: ['ph-gift-experiences'],
    queryFn: () => fetchTopTierData('vehicle_gift_experiences', { select: '*', order: 'created_at.desc' }),
  });

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<FormMode>('create');
  const [form, setForm] = useState<any>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const getActorId = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || 'unknown';
  };

  const saveMutation = useMutation({
    mutationFn: async (d: any) => {
      const actorId = await getActorId();
      if (mode === 'create') {
      const res = await postTopTierData('vehicle_gift_experiences', d);
        await logPenthouseAction({ actor_user_id: actorId, action: 'create_gift_experience', target_type: 'vehicle_gift_experiences', target_id: res?.[0]?.id, after: d });
        return res;
      }
      const { id, ...rest } = d;
      await patchTopTierData('vehicle_gift_experiences', id, rest);
      await logPenthouseAction({ actor_user_id: actorId, action: 'update_gift_experience', target_type: 'vehicle_gift_experiences', target_id: id, after: rest });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ph-gift-experiences'] });
      toast.success(mode === 'create' ? 'Experience created' : 'Experience updated');
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const actorId = await getActorId();
      await deleteTopTierData('vehicle_gift_experiences', id);
      await logPenthouseAction(actorId, 'delete_gift_experience', 'vehicle_gift_experiences', id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ph-gift-experiences'] });
      toast.success('Experience removed');
      setDeleteConfirm(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openCreate = () => { setMode('create'); setForm({ name: '', base_price: 0, description: '', is_active: true }); setOpen(true); };
  const openEdit = (item: any) => { setMode('edit'); setForm(item); setOpen(true); };

  const activeCount = experiences.filter((e: any) => e.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#C9A84C]">Vehicle Gift Experiences</h1>
          <p className="text-sm text-white/40 mt-1">Manage luxury reveal experience packages</p>
        </div>
        <Button onClick={openCreate} className="bg-[#C9A84C] text-black hover:bg-[#B8973F]">
          <Plus className="h-4 w-4 mr-2" /> Add Experience
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Packages', value: experiences.length },
          { label: 'Active', value: activeCount },
          { label: 'Inactive', value: experiences.length - activeCount },
        ].map(s => (
          <Card key={s.label} className="bg-[#111] border-[#C9A84C]/10">
            <CardContent className="p-4">
              <p className="text-xs text-white/40">{s.label}</p>
              <p className="text-2xl font-bold text-[#C9A84C]">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="bg-[#111] border-[#C9A84C]/10">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#C9A84C]" /></div>
          ) : experiences.length === 0 ? (
            <div className="text-center py-12 text-white/40">
              <Gift className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No gift experiences yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#C9A84C]/10">
                  <TableHead className="text-white/50">Name</TableHead>
                  <TableHead className="text-white/50">Price</TableHead>
                  <TableHead className="text-white/50">Status</TableHead>
                  <TableHead className="text-white/50 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {experiences.map((exp: any) => (
                  <TableRow key={exp.id} className="border-[#C9A84C]/5">
                    <TableCell>
                      <div>
                        <p className="font-medium text-white">{exp.name}</p>
                        {exp.description && <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{exp.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-[#C9A84C] font-mono">${Number(exp.base_price).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={exp.is_active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/10 text-white/40 border-white/10'}>
                        {exp.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-[#C9A84C]" onClick={() => openEdit(exp)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-red-400" onClick={() => setDeleteConfirm({ id: exp.id, name: exp.name })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#111] border-[#C9A84C]/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-[#C9A84C]">{mode === 'create' ? 'New Gift Experience' : 'Edit Experience'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white/60">Name</Label>
              <Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-black/30 border-white/10" />
            </div>
            <div>
              <Label className="text-white/60">Base Price ($)</Label>
              <Input type="number" value={form.base_price || 0} onChange={e => setForm({ ...form, base_price: Number(e.target.value) })} className="bg-black/30 border-white/10" />
            </div>
            <div>
              <Label className="text-white/60">Description</Label>
              <Textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-black/30 border-white/10" rows={3} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active ?? true} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              <Label className="text-white/60">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-white/10 text-white/60">Cancel</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.name} className="bg-[#C9A84C] text-black hover:bg-[#B8973F]">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-[#111] border-red-500/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Experience</DialogTitle>
          </DialogHeader>
          <p className="text-white/60">Remove <strong className="text-white">{deleteConfirm?.name}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="border-white/10 text-white/60">Cancel</Button>
            <Button onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)} disabled={deleteMutation.isPending} className="bg-red-600 hover:bg-red-700">
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
