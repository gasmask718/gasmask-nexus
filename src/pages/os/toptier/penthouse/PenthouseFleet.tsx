import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Car, Plus, Pencil, Truck, PartyPopper, Crown, BarChart3 } from 'lucide-react';
import { fetchTopTierData, postTopTierData, patchTopTierData, logPenthouseAction } from '@/lib/toptierApi';
import { supabase } from '@/integrations/supabase/client';

interface FleetVehicle {
  id: string;
  name: string;
  category: string;
  capacity: number;
  hourly_rate: number;
  minimum_hours: number;
  images: string[];
  city: string;
  is_active: boolean;
  available_for_chauffeur: boolean;
  available_for_decor: boolean;
  available_for_nightlife: boolean;
  decor_compatible: boolean;
  decor_tags: string[];
  nightlife_ready: boolean;
  vip_transport: boolean;
  chauffeur_only: boolean;
  driver_required: boolean;
  decor_price_override: number | null;
  nightlife_price_override: number | null;
  description: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  plate_number: string | null;
  color: string | null;
  created_at: string;
}

interface FleetBooking {
  id: string;
  vehicle_id: string;
  experience_type: string;
  status: string;
  total_price: number | null;
  scheduled_at: string | null;
  created_at: string;
}

const CATEGORIES = ['sedan', 'SUV', 'sprinter', 'exotic'];
const DECOR_TAG_OPTIONS = ['romantic', 'party', 'luxury', 'corporate'];
const CITIES = ['Miami', 'Atlanta', 'NYC', 'Los Angeles', 'Houston', 'Dallas'];

const emptyVehicle = (): Partial<FleetVehicle> => ({
  name: '', category: 'sedan', capacity: 4, hourly_rate: 0, minimum_hours: 1,
  images: [], city: 'Miami', is_active: true,
  available_for_chauffeur: false, available_for_decor: false, available_for_nightlife: false,
  decor_compatible: false, decor_tags: [], nightlife_ready: false, vip_transport: false,
  chauffeur_only: false, driver_required: true,
  decor_price_override: null, nightlife_price_override: null,
  description: '', make: '', model: '', year: 2024, plate_number: '', color: '',
});

