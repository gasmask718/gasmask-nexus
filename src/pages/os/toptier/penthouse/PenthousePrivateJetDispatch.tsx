import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plane, Send, DollarSign, Clock, Users, MapPin, TrendingUp,
  CheckCircle2, XCircle, AlertTriangle, Search, ChevronDown,
  ChevronRight, Zap, Eye, BarChart3, Trophy,
  RefreshCw, Mail, Star, Timer,
  CircleDot, FileText, Sparkles, Target, Activity,
  Shield, Gauge, Crown, Globe, Fuel
} from 'lucide-react';

// ── Design Tokens ───────────────────────────────────────────────────────
const GOLD = '#C9A84C';
const SURFACE = 'bg-[#0A0A0A]';
const GLASS_1 = 'backdrop-blur-xl bg-white/[0.03] border border-white/[0.06]';
const GLASS_2 = 'backdrop-blur-xl bg-white/[0.05] border border-white/[0.08]';
const GLASS_3 = 'backdrop-blur-xl bg-white/[0.08] border border-white/[0.12]';

const money = (n: number | null | undefined) => n != null ? `$${Number(n).toLocaleString()}` : '—';

// ── Status Config ───────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any; pulse?: boolean }> = {
  new: { label: 'New', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: CircleDot, pulse: true },
  awaiting_quotes: { label: 'Awaiting Quotes', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Send, pulse: true },
  quotes_received: { label: 'Quotes In', color: 'text-cyan-400', bg: 'bg-cyan-500/10', icon: FileText },
  selected: { label: 'Selected', color: 'text-violet-400', bg: 'bg-violet-500/10', icon: Trophy },
  customer_review: { label: 'Customer Review', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: Eye },
  confirmed: { label: 'Confirmed', color: 'text-green-400', bg: 'bg-green-500/10', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-500/10', icon: XCircle },
  expired: { label: 'Expired', color: 'text-zinc-400', bg: 'bg-zinc-500/10', icon: Timer },
};

