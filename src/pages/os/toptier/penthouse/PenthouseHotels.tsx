import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTopTierData, postTopTierData, patchTopTierData, deleteTopTierData, logPenthouseAction } from '@/lib/toptierApi';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Hotel, Bed, Gift, ClipboardList, Plug, Plus, Pencil, Trash2, Star, DollarSign } from 'lucide-react';

// ── Types ──
interface HotelRow { id: string; name: string; city: string; address: string; description: string; star_rating: number; review_score: number; hero_image: string; gallery: any; amenities: string[]; tags: string[]; inventory_mode: string; is_active: boolean; supplier_id: string; }
interface RoomRow { id: string; hotel_id: string; room_name: string; occupancy: number; bed_type: string; nightly_price: number; total_price: number; refund_policy: string; included_perks: string[]; is_refundable: boolean; is_active: boolean; currency: string; }
interface AddonRow { id: string; name: string; category: string; description: string; price: number; image_url: string; is_active: boolean; }
interface BookingRow { id: string; user_id: string; hotel_id: string; room_offer_id: string; check_in: string; check_out: string; guests: number; subtotal: number; total: number; status: string; payment_status: string; payout_status: string; supplier: string; created_at: string; }
interface SupplierRow { id: string; name: string; api_type: string; status: string; credentials_configured: boolean; payout_model: string; notes: string; }

const gold = '#C9A84C';

async function getActorId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || 'system';
}

// ── Hooks ──
function useHotels() {
  return useQuery({ queryKey: ['tt_hotels'], queryFn: () => fetchTopTierData<HotelRow>('tt_hotels', { order: 'name.asc' }) });
}
function useRooms() {
  return useQuery({ queryKey: ['tt_hotel_room_offers'], queryFn: () => fetchTopTierData<RoomRow>('tt_hotel_room_offers', { order: 'nightly_price.asc' }) });
}
function useAddons() {
  return useQuery({ queryKey: ['tt_hotel_addons'], queryFn: () => fetchTopTierData<AddonRow>('tt_hotel_addons', { order: 'sort_order.asc' }) });
}
function useBookings() {
  return useQuery({ queryKey: ['tt_hotel_booking_requests'], queryFn: () => fetchTopTierData<BookingRow>('tt_hotel_booking_requests', { order: 'created_at.desc' }) });
}
function useSuppliers() {
  return useQuery({ queryKey: ['tt_hotel_suppliers'], queryFn: () => fetchTopTierData<SupplierRow>('tt_hotel_suppliers', { order: 'name.asc' }) });
}

