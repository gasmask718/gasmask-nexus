import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTopTierData, patchTopTierData, postTopTierData, logPenthouseAction } from '@/lib/toptierApi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Users, CheckCircle, Clock, Star, Download, Eye, Ban,
  Check, Loader2, Plus, Edit, Upload, X, Image as ImageIcon
} from 'lucide-react';

export default function PenthousePartners() {
  const queryClient = useQueryClient();
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['ph-partners-list'],
    queryFn: () => fetchTopTierData('tt_partners', { select: '*', order: 'created_at.desc' }),
  });

  const { data: earnings = [] } = useQuery({
    queryKey: ['ph-partner-earnings-all'],
    queryFn: () => fetchTopTierData('tt_partner_earnings', { select: '*' }),
  });

  const getActorId = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || 'unknown';
  };

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, currentStatus }: { id: string; status: string; currentStatus?: string }) => {
      const result = await patchTopTierData('tt_partners', { id: `eq.${id}` }, { status, updated_at: new Date().toISOString() });
      const actorId = await getActorId();
      await logPenthouseAction({ action: `partner_${status}`, target_type: 'tt_partners', target_id: id, actor_user_id: actorId, before: { status: currentStatus }, after: { status } });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-partners-list'] });
      toast.success('Partner status updated');
      setSelectedPartner(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ data, mode, id }: { data: any; mode: 'create' | 'edit'; id?: string }) => {
      const actorId = await getActorId();
      if (mode === 'create') {
        const result = await postTopTierData('tt_partners', data);
        await logPenthouseAction({ action: 'create_partner', target_type: 'tt_partners', actor_user_id: actorId, after: data });
        return result;
      } else {
        const result = await patchTopTierData('tt_partners', { id: `eq.${id}` }, { ...data, updated_at: new Date().toISOString() });
        await logPenthouseAction({ action: 'edit_partner', target_type: 'tt_partners', target_id: id, actor_user_id: actorId, after: data });
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-partners-list'] });
      setFormOpen(false);
      toast.success(formMode === 'create' ? 'Partner created' : 'Partner updated');
    },
    onError: (e) => toast.error(e.message),
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return; }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const name = `partners/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('toptier-assets').upload(name, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('toptier-assets').getPublicUrl(name);
      setFormData((d: any) => ({ ...d, avatar_url: urlData.publicUrl }));
      toast.success('Avatar uploaded');
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  const openCreate = () => {
    setFormMode('create');
    setFormData({ status: 'pending' });
    setFormOpen(true);
  };

  const openEdit = (p: any) => {
    setFormMode('edit');
    setFormData({ ...p });
    setFormOpen(true);
  };

  const total = partners.length;
  const active = partners.filter((p: any) => p.status === 'active').length;
  const pending = partners.filter((p: any) => p.status === 'pending').length;
  const avgTrust = total > 0 ? Math.round(partners.reduce((s: number, p: any) => s + (p.trust_score || 0), 0) / total) : 0;

  const stats = [
    { label: 'Total Partners', value: total, icon: Users, color: '#C9A84C' },
    { label: 'Active', value: active, icon: CheckCircle, color: '#22c55e' },
    { label: 'Pending Approval', value: pending, icon: Clock, color: '#f59e0b' },
    { label: 'Avg Trust Score', value: `${avgTrust}/5`, icon: Star, color: '#C9A84C' },
  ];

  const statusColor = (s: string) => {
    if (s === 'active') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (s === 'pending') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  const exportCSV = () => {
    const rows = [['Name', 'Business', 'Category', 'Status', 'Trust Score', 'Bookings', 'Earnings', 'Commission Rate']];
    partners.forEach((p: any) => rows.push([p.name, p.business_name, p.service_category, p.status, p.trust_score, p.total_bookings, p.total_earnings, p.commission_rate]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'partners.csv'; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#C9A84C]">Partner Management</h1>
          <p className="text-white/40 text-sm mt-1">Full partner lifecycle — create, edit, approve, suspend</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreate} className="bg-[#C9A84C] hover:bg-[#B89A3C] text-black text-xs h-8">
            <Plus className="h-3 w-3 mr-1" /> Add Partner
          </Button>
          <Button onClick={exportCSV} variant="outline" className="border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10 text-xs h-8">
            <Download className="h-3 w-3 mr-1" /> Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <Card key={i} className="bg-[#111] border-white/5">
            <CardContent className="p-4">
              {isLoading ? <Skeleton className="h-12 bg-white/5" /> : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/40">{s.label}</p>
                    <p className="text-xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
                  </div>
                  <s.icon className="h-4 w-4" style={{ color: s.color, opacity: 0.5 }} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-[#111] border-white/5">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-white/40">Partner</TableHead>
                <TableHead className="text-white/40">Category</TableHead>
                <TableHead className="text-white/40">Status</TableHead>
                <TableHead className="text-white/40">Trust</TableHead>
                <TableHead className="text-white/40">Bookings</TableHead>
                <TableHead className="text-white/40">Commission</TableHead>
                <TableHead className="text-white/40">Earnings</TableHead>
                <TableHead className="text-white/40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map((p: any) => (
                <TableRow key={p.id} className="border-white/5 hover:bg-white/[0.02] cursor-pointer" onClick={() => setSelectedPartner(p)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover border border-white/10" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-[#C9A84C]/10 flex items-center justify-center text-[10px] text-[#C9A84C] font-bold">
                          {(p.name || '?').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-white/80">{p.name}</p>
                        <p className="text-xs text-white/40">{p.business_name}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] border-white/10 text-white/50">{p.service_category}</Badge></TableCell>
                  <TableCell><Badge className={`text-[10px] ${statusColor(p.status)}`}>{p.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} className={`h-3 w-3 ${n <= (p.trust_score || 0) ? 'text-[#C9A84C] fill-[#C9A84C]' : 'text-white/10'}`} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-white/60 text-sm">{p.total_bookings || 0}</TableCell>
                  <TableCell className="text-white/60 text-sm">{p.commission_rate || 15}%</TableCell>
                  <TableCell className="text-[#C9A84C] text-sm font-mono">${Number(p.total_earnings || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400" onClick={() => openEdit(p)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      {p.status === 'pending' && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: p.id, status: 'active', currentStatus: p.status })}>
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                      {p.status !== 'suspended' && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: p.id, status: 'suspended', currentStatus: p.status })}>
                          <Ban className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selectedPartner} onOpenChange={() => setSelectedPartner(null)}>
        <SheetContent className="bg-[#111] border-l border-[#C9A84C]/10 text-white w-[500px]">
          {selectedPartner && (
            <>
              <SheetHeader>
                <SheetTitle className="text-[#C9A84C] font-serif">{selectedPartner.name}</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-120px)] mt-4">
                <div className="space-y-4">
                  {selectedPartner.avatar_url && (
                    <img src={selectedPartner.avatar_url} alt="" className="w-full h-40 rounded-lg object-cover border border-white/10" />
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['Business', selectedPartner.business_name],
                      ['Category', selectedPartner.service_category],
                      ['Email', selectedPartner.email],
                      ['Phone', selectedPartner.phone],
                      ['Website', selectedPartner.website],
                      ['Address', selectedPartner.address],
                      ['Commission', `${selectedPartner.commission_rate || 15}%`],
                      ['Total Earnings', `$${Number(selectedPartner.total_earnings || 0).toLocaleString()}`],
                      ['Response Rate', `${selectedPartner.response_rate || 0}%`],
                      ['Status', selectedPartner.status],
                    ].map(([label, val]) => (
                      <div key={label as string} className="p-3 bg-white/[0.03] rounded-lg">
                        <p className="text-[10px] text-white/40 uppercase">{label}</p>
                        <p className="text-sm text-white/80 mt-1">{val || '—'}</p>
                      </div>
                    ))}
                  </div>
                  {selectedPartner.bio && (
                    <div className="p-3 bg-white/[0.03] rounded-lg">
                      <p className="text-[10px] text-white/40 uppercase">Bio</p>
                      <p className="text-sm text-white/60 mt-1">{selectedPartner.bio}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-white/40 uppercase mb-2">Recent Earnings</p>
                    {earnings.filter((e: any) => e.partner_id === selectedPartner.id).slice(0, 5).map((e: any) => (
                      <div key={e.id} className="flex justify-between p-2 border-b border-white/5">
                        <span className="text-sm text-white/60">{new Date(e.created_at).toLocaleDateString()}</span>
                        <span className="text-sm text-[#C9A84C]">${Number(e.amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs" onClick={() => { setSelectedPartner(null); openEdit(selectedPartner); }}>
                      <Edit className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    {selectedPartner.status !== 'active' && (
                      <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-xs" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: selectedPartner.id, status: 'active', currentStatus: selectedPartner.status })}>
                        <Check className="h-3 w-3 mr-1" /> Approve
                      </Button>
                    )}
                    {selectedPartner.status !== 'suspended' && (
                      <Button className="flex-1 bg-red-600 hover:bg-red-700 text-xs" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: selectedPartner.id, status: 'suspended', currentStatus: selectedPartner.status })}>
                        <Ban className="h-3 w-3 mr-1" /> Suspend
                      </Button>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-[#C9A84C]">{formMode === 'create' ? 'Add New Partner' : 'Edit Partner'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-3">
            <div className="space-y-4">
              <div>
                <Label className="text-white/50 text-xs">Avatar</Label>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                {formData.avatar_url ? (
                  <div className="relative mt-1 w-20 h-20">
                    <img src={formData.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover border border-white/10" />
                    <button className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center" onClick={() => setFormData((d: any) => ({ ...d, avatar_url: null }))}>
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <Button variant="outline" className="mt-1 border-dashed border-white/10 text-white/40 text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                    Upload Avatar
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-white/50 text-xs">Name</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                <div><Label className="text-white/50 text-xs">Business Name</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.business_name || ''} onChange={e => setFormData({ ...formData, business_name: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-white/50 text-xs">Email</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                <div><Label className="text-white/50 text-xs">Phone</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-white/50 text-xs">Service Category</Label>
                  <Select value={formData.service_category || ''} onValueChange={v => setFormData({ ...formData, service_category: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {['luxury_dining', 'yacht', 'villa', 'spa', 'adventure', 'nightlife', 'private_event', 'concierge', 'automotive', 'helicopter', 'aviation'].map(c => (
                        <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-white/50 text-xs">Commission Rate (%)</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={formData.commission_rate ?? 15} onChange={e => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) || 15 })} /></div>
              </div>
              <div><Label className="text-white/50 text-xs">Website</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.website || ''} onChange={e => setFormData({ ...formData, website: e.target.value })} /></div>
              <div><Label className="text-white/50 text-xs">Address</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.address || ''} onChange={e => setFormData({ ...formData, address: e.target.value })} /></div>
              <div><Label className="text-white/50 text-xs">Bio</Label><Textarea className="bg-white/5 border-white/10 text-white min-h-[80px]" value={formData.bio || ''} onChange={e => setFormData({ ...formData, bio: e.target.value })} /></div>
              <div><Label className="text-white/50 text-xs">Status</Label>
                <Select value={formData.status || 'pending'} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} className="border-white/10 text-white/50">Cancel</Button>
            <Button
              onClick={() => {
                const { id, created_at, updated_at, total_bookings, total_earnings, response_rate, last_active_at, trust_score, ...cleanData } = formData;
                saveMutation.mutate({ data: cleanData, mode: formMode, id: formData.id });
              }}
              disabled={saveMutation.isPending}
              className="bg-[#C9A84C] hover:bg-[#B89A3C] text-black"
            >
              {saveMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {formMode === 'create' ? 'Create Partner' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
