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
  UserCheck, Users, DollarSign, Clock, Check, Ban, Eye,
  Copy, Loader2, Plus, Edit, Upload, X
} from 'lucide-react';

const TIERS = [
  { name: 'Bronze', min: 0, color: '#CD7F32' },
  { name: 'Silver', min: 10, color: '#C0C0C0' },
  { name: 'Gold', min: 25, color: '#C9A84C' },
  { name: 'Platinum', min: 50, color: '#E5E4E2' },
];

function getTier(referrals: number) {
  return [...TIERS].reverse().find(t => referrals >= t.min) || TIERS[0];
}

export default function PenthouseAffiliates() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: affiliates = [], isLoading } = useQuery({
    queryKey: ['ph-affiliates-list'],
    queryFn: () => fetchTopTierData('tt_affiliates', { select: '*', order: 'created_at.desc' }),
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ['ph-aff-commissions'],
    queryFn: () => fetchTopTierData('tt_affiliate_commissions', { select: '*' }),
  });

  const getActorId = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || 'unknown';
  };

  const statusMutation = useMutation({
    mutationFn: async ({ id, updates, currentStatus }: { id: string; updates: any; currentStatus?: string }) => {
      const result = await patchTopTierData('tt_affiliates', { id: `eq.${id}` }, { ...updates, updated_at: new Date().toISOString() });
      const actorId = await getActorId();
      await logPenthouseAction({ action: `affiliate_${updates.status || 'update'}`, target_type: 'tt_affiliates', target_id: id, actor_user_id: actorId, before: { status: currentStatus }, after: updates });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-affiliates-list'] });
      toast.success('Affiliate updated');
      setSelected(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ data, mode, id }: { data: any; mode: 'create' | 'edit'; id?: string }) => {
      const actorId = await getActorId();
      if (mode === 'create') {
        const result = await postTopTierData('tt_affiliates', data);
        await logPenthouseAction({ action: 'create_affiliate', target_type: 'tt_affiliates', actor_user_id: actorId, after: data });
        return result;
      } else {
        const result = await patchTopTierData('tt_affiliates', { id: `eq.${id}` }, { ...data, updated_at: new Date().toISOString() });
        await logPenthouseAction({ action: 'edit_affiliate', target_type: 'tt_affiliates', target_id: id, actor_user_id: actorId, after: data });
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-affiliates-list'] });
      setFormOpen(false);
      toast.success(formMode === 'create' ? 'Affiliate created' : 'Affiliate updated');
    },
    onError: (e) => toast.error(e.message),
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const name = `affiliates/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('toptier-assets').upload(name, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('toptier-assets').getPublicUrl(name);
      setFormData((d: any) => ({ ...d, avatar_url: urlData.publicUrl }));
      toast.success('Avatar uploaded');
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  const openCreate = () => { setFormMode('create'); setFormData({ status: 'pending' }); setFormOpen(true); };
  const openEdit = (a: any) => { setFormMode('edit'); setFormData({ ...a }); setFormOpen(true); };

  const total = affiliates.length;
  const active = affiliates.filter((a: any) => a.status === 'active').length;
  const totalEarned = affiliates.reduce((s: number, a: any) => s + Number(a.total_earned || 0), 0);
  const totalPending = affiliates.reduce((s: number, a: any) => s + Number(a.pending_amount || 0), 0);

  const stats = [
    { label: 'Total Affiliates', value: total, icon: Users, color: '#C9A84C' },
    { label: 'Active', value: active, icon: UserCheck, color: '#22c55e' },
    { label: 'Commissions Paid', value: `$${totalEarned.toLocaleString()}`, icon: DollarSign, color: '#C9A84C' },
    { label: 'Pending Payouts', value: `$${totalPending.toLocaleString()}`, icon: Clock, color: '#f59e0b' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#C9A84C]">Affiliate Management</h1>
          <p className="text-white/40 text-sm mt-1">Full affiliate lifecycle — create, edit, commission overrides, tier management</p>
        </div>
        <Button onClick={openCreate} className="bg-[#C9A84C] hover:bg-[#B89A3C] text-black text-xs h-8">
          <Plus className="h-3 w-3 mr-1" /> Add Affiliate
        </Button>
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
                <TableHead className="text-white/40">Affiliate</TableHead>
                <TableHead className="text-white/40">Referral Code</TableHead>
                <TableHead className="text-white/40">Category</TableHead>
                <TableHead className="text-white/40">Status</TableHead>
                <TableHead className="text-white/40">Referrals</TableHead>
                <TableHead className="text-white/40">Earned</TableHead>
                <TableHead className="text-white/40">Override</TableHead>
                <TableHead className="text-white/40">Tier</TableHead>
                <TableHead className="text-white/40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {affiliates.map((a: any) => {
                const tier = getTier(a.total_referrals || 0);
                return (
                  <TableRow key={a.id} className="border-white/5 hover:bg-white/[0.02] cursor-pointer" onClick={() => setSelected(a)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {a.avatar_url ? (
                          <img src={a.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover border border-white/10" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-[#C9A84C]/10 flex items-center justify-center text-[10px] text-[#C9A84C] font-bold">
                            {(a.name || '?').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <p className="text-sm text-white/80">{a.name}</p>
                      </div>
                    </TableCell>
                    <TableCell><code className="text-[#C9A84C] text-xs font-mono bg-[#C9A84C]/5 px-2 py-0.5 rounded">{a.referral_code}</code></TableCell>
                    <TableCell className="text-white/50 text-xs">{a.category || '—'}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${a.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : a.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-white/60 text-sm">{a.total_referrals || 0}</TableCell>
                    <TableCell className="text-[#C9A84C] text-sm font-mono">${Number(a.total_earned || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-white/50 text-sm">{a.commission_override ? `${a.commission_override}%` : '—'}</TableCell>
                    <TableCell><Badge style={{ backgroundColor: `${tier.color}20`, color: tier.color, borderColor: `${tier.color}40` }} className="text-[10px]">{tier.name}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400" onClick={() => openEdit(a)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        {a.status === 'pending' && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: a.id, updates: { status: 'active' }, currentStatus: a.status })}>
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                        {a.status !== 'rejected' && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: a.id, updates: { status: 'rejected' }, currentStatus: a.status })}>
                            <Ban className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="bg-[#111] border-l border-[#C9A84C]/10 text-white w-[500px]">
          {selected && (
            <>
              <SheetHeader><SheetTitle className="text-[#C9A84C] font-serif">{selected.name}</SheetTitle></SheetHeader>
              <ScrollArea className="h-[calc(100vh-120px)] mt-4">
                <div className="space-y-4">
                  {selected.avatar_url && (
                    <img src={selected.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover border border-white/10" />
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['Email', selected.email],
                      ['Phone', selected.phone],
                      ['Category', selected.category],
                      ['Referrals', selected.total_referrals],
                      ['Tier', getTier(selected.total_referrals || 0).name],
                      ['Commission Override', selected.commission_override ? `${selected.commission_override}%` : 'Default'],
                      ['Total Earned', `$${Number(selected.total_earned || 0).toLocaleString()}`],
                      ['Pending', `$${Number(selected.pending_amount || 0).toLocaleString()}`],
                    ].map(([label, val]) => (
                      <div key={label as string} className="p-3 bg-white/[0.03] rounded-lg">
                        <p className="text-[10px] text-white/40 uppercase">{label}</p>
                        <p className="text-sm text-white/80 mt-1">{val || '—'}</p>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 bg-white/[0.03] rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-white/40 uppercase">Referral Code</p>
                      <code className="text-[#C9A84C] font-mono">{selected.referral_code}</code>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(selected.referral_code || ''); toast.success('Copied'); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="p-3 bg-white/[0.03] rounded-lg">
                    <p className="text-[10px] text-white/40 uppercase mb-2">Tier Progress</p>
                    <div className="flex gap-1">
                      {TIERS.map(t => (
                        <div key={t.name} className="flex-1">
                          <div className={`h-2 rounded-full ${(selected.total_referrals || 0) >= t.min ? 'opacity-100' : 'opacity-20'}`} style={{ backgroundColor: t.color }} />
                          <p className="text-[9px] text-center mt-1" style={{ color: t.color }}>{t.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-white/40 uppercase mb-2">Commission History</p>
                    {commissions.filter((c: any) => c.affiliate_id === selected.id).slice(0, 5).map((c: any) => (
                      <div key={c.id} className="flex justify-between p-2 border-b border-white/5">
                        <span className="text-sm text-white/60">{new Date(c.created_at).toLocaleDateString()}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[#C9A84C]">${Number(c.amount).toLocaleString()}</span>
                          <Badge className={`text-[9px] ${c.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{c.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs" onClick={() => { setSelected(null); openEdit(selected); }}>
                      <Edit className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    {selected.status !== 'active' && (
                      <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-xs" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: selected.id, updates: { status: 'active' }, currentStatus: selected.status })}>
                        Approve
                      </Button>
                    )}
                    {selected.status !== 'rejected' && (
                      <Button className="flex-1 bg-red-600 hover:bg-red-700 text-xs" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: selected.id, updates: { status: 'rejected' }, currentStatus: selected.status })}>
                        Reject
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
            <DialogTitle className="text-[#C9A84C]">{formMode === 'create' ? 'Add New Affiliate' : 'Edit Affiliate'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-3">
            <div className="space-y-4">
              <div>
                <Label className="text-white/50 text-xs">Avatar</Label>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                {formData.avatar_url ? (
                  <div className="relative mt-1 w-16 h-16">
                    <img src={formData.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover border border-white/10" />
                    <button className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 flex items-center justify-center" onClick={() => setFormData((d: any) => ({ ...d, avatar_url: null }))}>
                      <X className="h-2.5 w-2.5 text-white" />
                    </button>
                  </div>
                ) : (
                  <Button variant="outline" className="mt-1 border-dashed border-white/10 text-white/40 text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                    Upload
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-white/50 text-xs">Name</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                <div><Label className="text-white/50 text-xs">Email</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-white/50 text-xs">Phone</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
                <div><Label className="text-white/50 text-xs">Referral Code</Label><Input className="bg-white/5 border-white/10 text-white font-mono" value={formData.referral_code || ''} onChange={e => setFormData({ ...formData, referral_code: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-white/50 text-xs">Category</Label>
                  <Select value={formData.category || ''} onValueChange={v => setFormData({ ...formData, category: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {['luxury', 'dining', 'travel', 'lifestyle', 'events', 'automotive'].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-white/50 text-xs">Commission Override (%)</Label><Input type="number" className="bg-white/5 border-white/10 text-white" placeholder="Leave empty for default" value={formData.commission_override || ''} onChange={e => setFormData({ ...formData, commission_override: e.target.value ? parseFloat(e.target.value) : null })} /></div>
              </div>
              <div><Label className="text-white/50 text-xs">Tier</Label>
                <Select value={formData.tier || ''} onValueChange={v => setFormData({ ...formData, tier: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Auto" /></SelectTrigger>
                  <SelectContent>
                    {TIERS.map(t => <SelectItem key={t.name} value={t.name.toLowerCase()}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-white/50 text-xs">Notes</Label><Textarea className="bg-white/5 border-white/10 text-white min-h-[60px]" value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
              <div><Label className="text-white/50 text-xs">Status</Label>
                <Select value={formData.status || 'pending'} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} className="border-white/10 text-white/50">Cancel</Button>
            <Button
              onClick={() => {
                const { id, created_at, updated_at, total_referrals, total_earned, pending_amount, ...cleanData } = formData;
                saveMutation.mutate({ data: cleanData, mode: formMode, id: formData.id });
              }}
              disabled={saveMutation.isPending}
              className="bg-[#C9A84C] hover:bg-[#B89A3C] text-black"
            >
              {saveMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {formMode === 'create' ? 'Create Affiliate' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
