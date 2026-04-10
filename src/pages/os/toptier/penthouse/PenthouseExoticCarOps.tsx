import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Car, Search, RefreshCw, Plus, Clock, Send, CheckCircle, DollarSign, AlertTriangle, MapPin, Truck } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  sourcing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  quoted: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled: 'bg-muted text-muted-foreground border-muted',
  delivered: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

export default function PenthouseExoticCarOps() {
  const [activeTab, setActiveTab] = useState('requests');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['exotic-car-requests', statusFilter],
    queryFn: async () => {
      let q = supabase.from('exotic_car_requests').select('*').order('created_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('request_status', statusFilter);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['exotic-car-partners'],
    queryFn: async () => {
      const { data } = await supabase.from('exotic_car_partners').select('*').eq('status', 'active').order('partner_name');
      return data || [];
    },
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['exotic-car-inventory'],
    queryFn: async () => {
      const { data } = await supabase.from('exotic_car_inventory').select('*').eq('is_active', true).order('make');
      return data || [];
    },
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ['exotic-car-quotes'],
    queryFn: async () => {
      const { data } = await supabase.from('exotic_car_quotes').select('*').order('created_at', { ascending: false }).limit(100);
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('exotic_car_requests').update({ request_status: status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exotic-car-requests'] });
      toast.success('Request status updated');
    },
  });

  const filtered = requests.filter((r: any) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (r.customer_name || '').toLowerCase().includes(s) ||
      (r.city || '').toLowerCase().includes(s) ||
      (r.requested_make || '').toLowerCase().includes(s) ||
      (r.requested_model || '').toLowerCase().includes(s);
  });

  const newToday = requests.filter((r: any) => r.created_at && new Date(r.created_at).toDateString() === new Date().toDateString()).length;
  const pendingCount = requests.filter((r: any) => r.request_status === 'pending').length;
  const quotedCount = quotes.filter((q: any) => q.quote_status === 'sent').length;
  const confirmedCount = requests.filter((r: any) => r.request_status === 'confirmed').length;
  const totalRevenue = quotes.filter((q: any) => q.quote_status === 'accepted').reduce((s: number, q: any) => s + (q.total_price || 0), 0);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Car className="h-7 w-7 text-[#C9A84C]" />
            Exotic Car Ops Command Center
          </h1>
          <p className="text-sm text-neutral-400 mt-1">Nationwide exotic car sourcing, delivery & chauffeur coordination</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()} className="border-[#C9A84C]/30 text-[#C9A84C]">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'New Today', value: newToday, icon: Plus, color: 'text-blue-400' },
          { label: 'Pending', value: pendingCount, icon: Clock, color: 'text-yellow-400' },
          { label: 'Quoted', value: quotedCount, icon: Send, color: 'text-purple-400' },
          { label: 'Confirmed', value: confirmedCount, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-[#C9A84C]' },
        ].map((kpi) => (
          <Card key={kpi.label} className="bg-[#111] border-[#222]">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-xs text-neutral-500 uppercase">{kpi.label}</span>
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#111] border border-[#222]">
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="partners">Partners</TabsTrigger>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
        </TabsList>

        {/* REQUESTS */}
        <TabsContent value="requests" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <Input placeholder="Search by name, city, make, model..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-[#111] border-[#333]" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-[#111] border-[#333]"><SelectValue placeholder="Filter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sourcing">Sourcing</SelectItem>
                <SelectItem value="quoted">Quoted</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-[#222] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[#222]">
                  <TableHead className="text-neutral-400">Customer</TableHead>
                  <TableHead className="text-neutral-400">Vehicle</TableHead>
                  <TableHead className="text-neutral-400">City</TableHead>
                  <TableHead className="text-neutral-400">Date</TableHead>
                  <TableHead className="text-neutral-400">Duration</TableHead>
                  <TableHead className="text-neutral-400">Drive Mode</TableHead>
                  <TableHead className="text-neutral-400">Occasion</TableHead>
                  <TableHead className="text-neutral-400">Status</TableHead>
                  <TableHead className="text-neutral-400">Created</TableHead>
                  <TableHead className="text-neutral-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-neutral-500">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-neutral-500">No requests found</TableCell></TableRow>
                ) : filtered.map((req: any) => (
                  <TableRow key={req.id} className="border-[#222] hover:bg-[#111] cursor-pointer" onClick={() => { setSelectedRequest(req); setDetailOpen(true); }}>
                    <TableCell className="font-medium">{req.customer_name || 'Unknown'}</TableCell>
                    <TableCell>{[req.requested_make, req.requested_model].filter(Boolean).join(' ') || '—'}</TableCell>
                    <TableCell>{req.city || '—'}</TableCell>
                    <TableCell>{req.requested_date ? format(new Date(req.requested_date), 'MMM d') : '—'}</TableCell>
                    <TableCell>{req.duration_hours ? `${req.duration_hours}h` : '—'}</TableCell>
                    <TableCell className="capitalize">{req.drive_mode?.replace(/_/g, ' ') || '—'}</TableCell>
                    <TableCell className="capitalize">{req.occasion_type || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className={STATUS_COLORS[req.request_status] || 'bg-muted'}>{req.request_status?.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell className="text-neutral-500 text-xs">{req.created_at ? formatDistanceToNow(new Date(req.created_at), { addSuffix: true }) : '—'}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="h-7 text-[#C9A84C]" onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: req.id, status: 'sourcing' }); }}>
                        <Send className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* INVENTORY */}
        <TabsContent value="inventory" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader><CardTitle className="text-[#C9A84C]">Vehicle Inventory</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#222]">
                    <TableHead className="text-neutral-400">Make / Model</TableHead>
                    <TableHead className="text-neutral-400">Year</TableHead>
                    <TableHead className="text-neutral-400">City</TableHead>
                    <TableHead className="text-neutral-400">Drive Mode</TableHead>
                    <TableHead className="text-neutral-400">Hourly</TableHead>
                    <TableHead className="text-neutral-400">Daily</TableHead>
                    <TableHead className="text-neutral-400">Availability</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-neutral-500">No vehicles in inventory</TableCell></TableRow>
                  ) : inventory.map((v: any) => (
                    <TableRow key={v.id} className="border-[#222] hover:bg-[#0D0D0D]">
                      <TableCell className="font-medium">{v.make} {v.model}</TableCell>
                      <TableCell>{v.year || '—'}</TableCell>
                      <TableCell>{v.city || '—'}</TableCell>
                      <TableCell className="capitalize">{v.drive_mode?.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="text-[#C9A84C]">${(v.hourly_price || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-[#C9A84C]">${(v.daily_price || 0).toLocaleString()}</TableCell>
                      <TableCell className="capitalize">{v.availability_mode}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PARTNERS */}
        <TabsContent value="partners" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader><CardTitle className="text-[#C9A84C]">Partner Network</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#222]">
                    <TableHead className="text-neutral-400">Partner</TableHead>
                    <TableHead className="text-neutral-400">City</TableHead>
                    <TableHead className="text-neutral-400">Self-Drive</TableHead>
                    <TableHead className="text-neutral-400">Chauffeur</TableHead>
                    <TableHead className="text-neutral-400">Same-Day</TableHead>
                    <TableHead className="text-neutral-400">Avg Response</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-neutral-500">No partners yet</TableCell></TableRow>
                  ) : partners.map((p: any) => (
                    <TableRow key={p.id} className="border-[#222] hover:bg-[#0D0D0D]">
                      <TableCell className="font-medium">{p.partner_name}</TableCell>
                      <TableCell>{p.city || '—'}</TableCell>
                      <TableCell>{p.supports_self_drive ? <CheckCircle className="h-4 w-4 text-green-400" /> : '—'}</TableCell>
                      <TableCell>{p.supports_chauffeur ? <CheckCircle className="h-4 w-4 text-green-400" /> : '—'}</TableCell>
                      <TableCell>{p.supports_same_day ? <CheckCircle className="h-4 w-4 text-[#C9A84C]" /> : '—'}</TableCell>
                      <TableCell>{p.avg_response_minutes ? `${p.avg_response_minutes}m` : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* QUOTES */}
        <TabsContent value="quotes" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader><CardTitle className="text-[#C9A84C]">Quote Pipeline</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#222]">
                    <TableHead className="text-neutral-400">Request</TableHead>
                    <TableHead className="text-neutral-400">Hourly</TableHead>
                    <TableHead className="text-neutral-400">Delivery</TableHead>
                    <TableHead className="text-neutral-400">Chauffeur</TableHead>
                    <TableHead className="text-neutral-400">Total</TableHead>
                    <TableHead className="text-neutral-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-neutral-500">No quotes yet</TableCell></TableRow>
                  ) : quotes.map((q: any) => (
                    <TableRow key={q.id} className="border-[#222] hover:bg-[#0D0D0D]">
                      <TableCell className="font-mono text-xs">{q.exotic_car_request_id?.slice(0, 8)}</TableCell>
                      <TableCell>${(q.hourly_price || 0).toLocaleString()}</TableCell>
                      <TableCell>${(q.delivery_fee || 0).toLocaleString()}</TableCell>
                      <TableCell>${(q.chauffeur_fee || 0).toLocaleString()}</TableCell>
                      <TableCell className="font-bold text-[#C9A84C]">${(q.total_price || 0).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline" className={STATUS_COLORS[q.quote_status] || 'bg-muted'}>{q.quote_status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DELIVERY */}
        <TabsContent value="delivery" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader><CardTitle className="text-[#C9A84C] flex items-center gap-2"><Truck className="h-5 w-5" /> Delivery Coordination</CardTitle></CardHeader>
            <CardContent>
              <DeliveryTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl bg-[#0A0A0A] border-[#222] text-white">
          <DialogHeader><DialogTitle className="text-[#C9A84C]">Request Details</DialogTitle></DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-xs text-neutral-500">Customer</span><p className="font-medium">{selectedRequest.customer_name || 'Unknown'}</p></div>
                <div><span className="text-xs text-neutral-500">Vehicle</span><p>{[selectedRequest.requested_make, selectedRequest.requested_model].filter(Boolean).join(' ') || '—'}</p></div>
                <div><span className="text-xs text-neutral-500">City</span><p>{selectedRequest.city || '—'}</p></div>
                <div><span className="text-xs text-neutral-500">Date</span><p>{selectedRequest.requested_date || '—'}</p></div>
                <div><span className="text-xs text-neutral-500">Duration</span><p>{selectedRequest.duration_hours ? `${selectedRequest.duration_hours}h` : '—'}</p></div>
                <div><span className="text-xs text-neutral-500">Drive Mode</span><p className="capitalize">{selectedRequest.drive_mode?.replace(/_/g, ' ') || '—'}</p></div>
                <div><span className="text-xs text-neutral-500">Occasion</span><p className="capitalize">{selectedRequest.occasion_type || '—'}</p></div>
                <div><span className="text-xs text-neutral-500">Delivery</span><p>{selectedRequest.delivery_location || '—'}</p></div>
              </div>
              {selectedRequest.special_requests && (
                <div><span className="text-xs text-neutral-500">Special Requests</span><p className="text-sm mt-1">{selectedRequest.special_requests}</p></div>
              )}
              <div className="flex gap-2 pt-2">
                {['pending', 'sourcing', 'quoted', 'confirmed', 'delivered', 'cancelled'].map((s) => (
                  <Button key={s} size="sm" variant={selectedRequest.request_status === s ? 'default' : 'outline'}
                    className={selectedRequest.request_status === s ? 'bg-[#C9A84C] text-black' : 'border-[#333]'}
                    onClick={() => { updateStatus.mutate({ id: selectedRequest.id, status: s }); setSelectedRequest({ ...selectedRequest, request_status: s }); }}>
                    {s.replace(/_/g, ' ')}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeliveryTab() {
  const { data: deliveries = [] } = useQuery({
    queryKey: ['exotic-car-deliveries'],
    queryFn: async () => {
      const { data } = await supabase.from('exotic_car_delivery_options').select('*').order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
  });

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-[#222]">
          <TableHead className="text-neutral-400">Type</TableHead>
          <TableHead className="text-neutral-400">Address</TableHead>
          <TableHead className="text-neutral-400">Delivery Fee</TableHead>
          <TableHead className="text-neutral-400">Pickup Fee</TableHead>
          <TableHead className="text-neutral-400">Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deliveries.length === 0 ? (
          <TableRow><TableCell colSpan={5} className="text-center py-8 text-neutral-500">No deliveries scheduled</TableCell></TableRow>
        ) : deliveries.map((d: any) => (
          <TableRow key={d.id} className="border-[#222]">
            <TableCell className="capitalize">{d.delivery_type}</TableCell>
            <TableCell>{d.delivery_address || '—'}</TableCell>
            <TableCell className="text-[#C9A84C]">${(d.delivery_fee || 0).toLocaleString()}</TableCell>
            <TableCell>${(d.pickup_fee || 0).toLocaleString()}</TableCell>
            <TableCell className="text-xs text-neutral-400">{d.notes || '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
