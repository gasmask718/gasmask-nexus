import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTopTierData, patchTopTierData, postTopTierData, deleteTopTierData, logPenthouseAction } from '@/lib/toptierApi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  ShoppingBag, Car, Plane, Sparkles, ToggleLeft, ToggleRight,
  Edit, Trash2, Plus, Loader2, Upload, X, Image as ImageIcon,
  Star, MapPin, Clock, Users, ArrowUpDown, Truck
} from 'lucide-react';

type FormMode = 'create' | 'edit';

export default function PenthouseMarketplace() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [formTable, setFormTable] = useState('tt_experiences');
  const [formData, setFormData] = useState<any>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ table: string; id: string; title: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const { data: experiences = [] } = useQuery({
    queryKey: ['ph-experiences'],
    queryFn: () => fetchTopTierData('tt_experiences', { select: '*', order: 'sort_order.asc,created_at.desc' }),
  });

  const { data: jets = [] } = useQuery({
    queryKey: ['ph-jets'],
    queryFn: () => fetchTopTierData('tt_private_jets', { select: '*', order: 'sort_order.asc,created_at.desc' }),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['ph-vehicles'],
    queryFn: () => fetchTopTierData('tt_vehicles', { select: '*', order: 'sort_order.asc,created_at.desc' }),
  });

  const { data: charters = [] } = useQuery({
    queryKey: ['ph-charters'],
    queryFn: () => fetchTopTierData('tt_charter_requests', { select: '*', order: 'created_at.desc' }),
  });

  const getActorId = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || 'unknown';
  };

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const ext = file.name.split('.').pop();
    const name = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('toptier-assets').upload(name, file);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('toptier-assets').getPublicUrl(name);
    return urlData.publicUrl;
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Max 10MB'); return; }
    setUploading(true);
    try {
      const folder = formTable === 'tt_private_jets' ? 'jets' : 'experiences';
      const url = await uploadFile(file, folder);
      const field = formTable === 'tt_private_jets' ? 'photo_url' : 'image_url';
      setFormData((d: any) => ({ ...d, [field]: url }));
      toast.success('Cover uploaded');
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setGalleryUploading(true);
    try {
      const folder = formTable === 'tt_private_jets' ? 'jets/gallery' : 'experiences/gallery';
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) continue;
        urls.push(await uploadFile(file, folder));
      }
      setFormData((d: any) => ({
        ...d,
        gallery_images: [...(d.gallery_images || []), ...urls]
      }));
      toast.success(`${urls.length} image(s) added`);
    } catch (err: any) { toast.error(err.message); }
    finally { setGalleryUploading(false); }
  };

  const removeGalleryImage = (idx: number) => {
    setFormData((d: any) => ({
      ...d,
      gallery_images: (d.gallery_images || []).filter((_: any, i: number) => i !== idx)
    }));
  };

  const toggleStatus = useMutation({
    mutationFn: async ({ table, id, currentStatus }: { table: string; id: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const result = await patchTopTierData(table, { id: `eq.${id}` }, { status: newStatus, updated_at: new Date().toISOString() });
      const actorId = await getActorId();
      await logPenthouseAction({ action: 'toggle_status', target_type: table, target_id: id, actor_user_id: actorId, before: { status: currentStatus }, after: { status: newStatus } });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-experiences'] });
      queryClient.invalidateQueries({ queryKey: ['ph-jets'] });
      queryClient.invalidateQueries({ queryKey: ['ph-vehicles'] });
      toast.success('Status toggled');
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, currentActive }: { id: string; currentActive: boolean }) => {
      const result = await patchTopTierData('tt_vehicles', { id: `eq.${id}` }, { is_active: !currentActive, updated_at: new Date().toISOString() });
      const actorId = await getActorId();
      await logPenthouseAction({ action: 'toggle_vehicle_active', target_type: 'tt_vehicles', target_id: id, actor_user_id: actorId, before: { is_active: currentActive }, after: { is_active: !currentActive } });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-vehicles'] });
      toast.success('Active status toggled');
    },
  });

  const togglePopular = useMutation({
    mutationFn: async ({ id, current }: { id: string; current: boolean }) => {
      const result = await patchTopTierData('tt_vehicles', { id: `eq.${id}` }, { is_popular: !current, updated_at: new Date().toISOString() });
      const actorId = await getActorId();
      await logPenthouseAction({ action: 'toggle_vehicle_popular', target_type: 'tt_vehicles', target_id: id, actor_user_id: actorId, before: { is_popular: current }, after: { is_popular: !current } });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-vehicles'] });
      toast.success('Popular status toggled');
    },
  });

  const toggleFeatured = useMutation({
    mutationFn: async ({ table, id, current }: { table: string; id: string; current: boolean }) => {
      const result = await patchTopTierData(table, { id: `eq.${id}` }, { featured: !current, updated_at: new Date().toISOString() });
      const actorId = await getActorId();
      await logPenthouseAction({ action: 'toggle_featured', target_type: table, target_id: id, actor_user_id: actorId, before: { featured: current }, after: { featured: !current } });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-experiences'] });
      queryClient.invalidateQueries({ queryKey: ['ph-jets'] });
      toast.success('Featured toggled');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ table, data, mode, id }: { table: string; data: any; mode: FormMode; id?: string }) => {
      const actorId = await getActorId();
      if (mode === 'create') {
        const result = await postTopTierData(table, data);
        await logPenthouseAction({ action: 'create_listing', target_type: table, actor_user_id: actorId, after: data });
        return result;
      } else {
        const result = await patchTopTierData(table, { id: `eq.${id}` }, { ...data, updated_at: new Date().toISOString() });
        await logPenthouseAction({ action: 'edit_listing', target_type: table, target_id: id, actor_user_id: actorId, after: data });
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-experiences'] });
      queryClient.invalidateQueries({ queryKey: ['ph-jets'] });
      queryClient.invalidateQueries({ queryKey: ['ph-charters'] });
      setFormOpen(false);
      toast.success(formMode === 'create' ? 'Created' : 'Updated');
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ table, id }: { table: string; id: string }) => {
      await deleteTopTierData(table, { id: `eq.${id}` });
      const actorId = await getActorId();
      await logPenthouseAction({ action: 'delete_listing', target_type: table, target_id: id, actor_user_id: actorId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-experiences'] });
      queryClient.invalidateQueries({ queryKey: ['ph-jets'] });
      setDeleteConfirm(null);
      toast.success('Deleted');
    },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = (table: string) => {
    setFormTable(table);
    setFormMode('create');
    setFormData({ gallery_images: [] });
    setFormOpen(true);
  };

  const openEdit = (table: string, item: any) => {
    setFormTable(table);
    setFormMode('edit');
    setFormData({ ...item, gallery_images: item.gallery_images || [] });
    setFormOpen(true);
  };

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      active: 'bg-emerald-500/20 text-emerald-400',
      available: 'bg-emerald-500/20 text-emerald-400',
      inactive: 'bg-white/10 text-white/40',
      pending: 'bg-amber-500/20 text-amber-400',
      approved: 'bg-emerald-500/20 text-emerald-400',
      rejected: 'bg-red-500/20 text-red-400',
      completed: 'bg-blue-500/20 text-blue-400',
      maintenance: 'bg-orange-500/20 text-orange-400',
      reserved: 'bg-purple-500/20 text-purple-400',
    };
    return <Badge className={`text-[10px] ${colors[s] || 'bg-white/10 text-white/40'}`}>{s}</Badge>;
  };

  const coverPreview = formTable === 'tt_private_jets' ? formData.photo_url : formData.image_url;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#C9A84C]">Marketplace Control</h1>
          <p className="text-white/40 text-sm mt-1">Full CRUD with media, pricing, featured state — Dynasty OS writes, public site reads</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Experiences', count: experiences.length, featured: experiences.filter((e: any) => e.featured).length, icon: Sparkles },
          { label: 'Private Jets', count: jets.length, featured: jets.filter((j: any) => j.featured).length, icon: Plane },
          { label: 'Charter Requests', count: charters.length, featured: 0, icon: Car },
        ].map((s, i) => (
          <Card key={i} className="bg-[#111] border-white/5">
            <CardContent className="p-4 flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/40">{s.label}</p>
                <p className="text-2xl font-bold text-[#C9A84C] mt-1">{s.count}</p>
                {s.featured > 0 && <p className="text-[10px] text-amber-400 mt-0.5">★ {s.featured} featured</p>}
              </div>
              <s.icon className="h-5 w-5 text-[#C9A84C]/50" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="experiences" className="space-y-4">
        <TabsList className="bg-[#111] border border-white/5">
          <TabsTrigger value="experiences" className="data-[state=active]:bg-[#C9A84C]/10 data-[state=active]:text-[#C9A84C]">Experiences</TabsTrigger>
          <TabsTrigger value="jets" className="data-[state=active]:bg-[#C9A84C]/10 data-[state=active]:text-[#C9A84C]">Private Jets</TabsTrigger>
          <TabsTrigger value="charters" className="data-[state=active]:bg-[#C9A84C]/10 data-[state=active]:text-[#C9A84C]">Charter Requests</TabsTrigger>
        </TabsList>

        {/* EXPERIENCES TAB */}
        <TabsContent value="experiences">
          <div className="flex justify-end mb-3">
            <Button onClick={() => openCreate('tt_experiences')} className="bg-[#C9A84C] hover:bg-[#B89A3C] text-black text-xs h-8">
              <Plus className="h-3 w-3 mr-1" /> New Experience
            </Button>
          </div>
          <Card className="bg-[#111] border-white/5">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5">
                    <TableHead className="text-white/40">Image</TableHead>
                    <TableHead className="text-white/40">Title</TableHead>
                    <TableHead className="text-white/40">Category</TableHead>
                    <TableHead className="text-white/40">Price</TableHead>
                    <TableHead className="text-white/40">Status</TableHead>
                    <TableHead className="text-white/40">Featured</TableHead>
                    <TableHead className="text-white/40">Order</TableHead>
                    <TableHead className="text-white/40">Partner</TableHead>
                    <TableHead className="text-white/40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {experiences.map((e: any) => (
                    <TableRow key={e.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell>
                        {e.image_url ? (
                          <img src={e.image_url} alt="" className="h-10 w-14 rounded object-cover border border-white/10" />
                        ) : (
                          <div className="h-10 w-14 rounded bg-white/5 flex items-center justify-center"><ImageIcon className="h-4 w-4 text-white/20" /></div>
                        )}
                      </TableCell>
                      <TableCell className="text-white/80 text-sm font-medium">{e.title}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] border-white/10 text-white/50">{e.category}</Badge></TableCell>
                      <TableCell className="text-[#C9A84C] text-sm font-mono">{e.price ? `$${Number(e.price).toLocaleString()}` : 'Free'}</TableCell>
                      <TableCell>{statusBadge(e.status || 'active')}</TableCell>
                      <TableCell>
                        <button onClick={() => toggleFeatured.mutate({ table: 'tt_experiences', id: e.id, current: !!e.featured })}>
                          <Star className={`h-4 w-4 ${e.featured ? 'text-[#C9A84C] fill-[#C9A84C]' : 'text-white/15'}`} />
                        </button>
                      </TableCell>
                      <TableCell className="text-white/40 text-xs font-mono">{e.sort_order ?? 0}</TableCell>
                      <TableCell className="text-white/50 text-sm">{e.partner_name || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-white/40" onClick={() => toggleStatus.mutate({ table: 'tt_experiences', id: e.id, currentStatus: e.status || 'active' })}>
                            {e.status === 'active' ? <ToggleRight className="h-3 w-3 text-emerald-400" /> : <ToggleLeft className="h-3 w-3" />}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400" onClick={() => openEdit('tt_experiences', e)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" onClick={() => setDeleteConfirm({ table: 'tt_experiences', id: e.id, title: e.title })}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {experiences.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-white/30 py-8">No experiences found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* JETS TAB */}
        <TabsContent value="jets">
          <div className="flex justify-end mb-3">
            <Button onClick={() => openCreate('tt_private_jets')} className="bg-[#C9A84C] hover:bg-[#B89A3C] text-black text-xs h-8">
              <Plus className="h-3 w-3 mr-1" /> New Jet
            </Button>
          </div>
          <Card className="bg-[#111] border-white/5">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5">
                    <TableHead className="text-white/40">Photo</TableHead>
                    <TableHead className="text-white/40">Aircraft</TableHead>
                    <TableHead className="text-white/40">Model</TableHead>
                    <TableHead className="text-white/40">Capacity</TableHead>
                    <TableHead className="text-white/40">Hourly Rate</TableHead>
                    <TableHead className="text-white/40">Status</TableHead>
                    <TableHead className="text-white/40">Featured</TableHead>
                    <TableHead className="text-white/40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jets.map((j: any) => (
                    <TableRow key={j.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell>
                        {j.photo_url ? (
                          <img src={j.photo_url} alt="" className="h-10 w-14 rounded object-cover border border-white/10" />
                        ) : (
                          <div className="h-10 w-14 rounded bg-white/5 flex items-center justify-center"><Plane className="h-4 w-4 text-white/20" /></div>
                        )}
                      </TableCell>
                      <TableCell className="text-white/80 text-sm">{j.name || j.jet_type || j.id}</TableCell>
                      <TableCell className="text-white/50 text-sm">{j.manufacturer} {j.model}</TableCell>
                      <TableCell className="text-white/60 text-sm">{j.passenger_capacity || '—'} pax</TableCell>
                      <TableCell className="text-[#C9A84C] text-sm font-mono">{j.hourly_rate ? `$${Number(j.hourly_rate).toLocaleString()}/h` : '—'}</TableCell>
                      <TableCell>{statusBadge(j.status || 'available')}</TableCell>
                      <TableCell>
                        <button onClick={() => toggleFeatured.mutate({ table: 'tt_private_jets', id: j.id, current: !!j.featured })}>
                          <Star className={`h-4 w-4 ${j.featured ? 'text-[#C9A84C] fill-[#C9A84C]' : 'text-white/15'}`} />
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400" onClick={() => openEdit('tt_private_jets', j)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" onClick={() => setDeleteConfirm({ table: 'tt_private_jets', id: j.id, title: j.name || j.jet_type || j.id })}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {jets.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-white/30 py-8">No jets found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CHARTERS TAB */}
        <TabsContent value="charters">
          <Card className="bg-[#111] border-white/5">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5">
                    <TableHead className="text-white/40">Customer</TableHead>
                    <TableHead className="text-white/40">Route</TableHead>
                    <TableHead className="text-white/40">Date</TableHead>
                    <TableHead className="text-white/40">Passengers</TableHead>
                    <TableHead className="text-white/40">Price</TableHead>
                    <TableHead className="text-white/40">Status</TableHead>
                    <TableHead className="text-white/40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {charters.map((c: any) => (
                    <TableRow key={c.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell className="text-white/80 text-sm">{c.customer_name}</TableCell>
                      <TableCell className="text-white/60 text-sm">{c.departure_location} → {c.arrival_location}</TableCell>
                      <TableCell className="text-white/60 text-sm">{c.departure_date}</TableCell>
                      <TableCell className="text-white/60 text-sm">{c.passenger_count}</TableCell>
                      <TableCell className="text-[#C9A84C] text-sm font-mono">{c.final_price || c.quoted_price ? `$${Number(c.final_price || c.quoted_price).toLocaleString()}` : '—'}</TableCell>
                      <TableCell>{statusBadge(c.status || 'pending')}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400" onClick={() => openEdit('tt_charter_requests', c)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {charters.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-white/30 py-8">No charter requests</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── FULL CREATE/EDIT DIALOG ─── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-[#C9A84C]">
              {formMode === 'create' ? 'Create New' : 'Edit'} — {formTable.replace('tt_', '').replace(/_/g, ' ')}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-3">
            <div className="space-y-4">
              {/* ═══ EXPERIENCE FORM ═══ */}
              {formTable === 'tt_experiences' && (
                <>
                  {/* Cover Image */}
                  <div>
                    <Label className="text-white/50 text-xs">Cover Image</Label>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                    {coverPreview ? (
                      <div className="relative mt-1">
                        <img src={coverPreview} alt="" className="w-full h-40 rounded-lg object-cover border border-white/10" />
                        <Button size="sm" variant="ghost" className="absolute top-1 right-1 h-6 w-6 bg-black/60 p-0" onClick={() => setFormData((d: any) => ({ ...d, image_url: null }))}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" className="w-full mt-1 border-dashed border-white/10 text-white/40" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                        {uploading ? 'Uploading...' : 'Upload Cover'}
                      </Button>
                    )}
                  </div>
                  {/* Gallery */}
                  <div>
                    <Label className="text-white/50 text-xs">Gallery Images</Label>
                    <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(formData.gallery_images || []).map((url: string, i: number) => (
                        <div key={i} className="relative">
                          <img src={url} alt="" className="h-16 w-20 rounded object-cover border border-white/10" />
                          <button className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 flex items-center justify-center" onClick={() => removeGalleryImage(i)}>
                            <X className="h-2.5 w-2.5 text-white" />
                          </button>
                        </div>
                      ))}
                      <Button variant="outline" className="h-16 w-20 border-dashed border-white/10 text-white/30 text-xs" onClick={() => galleryRef.current?.click()} disabled={galleryUploading}>
                        {galleryUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-white/50 text-xs">Title</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} /></div>
                    <div><Label className="text-white/50 text-xs">Category</Label>
                      <Select value={formData.category || ''} onValueChange={v => setFormData({ ...formData, category: v })}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {['luxury_dining', 'yacht', 'villa', 'spa', 'adventure', 'nightlife', 'private_event', 'concierge', 'automotive', 'helicopter'].map(c => (
                            <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label className="text-white/50 text-xs">Price ($)</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: e.target.value })} /></div>
                    <div><Label className="text-white/50 text-xs">Pricing Tier</Label>
                      <Select value={formData.pricing_tier || ''} onValueChange={v => setFormData({ ...formData, pricing_tier: v })}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                          <SelectItem value="ultra">Ultra</SelectItem>
                          <SelectItem value="bespoke">Bespoke</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-white/50 text-xs">Sort Order</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={formData.sort_order ?? 0} onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })} /></div>
                  </div>
                  <div><Label className="text-white/50 text-xs">Pricing Notes</Label><Input className="bg-white/5 border-white/10 text-white" placeholder="e.g. Per person, minimum 2 guests" value={formData.pricing_notes || ''} onChange={e => setFormData({ ...formData, pricing_notes: e.target.value })} /></div>
                  <div><Label className="text-white/50 text-xs">Description</Label><Textarea className="bg-white/5 border-white/10 text-white min-h-[80px]" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-white/50 text-xs">Location</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.location || ''} onChange={e => setFormData({ ...formData, location: e.target.value })} /></div>
                    <div><Label className="text-white/50 text-xs">Duration (hours)</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={formData.duration_hours || ''} onChange={e => setFormData({ ...formData, duration_hours: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-white/50 text-xs">Max Guests</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={formData.max_guests || ''} onChange={e => setFormData({ ...formData, max_guests: parseInt(e.target.value) || null })} /></div>
                    <div><Label className="text-white/50 text-xs">Availability</Label>
                      <Select value={formData.availability || 'available'} onValueChange={v => setFormData({ ...formData, availability: v })}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="limited">Limited</SelectItem>
                          <SelectItem value="sold_out">Sold Out</SelectItem>
                          <SelectItem value="seasonal">Seasonal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label className="text-white/50 text-xs">Special Requirements</Label><Textarea className="bg-white/5 border-white/10 text-white min-h-[60px]" value={formData.special_requirements || ''} onChange={e => setFormData({ ...formData, special_requirements: e.target.value })} /></div>
                  <div><Label className="text-white/50 text-xs">Notes (Internal)</Label><Textarea className="bg-white/5 border-white/10 text-white min-h-[60px]" value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-white/50 text-xs">Status</Label>
                      <Select value={formData.status || 'active'} onValueChange={v => setFormData({ ...formData, status: v })}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3 pt-5">
                      <Switch checked={formData.featured || false} onCheckedChange={v => setFormData({ ...formData, featured: v })} />
                      <Label className="text-white/60 text-xs">Featured</Label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={formData.is_complimentary || false} onCheckedChange={v => setFormData({ ...formData, is_complimentary: v })} />
                    <Label className="text-white/60 text-xs">Complimentary</Label>
                  </div>
                </>
              )}

              {/* ═══ JET FORM ═══ */}
              {formTable === 'tt_private_jets' && (
                <>
                  <div>
                    <Label className="text-white/50 text-xs">Aircraft Photo</Label>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                    {formData.photo_url ? (
                      <div className="relative mt-1">
                        <img src={formData.photo_url} alt="" className="w-full h-40 rounded-lg object-cover border border-white/10" />
                        <Button size="sm" variant="ghost" className="absolute top-1 right-1 h-6 w-6 bg-black/60 p-0" onClick={() => setFormData((d: any) => ({ ...d, photo_url: null }))}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" className="w-full mt-1 border-dashed border-white/10 text-white/40" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                        {uploading ? 'Uploading...' : 'Upload Photo'}
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label className="text-white/50 text-xs">Gallery Images</Label>
                    <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(formData.gallery_images || []).map((url: string, i: number) => (
                        <div key={i} className="relative">
                          <img src={url} alt="" className="h-16 w-20 rounded object-cover border border-white/10" />
                          <button className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 flex items-center justify-center" onClick={() => removeGalleryImage(i)}>
                            <X className="h-2.5 w-2.5 text-white" />
                          </button>
                        </div>
                      ))}
                      <Button variant="outline" className="h-16 w-20 border-dashed border-white/10 text-white/30 text-xs" onClick={() => galleryRef.current?.click()} disabled={galleryUploading}>
                        {galleryUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-white/50 text-xs">Name</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                    <div><Label className="text-white/50 text-xs">Tail Number</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.tail_number || ''} onChange={e => setFormData({ ...formData, tail_number: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label className="text-white/50 text-xs">Manufacturer</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.manufacturer || ''} onChange={e => setFormData({ ...formData, manufacturer: e.target.value })} /></div>
                    <div><Label className="text-white/50 text-xs">Model</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.model || ''} onChange={e => setFormData({ ...formData, model: e.target.value })} /></div>
                    <div><Label className="text-white/50 text-xs">Year</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={formData.year || ''} onChange={e => setFormData({ ...formData, year: parseInt(e.target.value) || null })} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label className="text-white/50 text-xs">Passengers</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={formData.passenger_capacity || ''} onChange={e => setFormData({ ...formData, passenger_capacity: parseInt(e.target.value) || null })} /></div>
                    <div><Label className="text-white/50 text-xs">Range (nm)</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={formData.range_nautical_miles || ''} onChange={e => setFormData({ ...formData, range_nautical_miles: parseInt(e.target.value) || null })} /></div>
                    <div><Label className="text-white/50 text-xs">Sort Order</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={formData.sort_order ?? 0} onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-white/50 text-xs">Hourly Rate ($)</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={formData.hourly_rate || ''} onChange={e => setFormData({ ...formData, hourly_rate: e.target.value })} /></div>
                    <div><Label className="text-white/50 text-xs">Daily Rate ($)</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={formData.daily_rate || ''} onChange={e => setFormData({ ...formData, daily_rate: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-white/50 text-xs">Base Location</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.base_location || ''} onChange={e => setFormData({ ...formData, base_location: e.target.value })} /></div>
                    <div><Label className="text-white/50 text-xs">Current Location</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.current_location || ''} onChange={e => setFormData({ ...formData, current_location: e.target.value })} /></div>
                  </div>
                  <div><Label className="text-white/50 text-xs">Notes</Label><Textarea className="bg-white/5 border-white/10 text-white min-h-[60px]" value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
                  <div><Label className="text-white/50 text-xs">Maintenance Notes</Label><Textarea className="bg-white/5 border-white/10 text-white min-h-[60px]" value={formData.maintenance_notes || ''} onChange={e => setFormData({ ...formData, maintenance_notes: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-white/50 text-xs">Status</Label>
                      <Select value={formData.status || 'available'} onValueChange={v => setFormData({ ...formData, status: v })}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="reserved">Reserved</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3 pt-5">
                      <Switch checked={formData.featured || false} onCheckedChange={v => setFormData({ ...formData, featured: v })} />
                      <Label className="text-white/60 text-xs">Featured</Label>
                    </div>
                  </div>
                </>
              )}

              {/* ═══ CHARTER FORM ═══ */}
              {formTable === 'tt_charter_requests' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-white/50 text-xs">Customer Name</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.customer_name || ''} onChange={e => setFormData({ ...formData, customer_name: e.target.value })} /></div>
                    <div><Label className="text-white/50 text-xs">Passenger Count</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={formData.passenger_count || ''} onChange={e => setFormData({ ...formData, passenger_count: parseInt(e.target.value) || null })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-white/50 text-xs">Departure</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.departure_location || ''} onChange={e => setFormData({ ...formData, departure_location: e.target.value })} /></div>
                    <div><Label className="text-white/50 text-xs">Arrival</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.arrival_location || ''} onChange={e => setFormData({ ...formData, arrival_location: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-white/50 text-xs">Departure Date</Label><Input type="date" className="bg-white/5 border-white/10 text-white" value={formData.departure_date || ''} onChange={e => setFormData({ ...formData, departure_date: e.target.value })} /></div>
                    <div><Label className="text-white/50 text-xs">Return Date</Label><Input type="date" className="bg-white/5 border-white/10 text-white" value={formData.return_date || ''} onChange={e => setFormData({ ...formData, return_date: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-white/50 text-xs">Quoted Price ($)</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={formData.quoted_price || ''} onChange={e => setFormData({ ...formData, quoted_price: e.target.value })} /></div>
                    <div><Label className="text-white/50 text-xs">Final Price ($)</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={formData.final_price || ''} onChange={e => setFormData({ ...formData, final_price: e.target.value })} /></div>
                  </div>
                  <div><Label className="text-white/50 text-xs">Special Requests</Label><Textarea className="bg-white/5 border-white/10 text-white min-h-[60px]" value={formData.special_requests || ''} onChange={e => setFormData({ ...formData, special_requests: e.target.value })} /></div>
                  <div><Label className="text-white/50 text-xs">Notes</Label><Textarea className="bg-white/5 border-white/10 text-white min-h-[60px]" value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
                  <div><Label className="text-white/50 text-xs">Status</Label>
                    <Select value={formData.status || 'pending'} onValueChange={v => setFormData({ ...formData, status: v })}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} className="border-white/10 text-white/50">Cancel</Button>
            <Button
              onClick={() => {
                const { id, created_at, updated_at, is_simulation, created_by, ...cleanData } = formData;
                saveMutation.mutate({ table: formTable, data: cleanData, mode: formMode, id: formData.id });
              }}
              disabled={saveMutation.isPending}
              className="bg-[#C9A84C] hover:bg-[#B89A3C] text-black"
            >
              {saveMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {formMode === 'create' ? 'Create' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-[#111] border-red-500/20 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-400">Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-white/60 text-sm">Are you sure you want to delete <strong className="text-white">{deleteConfirm?.title}</strong>? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="border-white/10 text-white/50">Cancel</Button>
            <Button
              onClick={() => deleteConfirm && deleteMutation.mutate({ table: deleteConfirm.table, id: deleteConfirm.id })}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