function StatusChip({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color} ${cfg.bg}`}>
      {cfg.pulse && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'currentColor' }} /><span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'currentColor' }} /></span>}
      <Icon className={size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
      {cfg.label}
    </span>
  );
}

// ── KPI Card ────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, delay = 0 }: { icon: any; label: string; value: string; sub?: string; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}
      className={`${GLASS_2} rounded-2xl p-4 relative overflow-hidden group hover:border-[${GOLD}]/20 transition-all`}>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(circle at 50% 50%, ${GOLD}08, transparent 70%)` }} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${GOLD}15` }}><Icon className="w-4 h-4" style={{ color: GOLD }} /></div>
          <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{label}</span>
        </div>
        <div className="text-2xl font-bold text-white">{value}</div>
        {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
      </div>
    </motion.div>
  );
}

export default function PenthousePrivateJetDispatch() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => { const i = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(i); }, []);

  // ── Data ────────────────────────────────────────────────────────────
  const { data: requests = [] } = useQuery({
    queryKey: ['pj-requests'],
    queryFn: async () => {
      const { data } = await supabase.from('cb_booking_requests').select('*')
        .eq('category', 'private_jet').order('created_at', { ascending: false });
      return data || [];
    },
    refetchInterval: 15000,
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ['pj-quotes', selectedRequest],
    queryFn: async () => {
      if (!selectedRequest) return [];
      const { data } = await supabase.from('cb_partner_quotes').select('*').eq('booking_request_id', selectedRequest).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!selectedRequest,
  });

  const { data: margins = [] } = useQuery({
    queryKey: ['pj-margins', selectedRequest],
    queryFn: async () => {
      if (!selectedRequest) return [];
      const { data } = await supabase.from('cb_quote_margins').select('*').eq('booking_request_id', selectedRequest);
      return data || [];
    },
    enabled: !!selectedRequest,
  });

  const { data: dispatches = [] } = useQuery({
    queryKey: ['pj-dispatches', selectedRequest],
    queryFn: async () => {
      if (!selectedRequest) return [];
      const { data } = await supabase.from('cb_request_partner_dispatches').select('*').eq('booking_request_id', selectedRequest).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!selectedRequest,
  });

  // ── Mutations ──────────────────────────────────────────────────────
  const dispatchMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.functions.invoke('cb-dispatch-engine', {
        body: { action: 'dispatch', request_id: requestId },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Dispatched to ${data.dispatched} aviation partners`);
      queryClient.invalidateQueries({ queryKey: ['pj-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pj-dispatches'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectQuoteMutation = useMutation({
    mutationFn: async ({ requestId, quoteId }: { requestId: string; quoteId: string }) => {
      const { data, error } = await supabase.functions.invoke('cb-dispatch-engine', {
        body: { action: 'select_quote', request_id: requestId, quote_id: quoteId },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Charter selected – Customer price: ${money(data.customer_price)}`);
      queryClient.invalidateQueries({ queryKey: ['pj-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pj-quotes'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendOfferMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.functions.invoke('cb-dispatch-engine', {
        body: { action: 'send_customer_offer', request_id: requestId },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Charter offer sent to customer!');
      queryClient.invalidateQueries({ queryKey: ['pj-requests'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const autoEvalMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.functions.invoke('cb-dispatch-engine', {
        body: { action: 'auto_evaluate', request_id: requestId, trigger_type: 'manual' },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Auto-selected – $${data.winner?.final_customer_price?.toLocaleString()}`);
      queryClient.invalidateQueries({ queryKey: ['pj-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pj-quotes'] });
    },
    onError: (e: Error) => toast.error('Auto-evaluation failed: ' + e.message),
  });

  // ── New Request ────────────────────────────────────────────────────
  const [newReq, setNewReq] = useState({
    customer_name: '', customer_email: '', customer_phone: '',
    departure_airport: '', arrival_airport: '',
    pickup_city: '', pickup_state: '', dropoff_city: '', dropoff_state: '',
    trip_date: '', trip_time: '', return_date: '',
    flight_type: 'one_way', passenger_count: 1,
    aircraft_preference: '', luggage_estimate: '', catering_requests: '',
    pet_friendly: false, special_requests: '', notes: '',
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('cb_booking_requests').insert({
        ...newReq, category: 'private_jet', status: 'new', passenger_count: Number(newReq.passenger_count) || 1,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Private jet request created');
      setShowNewDialog(false);
      queryClient.invalidateQueries({ queryKey: ['pj-requests'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Computed ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return requests.filter((r: any) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (r.customer_name?.toLowerCase().includes(s) || r.departure_airport?.toLowerCase().includes(s) ||
          r.arrival_airport?.toLowerCase().includes(s) || r.pickup_city?.toLowerCase().includes(s) || r.dropoff_city?.toLowerCase().includes(s));
      }
      return true;
    });
  }, [requests, statusFilter, search]);

  const activeRequest = requests.find((r: any) => r.id === selectedRequest);
  const marginMap = new Map(margins.map((m: any) => [m.quote_id, m]));

  // KPI calcs
  const openCount = requests.filter((r: any) => ['new', 'awaiting_quotes', 'quotes_received'].includes(r.status)).length;
  const selectedCount = requests.filter((r: any) => r.status === 'selected').length;
  const confirmedCount = requests.filter((r: any) => r.status === 'confirmed').length;
  const avgPrice = requests.filter((r: any) => r.customer_offer_price).reduce((s: number, r: any) => s + Number(r.customer_offer_price), 0) / (requests.filter((r: any) => r.customer_offer_price).length || 1);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: requests.length };
    requests.forEach((r: any) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [requests]);

  return (
    <div className={`min-h-screen ${SURFACE} text-white`}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: `linear-gradient(135deg, ${GOLD}20, ${GOLD}05)` }}>
              <Plane className="w-6 h-6" style={{ color: GOLD }} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Private Jet <span style={{ color: GOLD }}>Command</span></h1>
              <p className="text-xs text-zinc-500">Global Aviation Brokerage • {now.toLocaleTimeString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="text-xs border-white/10 text-zinc-400 hover:text-white"
              onClick={() => { queryClient.invalidateQueries({ queryKey: ['pj-requests'] }); }}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
            </Button>
            <Button size="sm" className="text-xs font-bold" style={{ backgroundColor: GOLD, color: '#000' }}
              onClick={() => setShowNewDialog(true)}>
              <Plane className="w-3.5 h-3.5 mr-1.5" /> New Charter Request
            </Button>
          </div>
        </div>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────── */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <KpiCard icon={Globe} label="Open Requests" value={String(openCount)} delay={0} />
          <KpiCard icon={FileText} label="Awaiting Quotes" value={String(statusCounts.awaiting_quotes || 0)} delay={0.05} />
          <KpiCard icon={Trophy} label="Selected" value={String(selectedCount)} delay={0.1} />
          <KpiCard icon={CheckCircle2} label="Confirmed" value={String(confirmedCount)} delay={0.15} />
          <KpiCard icon={DollarSign} label="Avg Charter" value={money(Math.round(avgPrice))} delay={0.2} />
          <KpiCard icon={Gauge} label="Total Requests" value={String(requests.length)} delay={0.25} />
        </div>
      </div>

      {/* ── Main Grid ───────────────────────────────────────────────── */}
      <div className="px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* ── Request Queue ─────────────────────────────────────── */}
          <div className="lg:col-span-4 space-y-3">
            <div className={`${GLASS_1} rounded-2xl p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <Search className="w-4 h-4 text-zinc-500" />
                <Input placeholder="Search charters…" value={search} onChange={e => setSearch(e.target.value)}
                  className="h-8 bg-transparent border-white/[0.06] text-sm text-white placeholder:text-zinc-600" />
              </div>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {['all', 'new', 'awaiting_quotes', 'quotes_received', 'selected', 'customer_review', 'confirmed'].map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${statusFilter === s ? 'text-black' : 'text-zinc-500 hover:text-zinc-300 bg-white/[0.03]'}`}
                    style={statusFilter === s ? { backgroundColor: GOLD } : {}}>
                    {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s} {statusCounts[s] ? `(${statusCounts[s]})` : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <div className={`${GLASS_1} rounded-2xl p-8 text-center`}>
                  <Plane className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
                  <p className="text-sm text-zinc-500">No charter requests found</p>
                </div>
              ) : filtered.map((r: any) => (
                <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className={`${selectedRequest === r.id ? GLASS_3 : GLASS_1} rounded-xl p-3.5 cursor-pointer transition-all hover:border-white/[0.12]`}
                  style={selectedRequest === r.id ? { borderColor: `${GOLD}30` } : {}}
                  onClick={() => setSelectedRequest(r.id)}>
                  <div className="flex items-center justify-between mb-2">
                    <StatusChip status={r.status} />
                    <span className="text-[10px] text-zinc-600 font-mono">#{r.id.slice(0, 8)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-white mb-1">
                    <Plane className="w-3.5 h-3.5" style={{ color: GOLD }} />
                    {r.departure_airport || r.pickup_city || 'TBD'} → {r.arrival_airport || r.dropoff_city || 'TBD'}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                    <span>{r.trip_date || 'No date'}</span>
                    <span>·</span>
                    <span>{r.passenger_count} pax</span>
                    {r.aircraft_preference && <><span>·</span><span>{r.aircraft_preference}</span></>}
                  </div>
                  {r.customer_offer_price && (
                    <div className="mt-2 text-xs font-bold" style={{ color: GOLD }}>{money(r.customer_offer_price)}</div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* ── Detail Panel ──────────────────────────────────────── */}
          <div className="lg:col-span-8 space-y-4">
            {!activeRequest ? (
              <div className={`${GLASS_1} rounded-2xl p-16 text-center`}>
                <Plane className="w-16 h-16 mx-auto mb-4 text-zinc-800" />
                <h3 className="text-lg font-semibold text-zinc-500">Select a Charter Request</h3>
                <p className="text-sm text-zinc-600 mt-1">Choose from the queue to view details and manage quotes</p>
              </div>
            ) : (
              <>
                {/* ── Action Bar ─────────────────────────────────── */}
                <div className={`${GLASS_2} rounded-2xl p-4 sticky top-0 z-10`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusChip status={activeRequest.status} size="md" />
                      <div className="h-4 w-px bg-white/[0.08]" />
                      <span className="text-xs text-zinc-500 font-mono">#{activeRequest.id.slice(0, 8)}</span>
                      <span className="text-xs text-zinc-500">{activeRequest.customer_name || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {['new', 'quotes_received'].includes(activeRequest.status) && (
                        <Button size="sm" className="text-xs font-bold h-8 shadow-lg" style={{ backgroundColor: GOLD, color: '#000' }}
                          disabled={dispatchMutation.isPending} onClick={() => dispatchMutation.mutate(activeRequest.id)}>
                          <Send className="w-3.5 h-3.5 mr-1.5" />
                          {dispatchMutation.isPending ? 'Dispatching…' : activeRequest.status === 'new' ? 'Dispatch to Operators' : 'Redispatch'}
                        </Button>
                      )}
                      {['awaiting_quotes', 'quotes_received'].includes(activeRequest.status) && (
                        <Button size="sm" className="text-xs font-bold h-8 bg-violet-600 hover:bg-violet-500 text-white"
                          disabled={autoEvalMutation.isPending} onClick={() => autoEvalMutation.mutate(activeRequest.id)}>
                          <Zap className="w-3.5 h-3.5 mr-1.5" />
                          {autoEvalMutation.isPending ? 'Evaluating…' : 'Auto-Select Best'}
                        </Button>
                      )}
                      {activeRequest.status === 'selected' && (
                        <Button size="sm" className="text-xs font-bold h-8 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg"
                          disabled={sendOfferMutation.isPending} onClick={() => sendOfferMutation.mutate(activeRequest.id)}>
                          <Mail className="w-3.5 h-3.5 mr-1.5" />
                          {sendOfferMutation.isPending ? 'Sending…' : 'Send Charter Offer'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Flight Details ─────────────────────────────── */}
                <div className={`${GLASS_1} rounded-2xl p-5`}>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${GOLD}10` }}>
                      <Plane className="w-4 h-4" style={{ color: GOLD }} />
                    </div>
                    <span className="text-sm font-semibold text-white">Flight Details</span>
                  </div>

                  {/* Route Card */}
                  <div className="rounded-xl p-5 mb-4" style={{ background: `linear-gradient(135deg, #1a1a2e, ${GOLD}15)` }}>
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <div className="text-lg font-bold text-white">{activeRequest.departure_airport || activeRequest.pickup_city || 'TBD'}</div>
                        <div className="text-xs text-zinc-400">{activeRequest.pickup_city}{activeRequest.pickup_state ? `, ${activeRequest.pickup_state}` : ''}</div>
                      </div>
                      <div className="flex items-center gap-2 px-4">
                        <div className="h-px w-12 bg-white/20" />
                        <Plane className="w-5 h-5" style={{ color: GOLD }} />
                        <div className="h-px w-12 bg-white/20" />
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-white">{activeRequest.arrival_airport || activeRequest.dropoff_city || 'TBD'}</div>
                        <div className="text-xs text-zinc-400">{activeRequest.dropoff_city}{activeRequest.dropoff_state ? `, ${activeRequest.dropoff_state}` : ''}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { icon: Clock, label: 'Date', value: activeRequest.trip_date || 'TBD' },
                      { icon: Clock, label: 'Time', value: activeRequest.trip_time || 'TBD' },
                      { icon: Users, label: 'Passengers', value: String(activeRequest.passenger_count || 'TBD') },
                      { icon: Plane, label: 'Flight Type', value: activeRequest.flight_type || 'one_way' },
                      { icon: Plane, label: 'Aircraft Pref', value: activeRequest.aircraft_preference || 'Any' },
                      { icon: Target, label: 'Luggage', value: activeRequest.luggage_estimate || 'Standard' },
                      { icon: Sparkles, label: 'Catering', value: activeRequest.catering_requests || 'None' },
                      { icon: Shield, label: 'Pets', value: activeRequest.pet_friendly ? 'Yes' : 'No' },
                    ].map((item, i) => (
                      <div key={i} className="bg-white/[0.03] rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <item.icon className="w-3 h-3 text-zinc-500" />
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{item.label}</span>
                        </div>
                        <div className="text-sm font-semibold text-white">{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {activeRequest.special_requests && (
                    <div className="mt-3 bg-amber-500/5 border border-amber-500/10 rounded-lg p-3">
                      <span className="text-xs text-amber-400 font-semibold">Special Requests:</span>
                      <p className="text-xs text-zinc-400 mt-1">{activeRequest.special_requests}</p>
                    </div>
                  )}
                </div>

                {/* ── Dispatch Status ────────────────────────────── */}
                {dispatches.length > 0 && (
                  <div className={`${GLASS_1} rounded-2xl p-5`}>
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${GOLD}10` }}>
                        <Send className="w-4 h-4" style={{ color: GOLD }} />
                      </div>
                      <span className="text-sm font-semibold text-white">Dispatched Operators</span>
                      <Badge variant="outline" className="text-[10px] border-white/10 text-zinc-400">{dispatches.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {dispatches.map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between bg-white/[0.02] rounded-lg p-3">
                          <div>
                            <span className="text-sm font-medium text-white">{d.partner_name}</span>
                            <div className="text-[11px] text-zinc-500">{d.channel} • {d.partner_email || d.partner_phone}</div>
                          </div>
                          <Badge variant="outline" className={`text-[10px] ${d.status === 'responded' ? 'text-emerald-400 border-emerald-500/20' : d.status === 'sent' ? 'text-blue-400 border-blue-500/20' : 'text-zinc-500 border-white/10'}`}>
                            {d.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Quotes ─────────────────────────────────────── */}
                <div className={`${GLASS_1} rounded-2xl p-5`}>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${GOLD}10` }}>
                      <DollarSign className="w-4 h-4" style={{ color: GOLD }} />
                    </div>
                    <span className="text-sm font-semibold text-white">Charter Quotes</span>
                    <Badge variant="outline" className="text-[10px] border-white/10 text-zinc-400">{quotes.length}</Badge>
                  </div>

                  {quotes.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-zinc-700" />
                      <p className="text-sm text-zinc-600">No quotes received yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {quotes.map((q: any) => {
                        const m = marginMap.get(q.id);
                        const isExpanded = expandedQuote === q.id;
                        return (
                          <motion.div key={q.id} className={`${q.is_selected ? GLASS_3 : 'bg-white/[0.02]'} rounded-xl p-4 transition-all`}
                            style={q.is_selected ? { borderColor: `${GOLD}30` } : {}}>
                            <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedQuote(isExpanded ? null : q.id)}>
                              <div className="flex items-center gap-3">
                                {q.is_selected && <Crown className="w-4 h-4" style={{ color: GOLD }} />}
                                <div>
                                  <div className="text-sm font-semibold text-white">{q.aircraft_type || q.vehicle_type || 'Aircraft TBD'}</div>
                                  <div className="text-[11px] text-zinc-500">
                                    {q.flight_time_hours ? `${q.flight_time_hours}h flight` : ''} 
                                    {q.capacity ? ` • ${q.capacity} seats` : ''}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <div className="text-lg font-bold" style={{ color: GOLD }}>{money(q.quoted_price)}</div>
                                  {m && <div className="text-[10px] text-emerald-400">→ {money(m.final_customer_price)}</div>}
                                </div>
                                {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                              </div>
                            </div>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                  <div className="pt-3 mt-3 border-t border-white/[0.06] space-y-3">
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                      {[
                                        { label: 'Reposition', value: money(q.reposition_cost) },
                                        { label: 'Fuel Surcharge', value: money(q.fuel_surcharge) },
                                        { label: 'Landing Fees', value: money(q.landing_fees) },
                                        { label: 'Crew Overnight', value: money(q.crew_overnight) },
                                        { label: 'Deposit', value: money(q.deposit_required) },
                                        { label: 'Response Time', value: q.response_time_seconds ? `${Math.round(q.response_time_seconds / 60)}m` : '—' },
                                      ].map((item, i) => (
                                        <div key={i} className="bg-white/[0.03] rounded-lg p-2.5">
                                          <div className="text-[10px] text-zinc-500 uppercase">{item.label}</div>
                                          <div className="text-sm font-semibold text-white">{item.value}</div>
                                        </div>
                                      ))}
                                    </div>

                                    {m && (
                                      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3">
                                        <div className="text-[10px] text-emerald-400 font-semibold uppercase mb-2">Margin Breakdown</div>
                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                          <div><span className="text-zinc-500">Partner:</span> <span className="text-white font-semibold">{money(m.partner_price)}</span></div>
                                          <div><span className="text-zinc-500">Markup:</span> <span className="text-emerald-400 font-semibold">{money(m.markup_amount)}</span></div>
                                          <div><span className="text-zinc-500">Customer:</span> <span className="font-bold" style={{ color: GOLD }}>{money(m.final_customer_price)}</span></div>
                                        </div>
                                      </div>
                                    )}

                                    {q.quote_notes && <p className="text-xs text-zinc-400">{q.quote_notes}</p>}

                                    {!q.is_selected && activeRequest.status !== 'confirmed' && (
                                      <Button size="sm" className="w-full text-xs font-bold" style={{ backgroundColor: GOLD, color: '#000' }}
                                        disabled={selectQuoteMutation.isPending}
                                        onClick={() => selectQuoteMutation.mutate({ requestId: activeRequest.id, quoteId: q.id })}>
                                        <Trophy className="w-3.5 h-3.5 mr-1.5" /> Select This Charter
                                      </Button>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── New Request Dialog ───────────────────────────────────────── */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plane style={{ color: GOLD }} /> New Private Jet Request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Input placeholder="Client Name" value={newReq.customer_name} onChange={e => setNewReq(p => ({ ...p, customer_name: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
              <Input placeholder="Email" value={newReq.customer_email} onChange={e => setNewReq(p => ({ ...p, customer_email: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
              <Input placeholder="Phone" value={newReq.customer_phone} onChange={e => setNewReq(p => ({ ...p, customer_phone: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Departure Airport (ICAO/IATA)" value={newReq.departure_airport} onChange={e => setNewReq(p => ({ ...p, departure_airport: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
              <Input placeholder="Arrival Airport (ICAO/IATA)" value={newReq.arrival_airport} onChange={e => setNewReq(p => ({ ...p, arrival_airport: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Departure City" value={newReq.pickup_city} onChange={e => setNewReq(p => ({ ...p, pickup_city: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
              <Input placeholder="Arrival City" value={newReq.dropoff_city} onChange={e => setNewReq(p => ({ ...p, dropoff_city: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <Input type="date" value={newReq.trip_date} onChange={e => setNewReq(p => ({ ...p, trip_date: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
              <Input type="time" value={newReq.trip_time} onChange={e => setNewReq(p => ({ ...p, trip_time: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
              <Input type="number" placeholder="Passengers" min={1} value={newReq.passenger_count} onChange={e => setNewReq(p => ({ ...p, passenger_count: Number(e.target.value) }))} className="bg-white/5 border-white/10 text-white" />
              <select value={newReq.flight_type} onChange={e => setNewReq(p => ({ ...p, flight_type: e.target.value }))} className="rounded-md bg-white/5 border border-white/10 text-white text-sm px-3">
                <option value="one_way">One Way</option>
                <option value="round_trip">Round Trip</option>
                <option value="multi_leg">Multi-Leg</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Aircraft Preference (e.g. G650)" value={newReq.aircraft_preference} onChange={e => setNewReq(p => ({ ...p, aircraft_preference: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
              <Input placeholder="Luggage Estimate" value={newReq.luggage_estimate} onChange={e => setNewReq(p => ({ ...p, luggage_estimate: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            </div>
            <Input placeholder="Catering Requests" value={newReq.catering_requests} onChange={e => setNewReq(p => ({ ...p, catering_requests: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
            <Textarea placeholder="Special Requests" value={newReq.special_requests} onChange={e => setNewReq(p => ({ ...p, special_requests: e.target.value }))} className="bg-white/5 border-white/10 text-white" rows={2} />
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={newReq.pet_friendly} onChange={e => setNewReq(p => ({ ...p, pet_friendly: e.target.checked }))} className="rounded" />
              <span className="text-sm text-zinc-400">Pet-Friendly Charter</span>
            </div>
            <Button className="w-full font-bold" style={{ backgroundColor: GOLD, color: '#000' }}
              disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? 'Creating…' : 'Create Charter Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