export default function PenthouseFleet() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [bookings, setBookings] = useState<FleetBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FleetVehicle | null>(null);
  const [form, setForm] = useState<Partial<FleetVehicle>>(emptyVehicle());
  const [filterExp, setFilterExp] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    try {
      const [v, b] = await Promise.all([
        fetchTopTierData<FleetVehicle>('fleet_vehicles', { order: 'created_at.desc' }),
        fetchTopTierData<FleetBooking>('fleet_bookings', { order: 'created_at.desc', limit: 50 }),
      ]);
      setVehicles(v);
      setBookings(b);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyVehicle()); setDialogOpen(true); };
  const openEdit = (v: FleetVehicle) => { setEditing(v); setForm({ ...v }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.name) { toast.error('Vehicle name required'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    try {
      if (editing) {
        await patchTopTierData('fleet_vehicles', { id: `eq.${editing.id}` }, form);
        await logPenthouseAction({ action: 'update_fleet_vehicle', target_type: 'fleet_vehicles', target_id: editing.id, actor_user_id: user?.id || '' });
        toast.success('Vehicle updated');
      } else {
        await postTopTierData('fleet_vehicles', form);
        await logPenthouseAction({ action: 'create_fleet_vehicle', target_type: 'fleet_vehicles', actor_user_id: user?.id || '' });
        toast.success('Vehicle added');
      }
      setDialogOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const toggleActive = async (v: FleetVehicle) => {
    await patchTopTierData('fleet_vehicles', { id: `eq.${v.id}` }, { is_active: !v.is_active });
    load();
  };

  const filtered = vehicles.filter(v => {
    if (filterExp === 'chauffeur') return v.available_for_chauffeur;
    if (filterExp === 'decor') return v.available_for_decor;
    if (filterExp === 'nightlife') return v.available_for_nightlife;
    return true;
  });

  const counts = {
    total: vehicles.length,
    chauffeur: vehicles.filter(v => v.available_for_chauffeur).length,
    decor: vehicles.filter(v => v.available_for_decor).length,
    nightlife: vehicles.filter(v => v.available_for_nightlife).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Unified Fleet</h1>
          <p className="text-muted-foreground text-sm">One fleet — every experience</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Vehicle</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center"><Car className="h-5 w-5 mx-auto mb-1 text-primary" /><p className="text-2xl font-bold">{counts.total}</p><p className="text-xs text-muted-foreground">Total Fleet</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><Crown className="h-5 w-5 mx-auto mb-1 text-primary" /><p className="text-2xl font-bold">{counts.chauffeur}</p><p className="text-xs text-muted-foreground">Chauffeur</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><Truck className="h-5 w-5 mx-auto mb-1 text-primary" /><p className="text-2xl font-bold">{counts.decor}</p><p className="text-xs text-muted-foreground">Decor</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><PartyPopper className="h-5 w-5 mx-auto mb-1 text-primary" /><p className="text-2xl font-bold">{counts.nightlife}</p><p className="text-xs text-muted-foreground">Nightlife</p></CardContent></Card>
      </div>

      <Tabs defaultValue="vehicles">
        <TabsList>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles" className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2">
            {['all', 'chauffeur', 'decor', 'nightlife'].map(f => (
              <Button key={f} size="sm" variant={filterExp === f ? 'default' : 'outline'} onClick={() => setFilterExp(f)} className="capitalize">{f}</Button>
            ))}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Experiences</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.map(v => (
                <TableRow key={v.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{v.name}</p>
                      <p className="text-xs text-muted-foreground">{v.make} {v.model} {v.year}</p>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{v.category}</Badge></TableCell>
                  <TableCell>{v.city}</TableCell>
                  <TableCell>${v.hourly_rate}/hr</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {v.available_for_chauffeur && <Badge className="text-[10px]">Chauffeur</Badge>}
                      {v.available_for_decor && <Badge variant="secondary" className="text-[10px]">Decor</Badge>}
                      {v.available_for_nightlife && <Badge variant="outline" className="text-[10px]">Nightlife</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={v.is_active ? 'default' : 'destructive'} className="cursor-pointer" onClick={() => toggleActive(v)}>
                      {v.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="bookings">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map(b => {
                const veh = vehicles.find(v => v.id === b.vehicle_id);
                return (
                  <TableRow key={b.id}>
                    <TableCell>{veh?.name || b.vehicle_id.slice(0,8)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{b.experience_type}</Badge></TableCell>
                    <TableCell><Badge>{b.status}</Badge></TableCell>
                    <TableCell>{b.total_price ? `$${b.total_price}` : '—'}</TableCell>
                    <TableCell>{b.scheduled_at ? new Date(b.scheduled_at).toLocaleDateString() : '—'}</TableCell>
                  </TableRow>
                );
              })}
              {bookings.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No bookings yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Name</Label><Input value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Make</Label><Input value={form.make || ''} onChange={e => setForm(p => ({ ...p, make: e.target.value }))} /></div>
            <div><Label>Model</Label><Input value={form.model || ''} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} /></div>
            <div><Label>Year</Label><Input type="number" value={form.year || ''} onChange={e => setForm(p => ({ ...p, year: +e.target.value }))} /></div>
            <div><Label>Color</Label><Input value={form.color || ''} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} /></div>
            <div><Label>Capacity</Label><Input type="number" value={form.capacity || ''} onChange={e => setForm(p => ({ ...p, capacity: +e.target.value }))} /></div>
            <div><Label>City</Label>
              <Select value={form.city || 'Miami'} onValueChange={v => setForm(p => ({ ...p, city: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Hourly Rate ($)</Label><Input type="number" value={form.hourly_rate || ''} onChange={e => setForm(p => ({ ...p, hourly_rate: +e.target.value }))} /></div>
            <div><Label>Min Hours</Label><Input type="number" value={form.minimum_hours || ''} onChange={e => setForm(p => ({ ...p, minimum_hours: +e.target.value }))} /></div>
            <div><Label>Plate #</Label><Input value={form.plate_number || ''} onChange={e => setForm(p => ({ ...p, plate_number: e.target.value }))} /></div>
            <div><Label>Decor Price Override ($)</Label><Input type="number" value={form.decor_price_override ?? ''} onChange={e => setForm(p => ({ ...p, decor_price_override: e.target.value ? +e.target.value : null }))} /></div>
            <div><Label>Nightlife Price Override ($)</Label><Input type="number" value={form.nightlife_price_override ?? ''} onChange={e => setForm(p => ({ ...p, nightlife_price_override: e.target.value ? +e.target.value : null }))} /></div>
            <div className="col-span-2"><Label>Description</Label><Textarea value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
          </div>

          {/* Experience Flags */}
          <div className="border rounded-lg p-4 space-y-3 mt-2">
            <h3 className="font-semibold text-sm">Experience Availability</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2"><Switch checked={form.available_for_chauffeur} onCheckedChange={v => setForm(p => ({ ...p, available_for_chauffeur: v }))} /><Label className="text-sm">Chauffeur</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.available_for_decor} onCheckedChange={v => setForm(p => ({ ...p, available_for_decor: v }))} /><Label className="text-sm">Decor</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.available_for_nightlife} onCheckedChange={v => setForm(p => ({ ...p, available_for_nightlife: v }))} /><Label className="text-sm">Nightlife</Label></div>
            </div>
          </div>

          {/* Extra flags */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-sm">Capabilities</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2"><Switch checked={form.decor_compatible} onCheckedChange={v => setForm(p => ({ ...p, decor_compatible: v }))} /><Label className="text-sm">Decor Compatible</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.nightlife_ready} onCheckedChange={v => setForm(p => ({ ...p, nightlife_ready: v }))} /><Label className="text-sm">Nightlife Ready</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.vip_transport} onCheckedChange={v => setForm(p => ({ ...p, vip_transport: v }))} /><Label className="text-sm">VIP Transport</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.chauffeur_only} onCheckedChange={v => setForm(p => ({ ...p, chauffeur_only: v }))} /><Label className="text-sm">Chauffeur Only</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.driver_required} onCheckedChange={v => setForm(p => ({ ...p, driver_required: v }))} /><Label className="text-sm">Driver Required</Label></div>
            </div>
          </div>

          {/* Decor Tags */}
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Decor Tags</h3>
            <div className="flex gap-2 flex-wrap">
              {DECOR_TAG_OPTIONS.map(tag => {
                const active = form.decor_tags?.includes(tag);
                return (
                  <Badge key={tag} variant={active ? 'default' : 'outline'} className="cursor-pointer capitalize"
                    onClick={() => setForm(p => ({
                      ...p,
                      decor_tags: active ? (p.decor_tags || []).filter(t => t !== tag) : [...(p.decor_tags || []), tag],
                    }))}>
                    {tag}
                  </Badge>
                );
              })}
            </div>
          </div>

          <Button onClick={handleSave} className="w-full mt-2">{editing ? 'Update Vehicle' : 'Add Vehicle'}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
