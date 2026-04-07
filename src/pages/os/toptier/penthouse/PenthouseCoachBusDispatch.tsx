import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Bus, Send, DollarSign, Clock, Users, MapPin, TrendingUp,
  CheckCircle2, XCircle, AlertTriangle, Search, ChevronDown,
  ChevronRight, Zap, Eye, ArrowUpDown, BarChart3, Trophy,
  RefreshCw, MessageSquare, Mail, Phone, Star, Timer,
  CircleDot, Package, FileText, Sparkles, Target, Activity
} from 'lucide-react';

// ── Styles ──────────────────────────────────────────────────────────────
const GOLD = '#C9A84C';
const DARK_SURFACE = 'rgba(255,255,255,0.03)';
const GLASS = 'backdrop-blur-xl bg-black/40 border border-white/[0.06]';
const GLASS_HOVER = 'hover:border-white/[0.12] hover:bg-white/[0.04]';

// ── Status config ───────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  new: { label: 'New', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: CircleDot },
  dispatching: { label: 'Dispatching', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: Send },
  awaiting_quotes: { label: 'Awaiting Quotes', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', icon: Clock },
  quotes_received: { label: 'Quotes In', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', icon: FileText },
  customer_review: { label: 'Customer Review', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', icon: Eye },
  selected: { label: 'Selected', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  confirmed: { label: 'Confirmed', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', icon: CheckCircle2 },
  declined: { label: 'Declined', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20', icon: XCircle },
  expired: { label: 'Expired', color: 'text-zinc-500', bg: 'bg-zinc-600/10 border-zinc-600/20', icon: Timer },
};

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide border ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ── Relative time ───────────────────────────────────────────────────────
function relTime(iso: string | null) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function money(n: number | null | undefined) {
  if (n == null) return '$0.00';
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── KPI Card ────────────────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, sub, color = GOLD, pulse }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string; pulse?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative ${GLASS} rounded-xl p-4 ${GLASS_HOVER} transition-all duration-300 group`}
    >
      {pulse && (
        <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }} />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: color }} />
        </span>
      )}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
          <p className="text-xl font-bold text-white mt-0.5 truncate">{value}</p>
          {sub && <p className="text-[11px] text-zinc-500 mt-0.5">{sub}</p>}
        </div>
      </div>
    </motion.div>
  );
}

// ── Empty State ─────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] mb-4">
        <Icon className="w-8 h-8 text-zinc-600" />
      </div>
      <h3 className="text-sm font-semibold text-zinc-400 mb-1">{title}</h3>
      <p className="text-xs text-zinc-600 max-w-[280px]">{description}</p>
    </div>
  );
}

// ── Quote Card ──────────────────────────────────────────────────────────
function QuoteCard({ quote, margin, onSelect, isSelected }: {
  quote: any; margin: any; onSelect: () => void; isSelected: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      className={`${GLASS} rounded-xl overflow-hidden transition-all duration-300 ${
        isSelected ? 'border-emerald-500/40 ring-1 ring-emerald-500/20' : GLASS_HOVER
      }`}
    >
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
              <Bus className="w-4 h-4 text-zinc-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Partner #{quote.partner_id?.slice(-6)}</p>
              <p className="text-[11px] text-zinc-500">{relTime(quote.created_at)}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] text-zinc-500 uppercase">Partner Price</p>
              <p className="text-sm font-bold text-white">{money(quote.quoted_price)}</p>
            </div>
            {margin && (
              <div className="text-right">
                <p className="text-[10px] text-zinc-500 uppercase">Customer Price</p>
                <p className="text-sm font-bold" style={{ color: GOLD }}>{money(margin.final_customer_price)}</p>
              </div>
            )}
            {margin && (
              <div className="text-right">
                <p className="text-[10px] text-zinc-500 uppercase">Margin</p>
                <p className={`text-sm font-bold ${Number(margin.expected_margin_percentage) >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {Number(margin.expected_margin_percentage).toFixed(1)}%
                </p>
              </div>
            )}
            <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-white/[0.06] pt-3 space-y-3">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Vehicle', value: quote.vehicle_type || '—' },
                  { label: 'Capacity', value: quote.capacity ? `${quote.capacity} seats` : '—' },
                  { label: 'Deposit', value: quote.deposit_required > 0 ? money(quote.deposit_required) : 'None' },
                  { label: 'Response', value: quote.response_time_seconds ? `${Math.round(quote.response_time_seconds / 60)}min` : '—' },
                ].map((item, i) => (
                  <div key={i} className="bg-white/[0.02] rounded-lg p-2.5">
                    <p className="text-[10px] text-zinc-500 uppercase">{item.label}</p>
                    <p className="text-xs font-semibold text-white mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
              {quote.amenities?.length > 0 && (
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase mb-1.5">Amenities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {quote.amenities.map((a: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] text-zinc-300">{a}</span>
                    ))}
                  </div>
                </div>
              )}
              {quote.quote_notes && (
                <div className="bg-white/[0.02] rounded-lg p-3">
                  <p className="text-[10px] text-zinc-500 uppercase mb-1">Notes</p>
                  <p className="text-xs text-zinc-300">{quote.quote_notes}</p>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onSelect(); }}
                  disabled={isSelected}
                  className={isSelected
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-[#C9A84C] hover:bg-[#b8973f] text-black font-semibold'
                  }
                >
                  {isSelected ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Selected</> : <><Trophy className="w-3 h-3 mr-1" /> Select Winner</>}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Timeline Step ───────────────────────────────────────────────────────
function TimelineStep({ label, time, active, completed }: {
  label: string; time?: string; active?: boolean; completed?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
        completed ? 'bg-emerald-500' : active ? 'bg-[#C9A84C] animate-pulse' : 'bg-zinc-700'
      }`} />
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-medium ${completed ? 'text-emerald-400' : active ? 'text-white' : 'text-zinc-600'}`}>{label}</p>
      </div>
      {time && (
        <p className="text-[10px] text-zinc-600 shrink-0">{relTime(time)}</p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
export default function PenthouseCoachBusDispatch() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [showNewRequest, setShowNewRequest] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────
  const { data: requests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ['cb-requests'],
    queryFn: async () => {
      const { data } = await supabase.from('cb_booking_requests').select('*').order('created_at', { ascending: false }).limit(100);
      return data || [];
    },
    refetchInterval: 15000,
  });

  const { data: kpis } = useQuery({
    queryKey: ['cb-kpis'],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke('cb-dispatch-engine', { body: { action: 'kpis' } });
      return data?.kpis;
    },
    refetchInterval: 30000,
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ['cb-quotes', selectedRequest],
    queryFn: async () => {
      if (!selectedRequest) return [];
      const { data } = await supabase.from('cb_partner_quotes').select('*').eq('booking_request_id', selectedRequest).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!selectedRequest,
  });

  const { data: margins = [] } = useQuery({
    queryKey: ['cb-margins', selectedRequest],
    queryFn: async () => {
      if (!selectedRequest) return [];
      const { data } = await supabase.from('cb_quote_margins').select('*').eq('booking_request_id', selectedRequest);
      return data || [];
    },
    enabled: !!selectedRequest,
  });

  const { data: dispatches = [] } = useQuery({
    queryKey: ['cb-dispatches', selectedRequest],
    queryFn: async () => {
      if (!selectedRequest) return [];
      const { data } = await supabase.from('cb_request_partner_dispatches').select('*').eq('booking_request_id', selectedRequest).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!selectedRequest,
  });

  const { data: commLogs = [] } = useQuery({
    queryKey: ['cb-comms', selectedRequest],
    queryFn: async () => {
      if (!selectedRequest) return [];
      const { data } = await supabase.from('cb_communication_logs').select('*').eq('booking_request_id', selectedRequest).order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!selectedRequest,
  });

  // ── Mutations ─────────────────────────────────────────────────────
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
      toast.success(`Dispatched to ${data.dispatched} partners`);
      queryClient.invalidateQueries({ queryKey: ['cb-requests'] });
      queryClient.invalidateQueries({ queryKey: ['cb-dispatches'] });
      queryClient.invalidateQueries({ queryKey: ['cb-kpis'] });
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
      toast.success(`Winner selected – Customer price: ${money(data.customer_price)}`);
      queryClient.invalidateQueries({ queryKey: ['cb-requests'] });
      queryClient.invalidateQueries({ queryKey: ['cb-quotes'] });
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
      toast.success('Customer offer sent!');
      queryClient.invalidateQueries({ queryKey: ['cb-requests'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Filters ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return requests.filter((r: any) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          r.pickup_city?.toLowerCase().includes(s) ||
          r.dropoff_city?.toLowerCase().includes(s) ||
          r.customer_name?.toLowerCase().includes(s) ||
          r.id?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [requests, statusFilter, search]);

  const activeRequest = useMemo(() => {
    return requests.find((r: any) => r.id === selectedRequest);
  }, [requests, selectedRequest]);

  const marginMap = useMemo(() => {
    const map: Record<string, any> = {};
    margins.forEach((m: any) => { map[m.quote_id] = m; });
    return map;
  }, [margins]);

  // ── Status counts ─────────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    requests.forEach((r: any) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return counts;
  }, [requests]);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-black">
        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-30 border-b border-white/[0.06] bg-black/80 backdrop-blur-2xl">
          <div className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ backgroundColor: `${GOLD}15` }}>
                <Bus className="w-5 h-5" style={{ color: GOLD }} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">Coach Bus Dispatch Command</h1>
                <p className="text-[11px] text-zinc-500">Nationwide Transportation Brokerage Engine</p>
              </div>
              <span className="flex items-center gap-1.5 ml-3 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Live</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-white/10 text-zinc-300 hover:bg-white/[0.04] text-xs"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['cb-requests'] });
                  queryClient.invalidateQueries({ queryKey: ['cb-kpis'] });
                }}
              >
                <RefreshCw className="w-3 h-3 mr-1.5" /> Refresh
              </Button>
              <Button
                size="sm"
                className="text-xs font-semibold"
                style={{ backgroundColor: GOLD, color: '#000' }}
                onClick={() => setShowNewRequest(true)}
              >
                <Zap className="w-3 h-3 mr-1.5" /> New Request
              </Button>
            </div>
          </div>
        </div>

        {/* ── KPI STRIP ──────────────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-3">
          <div className="grid grid-cols-6 gap-3">
            <KPICard icon={Package} label="Open Requests" value={kpis?.open_requests ?? 0} pulse={kpis?.open_requests > 0} color="#3b82f6" />
            <KPICard icon={Clock} label="Awaiting Quotes" value={kpis?.awaiting_quotes ?? 0} color="#a855f7" />
            <KPICard icon={FileText} label="Quotes Today" value={kpis?.quotes_received_today ?? 0} color="#06b6d4" />
            <KPICard icon={Target} label="Selection Rate" value={`${kpis?.selection_rate ?? 0}%`} color={GOLD} />
            <KPICard icon={CheckCircle2} label="Confirmation Rate" value={`${kpis?.confirmation_rate ?? 0}%`} color="#22c55e" />
            <KPICard icon={DollarSign} label="Avg Margin" value={`${kpis?.avg_gross_margin ?? 0}%`} sub="Across all quotes" color={GOLD} />
          </div>
        </div>

        {/* ── FILTER BAR ─────────────────────────────────────────────── */}
        <div className="px-6 py-2 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <Input
              placeholder="Search requests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-xs bg-white/[0.03] border-white/[0.08] text-white placeholder:text-zinc-600"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {['all', 'new', 'awaiting_quotes', 'quotes_received', 'selected', 'confirmed'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-all ${
                  statusFilter === s
                    ? 'bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/30'
                    : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                }`}
              >
                {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s}
                {s !== 'all' && statusCounts[s] ? ` (${statusCounts[s]})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* ── MAIN CONTENT ───────────────────────────────────────────── */}
        <div className="px-6 pb-6 flex gap-4" style={{ height: 'calc(100vh - 230px)' }}>
          {/* ── LEFT: Request Queue ──────────────────────────────────── */}
          <div className="w-[380px] shrink-0 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Request Queue</p>
              <p className="text-[10px] text-zinc-600">{filtered.length} requests</p>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {loadingRequests ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`${GLASS} rounded-xl p-4 animate-pulse`}>
                    <div className="h-3 w-24 bg-white/[0.06] rounded mb-2" />
                    <div className="h-2 w-40 bg-white/[0.04] rounded" />
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <EmptyState icon={Bus} title="No Requests" description="Create a new coach bus request to begin dispatching to partners." />
              ) : (
                filtered.map((r: any) => (
                  <motion.div
                    key={r.id}
                    layout
                    onClick={() => setSelectedRequest(r.id)}
                    className={`${GLASS} rounded-xl p-3.5 cursor-pointer transition-all duration-200 ${
                      selectedRequest === r.id ? 'border-[#C9A84C]/40 ring-1 ring-[#C9A84C]/20' : GLASS_HOVER
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                        <p className="text-sm font-semibold text-white">
                          {r.pickup_city || 'TBD'} → {r.dropoff_city || 'TBD'}
                        </p>
                      </div>
                      <StatusChip status={r.status} />
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {r.passenger_count || '—'} pax
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {r.trip_date || 'TBD'}
                      </span>
                      {r.customer_offer_price && (
                        <span className="flex items-center gap-1 font-semibold" style={{ color: GOLD }}>
                          <DollarSign className="w-3 h-3" /> {money(r.customer_offer_price)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[10px] text-zinc-600">{r.customer_name || 'Unknown'}</p>
                      <Tooltip>
                        <TooltipTrigger>
                          <p className="text-[10px] text-zinc-600">{relTime(r.created_at)}</p>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px]">
                          {new Date(r.created_at).toLocaleString()}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* ── RIGHT: Detail Panel ─────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {!selectedRequest || !activeRequest ? (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  icon={Eye}
                  title="Select a Request"
                  description="Click on a request from the queue to view details, manage quotes, and dispatch partners."
                />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                {/* ── Actions Bar ────────────────────────────────────── */}
                <div className={`${GLASS} rounded-xl p-3 flex items-center justify-between sticky top-0 z-10`}>
                  <div className="flex items-center gap-3">
                    <StatusChip status={activeRequest.status} />
                    <span className="text-xs text-zinc-500">ID: {activeRequest.id.slice(0, 8)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {['new', 'quotes_received'].includes(activeRequest.status) && (
                      <Button
                        size="sm"
                        className="text-xs font-semibold"
                        style={{ backgroundColor: GOLD, color: '#000' }}
                        disabled={dispatchMutation.isPending}
                        onClick={() => dispatchMutation.mutate(activeRequest.id)}
                      >
                        <Send className="w-3 h-3 mr-1" />
                        {dispatchMutation.isPending ? 'Dispatching...' : activeRequest.status === 'new' ? 'Dispatch to Partners' : 'Redispatch'}
                      </Button>
                    )}
                    {activeRequest.status === 'selected' && (
                      <Button
                        size="sm"
                        className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={sendOfferMutation.isPending}
                        onClick={() => sendOfferMutation.mutate(activeRequest.id)}
                      >
                        <Mail className="w-3 h-3 mr-1" />
                        {sendOfferMutation.isPending ? 'Sending...' : 'Send Customer Offer'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* ── Trip Details ───────────────────────────────────── */}
                <div className={`${GLASS} rounded-xl p-4`}>
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4" style={{ color: GOLD }} />
                    <h3 className="text-sm font-semibold text-white">Trip Details</h3>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Pickup', value: `${activeRequest.pickup_city || '—'}${activeRequest.pickup_state ? `, ${activeRequest.pickup_state}` : ''}` },
                      { label: 'Dropoff', value: `${activeRequest.dropoff_city || '—'}${activeRequest.dropoff_state ? `, ${activeRequest.dropoff_state}` : ''}` },
                      { label: 'Date', value: activeRequest.trip_date || '—' },
                      { label: 'Time', value: activeRequest.trip_time || '—' },
                      { label: 'Passengers', value: activeRequest.passenger_count || '—' },
                      { label: 'Trip Type', value: activeRequest.trip_type || 'One Way' },
                      { label: 'Bus Preference', value: activeRequest.bus_type_preference || '—' },
                      { label: 'Customer', value: activeRequest.customer_name || '—' },
                    ].map((item, i) => (
                      <div key={i} className="bg-white/[0.02] rounded-lg p-2.5">
                        <p className="text-[10px] text-zinc-500 uppercase">{item.label}</p>
                        <p className="text-xs font-semibold text-white mt-0.5">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  {activeRequest.special_requests && (
                    <div className="mt-3 bg-white/[0.02] rounded-lg p-3">
                      <p className="text-[10px] text-zinc-500 uppercase mb-1">Special Requests</p>
                      <p className="text-xs text-zinc-300">{activeRequest.special_requests}</p>
                    </div>
                  )}
                </div>

                {/* ── Timeline ───────────────────────────────────────── */}
                <div className={`${GLASS} rounded-xl p-4`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4" style={{ color: GOLD }} />
                    <h3 className="text-sm font-semibold text-white">Request Lifecycle</h3>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: 'Request Created', time: activeRequest.created_at, status: 'new' },
                      { label: 'Partners Dispatched', time: dispatches[0]?.sent_at, status: 'dispatching' },
                      { label: 'Awaiting Quotes', status: 'awaiting_quotes' },
                      { label: 'Quotes Received', status: 'quotes_received' },
                      { label: 'Quote Selected', status: 'selected' },
                      { label: 'Customer Notified', time: activeRequest.customer_offer_sent_at, status: 'customer_review' },
                      { label: 'Confirmed', time: activeRequest.customer_approved_at, status: 'confirmed' },
                    ].map((step, i) => {
                      const statusOrder = ['new', 'dispatching', 'awaiting_quotes', 'quotes_received', 'customer_review', 'selected', 'confirmed'];
                      const currentIdx = statusOrder.indexOf(activeRequest.status);
                      const stepIdx = statusOrder.indexOf(step.status);
                      return (
                        <TimelineStep
                          key={i}
                          label={step.label}
                          time={step.time}
                          completed={stepIdx < currentIdx}
                          active={stepIdx === currentIdx}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* ── Dispatches ─────────────────────────────────────── */}
                {dispatches.length > 0 && (
                  <div className={`${GLASS} rounded-xl p-4`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Send className="w-4 h-4" style={{ color: GOLD }} />
                        <h3 className="text-sm font-semibold text-white">Partner Dispatches</h3>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-white/10 text-zinc-400">
                        {dispatches.length} partners
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      {dispatches.slice(0, 10).map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/[0.02]">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              d.status === 'responded' ? 'bg-emerald-500' :
                              d.status === 'sent' ? 'bg-blue-500' :
                              d.status === 'failed' ? 'bg-red-500' : 'bg-zinc-600'
                            }`} />
                            <span className="text-xs text-white">{d.partner_name || `Partner #${d.partner_id?.slice(-6)}`}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                            <span className="flex items-center gap-1">
                              {d.channel?.includes('sms') && <Phone className="w-2.5 h-2.5" />}
                              {d.channel?.includes('email') && <Mail className="w-2.5 h-2.5" />}
                            </span>
                            <span className="uppercase font-semibold">{d.status}</span>
                            <span>{relTime(d.sent_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Quotes ─────────────────────────────────────────── */}
                <div className={`${GLASS} rounded-xl p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" style={{ color: GOLD }} />
                      <h3 className="text-sm font-semibold text-white">Partner Quotes</h3>
                    </div>
                    {quotes.length > 0 && (
                      <Badge variant="outline" className="text-[10px] border-white/10 text-zinc-400">
                        {quotes.length} quotes
                      </Badge>
                    )}
                  </div>

                  {quotes.length === 0 ? (
                    <EmptyState icon={FileText} title="No Quotes Yet" description="Dispatch this request to partners to start collecting quotes." />
                  ) : (
                    <div className="space-y-2">
                      {quotes.map((q: any) => (
                        <QuoteCard
                          key={q.id}
                          quote={q}
                          margin={marginMap[q.id]}
                          isSelected={q.is_selected}
                          onSelect={() => selectQuoteMutation.mutate({ requestId: activeRequest.id, quoteId: q.id })}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Communication Log ──────────────────────────────── */}
                {commLogs.length > 0 && (
                  <div className={`${GLASS} rounded-xl p-4`}>
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="w-4 h-4" style={{ color: GOLD }} />
                      <h3 className="text-sm font-semibold text-white">Communication Log</h3>
                    </div>
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                      {commLogs.map((log: any) => (
                        <div key={log.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg bg-white/[0.02]">
                          <span className={`w-5 h-5 rounded flex items-center justify-center ${
                            log.channel === 'sms' ? 'bg-blue-500/10' : 'bg-purple-500/10'
                          }`}>
                            {log.channel === 'sms' ? <Phone className="w-2.5 h-2.5 text-blue-400" /> : <Mail className="w-2.5 h-2.5 text-purple-400" />}
                          </span>
                          <span className="text-xs text-zinc-300 flex-1 truncate">{log.content_preview}</span>
                          <span className={`text-[10px] font-semibold uppercase ${
                            log.delivery_status === 'sent' ? 'text-emerald-400' : 'text-red-400'
                          }`}>{log.delivery_status}</span>
                          <span className="text-[10px] text-zinc-600">{relTime(log.sent_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── NEW REQUEST DIALOG ─────────────────────────────────────── */}
        <NewRequestDialog open={showNewRequest} onOpenChange={setShowNewRequest} onCreated={(id) => {
          setSelectedRequest(id);
          queryClient.invalidateQueries({ queryKey: ['cb-requests'] });
          queryClient.invalidateQueries({ queryKey: ['cb-kpis'] });
        }} />
      </div>
    </TooltipProvider>
  );
}

// ── New Request Dialog ──────────────────────────────────────────────────
function NewRequestDialog({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState({
    customer_name: '', customer_email: '', customer_phone: '',
    pickup_city: '', pickup_state: '', dropoff_city: '', dropoff_state: '',
    trip_date: '', trip_time: '', passenger_count: '',
    trip_type: 'one_way', bus_type_preference: '', special_requests: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.customer_name || !form.pickup_city || !form.dropoff_city) {
      toast.error('Customer name, pickup city, and dropoff city are required');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('cb_booking_requests').insert({
        ...form,
        passenger_count: form.passenger_count ? parseInt(form.passenger_count) : 1,
        status: 'new',
      }).select('id').single();
      if (error) throw error;
      toast.success('Request created');
      onCreated(data.id);
      onOpenChange(false);
      setForm({ customer_name: '', customer_email: '', customer_phone: '', pickup_city: '', pickup_state: '', dropoff_city: '', dropoff_state: '', trip_date: '', trip_time: '', passenger_count: '', trip_type: 'one_way', bus_type_preference: '', special_requests: '' });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const F = ({ label, field, type = 'text', placeholder = '' }: { label: string; field: string; type?: string; placeholder?: string }) => (
    <div>
      <label className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider">{label}</label>
      <Input
        type={type}
        value={(form as any)[field]}
        onChange={(e) => setForm(prev => ({ ...prev, [field]: e.target.value }))}
        placeholder={placeholder}
        className="mt-1 h-8 text-xs bg-white/[0.03] border-white/[0.08] text-white"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0a0a] border-white/[0.08] text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bus className="w-4 h-4" style={{ color: GOLD }} />
            New Coach Bus Request
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-3 gap-3">
            <F label="Customer Name" field="customer_name" placeholder="Full name" />
            <F label="Email" field="customer_email" type="email" placeholder="email@example.com" />
            <F label="Phone" field="customer_phone" type="tel" placeholder="+1..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Pickup City" field="pickup_city" placeholder="Miami" />
            <F label="Pickup State" field="pickup_state" placeholder="FL" />
            <F label="Dropoff City" field="dropoff_city" placeholder="Orlando" />
            <F label="Dropoff State" field="dropoff_state" placeholder="FL" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <F label="Trip Date" field="trip_date" type="date" />
            <F label="Trip Time" field="trip_time" type="time" />
            <F label="Passengers" field="passenger_count" type="number" placeholder="40" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider">Trip Type</label>
              <select
                value={form.trip_type}
                onChange={(e) => setForm(prev => ({ ...prev, trip_type: e.target.value }))}
                className="w-full mt-1 h-8 text-xs bg-white/[0.03] border border-white/[0.08] text-white rounded-md px-2"
              >
                <option value="one_way">One Way</option>
                <option value="round_trip">Round Trip</option>
                <option value="multi_stop">Multi Stop</option>
                <option value="hourly">Hourly Charter</option>
              </select>
            </div>
            <F label="Bus Preference" field="bus_type_preference" placeholder="56-passenger, etc." />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider">Special Requests</label>
            <Textarea
              value={form.special_requests}
              onChange={(e) => setForm(prev => ({ ...prev, special_requests: e.target.value }))}
              placeholder="WiFi, luggage compartment, ADA accessible..."
              className="mt-1 text-xs bg-white/[0.03] border-white/[0.08] text-white min-h-[60px]"
            />
          </div>
          <Button
            className="w-full text-xs font-semibold"
            style={{ backgroundColor: GOLD, color: '#000' }}
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'Creating...' : 'Create Request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
