import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Palette, Users, ShoppingBag, CalendarCheck, Plus, Trash2, Eye, Star, Sparkles, Image, Lightbulb, Target, Layers } from 'lucide-react';
import { logPenthouseAction } from '@/lib/toptierApi';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  confirmed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  declined: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// ─── Styles Tab ─────────────────────────────────────────
function StylesTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', base_price: '', description: '' });

  const { data: styles = [] } = useQuery({
    queryKey: ['decor-styles'],
    queryFn: async () => {
      const { data } = await supabase.from('vehicle_decor_styles').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('vehicle_decor_styles').insert({
        name: form.name, category: form.category,
        base_price: parseFloat(form.base_price) || 0, description: form.description,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['decor-styles'] }); setOpen(false); setForm({ name: '', category: '', base_price: '', description: '' }); toast.success('Style created'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Decor Styles</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80"><Plus className="h-4 w-4 mr-1" />Add Style</Button></DialogTrigger>
          <DialogContent className="bg-[#111] border-[#C9A84C]/20">
            <DialogHeader><DialogTitle className="text-[#C9A84C]">New Decor Style</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <div><Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="bg-black/50 border-white/10"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent><SelectItem value="balloon">Balloon</SelectItem><SelectItem value="floral">Floral</SelectItem><SelectItem value="lighting">Lighting</SelectItem><SelectItem value="chrome">Chrome</SelectItem><SelectItem value="vinyl">Vinyl</SelectItem><SelectItem value="themed">Themed</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Base Price ($)</Label><Input type="number" value={form.base_price} onChange={e => setForm(p => ({ ...p, base_price: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <Button onClick={() => create.mutate()} className="w-full bg-[#C9A84C] text-black">Create Style</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow className="border-white/10"><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Base Price</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {styles.map((s: any) => (
            <TableRow key={s.id} className="border-white/5">
              <TableCell className="text-white font-medium">{s.name}</TableCell>
              <TableCell><Badge variant="outline" className="capitalize">{s.category}</Badge></TableCell>
              <TableCell className="text-[#C9A84C]">${Number(s.base_price).toLocaleString()}</TableCell>
              <TableCell><Badge variant="outline" className={s.is_active ? 'text-green-400' : 'text-red-400'}>{s.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Providers Tab ──────────────────────────────────────
function ProvidersTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', city: '', specialties: '', price_range: '', bio: '' });

  const { data: providers = [] } = useQuery({
    queryKey: ['decor-providers'],
    queryFn: async () => {
      const { data } = await supabase.from('decor_providers_legacy').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('decor_providers_legacy').insert({
        name: form.name, city: form.city,
        specialties: form.specialties.split(',').map(s => s.trim()).filter(Boolean),
        price_range: form.price_range, bio: form.bio,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['decor-providers'] }); setOpen(false);
      setForm({ name: '', city: '', specialties: '', price_range: '', bio: '' });
      toast.success('Provider added');
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Decor Providers</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80"><Plus className="h-4 w-4 mr-1" />Add Provider</Button></DialogTrigger>
          <DialogContent className="bg-[#111] border-[#C9A84C]/20">
            <DialogHeader><DialogTitle className="text-[#C9A84C]">New Decor Provider</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <div><Label>City</Label><Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <div><Label>Specialties (comma-separated)</Label><Input value={form.specialties} onChange={e => setForm(p => ({ ...p, specialties: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <div><Label>Price Range</Label><Input value={form.price_range} onChange={e => setForm(p => ({ ...p, price_range: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <div><Label>Bio</Label><Textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <Button onClick={() => create.mutate()} className="w-full bg-[#C9A84C] text-black">Add Provider</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow className="border-white/10"><TableHead>Name</TableHead><TableHead>City</TableHead><TableHead>Specialties</TableHead><TableHead>Rating</TableHead><TableHead>Range</TableHead></TableRow></TableHeader>
        <TableBody>
          {providers.map((p: any) => (
            <TableRow key={p.id} className="border-white/5">
              <TableCell className="text-white font-medium">{p.name}</TableCell>
              <TableCell className="text-white/60">{p.city}</TableCell>
              <TableCell><div className="flex flex-wrap gap-1">{(p.specialties || []).map((s: string) => <Badge key={s} variant="outline" className="text-xs capitalize">{s}</Badge>)}</div></TableCell>
              <TableCell className="text-[#C9A84C]"><Star className="h-3 w-3 inline mr-1" />{Number(p.rating).toFixed(1)}</TableCell>
              <TableCell className="text-white/50">{p.price_range}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Addons Tab ─────────────────────────────────────────
function AddonsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', category: '' });

  const { data: addons = [] } = useQuery({
    queryKey: ['decor-addons'],
    queryFn: async () => {
      const { data } = await supabase.from('decor_addons').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('decor_addons').insert({
        name: form.name, price: parseFloat(form.price) || 0, category: form.category,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['decor-addons'] }); setOpen(false); setForm({ name: '', price: '', category: '' }); toast.success('Add-on created'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Decor Add-ons</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80"><Plus className="h-4 w-4 mr-1" />Add Add-on</Button></DialogTrigger>
          <DialogContent className="bg-[#111] border-[#C9A84C]/20">
            <DialogHeader><DialogTitle className="text-[#C9A84C]">New Add-on</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <div><Label>Price ($)</Label><Input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <div><Label>Category</Label><Input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <Button onClick={() => create.mutate()} className="w-full bg-[#C9A84C] text-black">Create Add-on</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow className="border-white/10"><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Price</TableHead></TableRow></TableHeader>
        <TableBody>
          {addons.map((a: any) => (
            <TableRow key={a.id} className="border-white/5">
              <TableCell className="text-white font-medium">{a.name}</TableCell>
              <TableCell><Badge variant="outline" className="capitalize">{a.category}</Badge></TableCell>
              <TableCell className="text-[#C9A84C]">${Number(a.price).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Bookings Tab ───────────────────────────────────────
function BookingsTab() {
  const qc = useQueryClient();

  const { data: bookings = [] } = useQuery({
    queryKey: ['decor-bookings'],
    queryFn: async () => {
      const { data } = await (supabase.from('decor_bookings') as any).select('*, decor_providers(name), vehicle_decor_styles(name)').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('decor_bookings').update({ status }).eq('id', id);
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      await logPenthouseAction({ action: 'update_decor_booking_status', target_type: 'decor_booking', target_id: id, after: { status }, actor_user_id: user?.id || 'system' });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['decor-bookings'] }); toast.success('Booking updated'); },
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Decor Bookings</h3>
      <Table>
        <TableHeader><TableRow className="border-white/10"><TableHead>Provider</TableHead><TableHead>Style</TableHead><TableHead>Type</TableHead><TableHead>Event</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {bookings.map((b: any) => (
            <TableRow key={b.id} className="border-white/5">
              <TableCell className="text-white">{b.decor_providers?.name || '—'}</TableCell>
              <TableCell className="text-white/60">{b.vehicle_decor_styles?.name || '—'}</TableCell>
              <TableCell><Badge variant="outline" className="capitalize">{b.service_type}</Badge></TableCell>
              <TableCell className="text-white/50">{b.event_type || '—'}</TableCell>
              <TableCell className="text-[#C9A84C]">${Number(b.total_price).toLocaleString()}</TableCell>
              <TableCell><Badge variant="outline" className={statusColors[b.status] || ''}>{b.status}</Badge></TableCell>
              <TableCell>
                <Select onValueChange={v => updateStatus.mutate({ id: b.id, status: v })}>
                  <SelectTrigger className="h-7 w-28 bg-black/50 border-white/10 text-xs"><SelectValue placeholder="Update" /></SelectTrigger>
                  <SelectContent>
                    {['pending','approved','confirmed','in_progress','completed','cancelled','declined'].map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
          {bookings.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-white/30 py-8">No bookings yet</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Transformations Tab ────────────────────────────────
function TransformationsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ provider_id: '', before_image: '', after_image: '', style: '', description: '' });

  const { data: providers = [] } = useQuery({ queryKey: ['decor-providers'], queryFn: async () => { const { data } = await supabase.from('decor_providers_legacy').select('id,name'); return data || []; } });
  const { data: items = [] } = useQuery({
    queryKey: ['decor-transformations'],
    queryFn: async () => { const { data } = await (supabase.from('decor_transformations') as any).select('*, decor_providers(name)').order('created_at', { ascending: false }); return data || []; },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('decor_transformations').insert({ provider_id: form.provider_id, before_image: form.before_image, after_image: form.after_image, style: form.style, description: form.description });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['decor-transformations'] }); setOpen(false); toast.success('Transformation added'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Before / After Transformations</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80"><Plus className="h-4 w-4 mr-1" />Add</Button></DialogTrigger>
          <DialogContent className="bg-[#111] border-[#C9A84C]/20">
            <DialogHeader><DialogTitle className="text-[#C9A84C]">New Transformation</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Provider</Label>
                <Select value={form.provider_id} onValueChange={v => setForm(p => ({ ...p, provider_id: v }))}>
                  <SelectTrigger className="bg-black/50 border-white/10"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{providers.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Before Image URL</Label><Input value={form.before_image} onChange={e => setForm(p => ({ ...p, before_image: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <div><Label>After Image URL</Label><Input value={form.after_image} onChange={e => setForm(p => ({ ...p, after_image: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <div><Label>Style</Label><Input value={form.style} onChange={e => setForm(p => ({ ...p, style: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <Button onClick={() => create.mutate()} className="w-full bg-[#C9A84C] text-black">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow className="border-white/10"><TableHead>Provider</TableHead><TableHead>Style</TableHead><TableHead>Before</TableHead><TableHead>After</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
        <TableBody>
          {items.map((t: any) => (
            <TableRow key={t.id} className="border-white/5">
              <TableCell className="text-white">{t.decor_providers?.name || '—'}</TableCell>
              <TableCell><Badge variant="outline" className="capitalize">{t.style || '—'}</Badge></TableCell>
              <TableCell>{t.before_image ? <a href={t.before_image} target="_blank" className="text-[#C9A84C] underline text-xs">View</a> : '—'}</TableCell>
              <TableCell>{t.after_image ? <a href={t.after_image} target="_blank" className="text-[#C9A84C] underline text-xs">View</a> : '—'}</TableCell>
              <TableCell className="text-white/40 text-xs">{new Date(t.created_at).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
          {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-white/30 py-8">No transformations yet</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Matches Tab ────────────────────────────────────────
function MatchesTab() {
  const { data: matches = [] } = useQuery({
    queryKey: ['decor-matches'],
    queryFn: async () => { const { data } = await (supabase.from('decor_matches') as any).select('*, decor_providers(name), decor_bookings(event_type, status)').order('match_score', { ascending: false }); return data || []; },
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Provider Matches</h3>
      <Table>
        <TableHeader><TableRow className="border-white/10"><TableHead>Booking Event</TableHead><TableHead>Provider</TableHead><TableHead>Match Score</TableHead><TableHead>Booking Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {matches.map((m: any) => (
            <TableRow key={m.id} className="border-white/5">
              <TableCell className="text-white">{m.decor_bookings?.event_type || '—'}</TableCell>
              <TableCell className="text-white/60">{m.decor_providers?.name || '—'}</TableCell>
              <TableCell><Badge variant="outline" className={Number(m.match_score) >= 80 ? 'text-green-400 border-green-500/30' : Number(m.match_score) >= 50 ? 'text-amber-400 border-amber-500/30' : 'text-red-400 border-red-500/30'}>{Number(m.match_score).toFixed(0)}%</Badge></TableCell>
              <TableCell><Badge variant="outline" className={statusColors[m.decor_bookings?.status] || ''}>{m.decor_bookings?.status || '—'}</Badge></TableCell>
            </TableRow>
          ))}
          {matches.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-white/30 py-8">No matches yet</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────
export default function PenthouseVehicleDecor() {
  const { data: styleCt = 0 } = useQuery({ queryKey: ['decor-styles-ct'], queryFn: async () => { const { count } = await supabase.from('vehicle_decor_styles').select('*', { count: 'exact', head: true }); return count || 0; } });
  const { data: providerCt = 0 } = useQuery({ queryKey: ['decor-providers-ct'], queryFn: async () => { const { count } = await supabase.from('decor_providers_legacy').select('*', { count: 'exact', head: true }); return count || 0; } });
  const { data: bookingCt = 0 } = useQuery({ queryKey: ['decor-bookings-ct'], queryFn: async () => { const { count } = await supabase.from('decor_bookings').select('*', { count: 'exact', head: true }); return count || 0; } });
  const { data: addonCt = 0 } = useQuery({ queryKey: ['decor-addons-ct'], queryFn: async () => { const { count } = await supabase.from('decor_addons').select('*', { count: 'exact', head: true }); return count || 0; } });

  const { data: transformCt = 0 } = useQuery({ queryKey: ['decor-transforms-ct'], queryFn: async () => { const { count } = await supabase.from('decor_transformations').select('*', { count: 'exact', head: true }); return count || 0; } });
  const { data: matchCt = 0 } = useQuery({ queryKey: ['decor-matches-ct'], queryFn: async () => { const { count } = await supabase.from('decor_matches').select('*', { count: 'exact', head: true }); return count || 0; } });

  const stats = [
    { label: 'Styles', value: styleCt, icon: Palette, color: 'text-pink-400' },
    { label: 'Providers', value: providerCt, icon: Users, color: 'text-blue-400' },
    { label: 'Bookings', value: bookingCt, icon: CalendarCheck, color: 'text-green-400' },
    { label: 'Add-ons', value: addonCt, icon: Sparkles, color: 'text-amber-400' },
    { label: 'Transformations', value: transformCt, icon: Image, color: 'text-violet-400' },
    { label: 'Matches', value: matchCt, icon: Target, color: 'text-cyan-400' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#C9A84C]">Vehicle Decor Marketplace</h1>
        <p className="text-sm text-white/40">Manage decorators, styles, bookings & add-ons</p>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="bg-[#111] border-white/5">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div><p className="text-2xl font-bold text-white">{s.value}</p><p className="text-xs text-white/40">{s.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="styles" className="space-y-4">
        <TabsList className="bg-[#111] border border-white/5">
          <TabsTrigger value="styles" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><Palette className="h-4 w-4 mr-1" />Styles</TabsTrigger>
          <TabsTrigger value="providers" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><Users className="h-4 w-4 mr-1" />Providers</TabsTrigger>
          <TabsTrigger value="addons" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><Sparkles className="h-4 w-4 mr-1" />Add-ons</TabsTrigger>
          <TabsTrigger value="bookings" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><CalendarCheck className="h-4 w-4 mr-1" />Bookings</TabsTrigger>
          <TabsTrigger value="transformations" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><Image className="h-4 w-4 mr-1" />Transforms</TabsTrigger>
          <TabsTrigger value="matches" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><Target className="h-4 w-4 mr-1" />Matches</TabsTrigger>
        </TabsList>
        <TabsContent value="styles"><StylesTab /></TabsContent>
        <TabsContent value="providers"><ProvidersTab /></TabsContent>
        <TabsContent value="addons"><AddonsTab /></TabsContent>
        <TabsContent value="bookings"><BookingsTab /></TabsContent>
        <TabsContent value="transformations"><TransformationsTab /></TabsContent>
        <TabsContent value="matches"><MatchesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
