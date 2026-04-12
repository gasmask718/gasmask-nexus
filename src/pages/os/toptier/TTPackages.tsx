import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pubFetch, pubPatch, pubPost } from '@/lib/publicSiteApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Package, Plus, Copy, Archive } from 'lucide-react';

function KPICard({ label, value, icon: Icon, color = 'text-[#C9A84C]' }: any) {
  return (
    <Card className="bg-[#111111] border-[#C9A84C]/10">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center"><Icon className={`h-5 w-5 ${color}`} /></div>
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const CATEGORIES = ['luxury_transport', 'exotic_rental', 'helicopter', 'private_jet', 'yacht_charter', 'private_chef', 'nightlife_vip', 'wellness_massage', 'beauty_services', 'media_production', 'event_space', 'luxury_gifting'];

export default function TTPackages() {
  const qc = useQueryClient();
  const [addPkgOpen, setAddPkgOpen] = useState(false);
  const [addAddonOpen, setAddAddonOpen] = useState(false);
  const [newPkg, setNewPkg] = useState({ name: '', category: '', description: '', price: '', included_services: '', active: true });
  const [newAddon, setNewAddon] = useState({ name: '', category: '', description: '', price: '', max_quantity: '', active: true });

  const { data: packages = [], isError: pkgError } = useQuery({
    queryKey: ['pub-packages'],
    queryFn: async () => { let d = await pubFetch('service_packages'); if (!d.length) d = await pubFetch('packages'); return d; },
  });

  const { data: addons = [] } = useQuery({
    queryKey: ['pub-addons'],
    queryFn: async () => { let d = await pubFetch('add_on_packages'); if (!d.length) d = await pubFetch('add_ons'); return d; },
  });

  const activePkgs = packages.filter((p: any) => p.active !== false);

  const handleToggle = async (table: string, id: string, current: boolean) => {
    const ok = await pubPatch(table, id, { active: !current });
    if (ok) { toast.success(`${!current ? 'Activated' : 'Archived'}`); qc.invalidateQueries({ queryKey: ['pub-packages'] }); qc.invalidateQueries({ queryKey: ['pub-addons'] }); }
    else toast.error('Update failed.');
  };

  const handleDuplicate = async (pkg: any) => {
    const { id, created_at, updated_at, ...rest } = pkg;
    const result = await pubPost('service_packages', { ...rest, name: `${rest.name} (Copy)` });
    if (result) { toast.success('Duplicated!'); qc.invalidateQueries({ queryKey: ['pub-packages'] }); }
    else toast.error('Failed to duplicate.');
  };

  const handleAddPkg = async () => {
    const result = await pubPost('service_packages', { ...newPkg, price: parseFloat(newPkg.price) || 0 });
    if (!result) { const r2 = await pubPost('packages', { ...newPkg, price: parseFloat(newPkg.price) || 0 }); if (!r2) { toast.error('Failed.'); return; } }
    toast.success('Package created!'); setAddPkgOpen(false); qc.invalidateQueries({ queryKey: ['pub-packages'] });
  };

  const handleAddAddon = async () => {
    const result = await pubPost('add_on_packages', { ...newAddon, price: parseFloat(newAddon.price) || 0, max_quantity: parseInt(newAddon.max_quantity) || null });
    if (!result) { const r2 = await pubPost('add_ons', { ...newAddon, price: parseFloat(newAddon.price) || 0 }); if (!r2) { toast.error('Failed.'); return; } }
    toast.success('Add-on created!'); setAddAddonOpen(false); qc.invalidateQueries({ queryKey: ['pub-addons'] });
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Service Packages & Add-Ons</h1><p className="text-white/40 text-sm">Create and manage service bundles and optional extras</p></div>

      {pkgError && <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-400 text-sm">Could not load data from public site. Check Settings &gt; Public Site Connection.</div>}

      <div className="grid grid-cols-3 gap-4">
        <KPICard label="Total Packages" value={packages.length} icon={Package} />
        <KPICard label="Active" value={activePkgs.length} icon={Package} color="text-emerald-400" />
        <KPICard label="Add-Ons" value={addons.length} icon={Package} color="text-blue-400" />
      </div>

      <Tabs defaultValue="packages">
        <TabsList className="bg-white/5">
          <TabsTrigger value="packages" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]">Packages ({packages.length})</TabsTrigger>
          <TabsTrigger value="addons" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]">Add-Ons ({addons.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="packages">
          <div className="flex justify-end mt-4 mb-2">
            <Dialog open={addPkgOpen} onOpenChange={setAddPkgOpen}>
              <DialogTrigger asChild><Button className="bg-[#C9A84C] text-black"><Plus className="h-4 w-4 mr-2" />Add Package</Button></DialogTrigger>
              <DialogContent className="bg-[#111111] border-[#C9A84C]/20 text-white">
                <DialogHeader><DialogTitle className="text-[#C9A84C]">New Package</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label className="text-white/60">Name *</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={newPkg.name} onChange={e => setNewPkg({...newPkg, name: e.target.value})} /></div>
                  <div><Label className="text-white/60">Category *</Label>
                    <Select value={newPkg.category} onValueChange={v => setNewPkg({...newPkg, category: v})}>
                      <SelectTrigger className="bg-[#0A0A0A] border-white/10 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#111111] border-white/10">{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div><Label className="text-white/60">Price *</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" type="number" value={newPkg.price} onChange={e => setNewPkg({...newPkg, price: e.target.value})} /></div>
                  <div><Label className="text-white/60">Included Services</Label><Textarea className="bg-[#0A0A0A] border-white/10 text-white" value={newPkg.included_services} onChange={e => setNewPkg({...newPkg, included_services: e.target.value})} /></div>
                  <div><Label className="text-white/60">Description</Label><Textarea className="bg-[#0A0A0A] border-white/10 text-white" value={newPkg.description} onChange={e => setNewPkg({...newPkg, description: e.target.value})} /></div>
                  <Button className="w-full bg-[#C9A84C] text-black" onClick={handleAddPkg}>Create Package</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card className="bg-[#111111] border-[#C9A84C]/10">
            <Table>
              <TableHeader><TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-white/40">Name</TableHead><TableHead className="text-white/40">Category</TableHead><TableHead className="text-white/40">Price</TableHead><TableHead className="text-white/40">Included</TableHead><TableHead className="text-white/40">Active</TableHead><TableHead className="text-white/40">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody className="divide-y divide-white/5">
                {packages.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-white/40 py-12">No packages found. Click + Add Package to add one.</TableCell></TableRow> : packages.map((p: any) => (
                  <TableRow key={p.id} className="border-white/5">
                    <TableCell className="text-white font-medium">{p.name}</TableCell>
                    <TableCell><Badge className="bg-white/5 text-white/60 text-xs">{(p.category || '').replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell className="text-[#C9A84C] font-bold">${Number(p.price || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-white/40 text-sm max-w-[200px] truncate">{p.included_services || '—'}</TableCell>
                    <TableCell><Switch checked={p.active !== false} onCheckedChange={() => handleToggle('service_packages', p.id, p.active !== false)} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="ghost" className="text-white/60 h-7 text-xs" onClick={() => handleDuplicate(p)}><Copy className="h-3 w-3 mr-1" />Dup</Button>
                        <Button size="sm" variant="ghost" className="text-amber-400 h-7 text-xs" onClick={() => handleToggle('service_packages', p.id, true)}><Archive className="h-3 w-3 mr-1" />Archive</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="addons">
          <div className="flex justify-end mt-4 mb-2">
            <Dialog open={addAddonOpen} onOpenChange={setAddAddonOpen}>
              <DialogTrigger asChild><Button className="bg-[#C9A84C] text-black"><Plus className="h-4 w-4 mr-2" />Add Add-On</Button></DialogTrigger>
              <DialogContent className="bg-[#111111] border-[#C9A84C]/20 text-white">
                <DialogHeader><DialogTitle className="text-[#C9A84C]">New Add-On</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label className="text-white/60">Name *</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={newAddon.name} onChange={e => setNewAddon({...newAddon, name: e.target.value})} /></div>
                  <div><Label className="text-white/60">Category *</Label>
                    <Select value={newAddon.category} onValueChange={v => setNewAddon({...newAddon, category: v})}>
                      <SelectTrigger className="bg-[#0A0A0A] border-white/10 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#111111] border-white/10">{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div><Label className="text-white/60">Price *</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" type="number" value={newAddon.price} onChange={e => setNewAddon({...newAddon, price: e.target.value})} /></div>
                  <div><Label className="text-white/60">Description</Label><Textarea className="bg-[#0A0A0A] border-white/10 text-white" value={newAddon.description} onChange={e => setNewAddon({...newAddon, description: e.target.value})} /></div>
                  <div><Label className="text-white/60">Max Quantity</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" type="number" value={newAddon.max_quantity} onChange={e => setNewAddon({...newAddon, max_quantity: e.target.value})} /></div>
                  <Button className="w-full bg-[#C9A84C] text-black" onClick={handleAddAddon}>Create Add-On</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card className="bg-[#111111] border-[#C9A84C]/10">
            <Table>
              <TableHeader><TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-white/40">Name</TableHead><TableHead className="text-white/40">Category</TableHead><TableHead className="text-white/40">Price</TableHead><TableHead className="text-white/40">Description</TableHead><TableHead className="text-white/40">Active</TableHead>
              </TableRow></TableHeader>
              <TableBody className="divide-y divide-white/5">
                {addons.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-white/40 py-12">No add-ons found. Click + Add Add-On to add one.</TableCell></TableRow> : addons.map((a: any) => (
                  <TableRow key={a.id} className="border-white/5">
                    <TableCell className="text-white font-medium">{a.name}</TableCell>
                    <TableCell><Badge className="bg-white/5 text-white/60 text-xs">{(a.category || '').replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell className="text-[#C9A84C] font-bold">${Number(a.price || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-white/40 text-sm max-w-[200px] truncate">{a.description || '—'}</TableCell>
                    <TableCell><Switch checked={a.active !== false} onCheckedChange={() => handleToggle('add_on_packages', a.id, a.active !== false)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
