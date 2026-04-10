import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Car, Search, RefreshCw, Plus, Clock, Send, CheckCircle, DollarSign, AlertTriangle,
  MapPin, Truck, Star, Eye, ArrowRight, User, Phone, Mail, Calendar, Zap,
  FileText, MessageSquare, ListTodo, Activity, BarChart3, Shield, Crown,
  ChevronRight, ExternalLink, Sparkles, Target, TrendingUp, Package
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const STATUS_PIPELINE = [
  'new', 'in_review', 'sent_to_partners', 'waiting_on_partner', 'options_ready',
  'awaiting_client_choice', 'awaiting_payment', 'confirmed', 'delivery_scheduled',
  'chauffeur_assigned', 'completed', 'cancelled'
] as const;

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_review: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  sent_to_partners: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  waiting_on_partner: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  options_ready: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  awaiting_client_choice: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  awaiting_payment: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
  delivery_scheduled: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  chauffeur_assigned: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  completed: 'bg-green-600/20 text-green-300 border-green-600/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  sourcing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  quoted: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  delivered: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  expired: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30',
};

const URGENCY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500',
  normal: 'bg-blue-500/20 text-blue-400 border-blue-500',
  low: 'bg-neutral-500/20 text-neutral-400 border-neutral-500',
};

const UPSELL_OPTIONS = [
  { code: 'chauffeur', label: 'Chauffeur Service', icon: '🎩' },
  { code: 'airport_pickup', label: 'Airport Pickup', icon: '✈️' },
  { code: 'nightlife', label: 'Nightlife Continuation', icon: '🌃' },
  { code: 'yacht_charter', label: 'Yacht Charter', icon: '🛥️' },
  { code: 'helicopter', label: 'Helicopter Ride', icon: '🚁' },
  { code: 'photographer', label: 'Photographer', icon: '📸' },
  { code: 'videographer', label: 'Videographer', icon: '🎬' },
  { code: 'proposal_setup', label: 'Proposal Setup', icon: '💍' },
  { code: 'wedding_coordination', label: 'Wedding Coordination', icon: '💒' },
  { code: 'dinner_reservation', label: 'Dinner Reservation', icon: '🍽️' },
  { code: 'vip_event', label: 'VIP Event Access', icon: '🎫' },
  { code: 'decor', label: 'Car Decor Package', icon: '🎀' },
];

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function PenthouseExoticCarOps() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pipeline');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [driveFilter, setDriveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const queryClient = useQueryClient();

  // ─── DATA QUERIES ───────────────────────────────────────────
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['ec-ops-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exotic_car_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['ec-ops-partners'],
    queryFn: async () => {
      const { data } = await supabase.from('exotic_car_partners').select('*').order('partner_name');
      return data || [];
    },
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['ec-ops-inventory'],
    queryFn: async () => {
      const { data } = await supabase.from('exotic_car_inventory').select('*').order('make');
      return data || [];
    },
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ['ec-ops-quotes'],
    queryFn: async () => {
      const { data } = await supabase.from('exotic_car_quotes').select('*').order('created_at', { ascending: false }).limit(200);
      return data || [];
    },
  });

  const { data: partnerOffers = [] } = useQuery({
    queryKey: ['ec-ops-partner-offers'],
    queryFn: async () => {
      const { data } = await supabase.from('exotic_car_partner_offers').select('*').order('created_at', { ascending: false }).limit(200);
      return data || [];
    },
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ['ec-ops-deliveries'],
    queryFn: async () => {
      const { data } = await supabase.from('exotic_car_delivery_tracking').select('*').order('created_at', { ascending: false }).limit(100);
      return data || [];
    },
  });

  const { data: chauffeurs = [] } = useQuery({
    queryKey: ['ec-ops-chauffeurs'],
    queryFn: async () => {
      const { data } = await supabase.from('exotic_car_chauffeur_assignments').select('*').order('created_at', { ascending: false }).limit(100);
      return data || [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['ec-ops-payments'],
    queryFn: async () => {
      const { data } = await supabase.from('exotic_car_payment_tracking').select('*').order('created_at', { ascending: false }).limit(100);
      return data || [];
    },
  });

  // ─── MUTATIONS ──────────────────────────────────────────────
  const updateRequestStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('exotic_car_requests').update({ request_status: status, latest_status_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      // Log activity
      await supabase.from('exotic_car_request_activity_log').insert({
        exotic_car_request_id: id,
        actor_user_id: user?.id,
        activity_type: 'status_change',
        activity_label: `Status changed to ${status}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ec-ops-requests'] });
      toast.success('Status updated');
    },
  });

  const assignToMe = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exotic_car_requests').update({ assigned_staff_user_id: user?.id }).eq('id', id);
      if (error) throw error;
      await supabase.from('exotic_car_request_activity_log').insert({
        exotic_car_request_id: id,
        actor_user_id: user?.id,
        activity_type: 'assignment',
        activity_label: 'Self-assigned',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ec-ops-requests'] });
      toast.success('Assigned to you');
    },
  });

  // ─── COMPUTED ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    return requests.filter((r: any) => {
      if (statusFilter !== 'all' && r.request_status !== statusFilter) return false;
      if (cityFilter !== 'all' && (r.city || r.selected_city) !== cityFilter) return false;
      if (driveFilter !== 'all' && r.drive_mode !== driveFilter && r.booking_type !== driveFilter) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return (r.customer_name || '').toLowerCase().includes(s) ||
          (r.city || '').toLowerCase().includes(s) ||
          (r.requested_make || '').toLowerCase().includes(s) ||
          (r.requested_model || '').toLowerCase().includes(s) ||
          (r.id || '').toLowerCase().includes(s);
      }
      return true;
    });
  }, [requests, statusFilter, cityFilter, driveFilter, searchTerm]);

  const cities = useMemo(() => [...new Set(requests.map((r: any) => r.city || r.selected_city).filter(Boolean))], [requests]);

  const today = new Date().toDateString();
  const newToday = requests.filter((r: any) => r.created_at && new Date(r.created_at).toDateString() === today).length;
  const awaitingPartner = requests.filter((r: any) => ['sent_to_partners', 'waiting_on_partner'].includes(r.request_status)).length;
  const quotesReady = requests.filter((r: any) => r.request_status === 'options_ready').length;
  const awaitingClient = requests.filter((r: any) => r.request_status === 'awaiting_client_choice').length;
  const awaitingPayment = requests.filter((r: any) => r.request_status === 'awaiting_payment').length;
  const confirmedCount = requests.filter((r: any) => r.request_status === 'confirmed').length;
  const deliveriesScheduled = requests.filter((r: any) => r.request_status === 'delivery_scheduled').length;
  const chauffeurScheduled = requests.filter((r: any) => r.request_status === 'chauffeur_assigned').length;
  const sameDayCount = requests.filter((r: any) => r.is_same_day).length;
  const totalAccepted = quotes.filter((q: any) => q.quote_status === 'accepted');
  const totalRevenue = totalAccepted.reduce((s: number, q: any) => s + (q.total_price || q.total_amount || 0), 0);
  const conversionRate = requests.length > 0 ? ((totalAccepted.length / requests.length) * 100).toFixed(1) : '0';

  // Most requested city & brand
  const cityDemand = useMemo(() => {
    const map: Record<string, number> = {};
    requests.forEach((r: any) => { const c = r.city || r.selected_city; if (c) map[c] = (map[c] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [requests]);

  const brandDemand = useMemo(() => {
    const map: Record<string, number> = {};
    requests.forEach((r: any) => { if (r.requested_make) map[r.requested_make] = (map[r.requested_make] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [requests]);

  const openDetail = (req: any) => { setSelectedRequest(req); setDetailOpen(true); };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-4 lg:p-6 space-y-5">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Car className="h-7 w-7 text-[#C9A84C]" />
            Exotic Car Ops Command Center
            <span className="ml-2 inline-flex items-center gap-1 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> LIVE
            </span>
          </h1>
          <p className="text-sm text-neutral-400 mt-1">Nationwide exotic vehicle sourcing • delivery • chauffeur coordination</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">{format(new Date(), 'EEEE, MMM d yyyy • h:mm a')}</span>
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()} className="border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* KPI HEADER */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10 gap-2">
        {[
          { label: 'New Today', value: newToday, icon: Plus, color: 'text-blue-400' },
          { label: 'Awaiting Partner', value: awaitingPartner, icon: Clock, color: 'text-yellow-400' },
          { label: 'Quotes Ready', value: quotesReady, icon: FileText, color: 'text-purple-400' },
          { label: 'Client Choice', value: awaitingClient, icon: Eye, color: 'text-orange-400' },
          { label: 'Awaiting Pay', value: awaitingPayment, icon: DollarSign, color: 'text-amber-400' },
          { label: 'Confirmed', value: confirmedCount, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Deliveries', value: deliveriesScheduled, icon: Truck, color: 'text-teal-400' },
          { label: 'Chauffeur', value: chauffeurScheduled, icon: User, color: 'text-emerald-400' },
          { label: 'Conversion', value: `${conversionRate}%`, icon: Target, color: 'text-[#C9A84C]' },
          { label: 'Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: 'text-[#C9A84C]' },
        ].map((kpi) => (
          <Card key={kpi.label} className="bg-[#111] border-[#1A1A1A]">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-0.5">
                <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{kpi.label}</span>
              </div>
              <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Advanced KPIs row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-[#111] border border-[#1A1A1A] rounded-lg p-3">
          <span className="text-[10px] text-neutral-500 uppercase">Top City</span>
          <p className="text-sm font-semibold text-[#C9A84C]">{cityDemand[0]?.[0] || '—'} <span className="text-neutral-500">({cityDemand[0]?.[1] || 0})</span></p>
        </div>
        <div className="bg-[#111] border border-[#1A1A1A] rounded-lg p-3">
          <span className="text-[10px] text-neutral-500 uppercase">Top Brand</span>
          <p className="text-sm font-semibold text-[#C9A84C]">{brandDemand[0]?.[0] || '—'} <span className="text-neutral-500">({brandDemand[0]?.[1] || 0})</span></p>
        </div>
        <div className="bg-[#111] border border-[#1A1A1A] rounded-lg p-3">
          <span className="text-[10px] text-neutral-500 uppercase">Same-Day Requests</span>
          <p className="text-sm font-semibold text-orange-400">{sameDayCount}</p>
        </div>
        <div className="bg-[#111] border border-[#1A1A1A] rounded-lg p-3">
          <span className="text-[10px] text-neutral-500 uppercase">Active Partners</span>
          <p className="text-sm font-semibold text-green-400">{partners.filter((p: any) => p.status === 'active').length}</p>
        </div>
      </div>

      {/* MAIN TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#111] border border-[#222] flex-wrap h-auto gap-0.5 p-1">
          {[
            { v: 'pipeline', l: '📋 Pipeline' },
            { v: 'partners', l: '🤝 Partners' },
            { v: 'offers', l: '🚗 Offers' },
            { v: 'quotes', l: '💰 Quotes' },
            { v: 'delivery', l: '🚚 Delivery' },
            { v: 'chauffeur', l: '🎩 Chauffeur' },
            { v: 'payments', l: '💳 Payments' },
            { v: 'upsells', l: '✨ Upsells' },
            { v: 'special', l: '👑 Special' },
            { v: 'inventory', l: '📦 Inventory' },
            { v: 'analytics', l: '📊 Analytics' },
          ].map(t => <TabsTrigger key={t.v} value={t.v} className="text-xs">{t.l}</TabsTrigger>)}
        </TabsList>

        {/* ═══ PIPELINE TAB ═══ */}
        <TabsContent value="pipeline" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <Input placeholder="Search name, city, make, model, ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-[#111] border-[#333] text-white" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 bg-[#111] border-[#333]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS_PIPELINE.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="w-36 bg-[#111] border-[#333]"><SelectValue placeholder="City" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cities.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={driveFilter} onValueChange={setDriveFilter}>
              <SelectTrigger className="w-36 bg-[#111] border-[#333]"><SelectValue placeholder="Drive" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="self_drive">Self-Drive</SelectItem>
                <SelectItem value="chauffeur">Chauffeur</SelectItem>
                <SelectItem value="event">Event</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex border border-[#333] rounded-md overflow-hidden">
              <Button variant="ghost" size="sm" className={viewMode === 'table' ? 'bg-[#222] text-white' : 'text-neutral-500'} onClick={() => setViewMode('table')}>Table</Button>
              <Button variant="ghost" size="sm" className={viewMode === 'kanban' ? 'bg-[#222] text-white' : 'text-neutral-500'} onClick={() => setViewMode('kanban')}>Kanban</Button>
            </div>
          </div>

          {viewMode === 'kanban' ? (
            <KanbanBoard requests={filtered} onSelect={openDetail} onUpdateStatus={(id, s) => updateRequestStatus.mutate({ id, status: s })} />
          ) : (
            <RequestTable requests={filtered} isLoading={isLoading} onSelect={openDetail} onUpdateStatus={(id, s) => updateRequestStatus.mutate({ id, status: s })} onAssign={(id) => assignToMe.mutate(id)} />
          )}
        </TabsContent>

        {/* ═══ PARTNERS TAB ═══ */}
        <TabsContent value="partners"><PartnerPanel partners={partners} /></TabsContent>

        {/* ═══ OFFERS TAB ═══ */}
        <TabsContent value="offers"><PartnerOffersPanel offers={partnerOffers} partners={partners} /></TabsContent>

        {/* ═══ QUOTES TAB ═══ */}
        <TabsContent value="quotes"><QuotePanel quotes={quotes} /></TabsContent>

        {/* ═══ DELIVERY TAB ═══ */}
        <TabsContent value="delivery"><DeliveryPanel deliveries={deliveries} /></TabsContent>

        {/* ═══ CHAUFFEUR TAB ═══ */}
        <TabsContent value="chauffeur"><ChauffeurPanel chauffeurs={chauffeurs} /></TabsContent>

        {/* ═══ PAYMENTS TAB ═══ */}
        <TabsContent value="payments"><PaymentPanel payments={payments} /></TabsContent>

        {/* ═══ UPSELLS TAB ═══ */}
        <TabsContent value="upsells"><UpsellPanel /></TabsContent>

        {/* ═══ SPECIAL REQUESTS TAB ═══ */}
        <TabsContent value="special"><SpecialRequestsPanel requests={requests.filter((r: any) => r.urgency_level === 'critical' || r.urgency_level === 'high' || r.occasion_type)} /></TabsContent>

        {/* ═══ INVENTORY TAB ═══ */}
        <TabsContent value="inventory"><InventoryPanel inventory={inventory} /></TabsContent>

        {/* ═══ ANALYTICS TAB ═══ */}
        <TabsContent value="analytics"><AnalyticsPanel requests={requests} quotes={quotes} partners={partners} cityDemand={cityDemand} brandDemand={brandDemand} /></TabsContent>
      </Tabs>

      {/* ═══ REQUEST DETAIL DRAWER ═══ */}
      <RequestDetailDrawer
        request={selectedRequest}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        partners={partners}
        quotes={quotes.filter((q: any) => q.exotic_car_request_id === selectedRequest?.id)}
        offers={partnerOffers.filter((o: any) => o.exotic_car_request_id === selectedRequest?.id)}
        onUpdateStatus={(status) => {
          if (selectedRequest) {
            updateRequestStatus.mutate({ id: selectedRequest.id, status });
            setSelectedRequest({ ...selectedRequest, request_status: status });
          }
        }}
        onAssign={() => { if (selectedRequest) assignToMe.mutate(selectedRequest.id); }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REQUEST TABLE
// ═══════════════════════════════════════════════════════════════

function RequestTable({ requests, isLoading, onSelect, onUpdateStatus, onAssign }: any) {
  return (
    <div className="rounded-lg border border-[#222] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-[#222] bg-[#0D0D0D]">
            <TableHead className="text-neutral-400 text-xs">Priority</TableHead>
            <TableHead className="text-neutral-400 text-xs">Customer</TableHead>
            <TableHead className="text-neutral-400 text-xs">Vehicle</TableHead>
            <TableHead className="text-neutral-400 text-xs">City</TableHead>
            <TableHead className="text-neutral-400 text-xs">Date</TableHead>
            <TableHead className="text-neutral-400 text-xs">Mode</TableHead>
            <TableHead className="text-neutral-400 text-xs">Occasion</TableHead>
            <TableHead className="text-neutral-400 text-xs">Value</TableHead>
            <TableHead className="text-neutral-400 text-xs">Status</TableHead>
            <TableHead className="text-neutral-400 text-xs">Created</TableHead>
            <TableHead className="text-neutral-400 text-xs">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={11} className="text-center py-8 text-neutral-500">Loading requests...</TableCell></TableRow>
          ) : requests.length === 0 ? (
            <TableRow><TableCell colSpan={11} className="text-center py-8 text-neutral-500">No requests found</TableCell></TableRow>
          ) : requests.map((req: any) => (
            <TableRow key={req.id} className="border-[#222] hover:bg-[#111] cursor-pointer" onClick={() => onSelect(req)}>
              <TableCell>
                <div className="flex items-center gap-1">
                  {req.urgency_level === 'critical' && <Zap className="h-4 w-4 text-red-400" />}
                  {req.urgency_level === 'high' && <AlertTriangle className="h-4 w-4 text-orange-400" />}
                  {req.is_same_day && <Badge variant="outline" className="text-[9px] px-1 py-0 border-orange-500/50 text-orange-400">SAME-DAY</Badge>}
                  {(req.estimated_value || 0) >= 5000 && <Crown className="h-3.5 w-3.5 text-[#C9A84C]" />}
                </div>
              </TableCell>
              <TableCell className="font-medium text-sm">{req.customer_name || 'Unknown'}</TableCell>
              <TableCell className="text-sm">{[req.requested_make, req.requested_model].filter(Boolean).join(' ') || '—'}</TableCell>
              <TableCell className="text-sm">{req.city || req.selected_city || '—'}</TableCell>
              <TableCell className="text-sm">{req.requested_date ? format(new Date(req.requested_date), 'MMM d') : '—'}</TableCell>
              <TableCell><Badge variant="outline" className="text-[10px] capitalize border-[#333]">{(req.booking_type || req.drive_mode || '—').replace(/_/g, ' ')}</Badge></TableCell>
              <TableCell className="text-xs capitalize">{req.occasion_type || '—'}</TableCell>
              <TableCell className="text-[#C9A84C] font-medium">{req.estimated_value ? `$${Number(req.estimated_value).toLocaleString()}` : '—'}</TableCell>
              <TableCell><Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[req.request_status] || ''}`}>{(req.request_status || 'new').replace(/_/g, ' ')}</Badge></TableCell>
              <TableCell className="text-neutral-500 text-xs">{req.created_at ? formatDistanceToNow(new Date(req.created_at), { addSuffix: true }) : '—'}</TableCell>
              <TableCell>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[#C9A84C]" title="Assign to me" onClick={() => onAssign(req.id)}><User className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-400" title="Send to partners" onClick={() => onUpdateStatus(req.id, 'sent_to_partners')}><Send className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400" title="Mark urgent" onClick={() => {
                    supabase.from('exotic_car_requests').update({ urgency_level: 'critical' }).eq('id', req.id).then(() => toast.success('Marked urgent'));
                  }}><Zap className="h-3.5 w-3.5" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// KANBAN BOARD
// ═══════════════════════════════════════════════════════════════

function KanbanBoard({ requests, onSelect, onUpdateStatus }: any) {
  const columns = ['new', 'in_review', 'sent_to_partners', 'waiting_on_partner', 'options_ready', 'awaiting_client_choice', 'awaiting_payment', 'confirmed', 'completed'];
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {columns.map(col => {
        const items = requests.filter((r: any) => (r.request_status || 'new') === col);
        return (
          <div key={col} className="min-w-[240px] flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-400 uppercase">{col.replace(/_/g, ' ')}</span>
              <Badge variant="outline" className="text-[10px] border-[#333]">{items.length}</Badge>
            </div>
            <div className="space-y-2">
              {items.map((req: any) => (
                <Card key={req.id} className="bg-[#111] border-[#222] hover:border-[#C9A84C]/30 cursor-pointer transition-colors" onClick={() => onSelect(req)}>
                  <CardContent className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium truncate">{req.customer_name || 'Unknown'}</span>
                      {req.urgency_level === 'critical' && <Zap className="h-3 w-3 text-red-400" />}
                    </div>
                    <p className="text-[11px] text-[#C9A84C]">{[req.requested_make, req.requested_model].filter(Boolean).join(' ') || '—'}</p>
                    <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                      <span>{req.city || '—'}</span>
                      <span>•</span>
                      <span className="capitalize">{(req.booking_type || req.drive_mode || '').replace(/_/g, ' ')}</span>
                    </div>
                    {req.estimated_value && <p className="text-[11px] text-[#C9A84C] font-semibold">${Number(req.estimated_value).toLocaleString()}</p>}
                  </CardContent>
                </Card>
              ))}
              {items.length === 0 && <p className="text-center text-xs text-neutral-600 py-4">—</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REQUEST DETAIL DRAWER
// ═══════════════════════════════════════════════════════════════

function RequestDetailDrawer({ request, open, onOpenChange, partners, quotes, offers, onUpdateStatus, onAssign }: any) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [detailTab, setDetailTab] = useState('details');

  const { data: notes = [] } = useQuery({
    queryKey: ['ec-notes', request?.id],
    queryFn: async () => {
      if (!request?.id) return [];
      const { data } = await supabase.from('exotic_car_request_internal_notes').select('*').eq('exotic_car_request_id', request.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!request?.id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['ec-tasks', request?.id],
    queryFn: async () => {
      if (!request?.id) return [];
      const { data } = await supabase.from('exotic_car_request_tasks').select('*').eq('exotic_car_request_id', request.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!request?.id,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ['ec-timeline', request?.id],
    queryFn: async () => {
      if (!request?.id) return [];
      const { data } = await supabase.from('exotic_car_request_activity_log').select('*').eq('exotic_car_request_id', request.id).order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!request?.id,
  });

  const addNote = useMutation({
    mutationFn: async () => {
      if (!noteText.trim() || !request?.id) return;
      const { error } = await supabase.from('exotic_car_request_internal_notes').insert({
        exotic_car_request_id: request.id,
        author_user_id: user?.id,
        note_text: noteText.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNoteText('');
      queryClient.invalidateQueries({ queryKey: ['ec-notes', request?.id] });
      toast.success('Note added');
    },
  });

  const addTask = useMutation({
    mutationFn: async () => {
      if (!taskTitle.trim() || !request?.id) return;
      const { error } = await supabase.from('exotic_car_request_tasks').insert({
        exotic_car_request_id: request.id,
        assigned_user_id: user?.id,
        task_title: taskTitle.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTaskTitle('');
      queryClient.invalidateQueries({ queryKey: ['ec-tasks', request?.id] });
      toast.success('Task created');
    },
  });

  const completeTask = useMutation({
    mutationFn: async (taskId: string) => {
      await supabase.from('exotic_car_request_tasks').update({ task_status: 'completed' }).eq('id', taskId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ec-tasks', request?.id] }),
  });

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-[#0A0A0A] border-[#222] text-white p-0 overflow-hidden">
        <div className="flex flex-col h-full max-h-[90vh]">
          {/* Header */}
          <div className="p-4 border-b border-[#222] bg-[#0D0D0D]">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-[#C9A84C] text-lg flex items-center gap-2">
                  {request.customer_name || 'Unknown Customer'}
                  {request.urgency_level === 'critical' && <Badge className="bg-red-500/20 text-red-400 border-red-500/30">URGENT</Badge>}
                  {(request.estimated_value || 0) >= 5000 && <Crown className="h-4 w-4 text-[#C9A84C]" />}
                </DialogTitle>
                <p className="text-xs text-neutral-500 mt-1">ID: {request.id?.slice(0, 12)} • {request.created_at ? formatDistanceToNow(new Date(request.created_at), { addSuffix: true }) : ''}</p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="border-[#C9A84C]/30 text-[#C9A84C] h-8" onClick={onAssign}>
                  <User className="h-3.5 w-3.5 mr-1" /> Assign
                </Button>
                <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400 h-8" onClick={() => onUpdateStatus('sent_to_partners')}>
                  <Send className="h-3.5 w-3.5 mr-1" /> Send to Partners
                </Button>
              </div>
            </div>
            {/* Status buttons */}
            <div className="flex flex-wrap gap-1 mt-3">
              {STATUS_PIPELINE.map(s => (
                <Button key={s} size="sm" variant={request.request_status === s ? 'default' : 'outline'}
                  className={`h-6 text-[10px] ${request.request_status === s ? 'bg-[#C9A84C] text-black hover:bg-[#B89A3C]' : 'border-[#333] text-neutral-400 hover:text-white'}`}
                  onClick={() => onUpdateStatus(s)}>
                  {s.replace(/_/g, ' ')}
                </Button>
              ))}
            </div>
          </div>

          {/* Sub-tabs */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList className="bg-[#111] border border-[#222] h-8 mb-4">
                  <TabsTrigger value="details" className="text-xs h-6">Details</TabsTrigger>
                  <TabsTrigger value="partners" className="text-xs h-6">Partners</TabsTrigger>
                  <TabsTrigger value="quotes" className="text-xs h-6">Quotes ({quotes.length})</TabsTrigger>
                  <TabsTrigger value="notes" className="text-xs h-6">Notes ({notes.length})</TabsTrigger>
                  <TabsTrigger value="tasks" className="text-xs h-6">Tasks ({tasks.length})</TabsTrigger>
                  <TabsTrigger value="timeline" className="text-xs h-6">Timeline</TabsTrigger>
                </TabsList>

                {/* Details */}
                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { l: 'Vehicle', v: [request.requested_make, request.requested_model].filter(Boolean).join(' ') },
                      { l: 'City', v: request.city || request.selected_city },
                      { l: 'Date', v: request.requested_date },
                      { l: 'Time', v: request.requested_time },
                      { l: 'Duration', v: request.duration_hours ? `${request.duration_hours}h` : request.rental_days ? `${request.rental_days} days` : null },
                      { l: 'Booking Type', v: request.booking_type?.replace(/_/g, ' ') },
                      { l: 'Drive Mode', v: request.drive_mode?.replace(/_/g, ' ') },
                      { l: 'Occasion', v: request.occasion_type },
                      { l: 'Fulfillment', v: request.fulfillment_mode?.replace(/_/g, ' ') },
                      { l: 'Delivery Type', v: request.delivery_type },
                      { l: 'Delivery Address', v: request.delivery_address || request.delivery_location },
                      { l: 'Estimated Value', v: request.estimated_value ? `$${Number(request.estimated_value).toLocaleString()}` : null },
                    ].map(({ l, v }) => (
                      <div key={l}>
                        <span className="text-[10px] text-neutral-500 uppercase">{l}</span>
                        <p className="text-sm capitalize">{v || '—'}</p>
                      </div>
                    ))}
                  </div>

                  {/* Customer Contact */}
                  <Separator className="bg-[#222]" />
                  <div>
                    <h4 className="text-xs font-semibold text-[#C9A84C] uppercase mb-2">Customer Contact</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-neutral-500" /><span className="text-sm">{request.customer_phone || '—'}</span></div>
                      <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-neutral-500" /><span className="text-sm">{request.customer_email || '—'}</span></div>
                      <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-neutral-500" /><span className="text-sm">{request.city || request.selected_city || '—'}</span></div>
                    </div>
                  </div>

                  {/* Personalization */}
                  {(request.flower_package || request.car_decor_package || request.hotel_name || request.favorite_song) && (
                    <>
                      <Separator className="bg-[#222]" />
                      <div>
                        <h4 className="text-xs font-semibold text-[#C9A84C] uppercase mb-2">Personalization</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {request.flower_package && <div><span className="text-neutral-500">Flowers:</span> {request.flower_package}</div>}
                          {request.car_decor_package && <div><span className="text-neutral-500">Car Decor:</span> {request.car_decor_package}</div>}
                          {request.hotel_name && <div><span className="text-neutral-500">Hotel:</span> {request.hotel_name}</div>}
                          {request.favorite_song && <div><span className="text-neutral-500">Song:</span> {request.favorite_song}</div>}
                          {request.favorite_color && <div><span className="text-neutral-500">Color:</span> {request.favorite_color}</div>}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Insurance & Driver */}
                  {(request.has_customer_insurance || request.deposit_required || request.driver_full_name) && (
                    <>
                      <Separator className="bg-[#222]" />
                      <div>
                        <h4 className="text-xs font-semibold text-[#C9A84C] uppercase mb-2">Insurance & Verification</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {request.insurance_option_selected && <div><span className="text-neutral-500">Insurance:</span> {request.insurance_option_selected}</div>}
                          {request.deposit_amount > 0 && <div><span className="text-neutral-500">Deposit:</span> ${request.deposit_amount?.toLocaleString()}</div>}
                          {request.driver_full_name && <div><span className="text-neutral-500">Driver:</span> {request.driver_full_name}</div>}
                        </div>
                      </div>
                    </>
                  )}

                  {request.special_requests && (
                    <>
                      <Separator className="bg-[#222]" />
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase">Special Requests</span>
                        <p className="text-sm mt-1 bg-[#111] p-3 rounded border border-[#222]">{request.special_requests}</p>
                      </div>
                    </>
                  )}

                  {/* Acceptable Alternatives */}
                  {request.acceptable_alternatives?.length > 0 && (
                    <>
                      <Separator className="bg-[#222]" />
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase">Acceptable Alternatives</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {request.acceptable_alternatives.map((alt: string, i: number) => (
                            <Badge key={i} variant="outline" className="border-[#333] text-neutral-300 text-xs">{alt}</Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* Partner Matching */}
                <TabsContent value="partners" className="space-y-3">
                  <h4 className="text-xs font-semibold text-[#C9A84C] uppercase">Recommended Partners</h4>
                  {partners.length === 0 ? (
                    <p className="text-sm text-neutral-500">No partners available</p>
                  ) : partners
                    .filter((p: any) => p.status === 'active')
                    .sort((a: any, b: any) => {
                      const cityA = (a.city || '').toLowerCase() === (request.city || request.selected_city || '').toLowerCase() ? 1 : 0;
                      const cityB = (b.city || '').toLowerCase() === (request.city || request.selected_city || '').toLowerCase() ? 1 : 0;
                      return cityB - cityA;
                    })
                    .slice(0, 10)
                    .map((p: any) => {
                      const isCity = (p.city || '').toLowerCase() === (request.city || request.selected_city || '').toLowerCase();
                      return (
                        <Card key={p.id} className={`bg-[#111] ${isCity ? 'border-[#C9A84C]/30' : 'border-[#222]'}`}>
                          <CardContent className="p-3 flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{p.partner_name}</span>
                                {isCity && <Badge className="bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/30 text-[9px]">CITY MATCH</Badge>}
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-neutral-500 mt-1">
                                <span>{p.city}, {p.state}</span>
                                {p.supports_self_drive && <span className="text-green-400">Self-Drive ✓</span>}
                                {p.supports_chauffeur && <span className="text-blue-400">Chauffeur ✓</span>}
                                {p.supports_same_day && <span className="text-orange-400">Same-Day ✓</span>}
                                {p.avg_response_minutes && <span>~{p.avg_response_minutes}m response</span>}
                              </div>
                            </div>
                            <Button size="sm" className="bg-[#C9A84C] text-black hover:bg-[#B89A3C] h-7 text-xs">
                              <Send className="h-3 w-3 mr-1" /> Send Request
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                </TabsContent>

                {/* Quotes for this request */}
                <TabsContent value="quotes" className="space-y-3">
                  {quotes.length === 0 ? (
                    <p className="text-sm text-neutral-500">No quotes for this request</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {quotes.map((q: any) => (
                        <Card key={q.id} className={`bg-[#111] ${q.is_recommended ? 'border-[#C9A84C]/50' : 'border-[#222]'}`}>
                          <CardContent className="p-3 space-y-2">
                            {q.is_recommended && <Badge className="bg-[#C9A84C]/20 text-[#C9A84C] text-[9px]">⭐ RECOMMENDED</Badge>}
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              <div><span className="text-neutral-500">Base:</span> ${(q.base_rental_amount || q.hourly_price || 0).toLocaleString()}</div>
                              <div><span className="text-neutral-500">Delivery:</span> ${(q.delivery_fee || 0).toLocaleString()}</div>
                              <div><span className="text-neutral-500">Chauffeur:</span> ${(q.chauffeur_fee || q.chauffeur_amount || 0).toLocaleString()}</div>
                              <div><span className="text-neutral-500">Service:</span> ${(q.service_fee || 0).toLocaleString()}</div>
                            </div>
                            <Separator className="bg-[#222]" />
                            <div className="flex justify-between items-center">
                              <span className="text-lg font-bold text-[#C9A84C]">${(q.total_price || q.total_amount || 0).toLocaleString()}</span>
                              <Badge variant="outline" className={STATUS_COLORS[q.quote_status] || ''}>{q.quote_status}</Badge>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="text-[10px] h-6 border-[#333]">Send to Client</Button>
                              <Button size="sm" variant="outline" className="text-[10px] h-6 border-[#C9A84C]/30 text-[#C9A84C]">Recommend</Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Notes */}
                <TabsContent value="notes" className="space-y-3">
                  <div className="flex gap-2">
                    <Textarea placeholder="Add internal note..." value={noteText} onChange={(e) => setNoteText(e.target.value)} className="bg-[#111] border-[#333] text-white min-h-[60px]" />
                    <Button className="bg-[#C9A84C] text-black hover:bg-[#B89A3C] self-end" onClick={() => addNote.mutate()} disabled={!noteText.trim()}>Add</Button>
                  </div>
                  {notes.map((n: any) => (
                    <div key={n.id} className="bg-[#111] border border-[#222] rounded p-3">
                      <div className="flex justify-between items-start">
                        <p className="text-sm">{n.note_text}</p>
                        {n.is_pinned && <Badge className="bg-[#C9A84C]/20 text-[#C9A84C] text-[9px]">PINNED</Badge>}
                      </div>
                      <span className="text-[10px] text-neutral-500 mt-1 block">{n.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true }) : ''}</span>
                    </div>
                  ))}
                </TabsContent>

                {/* Tasks */}
                <TabsContent value="tasks" className="space-y-3">
                  <div className="flex gap-2">
                    <Input placeholder="New task..." value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="bg-[#111] border-[#333] text-white" />
                    <Button className="bg-[#C9A84C] text-black hover:bg-[#B89A3C]" onClick={() => addTask.mutate()} disabled={!taskTitle.trim()}>Add</Button>
                  </div>
                  {tasks.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between bg-[#111] border border-[#222] rounded p-3">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" className={`h-5 w-5 p-0 ${t.task_status === 'completed' ? 'text-green-400' : 'text-neutral-500'}`}
                          onClick={() => completeTask.mutate(t.id)}>
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <span className={`text-sm ${t.task_status === 'completed' ? 'line-through text-neutral-500' : ''}`}>{t.task_title}</span>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${t.task_status === 'completed' ? 'border-green-500/30 text-green-400' : 'border-[#333]'}`}>{t.task_status}</Badge>
                    </div>
                  ))}
                </TabsContent>

                {/* Timeline */}
                <TabsContent value="timeline" className="space-y-2">
                  {timeline.length === 0 ? (
                    <p className="text-sm text-neutral-500">No activity yet</p>
                  ) : timeline.map((a: any) => (
                    <div key={a.id} className="flex items-start gap-3 py-2 border-b border-[#1A1A1A] last:border-0">
                      <Activity className="h-4 w-4 text-[#C9A84C] mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm">{a.activity_label}</p>
                        {a.notes && <p className="text-xs text-neutral-500 mt-0.5">{a.notes}</p>}
                        <span className="text-[10px] text-neutral-600">{a.created_at ? formatDistanceToNow(new Date(a.created_at), { addSuffix: true }) : ''}</span>
                      </div>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// PARTNER PANEL
// ═══════════════════════════════════════════════════════════════

function PartnerPanel({ partners }: any) {
  const [search, setSearch] = useState('');
  const filtered = partners.filter((p: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (p.partner_name || '').toLowerCase().includes(s) || (p.city || '').toLowerCase().includes(s);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <Input placeholder="Search partners..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-[#111] border-[#333] text-white" />
        </div>
      </div>
      <div className="rounded-lg border border-[#222] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[#222] bg-[#0D0D0D]">
              <TableHead className="text-neutral-400 text-xs">Partner</TableHead>
              <TableHead className="text-neutral-400 text-xs">City / State</TableHead>
              <TableHead className="text-neutral-400 text-xs">Self-Drive</TableHead>
              <TableHead className="text-neutral-400 text-xs">Chauffeur</TableHead>
              <TableHead className="text-neutral-400 text-xs">Same-Day</TableHead>
              <TableHead className="text-neutral-400 text-xs">Avg Response</TableHead>
              <TableHead className="text-neutral-400 text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-neutral-500">No partners</TableCell></TableRow>
            ) : filtered.map((p: any) => (
              <TableRow key={p.id} className="border-[#222] hover:bg-[#111]">
                <TableCell className="font-medium">{p.partner_name}</TableCell>
                <TableCell>{p.city}{p.state ? `, ${p.state}` : ''}</TableCell>
                <TableCell>{p.supports_self_drive ? <CheckCircle className="h-4 w-4 text-green-400" /> : <span className="text-neutral-600">—</span>}</TableCell>
                <TableCell>{p.supports_chauffeur ? <CheckCircle className="h-4 w-4 text-blue-400" /> : <span className="text-neutral-600">—</span>}</TableCell>
                <TableCell>{p.supports_same_day ? <CheckCircle className="h-4 w-4 text-orange-400" /> : <span className="text-neutral-600">—</span>}</TableCell>
                <TableCell>{p.avg_response_minutes ? `${p.avg_response_minutes}m` : '—'}</TableCell>
                <TableCell><Badge variant="outline" className={p.status === 'active' ? 'border-green-500/30 text-green-400' : 'border-red-500/30 text-red-400'}>{p.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PARTNER OFFERS PANEL (Alternate Vehicle Intelligence)
// ═══════════════════════════════════════════════════════════════

function PartnerOffersPanel({ offers, partners }: any) {
  const partnerMap = useMemo(() => {
    const m: Record<string, string> = {};
    partners.forEach((p: any) => { m[p.id] = p.partner_name; });
    return m;
  }, [partners]);

  return (
    <div className="space-y-4">
      <Card className="bg-[#111] border-[#222]">
        <CardHeader><CardTitle className="text-[#C9A84C] text-sm flex items-center gap-2"><Car className="h-4 w-4" /> Partner Offers & Alternate Vehicles</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-[#222]">
                <TableHead className="text-neutral-400 text-xs">Partner</TableHead>
                <TableHead className="text-neutral-400 text-xs">Offered Vehicle</TableHead>
                <TableHead className="text-neutral-400 text-xs">City</TableHead>
                <TableHead className="text-neutral-400 text-xs">Drive Mode</TableHead>
                <TableHead className="text-neutral-400 text-xs">Delivery</TableHead>
                <TableHead className="text-neutral-400 text-xs">Same-Day</TableHead>
                <TableHead className="text-neutral-400 text-xs">Status</TableHead>
                <TableHead className="text-neutral-400 text-xs">Responded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-neutral-500">No partner offers yet</TableCell></TableRow>
              ) : offers.map((o: any) => (
                <TableRow key={o.id} className="border-[#222] hover:bg-[#111]">
                  <TableCell className="font-medium text-sm">{partnerMap[o.partner_id] || '—'}</TableCell>
                  <TableCell className="text-[#C9A84C]">{[o.offered_make, o.offered_model].filter(Boolean).join(' ') || '—'}</TableCell>
                  <TableCell>{o.city || '—'}</TableCell>
                  <TableCell className="capitalize">{o.drive_mode?.replace(/_/g, ' ') || '—'}</TableCell>
                  <TableCell>{o.delivery_supported ? <CheckCircle className="h-4 w-4 text-green-400" /> : '—'}</TableCell>
                  <TableCell>{o.same_day_supported ? <CheckCircle className="h-4 w-4 text-orange-400" /> : '—'}</TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_COLORS[o.offer_status] || ''}>{(o.offer_status || '').replace(/_/g, ' ')}</Badge></TableCell>
                  <TableCell className="text-xs text-neutral-500">{o.responded_at ? formatDistanceToNow(new Date(o.responded_at), { addSuffix: true }) : 'pending'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// QUOTE PANEL (Side-by-side comparison)
// ═══════════════════════════════════════════════════════════════

function QuotePanel({ quotes }: any) {
  return (
    <div className="space-y-4">
      <Card className="bg-[#111] border-[#222]">
        <CardHeader><CardTitle className="text-[#C9A84C] text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Quote Pipeline</CardTitle></CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <p className="text-center py-8 text-neutral-500">No quotes yet</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {quotes.map((q: any) => (
                <Card key={q.id} className={`bg-[#0D0D0D] ${q.is_recommended ? 'border-[#C9A84C]/50 ring-1 ring-[#C9A84C]/20' : 'border-[#222]'}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] text-neutral-500">{q.id?.slice(0, 8)}</span>
                      {q.is_recommended && <Badge className="bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/30 text-[9px]">⭐ RECOMMENDED</Badge>}
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-neutral-500">Base Rental</span><span>${(q.base_rental_amount || q.hourly_price || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-neutral-500">Delivery</span><span>${(q.delivery_fee || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-neutral-500">Chauffeur</span><span>${(q.chauffeur_fee || q.chauffeur_amount || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-neutral-500">Insurance</span><span>${(q.insurance_fee_amount || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-neutral-500">Add-ons</span><span>${(q.add_on_amount || q.upsell_amount || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-neutral-500">Service Fee</span><span>${(q.service_fee || 0).toLocaleString()}</span></div>
                      <Separator className="bg-[#222]" />
                      <div className="flex justify-between font-bold text-sm">
                        <span className="text-[#C9A84C]">Total</span>
                        <span className="text-[#C9A84C]">${(q.total_price || q.total_amount || 0).toLocaleString()}</span>
                      </div>
                      {q.internal_margin_amount > 0 && (
                        <div className="flex justify-between text-green-400"><span>Margin</span><span>${q.internal_margin_amount.toLocaleString()}</span></div>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <Badge variant="outline" className={STATUS_COLORS[q.quote_status] || ''}>{q.quote_status}</Badge>
                      {q.expires_at && <span className="text-neutral-600">Exp: {format(new Date(q.expires_at), 'MMM d')}</span>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="text-[10px] h-6 flex-1 border-[#333]">Send</Button>
                      <Button size="sm" variant="outline" className="text-[10px] h-6 flex-1 border-[#C9A84C]/30 text-[#C9A84C]">Recommend</Button>
                    </div>
                    {q.sent_to_customer_at && (
                      <div className="text-[10px] text-neutral-600">
                        Sent: {formatDistanceToNow(new Date(q.sent_to_customer_at), { addSuffix: true })}
                        {q.viewed_by_customer_at && ` • Viewed: ${formatDistanceToNow(new Date(q.viewed_by_customer_at), { addSuffix: true })}`}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DELIVERY PANEL
// ═══════════════════════════════════════════════════════════════

function DeliveryPanel({ deliveries }: any) {
  return (
    <Card className="bg-[#111] border-[#222]">
      <CardHeader><CardTitle className="text-[#C9A84C] text-sm flex items-center gap-2"><Truck className="h-4 w-4" /> Delivery Coordination</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-[#222]">
              <TableHead className="text-neutral-400 text-xs">Type</TableHead>
              <TableHead className="text-neutral-400 text-xs">Address</TableHead>
              <TableHead className="text-neutral-400 text-xs">Delivery Time</TableHead>
              <TableHead className="text-neutral-400 text-xs">Pickup Time</TableHead>
              <TableHead className="text-neutral-400 text-xs">Status</TableHead>
              <TableHead className="text-neutral-400 text-xs">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-neutral-500">No deliveries scheduled</TableCell></TableRow>
            ) : deliveries.map((d: any) => (
              <TableRow key={d.id} className="border-[#222]">
                <TableCell className="capitalize">{d.delivery_type || '—'}</TableCell>
                <TableCell className="text-sm">{d.delivery_address || '—'}</TableCell>
                <TableCell className="text-sm">{d.delivery_time ? format(new Date(d.delivery_time), 'MMM d, h:mm a') : '—'}</TableCell>
                <TableCell className="text-sm">{d.pickup_time ? format(new Date(d.pickup_time), 'MMM d, h:mm a') : '—'}</TableCell>
                <TableCell><Badge variant="outline" className={STATUS_COLORS[d.fulfillment_status] || 'border-[#333]'}>{d.fulfillment_status}</Badge></TableCell>
                <TableCell className="text-xs text-neutral-400 max-w-[200px] truncate">{d.notes || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// CHAUFFEUR PANEL
// ═══════════════════════════════════════════════════════════════

function ChauffeurPanel({ chauffeurs }: any) {
  return (
    <Card className="bg-[#111] border-[#222]">
      <CardHeader><CardTitle className="text-[#C9A84C] text-sm flex items-center gap-2"><User className="h-4 w-4" /> Chauffeur Assignments</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-[#222]">
              <TableHead className="text-neutral-400 text-xs">Chauffeur</TableHead>
              <TableHead className="text-neutral-400 text-xs">Phone</TableHead>
              <TableHead className="text-neutral-400 text-xs">Start</TableHead>
              <TableHead className="text-neutral-400 text-xs">End</TableHead>
              <TableHead className="text-neutral-400 text-xs">Status</TableHead>
              <TableHead className="text-neutral-400 text-xs">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chauffeurs.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-neutral-500">No chauffeur assignments</TableCell></TableRow>
            ) : chauffeurs.map((c: any) => (
              <TableRow key={c.id} className="border-[#222]">
                <TableCell className="font-medium">{c.chauffeur_name || '—'}</TableCell>
                <TableCell>{c.chauffeur_phone || '—'}</TableCell>
                <TableCell>{c.start_time ? format(new Date(c.start_time), 'MMM d, h:mm a') : '—'}</TableCell>
                <TableCell>{c.end_time ? format(new Date(c.end_time), 'MMM d, h:mm a') : '—'}</TableCell>
                <TableCell><Badge variant="outline" className={STATUS_COLORS[c.assignment_status] || 'border-[#333]'}>{c.assignment_status}</Badge></TableCell>
                <TableCell className="text-xs text-neutral-400 max-w-[200px] truncate">{c.notes || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAYMENT PANEL
// ═══════════════════════════════════════════════════════════════

function PaymentPanel({ payments }: any) {
  return (
    <Card className="bg-[#111] border-[#222]">
      <CardHeader><CardTitle className="text-[#C9A84C] text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Payment Tracking</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-[#222]">
              <TableHead className="text-neutral-400 text-xs">Amount</TableHead>
              <TableHead className="text-neutral-400 text-xs">Status</TableHead>
              <TableHead className="text-neutral-400 text-xs">Due Date</TableHead>
              <TableHead className="text-neutral-400 text-xs">Received</TableHead>
              <TableHead className="text-neutral-400 text-xs">Method</TableHead>
              <TableHead className="text-neutral-400 text-xs">Reference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-neutral-500">No payments tracked</TableCell></TableRow>
            ) : payments.map((p: any) => (
              <TableRow key={p.id} className="border-[#222]">
                <TableCell className="font-bold text-[#C9A84C]">${(p.payment_amount || 0).toLocaleString()}</TableCell>
                <TableCell><Badge variant="outline" className={p.payment_status === 'received' ? 'border-green-500/30 text-green-400' : p.payment_status === 'pending' ? 'border-yellow-500/30 text-yellow-400' : 'border-[#333]'}>{p.payment_status}</Badge></TableCell>
                <TableCell>{p.payment_due_at ? format(new Date(p.payment_due_at), 'MMM d') : '—'}</TableCell>
                <TableCell>{p.payment_received_at ? format(new Date(p.payment_received_at), 'MMM d') : '—'}</TableCell>
                <TableCell className="capitalize">{p.payment_method || '—'}</TableCell>
                <TableCell className="font-mono text-xs">{p.payment_reference || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// UPSELL PANEL
// ═══════════════════════════════════════════════════════════════

function UpsellPanel() {
  return (
    <Card className="bg-[#111] border-[#222]">
      <CardHeader><CardTitle className="text-[#C9A84C] text-sm flex items-center gap-2"><Sparkles className="h-4 w-4" /> Upsell Engine</CardTitle></CardHeader>
      <CardContent>
        <p className="text-xs text-neutral-500 mb-4">Attach premium add-ons to maximize booking value. Suggest by occasion for best conversion.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {UPSELL_OPTIONS.map(u => (
            <Card key={u.code} className="bg-[#0D0D0D] border-[#222] hover:border-[#C9A84C]/30 transition-colors cursor-pointer">
              <CardContent className="p-3 text-center">
                <span className="text-2xl">{u.icon}</span>
                <p className="text-xs font-medium mt-1">{u.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Separator className="my-4 bg-[#222]" />
        <div>
          <h4 className="text-xs font-semibold text-neutral-400 uppercase mb-2">Most Booked Together</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-[#C9A84C]/30 text-[#C9A84C]">🎩 Chauffeur + 📸 Photographer</Badge>
            <Badge variant="outline" className="border-[#C9A84C]/30 text-[#C9A84C]">💍 Proposal + 🎬 Videographer</Badge>
            <Badge variant="outline" className="border-[#C9A84C]/30 text-[#C9A84C]">🛥️ Yacht + 🌃 Nightlife</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// SPECIAL REQUESTS PANEL
// ═══════════════════════════════════════════════════════════════

function SpecialRequestsPanel({ requests }: any) {
  const special = requests.filter((r: any) => r.urgency_level === 'critical' || r.urgency_level === 'high' || ['wedding', 'proposal', 'music_video', 'photoshoot', 'fleet'].includes(r.occasion_type));
  return (
    <Card className="bg-[#111] border-[#222]">
      <CardHeader><CardTitle className="text-[#C9A84C] text-sm flex items-center gap-2"><Crown className="h-4 w-4" /> Special Requests & Rare Sourcing</CardTitle></CardHeader>
      <CardContent>
        {special.length === 0 ? (
          <p className="text-center py-8 text-neutral-500">No special requests at the moment</p>
        ) : (
          <div className="space-y-3">
            {special.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between bg-[#0D0D0D] border border-[#222] rounded-lg p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{r.customer_name || 'Unknown'}</span>
                    {r.urgency_level === 'critical' && <Badge className="bg-red-500/20 text-red-400 text-[9px]">CRITICAL</Badge>}
                    {r.occasion_type && <Badge variant="outline" className="border-[#C9A84C]/30 text-[#C9A84C] text-[9px] capitalize">{r.occasion_type}</Badge>}
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">{[r.requested_make, r.requested_model].filter(Boolean).join(' ')} • {r.city || r.selected_city || '—'}</p>
                  {r.special_requests && <p className="text-xs text-neutral-400 mt-1">{r.special_requests}</p>}
                </div>
                <Button size="sm" className="bg-[#C9A84C] text-black hover:bg-[#B89A3C] h-7 text-xs">
                  <Zap className="h-3 w-3 mr-1" /> Prioritize
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// INVENTORY PANEL
// ═══════════════════════════════════════════════════════════════

function InventoryPanel({ inventory }: any) {
  const [search, setSearch] = useState('');
  const filtered = inventory.filter((v: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (v.make || '').toLowerCase().includes(s) || (v.model || '').toLowerCase().includes(s) || (v.city || '').toLowerCase().includes(s);
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
        <Input placeholder="Search vehicles..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-[#111] border-[#333] text-white" />
      </div>
      <div className="rounded-lg border border-[#222] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[#222] bg-[#0D0D0D]">
              <TableHead className="text-neutral-400 text-xs">Vehicle</TableHead>
              <TableHead className="text-neutral-400 text-xs">Year</TableHead>
              <TableHead className="text-neutral-400 text-xs">City</TableHead>
              <TableHead className="text-neutral-400 text-xs">Daily Rate</TableHead>
              <TableHead className="text-neutral-400 text-xs">Chauffeur/hr</TableHead>
              <TableHead className="text-neutral-400 text-xs">Self-Drive</TableHead>
              <TableHead className="text-neutral-400 text-xs">Chauffeur</TableHead>
              <TableHead className="text-neutral-400 text-xs">Delivery</TableHead>
              <TableHead className="text-neutral-400 text-xs">Availability</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-neutral-500">No vehicles</TableCell></TableRow>
            ) : filtered.map((v: any) => (
              <TableRow key={v.id} className="border-[#222] hover:bg-[#111]">
                <TableCell className="font-medium">{v.make} {v.model}</TableCell>
                <TableCell>{v.year || '—'}</TableCell>
                <TableCell>{v.city || '—'}</TableCell>
                <TableCell className="text-[#C9A84C]">{v.self_drive_daily_rate || v.daily_price ? `$${(v.self_drive_daily_rate || v.daily_price || 0).toLocaleString()}` : '—'}</TableCell>
                <TableCell className="text-[#C9A84C]">{v.chauffeur_hourly_rate || v.hourly_price ? `$${(v.chauffeur_hourly_rate || v.hourly_price || 0).toLocaleString()}` : '—'}</TableCell>
                <TableCell>{v.supports_self_drive ? <CheckCircle className="h-4 w-4 text-green-400" /> : '—'}</TableCell>
                <TableCell>{(v.supports_chauffeur || v.chauffeur_available) ? <CheckCircle className="h-4 w-4 text-blue-400" /> : '—'}</TableCell>
                <TableCell>{v.delivery_available ? <CheckCircle className="h-4 w-4 text-teal-400" /> : '—'}</TableCell>
                <TableCell className="capitalize"><Badge variant="outline" className="text-[10px] border-[#333]">{v.availability_mode || 'request'}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ANALYTICS PANEL
// ═══════════════════════════════════════════════════════════════

function AnalyticsPanel({ requests, quotes, partners, cityDemand, brandDemand }: any) {
  const acceptedQuotes = quotes.filter((q: any) => q.quote_status === 'accepted');
  const totalRev = acceptedQuotes.reduce((s: number, q: any) => s + (q.total_price || q.total_amount || 0), 0);
  const avgValue = acceptedQuotes.length > 0 ? totalRev / acceptedQuotes.length : 0;

  // Vehicle category demand
  const categoryDemand = useMemo(() => {
    const map: Record<string, number> = {};
    requests.forEach((r: any) => { if (r.occasion_type) map[r.occasion_type] = (map[r.occasion_type] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [requests]);

  return (
    <div className="space-y-4">
      {/* Top-level metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <span className="text-[10px] text-neutral-500 uppercase">Total Revenue</span>
            <p className="text-2xl font-bold text-[#C9A84C]">${totalRev.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <span className="text-[10px] text-neutral-500 uppercase">Avg Booking Value</span>
            <p className="text-2xl font-bold text-[#C9A84C]">${avgValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <span className="text-[10px] text-neutral-500 uppercase">Total Requests</span>
            <p className="text-2xl font-bold text-blue-400">{requests.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <span className="text-[10px] text-neutral-500 uppercase">Conversion Rate</span>
            <p className="text-2xl font-bold text-green-400">{requests.length > 0 ? ((acceptedQuotes.length / requests.length) * 100).toFixed(1) : '0'}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* City Demand */}
        <Card className="bg-[#111] border-[#222]">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#C9A84C]">📍 Demand by City</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {cityDemand.slice(0, 10).map(([city, count]: any, i: number) => (
              <div key={city} className="flex justify-between items-center">
                <span className="text-xs">{i + 1}. {city}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 bg-[#C9A84C]/30 rounded" style={{ width: `${(count / (cityDemand[0]?.[1] || 1)) * 80}px` }} />
                  <span className="text-xs text-neutral-500 w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
            {cityDemand.length === 0 && <p className="text-xs text-neutral-500">No data</p>}
          </CardContent>
        </Card>

        {/* Brand Demand */}
        <Card className="bg-[#111] border-[#222]">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#C9A84C]">🏎️ Demand by Brand</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {brandDemand.slice(0, 10).map(([brand, count]: any, i: number) => (
              <div key={brand} className="flex justify-between items-center">
                <span className="text-xs">{i + 1}. {brand}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 bg-[#C9A84C]/30 rounded" style={{ width: `${(count / (brandDemand[0]?.[1] || 1)) * 80}px` }} />
                  <span className="text-xs text-neutral-500 w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
            {brandDemand.length === 0 && <p className="text-xs text-neutral-500">No data</p>}
          </CardContent>
        </Card>

        {/* Occasion Demand */}
        <Card className="bg-[#111] border-[#222]">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#C9A84C]">🎯 Demand by Occasion</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {categoryDemand.slice(0, 10).map(([cat, count]: any, i: number) => (
              <div key={cat} className="flex justify-between items-center">
                <span className="text-xs capitalize">{i + 1}. {cat.replace(/_/g, ' ')}</span>
                <span className="text-xs text-neutral-500">{count}</span>
              </div>
            ))}
            {categoryDemand.length === 0 && <p className="text-xs text-neutral-500">No data</p>}
          </CardContent>
        </Card>
      </div>

      {/* Partner Performance */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader className="pb-2"><CardTitle className="text-sm text-[#C9A84C]">🏆 Partner Performance</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-[#222]">
                <TableHead className="text-neutral-400 text-xs">Partner</TableHead>
                <TableHead className="text-neutral-400 text-xs">City</TableHead>
                <TableHead className="text-neutral-400 text-xs">Response Time</TableHead>
                <TableHead className="text-neutral-400 text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.sort((a: any, b: any) => (a.avg_response_minutes || 999) - (b.avg_response_minutes || 999)).slice(0, 10).map((p: any, i: number) => (
                <TableRow key={p.id} className="border-[#222]">
                  <TableCell className="font-medium text-sm">{i === 0 && '🥇 '}{i === 1 && '🥈 '}{i === 2 && '🥉 '}{p.partner_name}</TableCell>
                  <TableCell>{p.city || '—'}</TableCell>
                  <TableCell>{p.avg_response_minutes ? `${p.avg_response_minutes}m` : '—'}</TableCell>
                  <TableCell><Badge variant="outline" className={p.status === 'active' ? 'border-green-500/30 text-green-400' : 'border-[#333]'}>{p.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
