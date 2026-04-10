import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Ship, Anchor, Users, DollarSign, Clock, Send, CheckCircle, AlertTriangle, Eye, Plus, RefreshCw, Search, Filter } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  partner_review: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  options_returned: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  expired: 'bg-muted text-muted-foreground border-muted',
  cancelled: 'bg-muted text-muted-foreground border-muted',
  awaiting_payment: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const URGENCY_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-blue-500/20 text-blue-400',
  high: 'bg-orange-500/20 text-orange-400',
  urgent: 'bg-red-500/20 text-red-400',
};

export default function PenthouseYachtOps() {
  const [activeTab, setActiveTab] = useState('pipeline');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch booking requests
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['yacht-requests', statusFilter],
    queryFn: async () => {
      let q = supabase.from('yacht_booking_requests').select('*').order('created_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('request_status', statusFilter);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch partners
  const { data: partners = [] } = useQuery({
    queryKey: ['yacht-partners'],
    queryFn: async () => {
      const { data } = await supabase.from('yacht_partners').select('*').eq('status', 'active').order('partner_name');
      return data || [];
    },
  });

  // Fetch quotes
  const { data: quotes = [] } = useQuery({
    queryKey: ['yacht-quotes'],
    queryFn: async () => {
      const { data } = await supabase.from('yacht_quotes').select('*').order('created_at', { ascending: false }).limit(100);
      return data || [];
    },
  });

  // Fetch confirmed bookings
  const { data: bookings = [] } = useQuery({
    queryKey: ['yacht-confirmed-bookings'],
    queryFn: async () => {
      const { data } = await supabase.from('yacht_confirmed_bookings').select('*').order('created_at', { ascending: false }).limit(100);
      return data || [];
    },
  });

  // Fetch payments
  const { data: payments = [] } = useQuery({
    queryKey: ['yacht-payments'],
    queryFn: async () => {
      const { data } = await supabase.from('yacht_payment_tracking').select('*').order('created_at', { ascending: false }).limit(100);
      return data || [];
    },
  });

  // Partner performance
  const { data: partnerPerf = [] } = useQuery({
    queryKey: ['yacht-partner-performance'],
    queryFn: async () => {
      const { data } = await supabase.from('yacht_partner_performance').select('*').order('booking_conversion_rate', { ascending: false });
      return data || [];
    },
  });

  // Update request status
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('yacht_booking_requests').update({ request_status: status, latest_status_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yacht-requests'] });
      toast.success('Request status updated');
    },
  });

  const filtered = requests.filter((r: any) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (r.customer_name || '').toLowerCase().includes(s) ||
      (r.city || '').toLowerCase().includes(s) ||
      (r.occasion_type || '').toLowerCase().includes(s) ||
      r.id?.toLowerCase().includes(s);
  });

  // KPIs
  const newToday = requests.filter((r: any) => r.created_at && new Date(r.created_at).toDateString() === new Date().toDateString()).length;
  const awaitingPartner = requests.filter((r: any) => r.request_status === 'partner_review').length;
  const quotesReady = quotes.filter((q: any) => q.quote_status === 'sent').length;
  const confirmedCount = bookings.length;
  const awaitingPayment = payments.filter((p: any) => p.payment_status === 'pending').length;
  const totalRevenue = quotes.filter((q: any) => q.quote_status === 'accepted').reduce((s: number, q: any) => s + (q.total_price || 0), 0);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Ship className="h-7 w-7 text-[#C9A84C]" />
            Yacht & Boat Ops Command Center
          </h1>
          <p className="text-sm text-neutral-400 mt-1">Luxury charter coordination & partner orchestration</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()} className="border-[#C9A84C]/30 text-[#C9A84C]">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'New Today', value: newToday, icon: Plus, color: 'text-blue-400' },
          { label: 'Awaiting Partner', value: awaitingPartner, icon: Clock, color: 'text-yellow-400' },
          { label: 'Quotes Ready', value: quotesReady, icon: Send, color: 'text-purple-400' },
          { label: 'Confirmed', value: confirmedCount, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Awaiting Payment', value: awaitingPayment, icon: AlertTriangle, color: 'text-orange-400' },
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

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#111] border border-[#222]">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="partners">Partners</TabsTrigger>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="bookings">Confirmed</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* PIPELINE TAB */}
        <TabsContent value="pipeline" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <Input placeholder="Search by name, city, occasion..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-[#111] border-[#333]" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-[#111] border-[#333]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="partner_review">Partner Review</SelectItem>
                <SelectItem value="options_returned">Options Ready</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-[#222] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[#222] hover:bg-[#111]">
                  <TableHead className="text-neutral-400">Customer</TableHead>
                  <TableHead className="text-neutral-400">City</TableHead>
                  <TableHead className="text-neutral-400">Date</TableHead>
                  <TableHead className="text-neutral-400">Guests</TableHead>
                  <TableHead className="text-neutral-400">Occasion</TableHead>
                  <TableHead className="text-neutral-400">Budget</TableHead>
                  <TableHead className="text-neutral-400">Status</TableHead>
                  <TableHead className="text-neutral-400">Urgency</TableHead>
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
                    <TableCell>{req.city || '—'}</TableCell>
                    <TableCell>{req.preferred_date ? format(new Date(req.preferred_date), 'MMM d') : '—'}</TableCell>
                    <TableCell>{req.guest_count || '—'}</TableCell>
                    <TableCell className="capitalize">{req.occasion_type || '—'}</TableCell>
                    <TableCell>{req.budget_range || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[req.request_status] || 'bg-muted'}>
                        {req.request_status?.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={URGENCY_COLORS[req.urgency_level] || ''}>
                        {req.urgency_level}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-neutral-500 text-xs">{req.created_at ? formatDistanceToNow(new Date(req.created_at), { addSuffix: true }) : '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-[#C9A84C]" onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: req.id, status: 'partner_review' }); }}>
                          <Send className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* PARTNERS TAB */}
        <TabsContent value="partners" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-[#C9A84C]">Partner Network</CardTitle>
              <CardDescription>Active yacht & boat partners</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#222]">
                    <TableHead className="text-neutral-400">Partner</TableHead>
                    <TableHead className="text-neutral-400">City</TableHead>
                    <TableHead className="text-neutral-400">Marina</TableHead>
                    <TableHead className="text-neutral-400">Type</TableHead>
                    <TableHead className="text-neutral-400">Avg Response</TableHead>
                    <TableHead className="text-neutral-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-neutral-500">No partners yet</TableCell></TableRow>
                  ) : partners.map((p: any) => (
                    <TableRow key={p.id} className="border-[#222] hover:bg-[#0D0D0D]">
                      <TableCell className="font-medium">{p.partner_name}</TableCell>
                      <TableCell>{p.city || '—'}</TableCell>
                      <TableCell>{p.marina_name || '—'}</TableCell>
                      <TableCell className="capitalize">{p.partner_type}</TableCell>
                      <TableCell>{p.average_response_minutes ? `${p.average_response_minutes}m` : '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">{p.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* QUOTES TAB */}
        <TabsContent value="quotes" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-[#C9A84C]">Quote Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#222]">
                    <TableHead className="text-neutral-400">Request</TableHead>
                    <TableHead className="text-neutral-400">Base</TableHead>
                    <TableHead className="text-neutral-400">Markup</TableHead>
                    <TableHead className="text-neutral-400">Add-ons</TableHead>
                    <TableHead className="text-neutral-400">Total</TableHead>
                    <TableHead className="text-neutral-400">Status</TableHead>
                    <TableHead className="text-neutral-400">Recommended</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-neutral-500">No quotes yet</TableCell></TableRow>
                  ) : quotes.map((q: any) => (
                    <TableRow key={q.id} className="border-[#222] hover:bg-[#0D0D0D]">
                      <TableCell className="font-mono text-xs">{q.booking_request_id?.slice(0, 8)}</TableCell>
                      <TableCell>${(q.base_price || 0).toLocaleString()}</TableCell>
                      <TableCell>${(q.markup_amount || 0).toLocaleString()}</TableCell>
                      <TableCell>${(q.add_on_amount || 0).toLocaleString()}</TableCell>
                      <TableCell className="font-bold text-[#C9A84C]">${(q.total_price || 0).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline" className={STATUS_COLORS[q.quote_status] || 'bg-muted'}>{q.quote_status}</Badge></TableCell>
                      <TableCell>{q.is_recommended ? <CheckCircle className="h-4 w-4 text-green-400" /> : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONFIRMED BOOKINGS TAB */}
        <TabsContent value="bookings" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-[#C9A84C]">Confirmed Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#222]">
                    <TableHead className="text-neutral-400">Date</TableHead>
                    <TableHead className="text-neutral-400">Time</TableHead>
                    <TableHead className="text-neutral-400">Duration</TableHead>
                    <TableHead className="text-neutral-400">Guests</TableHead>
                    <TableHead className="text-neutral-400">Booking Status</TableHead>
                    <TableHead className="text-neutral-400">Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-neutral-500">No confirmed bookings yet</TableCell></TableRow>
                  ) : bookings.map((b: any) => (
                    <TableRow key={b.id} className="border-[#222] hover:bg-[#0D0D0D]">
                      <TableCell>{b.confirmed_date ? format(new Date(b.confirmed_date), 'MMM d, yyyy') : '—'}</TableCell>
                      <TableCell>{b.confirmed_time || '—'}</TableCell>
                      <TableCell>{b.confirmed_duration ? `${b.confirmed_duration}h` : '—'}</TableCell>
                      <TableCell>{b.guest_count || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className={STATUS_COLORS[b.booking_status] || 'bg-muted'}>{b.booking_status?.replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={STATUS_COLORS[b.payment_status] || 'bg-muted'}>{b.payment_status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAYMENTS TAB */}
        <TabsContent value="payments" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-[#C9A84C]">Payment Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#222]">
                    <TableHead className="text-neutral-400">Amount</TableHead>
                    <TableHead className="text-neutral-400">Status</TableHead>
                    <TableHead className="text-neutral-400">Due</TableHead>
                    <TableHead className="text-neutral-400">Received</TableHead>
                    <TableHead className="text-neutral-400">Method</TableHead>
                    <TableHead className="text-neutral-400">Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-neutral-500">No payments tracked yet</TableCell></TableRow>
                  ) : payments.map((p: any) => (
                    <TableRow key={p.id} className="border-[#222] hover:bg-[#0D0D0D]">
                      <TableCell className="font-bold text-[#C9A84C]">${(p.payment_amount || 0).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline" className={STATUS_COLORS[p.payment_status] || 'bg-muted'}>{p.payment_status}</Badge></TableCell>
                      <TableCell>{p.payment_due_at ? format(new Date(p.payment_due_at), 'MMM d') : '—'}</TableCell>
                      <TableCell>{p.payment_received_at ? format(new Date(p.payment_received_at), 'MMM d') : '—'}</TableCell>
                      <TableCell>{p.payment_method || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{p.payment_reference || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* INVENTORY TAB */}
        <TabsContent value="inventory">
          <InventoryTab />
        </TabsContent>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-[#111] border-[#222]">
              <CardHeader><CardTitle className="text-[#C9A84C] text-lg">Partner Performance</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#222]">
                      <TableHead className="text-neutral-400">Partner</TableHead>
                      <TableHead className="text-neutral-400">Requests</TableHead>
                      <TableHead className="text-neutral-400">Confirmed</TableHead>
                      <TableHead className="text-neutral-400">Conversion</TableHead>
                      <TableHead className="text-neutral-400">Avg Response</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partnerPerf.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-4 text-neutral-500">No data yet</TableCell></TableRow>
                    ) : partnerPerf.map((p: any) => (
                      <TableRow key={p.id} className="border-[#222]">
                        <TableCell className="font-mono text-xs">{p.partner_id?.slice(0, 8)}</TableCell>
                        <TableCell>{p.total_requests}</TableCell>
                        <TableCell>{p.confirmed_requests}</TableCell>
                        <TableCell className="text-[#C9A84C]">{((p.booking_conversion_rate || 0) * 100).toFixed(0)}%</TableCell>
                        <TableCell>{p.avg_response_minutes ? `${p.avg_response_minutes}m` : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card className="bg-[#111] border-[#222]">
              <CardHeader><CardTitle className="text-[#C9A84C] text-lg">Market Demand</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['Miami', 'Dubai', 'Ibiza', 'Monaco', 'Cancun'].map((city) => {
                    const count = requests.filter((r: any) => (r.city || '').toLowerCase() === city.toLowerCase()).length;
                    return (
                      <div key={city} className="flex items-center justify-between">
                        <span className="text-sm">{city}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-[#222] rounded-full overflow-hidden">
                            <div className="h-full bg-[#C9A84C] rounded-full" style={{ width: `${Math.min(100, (count / Math.max(1, requests.length)) * 100 * 5)}%` }} />
                          </div>
                          <span className="text-xs text-neutral-400">{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Request Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl bg-[#0A0A0A] border-[#222] text-white">
          <DialogHeader>
            <DialogTitle className="text-[#C9A84C]">Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-xs text-neutral-500">Customer</span><p className="font-medium">{selectedRequest.customer_name || 'Unknown'}</p></div>
                <div><span className="text-xs text-neutral-500">City</span><p>{selectedRequest.city || '—'}</p></div>
                <div><span className="text-xs text-neutral-500">Date</span><p>{selectedRequest.preferred_date || '—'}</p></div>
                <div><span className="text-xs text-neutral-500">Time</span><p>{selectedRequest.preferred_time || '—'}</p></div>
                <div><span className="text-xs text-neutral-500">Guests</span><p>{selectedRequest.guest_count || '—'}</p></div>
                <div><span className="text-xs text-neutral-500">Duration</span><p>{selectedRequest.duration_hours ? `${selectedRequest.duration_hours}h` : '—'}</p></div>
                <div><span className="text-xs text-neutral-500">Occasion</span><p className="capitalize">{selectedRequest.occasion_type || '—'}</p></div>
                <div><span className="text-xs text-neutral-500">Flexibility</span><p className="capitalize">{selectedRequest.flexibility_mode || '—'}</p></div>
                <div><span className="text-xs text-neutral-500">Vessel Preference</span><p>{selectedRequest.vessel_preference || '—'}</p></div>
                <div><span className="text-xs text-neutral-500">Budget</span><p>{selectedRequest.budget_range || '—'}</p></div>
              </div>
              {selectedRequest.special_requests && (
                <div><span className="text-xs text-neutral-500">Special Requests</span><p className="text-sm mt-1">{selectedRequest.special_requests}</p></div>
              )}
              <div className="flex gap-2 pt-2">
                {['pending', 'partner_review', 'options_returned', 'confirmed', 'cancelled'].map((s) => (
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

function InventoryTab() {
  const { data: inventory = [] } = useQuery({
    queryKey: ['yacht-inventory'],
    queryFn: async () => {
      const { data } = await supabase.from('yacht_inventory').select('*').eq('is_active', true).order('vessel_name');
      return data || [];
    },
  });

  return (
    <Card className="bg-[#111] border-[#222]">
      <CardHeader>
        <CardTitle className="text-[#C9A84C]">Vessel Inventory</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-[#222]">
              <TableHead className="text-neutral-400">Vessel</TableHead>
              <TableHead className="text-neutral-400">Type</TableHead>
              <TableHead className="text-neutral-400">City</TableHead>
              <TableHead className="text-neutral-400">Capacity</TableHead>
              <TableHead className="text-neutral-400">Starting Price</TableHead>
              <TableHead className="text-neutral-400">Featured</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventory.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-neutral-500">No vessels in inventory</TableCell></TableRow>
            ) : inventory.map((v: any) => (
              <TableRow key={v.id} className="border-[#222] hover:bg-[#0D0D0D]">
                <TableCell className="font-medium">{v.vessel_name}</TableCell>
                <TableCell className="capitalize">{v.vessel_type}</TableCell>
                <TableCell>{v.market_city || '—'}</TableCell>
                <TableCell>{v.guest_capacity || '—'} guests</TableCell>
                <TableCell className="text-[#C9A84C]">${(v.starting_price || 0).toLocaleString()}</TableCell>
                <TableCell>{v.is_featured ? <CheckCircle className="h-4 w-4 text-[#C9A84C]" /> : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
