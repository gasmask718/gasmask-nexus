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
import { Building2, Users, Package, FileText, Send, Plus, Eye, DollarSign } from 'lucide-react';

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

function RequestsTab() {
  const qc = useQueryClient();
  const { data: requests = [] } = useQuery({
    queryKey: ['corp-requests'],
    queryFn: async () => {
      const { data } = await supabase.from('corporate_event_requests').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('corporate_event_requests').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['corp-requests'] }); toast.success('Status updated'); },
  });

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
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ProposalsTab() {
  const { data: proposals = [] } = useQuery({
    queryKey: ['corp-proposals'],
    queryFn: async () => {
      const { data } = await supabase.from('corporate_event_proposals').select('*, corporate_event_requests(company_name, event_type)').order('created_at', { ascending: false });
      return data || [];
    },
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#C9A84C]">Proposals ({proposals.length})</h3>
      {proposals.length === 0 ? (
        <Card className="bg-white/5 border-white/10"><CardContent className="p-8 text-center text-white/40">No proposals yet. Create one from the Requests tab.</CardContent></Card>
      ) : (
        <Table>
          <TableHeader><TableRow className="border-white/10">
            <TableHead>Company</TableHead><TableHead>Event</TableHead><TableHead>Subtotal</TableHead><TableHead>Fees</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Sent</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {proposals.map((p: any) => (
              <TableRow key={p.id} className="border-white/5">
                <TableCell>{(p.corporate_event_requests as any)?.company_name || '—'}</TableCell>
                <TableCell>{(p.corporate_event_requests as any)?.event_type || '—'}</TableCell>
                <TableCell>${Number(p.subtotal).toLocaleString()}</TableCell>
                <TableCell>${Number(p.fees).toLocaleString()}</TableCell>
                <TableCell className="font-semibold text-[#C9A84C]">${Number(p.total).toLocaleString()}</TableCell>
                <TableCell><Badge className={statusColors[p.status] || ''}>{p.status}</Badge></TableCell>
                <TableCell className="text-xs text-white/40">{p.sent_at ? new Date(p.sent_at).toLocaleDateString() : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export default function PenthouseCorporateEvents() {
  const { data: venues = [] } = useQuery({ queryKey: ['corp-venues'], queryFn: async () => { const { data } = await supabase.from('corporate_event_venues').select('id'); return data || []; } });
  const { data: staff = [] } = useQuery({ queryKey: ['corp-staff-count'], queryFn: async () => { const { data } = await supabase.from('corporate_event_staff_roles').select('id'); return data || []; } });
  const { data: rentals = [] } = useQuery({ queryKey: ['corp-rentals-count'], queryFn: async () => { const { data } = await supabase.from('corporate_event_rentals').select('id'); return data || []; } });
  const { data: requests = [] } = useQuery({ queryKey: ['corp-requests-count'], queryFn: async () => { const { data } = await supabase.from('corporate_event_requests').select('id, status'); return data || []; } });

  const pending = requests.filter((r: any) => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-[#C9A84C]">Corporate Events</h1>
        <p className="text-white/40 text-sm">Powered by Unforgettable Times · Venue, Staff & Rental Marketplace</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Venues', value: venues.length, icon: Building2 },
          { label: 'Staff Roles', value: staff.length, icon: Users },
          { label: 'Rentals', value: rentals.length, icon: Package },
          { label: 'Pending Requests', value: pending, icon: FileText },
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

      <Tabs defaultValue="venues" className="space-y-4">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="venues" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><Building2 className="h-4 w-4 mr-1" />Venues</TabsTrigger>
          <TabsTrigger value="staff" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><Users className="h-4 w-4 mr-1" />Staff</TabsTrigger>
          <TabsTrigger value="rentals" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><Package className="h-4 w-4 mr-1" />Rentals</TabsTrigger>
          <TabsTrigger value="requests" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><FileText className="h-4 w-4 mr-1" />Requests</TabsTrigger>
          <TabsTrigger value="proposals" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]"><Send className="h-4 w-4 mr-1" />Proposals</TabsTrigger>
        </TabsList>
        <TabsContent value="venues"><VenuesTab /></TabsContent>
        <TabsContent value="staff"><StaffTab /></TabsContent>
        <TabsContent value="rentals"><RentalsTab /></TabsContent>
        <TabsContent value="requests"><RequestsTab /></TabsContent>
        <TabsContent value="proposals"><ProposalsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
