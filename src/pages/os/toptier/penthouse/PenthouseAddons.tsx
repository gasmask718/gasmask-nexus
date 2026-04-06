import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTopTierData, postTopTierData, patchTopTierData, deleteTopTierData, logPenthouseAction } from '@/lib/toptierApi';
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
import { toast } from 'sonner';
import { Package, Layers, Plus, Edit, Trash2, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';

type FormMode = 'create' | 'edit';

export default function PenthouseAddons() {
  const qc = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ['ph-addon-categories'],
    queryFn: () => fetchTopTierData('experience_addon_categories', { select: '*', order: 'display_order.asc' }),
  });

  const { data: addons = [] } = useQuery({
    queryKey: ['ph-addons'],
    queryFn: () => fetchTopTierData('experience_addons', { select: '*,experience_addon_categories(name)', order: 'created_at.desc' }),
  });

  // Category form state
  const [catOpen, setCatOpen] = useState(false);
  const [catMode, setCatMode] = useState<FormMode>('create');
  const [catData, setCatData] = useState<any>({});

  // Addon form state
  const [addonOpen, setAddonOpen] = useState(false);
  const [addonMode, setAddonMode] = useState<FormMode>('create');
  const [addonData, setAddonData] = useState<any>({});

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<{ table: string; id: string; name: string } | null>(null);

  const getActorId = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || 'unknown';
  };

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['ph-addon-categories'] });
    qc.invalidateQueries({ queryKey: ['ph-addons'] });
  };

  // Category mutations
  const saveCat = useMutation({
    mutationFn: async () => {
      const actorId = await getActorId();
      const payload = { name: catData.name, display_order: Number(catData.display_order) || 0 };
      if (catMode === 'create') {
        await postTopTierData('experience_addon_categories', payload);
        await logPenthouseAction({ action: 'create_addon_category', target_type: 'experience_addon_categories', actor_user_id: actorId, after: payload });
      } else {
        await patchTopTierData('experience_addon_categories', { id: `eq.${catData.id}` }, payload);
        await logPenthouseAction({ action: 'edit_addon_category', target_type: 'experience_addon_categories', target_id: catData.id, actor_user_id: actorId, after: payload });
      }
    },
    onSuccess: () => { invalidateAll(); setCatOpen(false); toast.success('Category saved'); },
    onError: (e) => toast.error(e.message),
  });

  // Addon mutations
  const saveAddon = useMutation({
    mutationFn: async () => {
      const actorId = await getActorId();
      const payload = {
        category_id: addonData.category_id,
        name: addonData.name,
        description: addonData.description || null,
        price: Number(addonData.price) || 0,
        type: addonData.type || 'flat',
        is_active: addonData.is_active ?? true,
        provider_id: addonData.provider_id || null,
      };
      if (addonMode === 'create') {
        await postTopTierData('experience_addons', payload);
        await logPenthouseAction({ action: 'create_addon', target_type: 'experience_addons', actor_user_id: actorId, after: payload });
      } else {
        await patchTopTierData('experience_addons', { id: `eq.${addonData.id}` }, { ...payload, updated_at: new Date().toISOString() });
        await logPenthouseAction({ action: 'edit_addon', target_type: 'experience_addons', target_id: addonData.id, actor_user_id: actorId, after: payload });
      }
    },
    onSuccess: () => { invalidateAll(); setAddonOpen(false); toast.success('Add-on saved'); },
    onError: (e) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, current }: { id: string; current: boolean }) => {
      await patchTopTierData('experience_addons', { id: `eq.${id}` }, { is_active: !current, updated_at: new Date().toISOString() });
      const actorId = await getActorId();
      await logPenthouseAction({ action: 'toggle_addon_active', target_type: 'experience_addons', target_id: id, actor_user_id: actorId, before: { is_active: current }, after: { is_active: !current } });
    },
    onSuccess: () => { invalidateAll(); toast.success('Toggled'); },
  });

  const deleteMut = useMutation({
    mutationFn: async ({ table, id }: { table: string; id: string }) => {
      await deleteTopTierData(table, { id: `eq.${id}` });
      const actorId = await getActorId();
      await logPenthouseAction({ action: 'delete_addon_item', target_type: table, target_id: id, actor_user_id: actorId });
    },
    onSuccess: () => { invalidateAll(); setDeleteConfirm(null); toast.success('Deleted'); },
    onError: (e) => toast.error(e.message),
  });

  const typeBadge = (t: string) => {
    const c: Record<string, string> = { flat: 'bg-blue-500/20 text-blue-400', hourly: 'bg-amber-500/20 text-amber-400', package: 'bg-purple-500/20 text-purple-400' };
    return <Badge className={`text-[10px] ${c[t] || 'bg-white/10 text-white/40'}`}>{t}</Badge>;
  };

  const activeCount = addons.filter((a: any) => a.is_active).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-[#C9A84C]">Experience Add-Ons</h1>
        <p className="text-white/40 text-sm mt-1">Structured, categorized experience upgrades — marketplace-ready</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Categories', count: categories.length, icon: Layers },
          { label: 'Total Add-Ons', count: addons.length, icon: Package },
          { label: 'Active Add-Ons', count: activeCount, icon: Package },
        ].map((s, i) => (
          <Card key={i} className="bg-[#111] border-white/5">
            <CardContent className="p-4 flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/40">{s.label}</p>
                <p className="text-2xl font-bold text-[#C9A84C] mt-1">{s.count}</p>
              </div>
              <s.icon className="h-5 w-5 text-[#C9A84C]/50" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="addons" className="space-y-4">
        <TabsList className="bg-[#111] border border-white/5">
          <TabsTrigger value="addons" className="data-[state=active]:bg-[#C9A84C]/10 data-[state=active]:text-[#C9A84C]">Add-Ons</TabsTrigger>
          <TabsTrigger value="categories" className="data-[state=active]:bg-[#C9A84C]/10 data-[state=active]:text-[#C9A84C]">Categories</TabsTrigger>
        </TabsList>

        {/* ADDONS TAB */}
        <TabsContent value="addons">
          <div className="flex justify-end mb-3">
            <Button onClick={() => { setAddonMode('create'); setAddonData({ is_active: true, type: 'flat' }); setAddonOpen(true); }} className="bg-[#C9A84C] hover:bg-[#B89A3C] text-black text-xs h-8">
              <Plus className="h-3 w-3 mr-1" /> New Add-On
            </Button>
          </div>
          <Card className="bg-[#111] border-white/5">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5">
                    <TableHead className="text-white/40">Name</TableHead>
                    <TableHead className="text-white/40">Category</TableHead>
                    <TableHead className="text-white/40">Price</TableHead>
                    <TableHead className="text-white/40">Type</TableHead>
                    <TableHead className="text-white/40">Active</TableHead>
                    <TableHead className="text-white/40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {addons.map((a: any) => (
                    <TableRow key={a.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell className="text-white/80 text-sm font-medium">{a.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] border-white/10 text-white/50">{a.experience_addon_categories?.name || '—'}</Badge></TableCell>
                      <TableCell className="text-[#C9A84C] text-sm font-mono">${Number(a.price).toLocaleString()}</TableCell>
                      <TableCell>{typeBadge(a.type)}</TableCell>
                      <TableCell>
                        <button onClick={() => toggleActive.mutate({ id: a.id, current: a.is_active })}>
                          {a.is_active ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4 text-white/20" />}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400" onClick={() => { setAddonMode('edit'); setAddonData(a); setAddonOpen(true); }}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" onClick={() => setDeleteConfirm({ table: 'experience_addons', id: a.id, name: a.name })}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {addons.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-white/30 py-8">No add-ons yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CATEGORIES TAB */}
        <TabsContent value="categories">
          <div className="flex justify-end mb-3">
            <Button onClick={() => { setCatMode('create'); setCatData({ display_order: 0 }); setCatOpen(true); }} className="bg-[#C9A84C] hover:bg-[#B89A3C] text-black text-xs h-8">
              <Plus className="h-3 w-3 mr-1" /> New Category
            </Button>
          </div>
          <Card className="bg-[#111] border-white/5">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5">
                    <TableHead className="text-white/40">Name</TableHead>
                    <TableHead className="text-white/40">Order</TableHead>
                    <TableHead className="text-white/40">Add-Ons</TableHead>
                    <TableHead className="text-white/40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((c: any) => (
                    <TableRow key={c.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell className="text-white/80 text-sm font-medium">{c.name}</TableCell>
                      <TableCell className="text-white/40 text-xs font-mono">{c.display_order}</TableCell>
                      <TableCell className="text-[#C9A84C] text-sm font-mono">{addons.filter((a: any) => a.category_id === c.id).length}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400" onClick={() => { setCatMode('edit'); setCatData(c); setCatOpen(true); }}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" onClick={() => setDeleteConfirm({ table: 'experience_addon_categories', id: c.id, name: c.name })}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {categories.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-white/30 py-8">No categories</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ADDON DIALOG */}
      <Dialog open={addonOpen} onOpenChange={setAddonOpen}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#C9A84C]">{addonMode === 'create' ? 'New Add-On' : 'Edit Add-On'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-white/60 text-xs">Category</Label>
              <Select value={addonData.category_id || ''} onValueChange={(v) => setAddonData((d: any) => ({ ...d, category_id: v }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/60 text-xs">Name</Label>
              <Input value={addonData.name || ''} onChange={(e) => setAddonData((d: any) => ({ ...d, name: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-white/60 text-xs">Description</Label>
              <Textarea value={addonData.description || ''} onChange={(e) => setAddonData((d: any) => ({ ...d, description: e.target.value }))} className="bg-white/5 border-white/10 text-white" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/60 text-xs">Price ($)</Label>
                <Input type="number" value={addonData.price || ''} onChange={(e) => setAddonData((d: any) => ({ ...d, price: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-white/60 text-xs">Pricing Type</Label>
                <Select value={addonData.type || 'flat'} onValueChange={(v) => setAddonData((d: any) => ({ ...d, type: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    <SelectItem value="flat">Flat</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="package">Package</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={addonData.is_active ?? true} onCheckedChange={(v) => setAddonData((d: any) => ({ ...d, is_active: v }))} />
              <Label className="text-white/60 text-xs">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddonOpen(false)} className="border-white/10 text-white/50">Cancel</Button>
            <Button onClick={() => saveAddon.mutate()} disabled={saveAddon.isPending || !addonData.name || !addonData.category_id} className="bg-[#C9A84C] hover:bg-[#B89A3C] text-black">
              {saveAddon.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {addonMode === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CATEGORY DIALOG */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#C9A84C]">{catMode === 'create' ? 'New Category' : 'Edit Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-white/60 text-xs">Name</Label>
              <Input value={catData.name || ''} onChange={(e) => setCatData((d: any) => ({ ...d, name: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-white/60 text-xs">Display Order</Label>
              <Input type="number" value={catData.display_order ?? 0} onChange={(e) => setCatData((d: any) => ({ ...d, display_order: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)} className="border-white/10 text-white/50">Cancel</Button>
            <Button onClick={() => saveCat.mutate()} disabled={saveCat.isPending || !catData.name} className="bg-[#C9A84C] hover:bg-[#B89A3C] text-black">
              {saveCat.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {catMode === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRM */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-md">
          <DialogHeader><DialogTitle className="text-red-400">Confirm Delete</DialogTitle></DialogHeader>
          <p className="text-white/60 text-sm">Delete <strong className="text-white">{deleteConfirm?.name}</strong>? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="border-white/10 text-white/50">Cancel</Button>
            <Button onClick={() => deleteConfirm && deleteMut.mutate({ table: deleteConfirm.table, id: deleteConfirm.id })} disabled={deleteMut.isPending} className="bg-red-600 hover:bg-red-700">
              {deleteMut.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
