import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTopTierData, patchTopTierData, postTopTierData, deleteTopTierData, logPenthouseAction } from '@/lib/toptierApi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Car, Plus, Loader2, Upload, X, Edit, Trash2, Star, User, Phone, Mail
} from 'lucide-react';

type FormMode = 'create' | 'edit';

export default function PenthouseDrivers() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [formData, setFormData] = useState<any>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['ph-drivers'],
    queryFn: () => fetchTopTierData('tt_drivers', { select: '*', order: 'created_at.desc' }),
  });

  const getActorId = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || 'unknown';
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Max 10MB'); return; }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const name = `drivers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('toptier-assets').upload(name, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('toptier-assets').getPublicUrl(name);
      setFormData((d: any) => ({ ...d, photo_url: urlData.publicUrl }));
      toast.success('Photo uploaded');
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  const saveMutation = useMutation({
    mutationFn: async ({ data, mode, id }: { data: any; mode: FormMode; id?: string }) => {
      const actorId = await getActorId();
      if (mode === 'create') {
        const result = await postTopTierData('tt_drivers', data);
        await logPenthouseAction({ action: 'create_driver', target_type: 'tt_drivers', actor_user_id: actorId, after: data });
        return result;
      } else {
        const result = await patchTopTierData('tt_drivers', { id: `eq.${id}` }, { ...data, updated_at: new Date().toISOString() });
        await logPenthouseAction({ action: 'edit_driver', target_type: 'tt_drivers', target_id: id, actor_user_id: actorId, after: data });
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-drivers'] });
      setFormOpen(false);
      toast.success(formMode === 'create' ? 'Driver created' : 'Driver updated');
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteTopTierData('tt_drivers', { id: `eq.${id}` });
      const actorId = await getActorId();
      await logPenthouseAction({ action: 'delete_driver', target_type: 'tt_drivers', target_id: id, actor_user_id: actorId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-drivers'] });
      setDeleteConfirm(null);
      toast.success('Driver deleted');
    },
    onError: (e) => toast.error(e.message),
  });

  const statusToggle = useMutation({
    mutationFn: async ({ id, current }: { id: string; current: string }) => {
      const newStatus = current === 'active' ? 'inactive' : 'active';
      await patchTopTierData('tt_drivers', { id: `eq.${id}` }, { status: newStatus, updated_at: new Date().toISOString() });
      const actorId = await getActorId();
      await logPenthouseAction({ action: 'toggle_driver_status', target_type: 'tt_drivers', target_id: id, actor_user_id: actorId, before: { status: current }, after: { status: newStatus } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-drivers'] });
      toast.success('Status updated');
    },
  });

  const openCreate = () => { setFormMode('create'); setFormData({}); setFormOpen(true); };
  const openEdit = (d: any) => { setFormMode('edit'); setFormData({ ...d }); setFormOpen(true); };

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      active: 'bg-emerald-500/20 text-emerald-400',
      inactive: 'bg-white/10 text-white/40',
      on_duty: 'bg-blue-500/20 text-blue-400',
      off_duty: 'bg-amber-500/20 text-amber-400',
    };
    return <Badge className={`text-[10px] ${colors[s] || 'bg-white/10 text-white/40'}`}>{s?.replace(/_/g, ' ')}</Badge>;
  };

  const activeCount = drivers.filter((d: any) => d.status === 'active').length;
  const onDutyCount = drivers.filter((d: any) => d.duty_status === 'on_duty').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#C9A84C]">Driver Fleet</h1>
          <p className="text-white/40 text-sm mt-1">Manage TopTier chauffeurs and vehicle assignments</p>
        </div>
        <Button onClick={openCreate} className="bg-[#C9A84C] hover:bg-[#B89A3C] text-black text-xs h-8">
          <Plus className="h-3 w-3 mr-1" /> Add Driver
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Drivers', value: drivers.length, color: '#C9A84C' },
          { label: 'Active', value: activeCount, color: '#22c55e' },
          { label: 'On Duty', value: onDutyCount, color: '#3b82f6' },
        ].map((s, i) => (
          <Card key={i} className="bg-[#111] border-white/5">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/40">{s.label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-[#111] border-white/5">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5">
                <TableHead className="text-white/40">Photo</TableHead>
                <TableHead className="text-white/40">Name</TableHead>
                <TableHead className="text-white/40">Phone</TableHead>
                <TableHead className="text-white/40">Vehicle</TableHead>
                <TableHead className="text-white/40">Status</TableHead>
                <TableHead className="text-white/40">Duty</TableHead>
                <TableHead className="text-white/40">Rating</TableHead>
                <TableHead className="text-white/40">Trips</TableHead>
                <TableHead className="text-white/40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((d: any) => (
                <TableRow key={d.id} className="border-white/5 hover:bg-white/[0.02]">
                  <TableCell>
                    {d.photo_url ? (
                      <img src={d.photo_url} alt="" className="h-10 w-10 rounded-full object-cover border border-white/10" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center"><User className="h-4 w-4 text-white/20" /></div>
                    )}
                  </TableCell>
                  <TableCell className="text-white/80 text-sm font-medium">{d.full_name || `${d.first_name || ''} ${d.last_name || ''}`.trim() || '—'}</TableCell>
                  <TableCell className="text-white/50 text-sm">{d.phone || '—'}</TableCell>
                  <TableCell className="text-white/50 text-sm">
                    {d.has_vehicle ? `${d.vehicle_year || ''} ${d.vehicle_make || ''} ${d.vehicle_model || ''}`.trim() : '—'}
                  </TableCell>
                  <TableCell>{statusBadge(d.status || 'active')}</TableCell>
                  <TableCell>{statusBadge(d.duty_status || 'off_duty')}</TableCell>
                  <TableCell className="text-[#C9A84C] text-sm">{d.rating ? `${Number(d.rating).toFixed(1)}★` : '—'}</TableCell>
                  <TableCell className="text-white/50 text-sm">{d.total_trips || 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400" onClick={() => openEdit(d)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" onClick={() => setDeleteConfirm({ id: d.id, name: d.full_name || d.first_name || d.id })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {drivers.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-white/30 py-8">{isLoading ? 'Loading...' : 'No drivers found'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-[#C9A84C]">{formMode === 'create' ? 'Add New Driver' : 'Edit Driver'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-3">
            <div className="space-y-4">
              {/* Photo */}
              <div>
                <Label className="text-white/50 text-xs">Driver Photo</Label>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                {formData.photo_url ? (
                  <div className="relative mt-1 w-24">
                    <img src={formData.photo_url} alt="" className="h-24 w-24 rounded-full object-cover border border-white/10" />
                    <Button size="sm" variant="ghost" className="absolute top-0 right-0 h-5 w-5 bg-black/60 p-0 rounded-full" onClick={() => setFormData((d: any) => ({ ...d, photo_url: null }))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" className="mt-1 border-dashed border-white/10 text-white/40" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {uploading ? 'Uploading...' : 'Upload Photo'}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-white/50 text-xs">First Name</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.first_name || ''} onChange={e => setFormData({ ...formData, first_name: e.target.value })} /></div>
                <div><Label className="text-white/50 text-xs">Last Name</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.last_name || ''} onChange={e => setFormData({ ...formData, last_name: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-white/50 text-xs">Phone</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
                <div><Label className="text-white/50 text-xs">Email</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-white/50 text-xs">Status</Label>
                  <Select value={formData.status || 'active'} onValueChange={v => setFormData({ ...formData, status: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-white/50 text-xs">Duty Status</Label>
                  <Select value={formData.duty_status || 'off_duty'} onValueChange={v => setFormData({ ...formData, duty_status: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on_duty">On Duty</SelectItem>
                      <SelectItem value="off_duty">Off Duty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={formData.has_vehicle || false} onCheckedChange={v => setFormData({ ...formData, has_vehicle: v })} />
                <Label className="text-white/60 text-xs">Has Vehicle</Label>
              </div>

              {formData.has_vehicle && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-white/50 text-xs">Vehicle Make</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.vehicle_make || ''} onChange={e => setFormData({ ...formData, vehicle_make: e.target.value })} /></div>
                    <div><Label className="text-white/50 text-xs">Vehicle Model</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.vehicle_model || ''} onChange={e => setFormData({ ...formData, vehicle_model: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label className="text-white/50 text-xs">Year</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={formData.vehicle_year || ''} onChange={e => setFormData({ ...formData, vehicle_year: parseInt(e.target.value) || null })} /></div>
                    <div><Label className="text-white/50 text-xs">Color</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.vehicle_color || ''} onChange={e => setFormData({ ...formData, vehicle_color: e.target.value })} /></div>
                    <div><Label className="text-white/50 text-xs">License Plate</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.license_plate || ''} onChange={e => setFormData({ ...formData, license_plate: e.target.value })} /></div>
                  </div>
                </>
              )}

              <div><Label className="text-white/50 text-xs">Intake Notes</Label><Textarea className="bg-white/5 border-white/10 text-white min-h-[60px]" value={formData.intake_notes || ''} onChange={e => setFormData({ ...formData, intake_notes: e.target.value })} /></div>
              <div><Label className="text-white/50 text-xs">Admin Notes</Label><Textarea className="bg-white/5 border-white/10 text-white min-h-[60px]" value={formData.admin_notes || ''} onChange={e => setFormData({ ...formData, admin_notes: e.target.value })} /></div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} className="border-white/10 text-white/50">Cancel</Button>
            <Button
              onClick={() => {
                const { id, created_at, updated_at, is_simulation, created_by, total_trips, rating, ...cleanData } = formData;
                saveMutation.mutate({ data: cleanData, mode: formMode, id: formData.id });
              }}
              disabled={saveMutation.isPending}
              className="bg-[#C9A84C] hover:bg-[#B89A3C] text-black"
            >
              {saveMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {formMode === 'create' ? 'Add Driver' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-[#111] border-red-500/20 text-white max-w-sm">
          <DialogHeader><DialogTitle className="text-red-400">Confirm Delete</DialogTitle></DialogHeader>
          <p className="text-white/60 text-sm">Delete driver <strong className="text-white">{deleteConfirm?.name}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="border-white/10 text-white/50">Cancel</Button>
            <Button onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)} disabled={deleteMutation.isPending} className="bg-red-600 hover:bg-red-700">
              {deleteMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
