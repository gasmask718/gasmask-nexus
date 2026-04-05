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
import { Building2, Users, Package, FileText, Send, Plus, Eye, DollarSign, Trash2, Layers, Star, Sparkles } from 'lucide-react';
import { logPenthouseAction } from '@/lib/toptierApi';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  proposal_sent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  booked: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  sent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  declined: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// ─── Venues Tab ───────────────────────────────────────
function VenuesTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', city: '', capacity: '', starting_rate: '', description: '', address: '' });

  const { data: venues = [] } = useQuery({
    queryKey: ['corp-venues'],
    queryFn: async () => {
      const { data } = await supabase.from('corporate_event_venues').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('corporate_event_venues').insert({
        name: form.name, city: form.city, capacity: Number(form.capacity) || null,
        starting_rate: Number(form.starting_rate) || 0, description: form.description, address: form.address,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['corp-venues'] }); setOpen(false); setForm({ name: '', city: '', capacity: '', starting_rate: '', description: '', address: '' }); toast.success('Venue added'); },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('corporate_event_venues').update({ is_active: !is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['corp-venues'] }); toast.success('Updated'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-[#C9A84C]">Corporate Venues ({venues.length})</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80"><Plus className="h-4 w-4 mr-1" />Add Venue</Button></DialogTrigger>
          <DialogContent className="bg-[#111] border-[#C9A84C]/20">
            <DialogHeader><DialogTitle className="text-[#C9A84C]">Add Corporate Venue</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>City</Label><Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className="bg-black/50 border-white/10" /></div>
                <div><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              </div>
              <div><Label>Starting Rate ($)</Label><Input type="number" value={form.starting_rate} onChange={e => setForm(p => ({ ...p, starting_rate: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <div><Label>Address</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <Button onClick={() => addMut.mutate()} disabled={!form.name || !form.city} className="w-full bg-[#C9A84C] text-black">Save Venue</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow className="border-white/10">
          <TableHead>Name</TableHead><TableHead>City</TableHead><TableHead>Capacity</TableHead><TableHead>Rate</TableHead><TableHead>Supplier</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {venues.map((v: any) => (
            <TableRow key={v.id} className="border-white/5">
              <TableCell className="font-medium">{v.name}</TableCell>
              <TableCell>{v.city}</TableCell>
              <TableCell>{v.capacity || '—'}</TableCell>
              <TableCell>${Number(v.starting_rate).toLocaleString()}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{v.supplier}</Badge></TableCell>
              <TableCell><Badge className={v.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>{v.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
              <TableCell><Button size="sm" variant="ghost" onClick={() => toggleActive.mutate({ id: v.id, is_active: v.is_active })} className="text-xs">{v.is_active ? 'Deactivate' : 'Activate'}</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Staff Tab ────────────────────────────────────────
function StaffTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ role_name: '', rate_type: 'hourly', rate_amount: '', city: '', description: '' });

  const { data: staff = [] } = useQuery({
    queryKey: ['corp-staff'],
    queryFn: async () => {
      const { data } = await supabase.from('corporate_event_staff_roles').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('corporate_event_staff_roles').insert({
        role_name: form.role_name, rate_type: form.rate_type as any, rate_amount: Number(form.rate_amount) || 0,
        city: form.city, description: form.description,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['corp-staff'] }); setOpen(false); toast.success('Staff role added'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-[#C9A84C]">Staff Roles ({staff.length})</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80"><Plus className="h-4 w-4 mr-1" />Add Role</Button></DialogTrigger>
          <DialogContent className="bg-[#111] border-[#C9A84C]/20">
            <DialogHeader><DialogTitle className="text-[#C9A84C]">Add Staff Role</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Role Name</Label><Input value={form.role_name} onChange={e => setForm(p => ({ ...p, role_name: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Rate Type</Label>
                  <Select value={form.rate_type} onValueChange={v => setForm(p => ({ ...p, rate_type: v }))}>
                    <SelectTrigger className="bg-black/50 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="hourly">Hourly</SelectItem><SelectItem value="event">Per Event</SelectItem><SelectItem value="daily">Daily</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Rate ($)</Label><Input type="number" value={form.rate_amount} onChange={e => setForm(p => ({ ...p, rate_amount: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              </div>
              <div><Label>City</Label><Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <Button onClick={() => addMut.mutate()} disabled={!form.role_name} className="w-full bg-[#C9A84C] text-black">Save Role</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow className="border-white/10">
          <TableHead>Role</TableHead><TableHead>Rate</TableHead><TableHead>City</TableHead><TableHead>Supplier</TableHead><TableHead>Status</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {staff.map((s: any) => (
            <TableRow key={s.id} className="border-white/5">
              <TableCell className="font-medium">{s.role_name}</TableCell>
              <TableCell>${Number(s.rate_amount).toLocaleString()}/{s.rate_type}</TableCell>
              <TableCell>{s.city || '—'}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{s.supplier}</Badge></TableCell>
              <TableCell><Badge className={s.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>{s.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Rentals Tab ──────────────────────────────────────
function RentalsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ item_name: '', category: '', rental_rate: '', unit_type: 'per_event', inventory_count: '1', city: '', description: '' });

  const { data: rentals = [] } = useQuery({
    queryKey: ['corp-rentals'],
    queryFn: async () => {
      const { data } = await supabase.from('corporate_event_rentals').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('corporate_event_rentals').insert({
        item_name: form.item_name, category: form.category, rental_rate: Number(form.rental_rate) || 0,
        unit_type: form.unit_type, inventory_count: Number(form.inventory_count) || 1, city: form.city, description: form.description,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['corp-rentals'] }); setOpen(false); toast.success('Rental added'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-[#C9A84C]">Rental Inventory ({rentals.length})</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80"><Plus className="h-4 w-4 mr-1" />Add Rental</Button></DialogTrigger>
          <DialogContent className="bg-[#111] border-[#C9A84C]/20">
            <DialogHeader><DialogTitle className="text-[#C9A84C]">Add Rental Item</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Item Name</Label><Input value={form.item_name} onChange={e => setForm(p => ({ ...p, item_name: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label><Input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="bg-black/50 border-white/10" /></div>
                <div><Label>Rate ($)</Label><Input type="number" value={form.rental_rate} onChange={e => setForm(p => ({ ...p, rental_rate: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Unit Type</Label>
                  <Select value={form.unit_type} onValueChange={v => setForm(p => ({ ...p, unit_type: v }))}>
                    <SelectTrigger className="bg-black/50 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="per_event">Per Event</SelectItem><SelectItem value="per_unit">Per Unit</SelectItem><SelectItem value="per_day">Per Day</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Stock</Label><Input type="number" value={form.inventory_count} onChange={e => setForm(p => ({ ...p, inventory_count: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              </div>
              <div><Label>City</Label><Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <Button onClick={() => addMut.mutate()} disabled={!form.item_name} className="w-full bg-[#C9A84C] text-black">Save Rental</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow className="border-white/10">
          <TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead>Rate</TableHead><TableHead>Unit</TableHead><TableHead>Stock</TableHead><TableHead>Status</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rentals.map((r: any) => (
            <TableRow key={r.id} className="border-white/5">
              <TableCell className="font-medium">{r.item_name}</TableCell>
              <TableCell>{r.category || '—'}</TableCell>
              <TableCell>${Number(r.rental_rate).toLocaleString()}</TableCell>
              <TableCell>{r.unit_type}</TableCell>
              <TableCell>{r.inventory_count}</TableCell>
              <TableCell><Badge className={r.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>{r.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Requests Tab (with Generate Proposal) ────────────
function RequestsTab() {
  const qc = useQueryClient();
  const [buildFor, setBuildFor] = useState<any>(null);

  const { data: requests = [] } = useQuery({
    queryKey: ['corp-requests'],
    queryFn: async () => {
      const { data } = await supabase.from('corporate_event_requests').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: venues = [] } = useQuery({ queryKey: ['corp-venues-list'], queryFn: async () => { const { data } = await supabase.from('corporate_event_venues').select('id, name, starting_rate').eq('is_active', true); return data || []; } });
  const { data: staffRoles = [] } = useQuery({ queryKey: ['corp-staff-list'], queryFn: async () => { const { data } = await supabase.from('corporate_event_staff_roles').select('id, role_name, rate_amount').eq('is_active', true); return data || []; } });
  const { data: rentals = [] } = useQuery({ queryKey: ['corp-rentals-list'], queryFn: async () => { const { data } = await supabase.from('corporate_event_rentals').select('id, item_name, rental_rate').eq('is_active', true); return data || []; } });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('corporate_event_requests').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['corp-requests'] }); toast.success('Status updated'); },
  });

  // Proposal builder state
  const [venueId, setVenueId] = useState('');
  const [lineItems, setLineItems] = useState<{ type: string; item_id: string; item_name: string; quantity: number; price: number }[]>([]);
  const [feePercent, setFeePercent] = useState('15');

  const addLineItem = (type: string) => {
    setLineItems(prev => [...prev, { type, item_id: '', item_name: '', quantity: 1, price: 0 }]);
  };
  const removeLineItem = (idx: number) => setLineItems(prev => prev.filter((_, i) => i !== idx));
  const updateLineItem = (idx: number, field: string, value: any) => {
    setLineItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      // Auto-fill price/name when item selected
      if (field === 'item_id' && value) {
        if (updated.type === 'venue') {
          const v = venues.find((x: any) => x.id === value);
          if (v) { updated.item_name = v.name; updated.price = Number(v.starting_rate) || 0; }
        } else if (updated.type === 'staff') {
          const s = staffRoles.find((x: any) => x.id === value);
          if (s) { updated.item_name = s.role_name; updated.price = Number(s.rate_amount) || 0; }
        } else if (updated.type === 'rental') {
          const r = rentals.find((x: any) => x.id === value);
          if (r) { updated.item_name = r.item_name; updated.price = Number(r.rental_rate) || 0; }
        }
      }
      return updated;
    }));
  };

  const itemsSubtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.price, 0);
  const fees = itemsSubtotal * (Number(feePercent) / 100);
  const total = itemsSubtotal + fees;

  const generateProposal = useMutation({
    mutationFn: async () => {
      if (!buildFor) return;
      const staffSummary = lineItems.filter(l => l.type === 'staff').map(l => `${l.quantity}x ${l.item_name}`).join(', ') || null;
      const rentalSummary = lineItems.filter(l => l.type === 'rental').map(l => `${l.quantity}x ${l.item_name}`).join(', ') || null;
      const venueItem = lineItems.find(l => l.type === 'venue');

      const { data: proposal, error } = await supabase.from('corporate_event_proposals').insert({
        request_id: buildFor.id,
        venue_id: venueItem?.item_id || null,
        staff_summary: staffSummary,
        rental_summary: rentalSummary,
        subtotal: itemsSubtotal,
        fees,
        total,
        status: 'draft',
      }).select().single();
      if (error) throw error;

      // Insert line items
      if (lineItems.length > 0 && proposal) {
        const items = lineItems.map(li => ({
          proposal_id: proposal.id,
          type: li.type,
          item_id: li.item_id || null,
          item_name: li.item_name,
          quantity: li.quantity,
          price: li.price,
        }));
        const { error: itemErr } = await supabase.from('corporate_event_proposal_items').insert(items);
        if (itemErr) console.error('Line items error:', itemErr);
      }

      // Update request status
      await supabase.from('corporate_event_requests').update({ status: 'proposal_sent' }).eq('id', buildFor.id);

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        logPenthouseAction({ action: 'generate_proposal', target_type: 'corporate_event_proposals', target_id: proposal.id, actor_user_id: session.user.id, after: { request_id: buildFor.id, total } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['corp-requests'] });
      qc.invalidateQueries({ queryKey: ['corp-proposals'] });
      setBuildFor(null);
      setLineItems([]);
      setVenueId('');
      toast.success('Proposal generated');
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const getItemOptions = (type: string) => {
    if (type === 'venue') return venues.map((v: any) => ({ id: v.id, label: v.name }));
    if (type === 'staff') return staffRoles.map((s: any) => ({ id: s.id, label: s.role_name }));
    if (type === 'rental') return rentals.map((r: any) => ({ id: r.id, label: r.item_name }));
    return [];
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#C9A84C]">Corporate Event Requests ({requests.length})</h3>
      {requests.length === 0 ? (
        <Card className="bg-white/5 border-white/10"><CardContent className="p-8 text-center text-white/40">No requests yet</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r: any) => (
            <Card key={r.id} className="bg-white/5 border-white/10">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-white">{r.company_name}</p>
                    <p className="text-sm text-white/50">{r.contact_name} · {r.email} · {r.phone}</p>
                    <div className="flex gap-3 mt-2 text-xs text-white/40">
                      <span>📍 {r.city}</span>
                      <span>🎭 {r.event_type}</span>
                      <span>👥 {r.guest_count} guests</span>
                      <span>📅 {r.event_date}</span>
                      <span>💰 {r.budget_range}</span>
                    </div>
                    {r.notes && <p className="text-xs text-white/30 mt-1">{r.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[r.status] || 'bg-gray-500/20 text-gray-400'}>{r.status}</Badge>
                    <Select value={r.status} onValueChange={v => updateStatus.mutate({ id: r.id, status: v })}>
                      <SelectTrigger className="w-[140px] h-8 text-xs bg-black/50 border-white/10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="booked">Booked</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    {r.status === 'pending' && (
                      <Button size="sm" onClick={() => { setBuildFor(r); setLineItems([]); setVenueId(''); setFeePercent('15'); }} className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80 text-xs">
                        <DollarSign className="h-3 w-3 mr-1" />Build Proposal
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Proposal Builder Dialog */}
      <Dialog open={!!buildFor} onOpenChange={o => { if (!o) setBuildFor(null); }}>
        <DialogContent className="bg-[#111] border-[#C9A84C]/20 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-[#C9A84C]">Build Proposal — {buildFor?.company_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-white/40">{buildFor?.event_type} · {buildFor?.guest_count} guests · {buildFor?.event_date} · Budget: {buildFor?.budget_range}</p>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm text-white/70">Line Items</Label>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => addLineItem('venue')} className="text-xs h-7 border-white/10"><Building2 className="h-3 w-3 mr-1" />Venue</Button>
                  <Button size="sm" variant="outline" onClick={() => addLineItem('staff')} className="text-xs h-7 border-white/10"><Users className="h-3 w-3 mr-1" />Staff</Button>
                  <Button size="sm" variant="outline" onClick={() => addLineItem('rental')} className="text-xs h-7 border-white/10"><Package className="h-3 w-3 mr-1" />Rental</Button>
                </div>
              </div>

              {lineItems.length === 0 && <p className="text-xs text-white/30 py-2">Add venue, staff, and rental items above.</p>}

              {lineItems.map((li, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-white/5 p-2 rounded border border-white/5">
                  <Badge variant="outline" className="text-[10px] w-14 justify-center shrink-0">{li.type}</Badge>
                  <Select value={li.item_id} onValueChange={v => updateLineItem(idx, 'item_id', v)}>
                    <SelectTrigger className="bg-black/50 border-white/10 h-8 text-xs flex-1"><SelectValue placeholder="Select item" /></SelectTrigger>
                    <SelectContent>
                      {getItemOptions(li.type).map((opt: any) => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" value={li.quantity} onChange={e => updateLineItem(idx, 'quantity', Number(e.target.value) || 1)} className="w-16 h-8 text-xs bg-black/50 border-white/10" placeholder="Qty" />
                  <Input type="number" value={li.price} onChange={e => updateLineItem(idx, 'price', Number(e.target.value) || 0)} className="w-24 h-8 text-xs bg-black/50 border-white/10" placeholder="Price" />
                  <span className="text-xs text-white/50 w-20 text-right">${(li.quantity * li.price).toLocaleString()}</span>
                  <Button size="sm" variant="ghost" onClick={() => removeLineItem(idx)} className="h-7 w-7 p-0"><Trash2 className="h-3 w-3 text-red-400" /></Button>
                </div>
              ))}
            </div>

            {/* Fee */}
            <div className="flex gap-3 items-center">
              <Label className="text-sm text-white/70 shrink-0">Service Fee %</Label>
              <Input type="number" value={feePercent} onChange={e => setFeePercent(e.target.value)} className="w-20 h-8 text-xs bg-black/50 border-white/10" />
            </div>

            {/* Summary */}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-3 space-y-1">
                <div className="flex justify-between text-sm text-white/60"><span>Subtotal</span><span>${itemsSubtotal.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm text-white/60"><span>Fees ({feePercent}%)</span><span>${fees.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm font-bold text-[#C9A84C] pt-1 border-t border-white/10"><span>Total</span><span>${total.toLocaleString()}</span></div>
              </CardContent>
            </Card>

            <Button onClick={() => generateProposal.mutate()} disabled={lineItems.length === 0 || generateProposal.isPending} className="w-full bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80">
              <Send className="h-4 w-4 mr-2" />Generate Proposal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Proposals Tab (with line item detail) ────────────
function ProposalsTab() {
  const qc = useQueryClient();
  const [viewId, setViewId] = useState<string | null>(null);

  const { data: proposals = [] } = useQuery({
    queryKey: ['corp-proposals'],
    queryFn: async () => {
      const { data } = await supabase.from('corporate_event_proposals').select('*, corporate_event_requests(company_name, event_type, contact_name, email)').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: viewItems = [] } = useQuery({
    queryKey: ['corp-proposal-items', viewId],
    enabled: !!viewId,
    queryFn: async () => {
      const { data } = await supabase.from('corporate_event_proposal_items').select('*').eq('proposal_id', viewId!).order('created_at');
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === 'sent') updates.sent_at = new Date().toISOString();
      const { error } = await supabase.from('corporate_event_proposals').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['corp-proposals'] }); toast.success('Proposal updated'); },
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#C9A84C]">Proposals ({proposals.length})</h3>
      {proposals.length === 0 ? (
        <Card className="bg-white/5 border-white/10"><CardContent className="p-8 text-center text-white/40">No proposals yet. Generate one from the Requests tab.</CardContent></Card>
      ) : (
        <Table>
          <TableHeader><TableRow className="border-white/10">
            <TableHead>Company</TableHead><TableHead>Event</TableHead><TableHead>Subtotal</TableHead><TableHead>Fees</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {proposals.map((p: any) => (
              <TableRow key={p.id} className="border-white/5">
                <TableCell>{(p.corporate_event_requests as any)?.company_name || '—'}</TableCell>
                <TableCell>{(p.corporate_event_requests as any)?.event_type || '—'}</TableCell>
                <TableCell>${Number(p.subtotal).toLocaleString()}</TableCell>
                <TableCell>${Number(p.fees).toLocaleString()}</TableCell>
                <TableCell className="font-semibold text-[#C9A84C]">${Number(p.total).toLocaleString()}</TableCell>
                <TableCell>
                  <Select value={p.status} onValueChange={v => updateStatus.mutate({ id: p.id, status: v })}>
                    <SelectTrigger className="w-[120px] h-7 text-xs bg-transparent border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => setViewId(viewId === p.id ? null : p.id)} className="text-xs"><Eye className="h-3 w-3 mr-1" />Items</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Line Item Detail */}
      <Dialog open={!!viewId} onOpenChange={o => { if (!o) setViewId(null); }}>
        <DialogContent className="bg-[#111] border-[#C9A84C]/20">
          <DialogHeader><DialogTitle className="text-[#C9A84C]">Proposal Line Items</DialogTitle></DialogHeader>
          {viewItems.length === 0 ? (
            <p className="text-white/40 text-sm">No line items.</p>
          ) : (
            <Table>
              <TableHeader><TableRow className="border-white/10">
                <TableHead>Type</TableHead><TableHead>Item</TableHead><TableHead>Qty</TableHead><TableHead>Price</TableHead><TableHead>Subtotal</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {viewItems.map((item: any) => (
                  <TableRow key={item.id} className="border-white/5">
                    <TableCell><Badge variant="outline" className="text-[10px]">{item.type}</Badge></TableCell>
                    <TableCell>{item.item_name || '—'}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>${Number(item.price).toLocaleString()}</TableCell>
                    <TableCell className="font-medium">${Number(item.subtotal).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Bundles Tab ──────────────────────────────────────
function BundlesTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ request_id: '', hotel_id: '', nightlife_id: '', chauffeur_id: '', addons: '', total_price: '' });

  const { data: bundles = [] } = useQuery({
    queryKey: ['corp-bundles'],
    queryFn: async () => {
      const { data } = await supabase.from('corporate_event_bundles').select('*, corporate_event_requests(company_name, event_type, city)').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: requests = [] } = useQuery({
    queryKey: ['corp-requests-for-bundles'],
    queryFn: async () => {
      const { data } = await supabase.from('corporate_event_requests').select('id, company_name, event_type').order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
  });

  const { data: hotels = [] } = useQuery({
    queryKey: ['corp-hotels-list'],
    queryFn: async () => {
      const { data } = await supabase.from('tt_hotels').select('id, name, city').eq('is_active', true);
      return data || [];
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      let addonsJson: any[] = [];
      try { addonsJson = form.addons ? JSON.parse(form.addons) : []; } catch { addonsJson = form.addons ? [{ note: form.addons }] : []; }
      const { error } = await supabase.from('corporate_event_bundles').insert({
        request_id: form.request_id,
        hotel_id: form.hotel_id || null,
        nightlife_id: form.nightlife_id || null,
        chauffeur_id: form.chauffeur_id || null,
        addons: addonsJson,
        total_price: Number(form.total_price) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['corp-bundles'] });
      setOpen(false);
      setForm({ request_id: '', hotel_id: '', nightlife_id: '', chauffeur_id: '', addons: '', total_price: '' });
      toast.success('Bundle created');
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('corporate_event_bundles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['corp-bundles'] }); toast.success('Bundle removed'); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-[#C9A84C]">Service Bundles ({bundles.length})</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80"><Plus className="h-4 w-4 mr-1" />Create Bundle</Button></DialogTrigger>
          <DialogContent className="bg-[#111] border-[#C9A84C]/20">
            <DialogHeader><DialogTitle className="text-[#C9A84C]">Create Service Bundle</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Event Request *</Label>
                <Select value={form.request_id} onValueChange={v => setForm(p => ({ ...p, request_id: v }))}>
                  <SelectTrigger className="bg-black/50 border-white/10"><SelectValue placeholder="Select request" /></SelectTrigger>
                  <SelectContent>{requests.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.company_name} — {r.event_type}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Hotel</Label>
                <Select value={form.hotel_id} onValueChange={v => setForm(p => ({ ...p, hotel_id: v }))}>
                  <SelectTrigger className="bg-black/50 border-white/10"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>{hotels.map((h: any) => <SelectItem key={h.id} value={h.id}>{h.name} ({h.city})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nightlife Request ID</Label><Input value={form.nightlife_id} onChange={e => setForm(p => ({ ...p, nightlife_id: e.target.value }))} placeholder="Optional UUID" className="bg-black/50 border-white/10" /></div>
                <div><Label>Chauffeur ID</Label><Input value={form.chauffeur_id} onChange={e => setForm(p => ({ ...p, chauffeur_id: e.target.value }))} placeholder="Optional UUID" className="bg-black/50 border-white/10" /></div>
              </div>
              <div><Label>Add-ons (JSON or text)</Label><Textarea value={form.addons} onChange={e => setForm(p => ({ ...p, addons: e.target.value }))} placeholder='e.g. [{"service":"photographer","price":500}]' className="bg-black/50 border-white/10" /></div>
              <div><Label>Total Price ($)</Label><Input type="number" value={form.total_price} onChange={e => setForm(p => ({ ...p, total_price: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <Button onClick={() => addMut.mutate()} disabled={!form.request_id} className="w-full bg-[#C9A84C] text-black">Save Bundle</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow className="border-white/10">
          <TableHead>Company</TableHead><TableHead>Event</TableHead><TableHead>Hotel</TableHead><TableHead>Nightlife</TableHead><TableHead>Chauffeur</TableHead><TableHead>Total</TableHead><TableHead>Actions</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {bundles.map((b: any) => (
            <TableRow key={b.id} className="border-white/5">
              <TableCell className="font-medium">{b.corporate_event_requests?.company_name || '—'}</TableCell>
              <TableCell>{b.corporate_event_requests?.event_type || '—'}</TableCell>
              <TableCell>{b.hotel_id ? <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400">Hotel ✓</Badge> : '—'}</TableCell>
              <TableCell>{b.nightlife_id ? <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400">VIP ✓</Badge> : '—'}</TableCell>
              <TableCell>{b.chauffeur_id ? <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400">Car ✓</Badge> : '—'}</TableCell>
              <TableCell className="font-bold text-[#C9A84C]">${Number(b.total_price).toLocaleString()}</TableCell>
              <TableCell><Button size="sm" variant="ghost" onClick={() => deleteMut.mutate(b.id)} className="text-red-400 hover:text-red-300"><Trash2 className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Providers Tab ────────────────────────────────────
function ProvidersTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'photographer', city: '', price: '', description: '', tags: '' });

  const { data: providers = [] } = useQuery({
    queryKey: ['exp-providers'],
    queryFn: async () => {
      const { data } = await supabase.from('experience_providers').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('experience_providers').insert({
        name: form.name, category: form.category, city: form.city,
        price: Number(form.price) || 0, description: form.description,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
      });
      if (error) throw error;
      await logPenthouseAction('create', 'experience_provider', null, null, { name: form.name, category: form.category });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exp-providers'] }); setOpen(false); setForm({ name: '', category: 'photographer', city: '', price: '', description: '', tags: '' }); toast.success('Provider added'); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('experience_providers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exp-providers'] }); toast.success('Deleted'); },
  });

  const categories = ['photographer', 'dj', 'decor', 'catering', 'entertainment', 'florist', 'lighting', 'security', 'mc', 'other'];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-[#C9A84C]">Experience Providers ({providers.length})</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80"><Plus className="h-4 w-4 mr-1" />Add Provider</Button></DialogTrigger>
          <DialogContent className="bg-[#111] border-[#C9A84C]/20">
            <DialogHeader><DialogTitle className="text-[#C9A84C]">Add Experience Provider</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                    <SelectTrigger className="bg-black/50 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>City</Label><Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              </div>
              <div><Label>Price ($)</Label><Input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <div><Label>Tags (comma-separated)</Label><Input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} className="bg-black/50 border-white/10" placeholder="luxury, corporate, premium" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="bg-black/50 border-white/10" /></div>
              <Button onClick={() => addMut.mutate()} disabled={!form.name || !form.city} className="w-full bg-[#C9A84C] text-black">Save Provider</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow className="border-white/10">
          <TableHead className="text-white/50">Provider</TableHead>
          <TableHead className="text-white/50">Category</TableHead>
          <TableHead className="text-white/50">City</TableHead>
          <TableHead className="text-white/50">Price</TableHead>
          <TableHead className="text-white/50">Rating</TableHead>
          <TableHead className="text-white/50">Tags</TableHead>
          <TableHead />
        </TableRow></TableHeader>
        <TableBody>
          {providers.map((p: any) => (
            <TableRow key={p.id} className="border-white/5">
              <TableCell className="text-white font-medium">{p.name}</TableCell>
              <TableCell><Badge variant="outline" className="border-[#C9A84C]/30 text-[#C9A84C]">{p.category}</Badge></TableCell>
              <TableCell className="text-white/60">{p.city}</TableCell>
              <TableCell className="text-white/60">${Number(p.price).toLocaleString()}</TableCell>
              <TableCell className="text-amber-400 flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400" />{p.rating}</TableCell>
              <TableCell>{(p.tags || []).map((t: string) => <Badge key={t} variant="outline" className="mr-1 text-[10px] border-white/10 text-white/40">{t}</Badge>)}</TableCell>
              <TableCell><Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => deleteMut.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────
export default function PenthouseCorporateEvents() {
  const { data: venues = [] } = useQuery({ queryKey: ['corp-venues'], queryFn: async () => { const { data } = await supabase.from('corporate_event_venues').select('id'); return data || []; } });
  const { data: staff = [] } = useQuery({ queryKey: ['corp-staff-count'], queryFn: async () => { const { data } = await supabase.from('corporate_event_staff_roles').select('id'); return data || []; } });
  const { data: rentals = [] } = useQuery({ queryKey: ['corp-rentals-count'], queryFn: async () => { const { data } = await supabase.from('corporate_event_rentals').select('id'); return data || []; } });
  const { data: requests = [] } = useQuery({ queryKey: ['corp-requests-count'], queryFn: async () => { const { data } = await supabase.from('corporate_event_requests').select('id, status'); return data || []; } });
  const { data: bundles = [] } = useQuery({ queryKey: ['corp-bundles-count'], queryFn: async () => { const { data } = await supabase.from('corporate_event_bundles').select('id'); return data || []; } });
  const { data: providers = [] } = useQuery({ queryKey: ['exp-providers-count'], queryFn: async () => { const { data } = await supabase.from('experience_providers').select('id'); return data || []; } });

  const pending = requests.filter((r: any) => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-[#C9A84C]">Corporate Events</h1>
        <p className="text-white/40 text-sm">Powered by Unforgettable Times · Venue, Staff & Rental Marketplace</p>
      </div>

      <div className="grid grid-cols-6 gap-4">
        {[
          { label: 'Venues', value: venues.length, icon: Building2 },
          { label: 'Staff Roles', value: staff.length, icon: Users },
          { label: 'Rentals', value: rentals.length, icon: Package },
          { label: 'Providers', value: providers.length, icon: Sparkles },
          { label: 'Pending', value: pending, icon: FileText },
          { label: 'Bundles', value: bundles.length, icon: Layers },
        ].map(s => (
          <Card key={s.label} className="bg-white/5 border-white/10">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className="h-8 w-8 text-[#C9A84C]/60" />
              <div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-white/40">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="requests" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><FileText className="h-4 w-4 mr-1" />Requests</TabsTrigger>
          <TabsTrigger value="proposals" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><Send className="h-4 w-4 mr-1" />Proposals</TabsTrigger>
          <TabsTrigger value="bundles" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><Layers className="h-4 w-4 mr-1" />Bundles</TabsTrigger>
          <TabsTrigger value="providers" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><Sparkles className="h-4 w-4 mr-1" />Providers</TabsTrigger>
          <TabsTrigger value="venues" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><Building2 className="h-4 w-4 mr-1" />Venues</TabsTrigger>
          <TabsTrigger value="staff" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><Users className="h-4 w-4 mr-1" />Staff</TabsTrigger>
          <TabsTrigger value="rentals" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><Package className="h-4 w-4 mr-1" />Rentals</TabsTrigger>
        </TabsList>
        <TabsContent value="requests"><RequestsTab /></TabsContent>
        <TabsContent value="proposals"><ProposalsTab /></TabsContent>
        <TabsContent value="bundles"><BundlesTab /></TabsContent>
        <TabsContent value="providers"><ProvidersTab /></TabsContent>
        <TabsContent value="venues"><VenuesTab /></TabsContent>
        <TabsContent value="staff"><StaffTab /></TabsContent>
        <TabsContent value="rentals"><RentalsTab /></TabsContent>
      </Tabs>
    </div>
  );
}