// ── Hotel Tab ──
function HotelCatalog() {
  const qc = useQueryClient();
  const { data: hotels = [], isLoading } = useHotels();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Partial<HotelRow>>({});

  const save = useMutation({
    mutationFn: async () => {
      const actor = await getActorId();
      if (form.id) {
        await patchTopTierData('tt_hotels', { id: `eq.${form.id}` }, form);
        await logPenthouseAction({ action: 'update_hotel', target_type: 'hotel', target_id: form.id, actor_user_id: actor });
      } else {
        await postTopTierData('tt_hotels', { ...form, inventory_mode: 'mock' });
        await logPenthouseAction({ action: 'create_hotel', target_type: 'hotel', actor_user_id: actor });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tt_hotels'] }); setEditOpen(false); toast.success('Hotel saved'); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (h: HotelRow) => {
      await patchTopTierData('tt_hotels', { id: `eq.${h.id}` }, { is_active: !h.is_active });
      const actor = await getActorId();
      await logPenthouseAction({ action: 'toggle_hotel', target_type: 'hotel', target_id: h.id, actor_user_id: actor, after: { is_active: !h.is_active } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tt_hotels'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Hotel Catalog</h2>
        <Button size="sm" className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80" onClick={() => { setForm({}); setEditOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Hotel
        </Button>
      </div>
      {isLoading ? <p className="text-white/40">Loading…</p> : (
        <Table>
          <TableHeader><TableRow className="border-white/10">
            <TableHead className="text-white/50">Name</TableHead>
            <TableHead className="text-white/50">City</TableHead>
            <TableHead className="text-white/50">Stars</TableHead>
            <TableHead className="text-white/50">Mode</TableHead>
            <TableHead className="text-white/50">Active</TableHead>
            <TableHead className="text-white/50 text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {hotels.map(h => (
              <TableRow key={h.id} className="border-white/5 hover:bg-white/5">
                <TableCell className="text-white font-medium">{h.name}</TableCell>
                <TableCell className="text-white/60">{h.city}</TableCell>
                <TableCell><div className="flex items-center gap-1 text-[#C9A84C]"><Star className="h-3 w-3" />{h.star_rating}</div></TableCell>
                <TableCell><Badge variant="outline" className="text-[10px] border-white/20 text-white/50">{h.inventory_mode}</Badge></TableCell>
                <TableCell><Switch checked={h.is_active} onCheckedChange={() => toggle.mutate(h)} /></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-white/40 hover:text-[#C9A84C]" onClick={() => { setForm(h); setEditOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-[#111] border-[#C9A84C]/20 text-white max-w-lg max-h-[85vh]">
          <DialogHeader><DialogTitle className="text-[#C9A84C]">{form.id ? 'Edit' : 'Add'} Hotel</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-3">
              <div><Label className="text-white/60">Name</Label><Input className="bg-white/5 border-white/10 text-white" value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-white/60">City</Label><Input className="bg-white/5 border-white/10 text-white" value={form.city || ''} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} /></div>
                <div><Label className="text-white/60">Star Rating</Label><Input type="number" step="0.1" className="bg-white/5 border-white/10 text-white" value={form.star_rating ?? 5} onChange={e => setForm(p => ({ ...p, star_rating: parseFloat(e.target.value) }))} /></div>
              </div>
              <div><Label className="text-white/60">Address</Label><Input className="bg-white/5 border-white/10 text-white" value={form.address || ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
              <div><Label className="text-white/60">Description</Label><Textarea className="bg-white/5 border-white/10 text-white" rows={3} value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div><Label className="text-white/60">Hero Image URL</Label><Input className="bg-white/5 border-white/10 text-white" value={form.hero_image || ''} onChange={e => setForm(p => ({ ...p, hero_image: e.target.value }))} /></div>
              <div><Label className="text-white/60">Amenities (comma-separated)</Label><Input className="bg-white/5 border-white/10 text-white" value={(form.amenities || []).join(', ')} onChange={e => setForm(p => ({ ...p, amenities: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} /></div>
              <div><Label className="text-white/60">Tags (comma-separated)</Label><Input className="bg-white/5 border-white/10 text-white" value={(form.tags || []).join(', ')} onChange={e => setForm(p => ({ ...p, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} /></div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} className="text-white/50">Cancel</Button>
            <Button className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Room Offers Tab ──
function RoomOffers() {
  const qc = useQueryClient();
  const { data: rooms = [], isLoading } = useRooms();
  const { data: hotels = [] } = useHotels();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Partial<RoomRow>>({});

  const hotelName = (id: string) => hotels.find(h => h.id === id)?.name || '—';

  const save = useMutation({
    mutationFn: async () => {
      const actor = await getActorId();
      if (form.id) {
        await patchTopTierData('tt_hotel_room_offers', { id: `eq.${form.id}` }, form);
        await logPenthouseAction({ action: 'update_room_offer', target_type: 'room_offer', target_id: form.id, actor_user_id: actor });
      } else {
        await postTopTierData('tt_hotel_room_offers', form);
        await logPenthouseAction({ action: 'create_room_offer', target_type: 'room_offer', actor_user_id: actor });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tt_hotel_room_offers'] }); setEditOpen(false); toast.success('Room offer saved'); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Room & Package Offers</h2>
        <Button size="sm" className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80" onClick={() => { setForm({}); setEditOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Room Offer
        </Button>
      </div>
      {isLoading ? <p className="text-white/40">Loading…</p> : (
        <Table>
          <TableHeader><TableRow className="border-white/10">
            <TableHead className="text-white/50">Hotel</TableHead>
            <TableHead className="text-white/50">Room</TableHead>
            <TableHead className="text-white/50">Bed</TableHead>
            <TableHead className="text-white/50">Occupancy</TableHead>
            <TableHead className="text-white/50">Nightly</TableHead>
            <TableHead className="text-white/50">Refundable</TableHead>
            <TableHead className="text-white/50">Active</TableHead>
            <TableHead className="text-white/50 text-right">Edit</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rooms.map(r => (
              <TableRow key={r.id} className="border-white/5 hover:bg-white/5">
                <TableCell className="text-white/60 text-xs">{hotelName(r.hotel_id)}</TableCell>
                <TableCell className="text-white font-medium">{r.room_name}</TableCell>
                <TableCell className="text-white/60">{r.bed_type}</TableCell>
                <TableCell className="text-white/60">{r.occupancy}</TableCell>
                <TableCell className="text-[#C9A84C] font-mono">${r.nightly_price?.toLocaleString()}</TableCell>
                <TableCell>{r.is_refundable ? <Badge className="bg-green-500/20 text-green-400 text-[10px]">Yes</Badge> : <Badge className="bg-red-500/20 text-red-400 text-[10px]">No</Badge>}</TableCell>
                <TableCell><Switch checked={r.is_active} onCheckedChange={async () => { await patchTopTierData('tt_hotel_room_offers', { id: `eq.${r.id}` }, { is_active: !r.is_active }); qc.invalidateQueries({ queryKey: ['tt_hotel_room_offers'] }); }} /></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-white/40 hover:text-[#C9A84C]" onClick={() => { setForm(r); setEditOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-[#111] border-[#C9A84C]/20 text-white max-w-lg max-h-[85vh]">
          <DialogHeader><DialogTitle className="text-[#C9A84C]">{form.id ? 'Edit' : 'Add'} Room Offer</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-3">
              <div>
                <Label className="text-white/60">Hotel</Label>
                <Select value={form.hotel_id || ''} onValueChange={v => setForm(p => ({ ...p, hotel_id: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select hotel" /></SelectTrigger>
                  <SelectContent>{hotels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-white/60">Room Name</Label><Input className="bg-white/5 border-white/10 text-white" value={form.room_name || ''} onChange={e => setForm(p => ({ ...p, room_name: e.target.value }))} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-white/60">Occupancy</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={form.occupancy ?? 2} onChange={e => setForm(p => ({ ...p, occupancy: parseInt(e.target.value) }))} /></div>
                <div><Label className="text-white/60">Bed Type</Label><Input className="bg-white/5 border-white/10 text-white" value={form.bed_type || 'King'} onChange={e => setForm(p => ({ ...p, bed_type: e.target.value }))} /></div>
                <div><Label className="text-white/60">Currency</Label><Input className="bg-white/5 border-white/10 text-white" value={form.currency || 'USD'} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-white/60">Nightly Price</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={form.nightly_price ?? 0} onChange={e => setForm(p => ({ ...p, nightly_price: parseFloat(e.target.value) }))} /></div>
                <div><Label className="text-white/60">Total Price</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={form.total_price ?? ''} onChange={e => setForm(p => ({ ...p, total_price: parseFloat(e.target.value) || null }))} /></div>
              </div>
              <div><Label className="text-white/60">Refund Policy</Label><Input className="bg-white/5 border-white/10 text-white" value={form.refund_policy || ''} onChange={e => setForm(p => ({ ...p, refund_policy: e.target.value }))} /></div>
              <div><Label className="text-white/60">Included Perks (comma-separated)</Label><Input className="bg-white/5 border-white/10 text-white" value={(form.included_perks || []).join(', ')} onChange={e => setForm(p => ({ ...p, included_perks: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.is_refundable ?? false} onCheckedChange={v => setForm(p => ({ ...p, is_refundable: v }))} /><Label className="text-white/60">Refundable</Label></div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} className="text-white/50">Cancel</Button>
            <Button className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Add-ons Tab ──
function AddonsManager() {
  const qc = useQueryClient();
  const { data: addons = [], isLoading } = useAddons();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Partial<AddonRow>>({});

  const save = useMutation({
    mutationFn: async () => {
      const actor = await getActorId();
      if (form.id) {
        await patchTopTierData('tt_hotel_addons', { id: `eq.${form.id}` }, form);
        await logPenthouseAction({ action: 'update_addon', target_type: 'hotel_addon', target_id: form.id, actor_user_id: actor });
      } else {
        await postTopTierData('tt_hotel_addons', form);
        await logPenthouseAction({ action: 'create_addon', target_type: 'hotel_addon', actor_user_id: actor });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tt_hotel_addons'] }); setEditOpen(false); toast.success('Add-on saved'); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await deleteTopTierData('tt_hotel_addons', { id: `eq.${id}` });
      const actor = await getActorId();
      await logPenthouseAction({ action: 'delete_addon', target_type: 'hotel_addon', target_id: id, actor_user_id: actor });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tt_hotel_addons'] }); toast.success('Deleted'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Hotel Add-ons</h2>
        <Button size="sm" className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80" onClick={() => { setForm({}); setEditOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add Add-on</Button>
      </div>
      {isLoading ? <p className="text-white/40">Loading…</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {addons.map(a => (
            <Card key={a.id} className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-white text-sm">{a.name}</CardTitle>
                    <CardDescription className="text-white/40 text-xs">{a.category}</CardDescription>
                  </div>
                  <Badge className="bg-[#C9A84C]/20 text-[#C9A84C] border-0">${a.price}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-white/50 text-xs mb-3">{a.description}</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-white/40 hover:text-[#C9A84C] text-xs" onClick={() => { setForm(a); setEditOpen(true); }}><Pencil className="h-3 w-3 mr-1" />Edit</Button>
                  <Button variant="ghost" size="sm" className="text-white/40 hover:text-red-400 text-xs" onClick={() => del.mutate(a.id)}><Trash2 className="h-3 w-3 mr-1" />Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-[#111] border-[#C9A84C]/20 text-white max-w-md">
          <DialogHeader><DialogTitle className="text-[#C9A84C]">{form.id ? 'Edit' : 'Add'} Add-on</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-white/60">Name</Label><Input className="bg-white/5 border-white/10 text-white" value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-white/60">Category</Label><Input className="bg-white/5 border-white/10 text-white" value={form.category || ''} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} /></div>
              <div><Label className="text-white/60">Price</Label><Input type="number" className="bg-white/5 border-white/10 text-white" value={form.price ?? 0} onChange={e => setForm(p => ({ ...p, price: parseFloat(e.target.value) }))} /></div>
            </div>
            <div><Label className="text-white/60">Description</Label><Textarea className="bg-white/5 border-white/10 text-white" rows={2} value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div><Label className="text-white/60">Image URL</Label><Input className="bg-white/5 border-white/10 text-white" value={form.image_url || ''} onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} className="text-white/50">Cancel</Button>
            <Button className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Bookings Tab ──
function BookingsManager() {
  const qc = useQueryClient();
  const { data: bookings = [], isLoading } = useBookings();
  const { data: hotels = [] } = useHotels();

  const hotelName = (id: string) => hotels.find(h => h.id === id)?.name || '—';

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    confirmed: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
    completed: 'bg-blue-500/20 text-blue-400',
  };

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await patchTopTierData('tt_hotel_booking_requests', { id: `eq.${id}` }, { status });
      const actor = await getActorId();
      await logPenthouseAction({ action: 'update_booking_status', target_type: 'hotel_booking', target_id: id, actor_user_id: actor, after: { status } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tt_hotel_booking_requests'] }); toast.success('Status updated'); },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Booking Requests</h2>
      {isLoading ? <p className="text-white/40">Loading…</p> : bookings.length === 0 ? (
        <Card className="bg-white/5 border-white/10"><CardContent className="py-12 text-center text-white/40">No booking requests yet</CardContent></Card>
      ) : (
        <Table>
          <TableHeader><TableRow className="border-white/10">
            <TableHead className="text-white/50">Hotel</TableHead>
            <TableHead className="text-white/50">Dates</TableHead>
            <TableHead className="text-white/50">Guests</TableHead>
            <TableHead className="text-white/50">Total</TableHead>
            <TableHead className="text-white/50">Payment</TableHead>
            <TableHead className="text-white/50">Status</TableHead>
            <TableHead className="text-white/50 text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {bookings.map(b => (
              <TableRow key={b.id} className="border-white/5 hover:bg-white/5">
                <TableCell className="text-white font-medium text-xs">{hotelName(b.hotel_id)}</TableCell>
                <TableCell className="text-white/60 text-xs">{b.check_in} → {b.check_out}</TableCell>
                <TableCell className="text-white/60">{b.guests}</TableCell>
                <TableCell className="text-[#C9A84C] font-mono">${b.total?.toLocaleString()}</TableCell>
                <TableCell><Badge className="text-[10px]" variant="outline">{b.payment_status}</Badge></TableCell>
                <TableCell><Badge className={`text-[10px] ${statusColors[b.status] || ''}`}>{b.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Select value={b.status} onValueChange={v => updateStatus.mutate({ id: b.id, status: v })}>
                    <SelectTrigger className="h-7 w-28 bg-white/5 border-white/10 text-white text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ── Suppliers Tab ──
function SuppliersManager() {
  const qc = useQueryClient();
  const { data: suppliers = [], isLoading } = useSuppliers();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Partial<SupplierRow>>({});

  const save = useMutation({
    mutationFn: async () => {
      const actor = await getActorId();
      if (form.id) {
        await patchTopTierData('tt_hotel_suppliers', { id: `eq.${form.id}` }, form);
        await logPenthouseAction({ action: 'update_supplier', target_type: 'hotel_supplier', target_id: form.id, actor_user_id: actor });
      } else {
        await postTopTierData('tt_hotel_suppliers', form);
        await logPenthouseAction({ action: 'create_supplier', target_type: 'hotel_supplier', actor_user_id: actor });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tt_hotel_suppliers'] }); setEditOpen(false); toast.success('Supplier saved'); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Supplier Connections</h2>
        <Button size="sm" className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80" onClick={() => { setForm({ api_type: 'mock', status: 'active', payout_model: 'net_rate' }); setEditOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add Supplier</Button>
      </div>
      {isLoading ? <p className="text-white/40">Loading…</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suppliers.map(s => (
            <Card key={s.id} className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-white text-sm">{s.name}</CardTitle>
                  <Badge className={s.status === 'active' ? 'bg-green-500/20 text-green-400 text-[10px]' : 'bg-red-500/20 text-red-400 text-[10px]'}>{s.status}</Badge>
                </div>
                <CardDescription className="text-white/40 text-xs">API: {s.api_type} · Payout: {s.payout_model}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-2 w-2 rounded-full ${s.credentials_configured ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-white/50 text-xs">{s.credentials_configured ? 'Credentials configured' : 'No credentials'}</span>
                </div>
                {s.notes && <p className="text-white/40 text-xs">{s.notes}</p>}
                <Button variant="ghost" size="sm" className="text-white/40 hover:text-[#C9A84C] text-xs mt-2" onClick={() => { setForm(s); setEditOpen(true); }}><Pencil className="h-3 w-3 mr-1" />Edit</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-[#111] border-[#C9A84C]/20 text-white max-w-md">
          <DialogHeader><DialogTitle className="text-[#C9A84C]">{form.id ? 'Edit' : 'Add'} Supplier</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-white/60">Name</Label><Input className="bg-white/5 border-white/10 text-white" value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/60">API Type</Label>
                <Select value={form.api_type || 'mock'} onValueChange={v => setForm(p => ({ ...p, api_type: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mock">Mock</SelectItem>
                    <SelectItem value="booking_com">Booking.com</SelectItem>
                    <SelectItem value="expedia">Expedia</SelectItem>
                    <SelectItem value="hotelbeds">Hotelbeds</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/60">Payout Model</Label>
                <Select value={form.payout_model || 'net_rate'} onValueChange={v => setForm(p => ({ ...p, payout_model: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="net_rate">Net Rate</SelectItem>
                    <SelectItem value="commission">Commission</SelectItem>
                    <SelectItem value="markup">Markup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-white/60">Notes</Label><Textarea className="bg-white/5 border-white/10 text-white" rows={2} value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.credentials_configured ?? false} onCheckedChange={v => setForm(p => ({ ...p, credentials_configured: v }))} /><Label className="text-white/60">Credentials Configured</Label></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} className="text-white/50">Cancel</Button>
            <Button className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Page ──
export default function PenthouseHotels() {
  const { data: hotels = [] } = useHotels();
  const { data: rooms = [] } = useRooms();
  const { data: bookings = [] } = useBookings();
  const { data: addons = [] } = useAddons();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-[#C9A84C]">Luxury Hotels</h1>
        <p className="text-white/40 text-sm">Hotel catalog, room offers, add-ons, bookings & supplier management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Hotels', value: hotels.length, icon: Hotel },
          { label: 'Room Offers', value: rooms.length, icon: Bed },
          { label: 'Add-ons', value: addons.length, icon: Gift },
          { label: 'Bookings', value: bookings.length, icon: ClipboardList },
        ].map(s => (
          <Card key={s.label} className="bg-white/5 border-white/10">
            <CardContent className="py-4 flex items-center gap-3">
              <s.icon className="h-5 w-5 text-[#C9A84C]" />
              <div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-white/40 text-xs">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="hotels">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="hotels" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><Hotel className="h-3.5 w-3.5 mr-1.5" />Hotels</TabsTrigger>
          <TabsTrigger value="rooms" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><Bed className="h-3.5 w-3.5 mr-1.5" />Rooms</TabsTrigger>
          <TabsTrigger value="addons" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><Gift className="h-3.5 w-3.5 mr-1.5" />Add-ons</TabsTrigger>
          <TabsTrigger value="bookings" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><ClipboardList className="h-3.5 w-3.5 mr-1.5" />Bookings</TabsTrigger>
          <TabsTrigger value="suppliers" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><Plug className="h-3.5 w-3.5 mr-1.5" />Suppliers</TabsTrigger>
        </TabsList>
        <TabsContent value="hotels"><HotelCatalog /></TabsContent>
        <TabsContent value="rooms"><RoomOffers /></TabsContent>
        <TabsContent value="addons"><AddonsManager /></TabsContent>
        <TabsContent value="bookings"><BookingsManager /></TabsContent>
        <TabsContent value="suppliers"><SuppliersManager /></TabsContent>
      </Tabs>
    </div>
  );
}
