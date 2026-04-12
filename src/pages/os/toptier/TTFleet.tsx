import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pubFetch, pubPatch, pubPost } from '@/lib/publicSiteApi';
import { fetchTopTierData, patchTopTierData, postTopTierData } from '@/lib/toptierApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Car, CheckCircle, Wrench, Layers, Plus, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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

function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  const map: Record<string, string> = {
    available: 'bg-emerald-500/20 text-emerald-400', active: 'bg-emerald-500/20 text-emerald-400',
    in_service: 'bg-blue-500/20 text-blue-400', booked: 'bg-blue-500/20 text-blue-400', on_assignment: 'bg-blue-500/20 text-blue-400',
    maintenance: 'bg-amber-500/20 text-amber-400',
  };
  return <Badge className={map[s] || 'bg-white/10 text-white/60'}>{status}</Badge>;
}

export default function TTFleet() {
  const qc = useQueryClient();
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<'public' | 'os'>('public');
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [rateValue, setRateValue] = useState('');
  const [newVehicle, setNewVehicle] = useState({ make: '', model: '', year: '', category: '', capacity: '', base_rate: '', hourly_rate: '', amenities: '', status: 'available', photo_url: '' });

  const { data: pubVehicles = [], isError: pubError } = useQuery({
    queryKey: ['pub-vehicles'],
    queryFn: () => pubFetch('vehicles', { order: 'category.asc' }),
  });

  const { data: osVehicles = [] } = useQuery({
    queryKey: ['os-vehicles'],
    queryFn: () => fetchTopTierData('tt_vehicles'),
  });

  const allVehicles = [...pubVehicles, ...osVehicles];
  const totalAvailable = allVehicles.filter((v: any) => ['available', 'active'].includes((v.status || '').toLowerCase())).length;
  const inService = allVehicles.filter((v: any) => ['in_service', 'booked', 'on_assignment'].includes((v.status || '').toLowerCase())).length;
  const inMaintenance = allVehicles.filter((v: any) => (v.status || '').toLowerCase() === 'maintenance').length;
  const categories = new Set(allVehicles.map((v: any) => v.category).filter(Boolean));

  const handleRateSave = async (vehicle: any, isPublic: boolean) => {
    const val = parseFloat(rateValue);
    if (isNaN(val)) { setEditingRate(null); return; }
    if (isPublic) {
      const ok = await pubPatch('vehicles', vehicle.id, { base_rate: val });
      if (ok) { toast.success('Rate updated'); qc.invalidateQueries({ queryKey: ['pub-vehicles'] }); }
      else toast.error('Update failed. Try again.');
    } else {
      try { await patchTopTierData('tt_vehicles', { id: `eq.${vehicle.id}` }, { base_rate: val }); toast.success('Rate updated'); qc.invalidateQueries({ queryKey: ['os-vehicles'] }); }
      catch { toast.error('Update failed. Try again.'); }
    }
    setEditingRate(null);
  };

  const handleToggleStatus = async (vehicle: any, isPublic: boolean) => {
    const cycle: Record<string, string> = { available: 'in_service', in_service: 'maintenance', maintenance: 'available', active: 'in_service' };
    const next = cycle[(vehicle.status || '').toLowerCase()] || 'available';
    if (isPublic) {
      const ok = await pubPatch('vehicles', vehicle.id, { status: next });
      if (ok) { toast.success(`Status → ${next}`); qc.invalidateQueries({ queryKey: ['pub-vehicles'] }); }
    } else {
      try { await patchTopTierData('tt_vehicles', { id: `eq.${vehicle.id}` }, { status: next }); toast.success(`Status → ${next}`); qc.invalidateQueries({ queryKey: ['os-vehicles'] }); }
      catch { toast.error('Update failed.'); }
    }
  };

  const handleAdd = async () => {
    const data = { ...newVehicle, capacity: parseInt(newVehicle.capacity) || 0, base_rate: parseFloat(newVehicle.base_rate) || 0, hourly_rate: parseFloat(newVehicle.hourly_rate) || 0, year: parseInt(newVehicle.year) || 0, amenities: newVehicle.amenities ? newVehicle.amenities.split(',').map(a => a.trim()) : [] };
    if (addTarget === 'public') {
      const result = await pubPost('vehicles', data);
      if (result) { toast.success('Vehicle added to public fleet'); qc.invalidateQueries({ queryKey: ['pub-vehicles'] }); setAddOpen(false); }
      else toast.error('Failed to add vehicle.');
    } else {
      try { await postTopTierData('tt_vehicles', data); toast.success('Vehicle added to OS fleet'); qc.invalidateQueries({ queryKey: ['os-vehicles'] }); setAddOpen(false); }
      catch { toast.error('Failed to add vehicle.'); }
    }
  };

  const renderTable = (vehicles: any[], isPublic: boolean) => (
    <Table>
      <TableHeader>
        <TableRow className="border-white/5 hover:bg-transparent">
          <TableHead className="text-white/40">Vehicle</TableHead>
          <TableHead className="text-white/40">Capacity</TableHead>
          <TableHead className="text-white/40">Base Rate</TableHead>
          <TableHead className="text-white/40">Status</TableHead>
          <TableHead className="text-white/40">Features</TableHead>
          <TableHead className="text-white/40">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="divide-y divide-white/5">
        {vehicles.length === 0 ? (
          <TableRow><TableCell colSpan={6} className="text-center text-white/40 py-12">No vehicles found. Click + Add Vehicle to add one.</TableCell></TableRow>
        ) : vehicles.map((v: any) => {
          const amenities = Array.isArray(v.amenities) ? v.amenities : typeof v.amenities === 'string' ? v.amenities.split(',') : [];
          return (
            <TableRow key={v.id} className="border-white/5">
              <TableCell>
                <div>
                  <p className="text-white font-medium text-sm">{v.name || v.vehicle_name || [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Unnamed Vehicle'}</p>
                  <Badge className="bg-white/5 text-white/40 text-[10px] mt-0.5">{v.category || 'N/A'}</Badge>
                </div>
              </TableCell>
              <TableCell className="text-white/60">{v.capacity || '—'}</TableCell>
              <TableCell>
                {editingRate === v.id ? (
                  <Input className="w-20 h-7 bg-[#0A0A0A] border-[#C9A84C]/30 text-[#C9A84C] text-sm" value={rateValue} onChange={e => setRateValue(e.target.value)} onBlur={() => handleRateSave(v, isPublic)} onKeyDown={e => e.key === 'Enter' && handleRateSave(v, isPublic)} autoFocus />
                ) : (
                  <span className="text-[#C9A84C] font-bold cursor-pointer hover:underline" onClick={() => { setEditingRate(v.id); setRateValue(String(v.base_rate || v.hourly_rate || v.price || v.rate || '')); }}>${Number(v.base_rate || v.hourly_rate || v.price || v.rate || 0).toLocaleString()}/hr</span>
                )}
              </TableCell>
              <TableCell><StatusBadge status={v.status || 'unknown'} /></TableCell>
              <TableCell>
                <div className="flex gap-1 flex-wrap">{amenities.slice(0, 3).map((a: string, i: number) => <Badge key={i} className="bg-white/5 text-white/40 text-[10px]">{a.trim()}</Badge>)}</div>
              </TableCell>
              <TableCell>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="ghost" className="text-white/60 h-7 text-xs" onClick={() => handleToggleStatus(v, isPublic)}>Toggle</Button>
                  <Button size="sm" variant="ghost" className="text-[#C9A84C] h-7 text-xs" onClick={() => { setSelectedVehicle(v); setSheetOpen(true); }}>Details</Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Fleet Command Center</h1><p className="text-white/40 text-sm">Manage all vehicles across platforms</p></div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild><Button className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80"><Plus className="h-4 w-4 mr-2" />Add Vehicle</Button></DialogTrigger>
          <DialogContent className="bg-[#111111] border-[#C9A84C]/20 text-white max-w-lg">
            <DialogHeader><DialogTitle className="text-[#C9A84C]">Add Vehicle</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2"><Button size="sm" className={addTarget === 'public' ? 'bg-[#C9A84C] text-black' : 'bg-white/5 text-white/60'} onClick={() => setAddTarget('public')}>Public Fleet</Button><Button size="sm" className={addTarget === 'os' ? 'bg-[#C9A84C] text-black' : 'bg-white/5 text-white/60'} onClick={() => setAddTarget('os')}>OS Fleet</Button></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-white/60">Make *</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={newVehicle.make} onChange={e => setNewVehicle({...newVehicle, make: e.target.value})} /></div>
                <div><Label className="text-white/60">Model *</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={newVehicle.model} onChange={e => setNewVehicle({...newVehicle, model: e.target.value})} /></div>
                <div><Label className="text-white/60">Year *</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={newVehicle.year} onChange={e => setNewVehicle({...newVehicle, year: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-white/60">Category</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={newVehicle.category} onChange={e => setNewVehicle({...newVehicle, category: e.target.value})} /></div>
                <div><Label className="text-white/60">Capacity</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={newVehicle.capacity} onChange={e => setNewVehicle({...newVehicle, capacity: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-white/60">Base Rate ($/hr)</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={newVehicle.base_rate} onChange={e => setNewVehicle({...newVehicle, base_rate: e.target.value})} /></div>
                <div><Label className="text-white/60">Hourly Rate</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={newVehicle.hourly_rate} onChange={e => setNewVehicle({...newVehicle, hourly_rate: e.target.value})} /></div>
              </div>
              <div><Label className="text-white/60">Amenities (comma separated)</Label><Textarea className="bg-[#0A0A0A] border-white/10 text-white" value={newVehicle.amenities} onChange={e => setNewVehicle({...newVehicle, amenities: e.target.value})} /></div>
              <Button className="w-full bg-[#C9A84C] text-black" onClick={handleAdd}>Add Vehicle</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {pubError && <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-400 text-sm">Could not load data from public site. Check Settings &gt; Public Site Connection.</div>}

      <div className="grid grid-cols-5 gap-4">
        <KPICard label="Total Vehicles" value={allVehicles.length} icon={Car} />
        <KPICard label="Available" value={totalAvailable} icon={CheckCircle} color="text-emerald-400" />
        <KPICard label="In Service" value={inService} icon={Car} color="text-blue-400" />
        <KPICard label="Maintenance" value={inMaintenance} icon={Wrench} color="text-amber-400" />
        <KPICard label="Categories" value={categories.size} icon={Layers} />
      </div>

      <PartnerAssetsSection />

      <Tabs defaultValue="public">
        <TabsList className="bg-white/5">
          <TabsTrigger value="public" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]">Public Site Fleet ({pubVehicles.length})</TabsTrigger>
          <TabsTrigger value="os" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]">OS Fleet ({osVehicles.length})</TabsTrigger>
          <TabsTrigger value="partner-assets" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]">Partner Assets</TabsTrigger>
        </TabsList>
        <TabsContent value="public"><Card className="bg-[#111111] border-[#C9A84C]/10 mt-4">{renderTable(pubVehicles, true)}</Card></TabsContent>
        <TabsContent value="os"><Card className="bg-[#111111] border-[#C9A84C]/10 mt-4">{renderTable(osVehicles, false)}</Card></TabsContent>
        <TabsContent value="partner-assets"><PartnerAssetsTab /></TabsContent>
      </Tabs>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="bg-[#111111] border-l border-[#C9A84C]/10 text-white w-[500px] sm:max-w-[500px] overflow-y-auto">
          {selectedVehicle && (
            <>
              <SheetHeader><SheetTitle className="text-white">{selectedVehicle.name || selectedVehicle.vehicle_name || [selectedVehicle.year, selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(' ')}</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-4">
                {selectedVehicle.photo_url && <img src={selectedVehicle.photo_url} alt="Vehicle" className="w-full h-48 object-cover rounded-lg" />}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-white/40">Category</p><p className="text-white">{selectedVehicle.category || '—'}</p></div>
                  <div><p className="text-white/40">Capacity</p><p className="text-white">{selectedVehicle.capacity || '—'} pax</p></div>
                  <div><p className="text-white/40">Base Rate</p><p className="text-[#C9A84C] font-bold">${Number(selectedVehicle.base_rate || selectedVehicle.hourly_rate || selectedVehicle.price || selectedVehicle.rate || 0).toLocaleString()}/hr</p></div>
                  <div><p className="text-white/40">Status</p><StatusBadge status={selectedVehicle.status || ''} /></div>
                </div>
                {selectedVehicle.amenities && (
                  <div><p className="text-white/40 text-sm mb-1">Amenities</p><div className="flex gap-1 flex-wrap">{(Array.isArray(selectedVehicle.amenities) ? selectedVehicle.amenities : selectedVehicle.amenities.split(',')).map((a: string, i: number) => <Badge key={i} className="bg-[#C9A84C]/10 text-[#C9A84C] text-xs">{a.trim()}</Badge>)}</div></div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ─── Partner Assets Section (placeholder for link button at top) ─── */
function PartnerAssetsSection() { return null; }

/* ─── Partner Assets Tab ─── */
function PartnerAssetsTab() {
  const qc = useQueryClient();
  const [linkOpen, setLinkOpen] = useState(false);
  const [form, setForm] = useState({ partner_id: '', partner_name: '', partner_type: 'driver', asset_type: 'vehicle', asset_name: '', asset_category: 'luxury_transport', capacity: '', base_rate: '', hourly_rate: '', markets: '', coverage_radius_miles: '50', response_time_minutes: '30', asset_description: '', photos: '' });

  const { data: partnerAssets = [] } = useQuery({
    queryKey: ['partner-assets'],
    queryFn: async () => {
      const { data } = await supabase.from('tt_partner_assets').select('*').order('partner_name');
      return data || [];
    },
  });

  const handleToggleAvailable = async (asset: any) => {
    await supabase.from('tt_partner_assets').update({ is_available: !asset.is_available }).eq('id', asset.id);
    qc.invalidateQueries({ queryKey: ['partner-assets'] });
  };

  const handleLink = async () => {
    const { error } = await supabase.from('tt_partner_assets').insert({
      partner_id: form.partner_id || crypto.randomUUID(),
      partner_name: form.partner_name,
      partner_type: form.partner_type,
      asset_type: form.asset_type as any,
      asset_name: form.asset_name,
      asset_category: form.asset_category,
      capacity: parseInt(form.capacity) || null,
      base_rate: parseFloat(form.base_rate) || 0,
      hourly_rate: parseFloat(form.hourly_rate) || 0,
      markets: form.markets ? form.markets.split(',').map(m => m.trim()) : [],
      coverage_radius_miles: parseInt(form.coverage_radius_miles) || 50,
      response_time_minutes: parseInt(form.response_time_minutes) || 30,
      asset_description: form.asset_description || null,
      photos: form.photos ? form.photos.split(',').map(p => p.trim()) : [],
    });
    if (error) { toast.error('Failed to link asset'); return; }
    toast.success('Partner asset linked');
    qc.invalidateQueries({ queryKey: ['partner-assets'] });
    setLinkOpen(false);
  };

  const handleRemove = async (id: string) => {
    await supabase.from('tt_partner_assets').delete().eq('id', id);
    toast.success('Asset removed');
    qc.invalidateQueries({ queryKey: ['partner-assets'] });
  };

  // Group by partner
  const grouped = partnerAssets.reduce((acc: Record<string, any[]>, a: any) => {
    const key = a.partner_name || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <Card className="bg-[#111111] border-[#C9A84C]/10 mt-4">
      <div className="p-4 flex justify-between items-center border-b border-white/5">
        <p className="text-white/60 text-sm">{partnerAssets.length} partner assets linked</p>
        <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
          <DialogTrigger asChild><Button className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80" size="sm"><Link2 className="h-4 w-4 mr-2" />Link Partner Asset</Button></DialogTrigger>
          <DialogContent className="bg-[#111111] border-[#C9A84C]/20 text-white max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-[#C9A84C]">Link Partner Asset</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-white/60">Partner Name *</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={form.partner_name} onChange={e => setForm({...form, partner_name: e.target.value})} /></div>
                <div><Label className="text-white/60">Partner Type</Label>
                  <Select value={form.partner_type} onValueChange={v => setForm({...form, partner_type: v})}>
                    <SelectTrigger className="bg-[#0A0A0A] border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#111111] border-white/10">{['driver','chef','security','photographer','yacht_owner','florist','wellness','beauty','media'].map(t => <SelectItem key={t} value={t} className="text-white">{t.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-white/60">Asset Type *</Label>
                  <Select value={form.asset_type} onValueChange={v => setForm({...form, asset_type: v})}>
                    <SelectTrigger className="bg-[#0A0A0A] border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#111111] border-white/10">{['vehicle','aircraft','vessel','team','individual'].map(t => <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-white/60">Asset Name *</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={form.asset_name} onChange={e => setForm({...form, asset_name: e.target.value})} placeholder="e.g. 2024 Escalade" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-white/60">Category</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={form.asset_category} onChange={e => setForm({...form, asset_category: e.target.value})} /></div>
                <div><Label className="text-white/60">Capacity</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-white/60">Base Rate ($/service)</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={form.base_rate} onChange={e => setForm({...form, base_rate: e.target.value})} /></div>
                <div><Label className="text-white/60">Hourly Rate</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={form.hourly_rate} onChange={e => setForm({...form, hourly_rate: e.target.value})} /></div>
              </div>
              <div><Label className="text-white/60">Markets (comma separated)</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={form.markets} onChange={e => setForm({...form, markets: e.target.value})} placeholder="NY, NJ, CT, FL" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-white/60">Coverage Radius (mi)</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={form.coverage_radius_miles} onChange={e => setForm({...form, coverage_radius_miles: e.target.value})} /></div>
                <div><Label className="text-white/60">Response Time (min)</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={form.response_time_minutes} onChange={e => setForm({...form, response_time_minutes: e.target.value})} /></div>
              </div>
              <div><Label className="text-white/60">Description</Label><Textarea className="bg-[#0A0A0A] border-white/10 text-white" value={form.asset_description} onChange={e => setForm({...form, asset_description: e.target.value})} /></div>
              <Button className="w-full bg-[#C9A84C] text-black" onClick={handleLink}>Link Asset</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {partnerAssets.length === 0 ? (
        <div className="p-12 text-center text-white/40"><p>No assets linked yet.</p><p className="text-xs mt-1">Click "Link Partner Asset" to assign vehicles, aircraft, or teams to partners.</p></div>
      ) : (
        Object.entries(grouped).map(([partnerName, assets]) => (
          <div key={partnerName}>
            <div className="px-4 py-2 bg-white/[0.02] border-b border-white/5"><span className="text-sm font-medium text-white/80">{partnerName}</span><Badge className="ml-2 bg-white/5 text-white/40 text-[10px]">{(assets as any[]).length} assets</Badge></div>
            <Table>
              <TableBody className="divide-y divide-white/5">
                {(assets as any[]).map((a: any) => (
                  <TableRow key={a.id} className="border-white/5">
                    <TableCell><div><p className="text-white text-sm">{a.asset_name}</p><Badge className="bg-white/5 text-white/40 text-[10px]">{a.asset_category}</Badge></div></TableCell>
                    <TableCell className="text-white/60 text-sm">{a.asset_type}</TableCell>
                    <TableCell className="text-white/60 text-sm">{a.capacity || '—'}</TableCell>
                    <TableCell><span className="text-[#C9A84C] font-bold">${Number(a.base_rate || 0).toLocaleString()}</span></TableCell>
                    <TableCell><div className="flex gap-1 flex-wrap">{(a.markets || []).slice(0, 3).map((m: string, i: number) => <Badge key={i} className="bg-white/5 text-white/40 text-[10px]">{m}</Badge>)}</div></TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className={`h-7 text-xs ${a.is_available ? 'text-emerald-400' : 'text-white/40'}`} onClick={() => handleToggleAvailable(a)}>
                        {a.is_available ? '✓ Available' : '✗ Unavailable'}
                      </Button>
                    </TableCell>
                    <TableCell><span className="text-[#C9A84C]">★ {Number(a.rating || 5).toFixed(1)}</span></TableCell>
                    <TableCell><Button size="sm" variant="ghost" className="text-red-400/60 h-7 text-xs" onClick={() => handleRemove(a.id)}>Remove</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))
      )}
    </Card>
  );
}
