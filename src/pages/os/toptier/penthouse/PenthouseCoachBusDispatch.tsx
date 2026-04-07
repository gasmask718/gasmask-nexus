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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Bus, Send, DollarSign, Clock, Users, MapPin, TrendingUp,
  CheckCircle2, XCircle, AlertTriangle, Search, ChevronDown,
  ChevronRight, Zap, Eye, ArrowUpDown, BarChart3, Trophy,
  RefreshCw, MessageSquare, Mail, Phone, Star, Timer,
  CircleDot, Package, FileText, Sparkles, Target, Activity,
  Shield, ArrowRight, Gauge, Crown
} from 'lucide-react';

// ── Design Tokens ───────────────────────────────────────────────────────
const GOLD = '#C9A84C';
const GOLD_DIM = '#C9A84C80';
const SURFACE = 'bg-[#0A0A0A]';

const glass = (level: 1 | 2 | 3 = 1) => {
  const opacity = level === 1 ? '0.03' : level === 2 ? '0.05' : '0.08';
  const border = level === 1 ? '0.06' : level === 2 ? '0.08' : '0.12';
  return `backdrop-blur-xl bg-white/[${opacity}] border border-white/[${border}]`;
};

const GLASS_1 = 'backdrop-blur-xl bg-white/[0.03] border border-white/[0.06]';
const GLASS_2 = 'backdrop-blur-xl bg-white/[0.05] border border-white/[0.08]';
const GLASS_3 = 'backdrop-blur-xl bg-white/[0.08] border border-white/[0.12]';
const GLASS_HOVER = 'hover:border-white/[0.14] hover:bg-white/[0.06]';

// ── Status config ───────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; ring: string; icon: any; pulse?: boolean }> = {
  new: { label: 'New', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', ring: 'ring-blue-500/30', icon: CircleDot, pulse: true },
  dispatching: { label: 'Dispatching', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', ring: 'ring-amber-500/30', icon: Send, pulse: true },
  awaiting_quotes: { label: 'Awaiting Quotes', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', ring: 'ring-purple-500/30', icon: Clock, pulse: true },
  quotes_received: { label: 'Quotes In', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', ring: 'ring-cyan-500/30', icon: FileText },
  customer_review: { label: 'Customer Review', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', ring: 'ring-orange-500/30', icon: Eye },
  selected: { label: 'Selected', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', ring: 'ring-emerald-500/30', icon: CheckCircle2 },
  confirmed: { label: 'Confirmed', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', ring: 'ring-green-500/30', icon: CheckCircle2 },
  declined: { label: 'Declined', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', ring: 'ring-red-500/30', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20', ring: 'ring-zinc-500/30', icon: XCircle },
  expired: { label: 'Expired', color: 'text-zinc-500', bg: 'bg-zinc-600/10 border-zinc-600/20', ring: 'ring-zinc-600/30', icon: Timer },
};

function StatusChip({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  const Icon = cfg.icon;
  const sizeClasses = size === 'md' ? 'px-3 py-1.5 text-xs gap-2' : 'px-2.5 py-1 text-[11px] gap-1.5';
  return (
    <span className={`inline-flex items-center rounded-full font-semibold tracking-wide border ${cfg.bg} ${cfg.color} ${sizeClasses}`}>
      {cfg.pulse && <span className="relative flex h-2 w-2"><span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-50 ${cfg.color.replace('text-', 'bg-')}`} /><span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.color.replace('text-', 'bg-')}`} /></span>}
      {!cfg.pulse && <Icon className="w-3 h-3" />}
      {cfg.label}
    </span>
  );
}

// ── Live Clock ──────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-[11px] text-zinc-500 tracking-wider tabular-nums">
      {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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

// ── KPI Card (Premium) ─────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, sub, color = GOLD, pulse, delay = 0 }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string; pulse?: boolean; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`relative ${GLASS_2} rounded-2xl p-5 ${GLASS_HOVER} transition-all duration-300 group overflow-hidden`}
    >
      {/* Ambient glow */}
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl" style={{ backgroundColor: `${color}20` }} />
      
      {pulse && (
        <span className="absolute top-4 right-4 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: color }} />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: color }} />
        </span>
      )}
      <div className="relative flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl border" style={{ backgroundColor: `${color}10`, borderColor: `${color}20` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.1em] mb-1">{label}</p>
          <p className="text-2xl font-bold text-white tracking-tight font-mono">{value}</p>
          {sub && <p className="text-[11px] text-zinc-500 mt-1">{sub}</p>}
        </div>
      </div>
    </motion.div>
  );
}

// ── Empty State ─────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-3xl blur-xl" style={{ backgroundColor: `${GOLD}08` }} />
        <div className={`relative p-5 rounded-3xl ${GLASS_2}`}>
          <Icon className="w-10 h-10 text-zinc-600" />
        </div>
      </div>
      <h3 className="text-sm font-semibold text-zinc-400 mb-1.5">{title}</h3>
      <p className="text-xs text-zinc-600 max-w-[300px] leading-relaxed">{description}</p>
    </motion.div>
  );
}

// ── Quote Card (Premium) ───────────────────────────────────────────────
function QuoteCard({ quote, margin, onSelect, isSelected, isRecommended, index }: {
  quote: any; margin: any; onSelect: () => void; isSelected: boolean; isRecommended?: boolean; index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const marginPct = margin ? Number(margin.expected_margin_percentage) : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
        isSelected
          ? `${GLASS_3} border-emerald-500/40 ring-1 ring-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]`
          : `${GLASS_1} ${GLASS_HOVER}`
      }`}
    >
      {/* Recommended ribbon */}
      {isRecommended && !isSelected && (
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
      )}

      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isSelected ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/[0.04] border border-white/[0.06]'
            }`}>
              {isSelected ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Bus className="w-5 h-5 text-zinc-400" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">Partner #{quote.partner_id?.slice(-6)}</p>
                {isRecommended && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30` }}>
                    <Crown className="w-2.5 h-2.5" /> Best
                  </span>
                )}
                {isSelected && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                    <Trophy className="w-2.5 h-2.5" /> Winner
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">{quote.vehicle_type || 'Standard Coach'} · {relTime(quote.created_at)}</p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">Partner</p>
              <p className="text-sm font-bold text-white font-mono">{money(quote.quoted_price)}</p>
            </div>
            {margin && (
              <>
                <div className="text-right">
                  <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">Customer</p>
                  <p className="text-sm font-bold font-mono" style={{ color: GOLD }}>{money(margin.final_customer_price)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">Margin</p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className={`h-full rounded-full ${marginPct >= 25 ? 'bg-emerald-500' : marginPct >= 15 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(marginPct * 2, 100)}%` }} />
                    </div>
                    <p className={`text-sm font-bold font-mono ${marginPct >= 25 ? 'text-emerald-400' : marginPct >= 15 ? 'text-amber-400' : 'text-red-400'}`}>
                      {marginPct.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </>
            )}
            <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-white/[0.06] pt-4 space-y-3">
              <div className="grid grid-cols-4 gap-2.5">
                {[
                  { label: 'Vehicle Type', value: quote.vehicle_type || '—', icon: Bus },
                  { label: 'Capacity', value: quote.capacity ? `${quote.capacity} seats` : '—', icon: Users },
                  { label: 'Deposit', value: quote.deposit_required > 0 ? money(quote.deposit_required) : 'None', icon: Shield },
                  { label: 'Response Time', value: quote.response_time_seconds ? `${Math.round(quote.response_time_seconds / 60)}min` : '—', icon: Gauge },
                ].map((item, i) => (
                  <div key={i} className={`${GLASS_1} rounded-xl p-3`}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <item.icon className="w-3 h-3 text-zinc-600" />
                      <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">{item.label}</p>
                    </div>
                    <p className="text-xs font-bold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
              {margin && (
                <div className={`${GLASS_1} rounded-xl p-3`}>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-2">Margin Breakdown</p>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <p className="text-[10px] text-zinc-500">Partner Cost</p>
                      <p className="text-xs font-bold text-white font-mono">{money(margin.partner_quote_amount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500">Markup</p>
                      <p className="text-xs font-bold text-white font-mono">{margin.markup_type === 'percentage' ? `${margin.markup_value}%` : money(margin.markup_value)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500">Customer Price</p>
                      <p className="text-xs font-bold font-mono" style={{ color: GOLD }}>{money(margin.final_customer_price)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500">Net Margin</p>
                      <p className="text-xs font-bold text-emerald-400 font-mono">{money(margin.expected_margin_amount)}</p>
                    </div>
                  </div>
                </div>
              )}
              {quote.amenities?.length > 0 && (
                <div>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-2">Amenities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {quote.amenities.map((a: string, i: number) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[10px] text-zinc-300 font-medium">{a}</span>
                    ))}
                  </div>
                </div>
              )}
              {quote.quote_notes && (
                <div className={`${GLASS_1} rounded-xl p-3`}>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Partner Notes</p>
                  <p className="text-xs text-zinc-300 leading-relaxed">{quote.quote_notes}</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onSelect(); }}
                  disabled={isSelected}
                  className={`text-xs font-bold transition-all duration-300 ${isSelected
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                    : 'hover:scale-[1.02] shadow-lg'
                  }`}
                  style={!isSelected ? { backgroundColor: GOLD, color: '#000' } : undefined}
                >
                  {isSelected ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Selected Winner</> : <><Trophy className="w-3.5 h-3.5 mr-1.5" /> Select as Winner</>}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Timeline Step (Premium) ────────────────────────────────────────────
function TimelineStep({ label, time, active, completed, isLast }: {
  label: string; time?: string; active?: boolean; completed?: boolean; isLast?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`relative w-4 h-4 rounded-full shrink-0 flex items-center justify-center ${
          completed ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]' : active ? 'shadow-[0_0_12px_rgba(201,168,76,0.5)]' : 'bg-zinc-800 border border-zinc-700'
        }`} style={active ? { backgroundColor: GOLD } : undefined}>
          {completed && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
          {active && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
        </div>
        {!isLast && (
          <div className={`w-px flex-1 min-h-[20px] ${completed ? 'bg-emerald-500/40' : 'bg-zinc-800'}`} />
        )}
      </div>
      <div className={`pb-4 ${isLast ? '' : ''}`}>
        <p className={`text-xs font-semibold ${completed ? 'text-emerald-400' : active ? 'text-white' : 'text-zinc-600'}`}>{label}</p>
        {time && (
          <Tooltip>
            <TooltipTrigger>
              <p className="text-[10px] text-zinc-600 mt-0.5">{relTime(time)}</p>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-[10px]">{new Date(time).toLocaleString()}</TooltipContent>
          </Tooltip>
        )}
      </div>
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
      toast.success(`Auto-selected best quote – $${data.winner?.final_customer_price?.toLocaleString()}`);
      queryClient.invalidateQueries({ queryKey: ['cb-requests'] });
      queryClient.invalidateQueries({ queryKey: ['cb-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['cb-kpis'] });
    },
    onError: (e: Error) => toast.error('Auto-evaluation failed: ' + e.message),
  });


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

  const activeRequest = useMemo(() => requests.find((r: any) => r.id === selectedRequest), [requests, selectedRequest]);

  const marginMap = useMemo(() => {
    const map: Record<string, any> = {};
    margins.forEach((m: any) => { map[m.quote_id] = m; });
    return map;
  }, [margins]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    requests.forEach((r: any) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return counts;
  }, [requests]);

  // Find recommended (cheapest) quote
  const recommendedQuoteId = useMemo(() => {
    if (!quotes.length) return null;
    const sorted = [...quotes].filter((q: any) => q.quoted_price).sort((a: any, b: any) => a.quoted_price - b.quoted_price);
    return sorted[0]?.id || null;
  }, [quotes]);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#050505]">
        {/* ── AMBIENT BACKGROUND ──────────────────────────────────────── */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[400px] rounded-full blur-[120px] opacity-[0.03]" style={{ backgroundColor: GOLD }} />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] rounded-full blur-[100px] opacity-[0.02]" style={{ backgroundColor: '#3b82f6' }} />
        </div>

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#050505]/90 backdrop-blur-2xl">
          <div className="px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl blur-md" style={{ backgroundColor: `${GOLD}20` }} />
                <div className="relative p-2.5 rounded-2xl border" style={{ backgroundColor: `${GOLD}10`, borderColor: `${GOLD}25` }}>
                  <Bus className="w-6 h-6" style={{ color: GOLD }} />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-lg font-bold text-white tracking-tight">Coach Bus Dispatch Command</h1>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.12em]">Live</span>
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">Nationwide Transportation Brokerage · Quote Broadcast Engine</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <LiveClock />
              <div className="w-px h-5 bg-white/[0.06]" />
              <Button
                size="sm"
                variant="outline"
                className="border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.06] text-xs h-8"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['cb-requests'] });
                  queryClient.invalidateQueries({ queryKey: ['cb-kpis'] });
                }}
              >
                <RefreshCw className="w-3 h-3 mr-1.5" /> Sync
              </Button>
              <Button
                size="sm"
                className="text-xs font-bold h-8 shadow-lg"
                style={{ backgroundColor: GOLD, color: '#000' }}
                onClick={() => setShowNewRequest(true)}
              >
                <Zap className="w-3 h-3 mr-1.5" /> New Request
              </Button>
            </div>
          </div>
        </div>

        {/* ── KPI EXECUTIVE STRIP ─────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-4">
          <div className="grid grid-cols-6 gap-3">
            <KPICard icon={Package} label="Open Requests" value={kpis?.open_requests ?? 0} pulse={(kpis?.open_requests ?? 0) > 0} color="#3b82f6" delay={0} />
            <KPICard icon={Clock} label="Awaiting Quotes" value={kpis?.awaiting_quotes ?? 0} color="#a855f7" delay={0.05} />
            <KPICard icon={FileText} label="Quotes Today" value={kpis?.quotes_received_today ?? 0} color="#06b6d4" delay={0.1} />
            <KPICard icon={Target} label="Selection Rate" value={`${kpis?.selection_rate ?? 0}%`} color={GOLD} delay={0.15} />
            <KPICard icon={CheckCircle2} label="Confirmed" value={`${kpis?.confirmation_rate ?? 0}%`} color="#22c55e" delay={0.2} />
            <KPICard icon={DollarSign} label="Avg Margin" value={`${kpis?.avg_gross_margin ?? 0}%`} sub="Across all quotes" color={GOLD} delay={0.25} />
          </div>
        </div>

        {/* ── FILTER BAR ──────────────────────────────────────────────── */}
        <div className="px-6 pb-3 flex items-center gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
            <Input
              placeholder="Search by city, customer, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-white/[0.03] border-white/[0.08] text-white placeholder:text-zinc-600 rounded-xl focus:border-[#C9A84C]/30 focus:ring-[#C9A84C]/10"
            />
          </div>
          <div className="flex items-center gap-1">
            {['all', 'new', 'awaiting_quotes', 'quotes_received', 'selected', 'confirmed'].map(s => {
              const isActive = statusFilter === s;
              const count = s !== 'all' ? statusCounts[s] : undefined;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.08em] transition-all duration-200 ${
                    isActive
                      ? 'text-black shadow-lg'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
                  }`}
                  style={isActive ? { backgroundColor: GOLD } : undefined}
                >
                  {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s}
                  {count ? ` · ${count}` : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── MAIN CONTENT ────────────────────────────────────────────── */}
        <div className="px-6 pb-6 flex gap-4" style={{ height: 'calc(100vh - 260px)' }}>
          {/* ── LEFT: Request Queue ───────────────────────────────────── */}
          <div className="w-[400px] shrink-0 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em]">Request Queue</p>
              <span className="text-[10px] text-zinc-600 font-mono">{filtered.length} items</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#27272a transparent' }}>
              {loadingRequests ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={`${GLASS_1} rounded-2xl p-4 animate-pulse`}>
                    <div className="h-3 w-32 bg-white/[0.06] rounded-lg mb-3" />
                    <div className="h-2 w-48 bg-white/[0.04] rounded-lg" />
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <EmptyState icon={Bus} title="No Requests" description="Create a new coach bus request to begin dispatching to your partner network." />
              ) : (
                filtered.map((r: any, i: number) => (
                  <motion.div
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => setSelectedRequest(r.id)}
                    className={`rounded-2xl p-4 cursor-pointer transition-all duration-200 ${
                      selectedRequest === r.id
                        ? `${GLASS_3} border-[#C9A84C]/30 shadow-[0_0_30px_rgba(201,168,76,0.08)]`
                        : `${GLASS_1} ${GLASS_HOVER}`
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                        </div>
                        <p className="text-sm font-bold text-white truncate">
                          {r.pickup_city || 'TBD'} <ArrowRight className="w-3 h-3 inline text-zinc-600 mx-0.5" /> {r.dropoff_city || 'TBD'}
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
                        <span className="flex items-center gap-1 font-bold font-mono" style={{ color: GOLD }}>
                          <DollarSign className="w-3 h-3" /> {money(r.customer_offer_price)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/[0.04]">
                      <p className="text-[10px] text-zinc-600 font-medium">{r.customer_name || 'Unknown Customer'}</p>
                      <Tooltip>
                        <TooltipTrigger>
                          <p className="text-[10px] text-zinc-600 font-mono">{relTime(r.created_at)}</p>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px]">{new Date(r.created_at).toLocaleString()}</TooltipContent>
                      </Tooltip>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* ── RIGHT: Detail Panel ──────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {!selectedRequest || !activeRequest ? (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  icon={Eye}
                  title="Select a Request"
                  description="Click on a request from the queue to view full details, manage quotes, and dispatch to your partner network."
                />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#27272a transparent' }}>
                {/* ── Sticky Actions Bar ─────────────────────────────── */}
                <div className={`${GLASS_2} rounded-2xl p-4 sticky top-0 z-10`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusChip status={activeRequest.status} size="md" />
                      <div className="h-4 w-px bg-white/[0.08]" />
                      <span className="text-xs text-zinc-500 font-mono">#{activeRequest.id.slice(0, 8)}</span>
                      <span className="text-xs text-zinc-600">·</span>
                      <span className="text-xs text-zinc-500">{activeRequest.customer_name || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {['new', 'quotes_received'].includes(activeRequest.status) && (
                        <Button
                          size="sm"
                          className="text-xs font-bold h-8 shadow-lg hover:scale-[1.02] transition-transform"
                          style={{ backgroundColor: GOLD, color: '#000' }}
                          disabled={dispatchMutation.isPending}
                          onClick={() => dispatchMutation.mutate(activeRequest.id)}
                        >
                          <Send className="w-3.5 h-3.5 mr-1.5" />
                          {dispatchMutation.isPending ? 'Dispatching...' : activeRequest.status === 'new' ? 'Dispatch to Partners' : 'Redispatch'}
                        </Button>
                      )}
                      {['awaiting_quotes', 'quotes_received'].includes(activeRequest.status) && (
                        <Button
                          size="sm"
                          className="text-xs font-bold h-8 shadow-lg hover:scale-[1.02] transition-transform bg-violet-600 hover:bg-violet-500 text-white"
                          disabled={autoEvalMutation.isPending}
                          onClick={() => autoEvalMutation.mutate(activeRequest.id)}
                        >
                          <Zap className="w-3.5 h-3.5 mr-1.5" />
                          {autoEvalMutation.isPending ? 'Evaluating...' : 'Auto-Select Best'}
                        </Button>
                      {activeRequest.status === 'selected' && (
                        <Button
                          size="sm"
                          className="text-xs font-bold h-8 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg hover:scale-[1.02] transition-transform"
                          disabled={sendOfferMutation.isPending}
                          onClick={() => sendOfferMutation.mutate(activeRequest.id)}
                        >
                          <Mail className="w-3.5 h-3.5 mr-1.5" />
                          {sendOfferMutation.isPending ? 'Sending...' : 'Send Customer Offer'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Trip Details ────────────────────────────────────── */}
                <div className={`${GLASS_1} rounded-2xl p-5`}>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${GOLD}10` }}>
                      <MapPin className="w-4 h-4" style={{ color: GOLD }} />
                    </div>
                    <h3 className="text-sm font-bold text-white">Trip Details</h3>
                  </div>
                  <div className="grid grid-cols-4 gap-2.5">
                    {[
                      { label: 'Pickup', value: `${activeRequest.pickup_city || '—'}${activeRequest.pickup_state ? `, ${activeRequest.pickup_state}` : ''}`, icon: MapPin },
                      { label: 'Dropoff', value: `${activeRequest.dropoff_city || '—'}${activeRequest.dropoff_state ? `, ${activeRequest.dropoff_state}` : ''}`, icon: MapPin },
                      { label: 'Date', value: activeRequest.trip_date || '—', icon: Clock },
                      { label: 'Time', value: activeRequest.trip_time || '—', icon: Timer },
                      { label: 'Passengers', value: activeRequest.passenger_count || '—', icon: Users },
                      { label: 'Trip Type', value: activeRequest.trip_type || 'One Way', icon: ArrowUpDown },
                      { label: 'Bus Preference', value: activeRequest.bus_type_preference || '—', icon: Bus },
                      { label: 'Customer', value: activeRequest.customer_name || '—', icon: Star },
                    ].map((item, i) => (
                      <div key={i} className={`${GLASS_1} rounded-xl p-3`}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <item.icon className="w-3 h-3 text-zinc-600" />
                          <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">{item.label}</p>
                        </div>
                        <p className="text-xs font-bold text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  {activeRequest.special_requests && (
                    <div className={`mt-3 ${GLASS_1} rounded-xl p-3`}>
                      <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-1.5">Special Requests</p>
                      <p className="text-xs text-zinc-300 leading-relaxed">{activeRequest.special_requests}</p>
                    </div>
                  )}
                </div>

                {/* ── Timeline ────────────────────────────────────────── */}
                <div className={`${GLASS_1} rounded-2xl p-5`}>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${GOLD}10` }}>
                      <Activity className="w-4 h-4" style={{ color: GOLD }} />
                    </div>
                    <h3 className="text-sm font-bold text-white">Request Lifecycle</h3>
                  </div>
                  <div className="pl-1">
                    {[
                      { label: 'Request Created', time: activeRequest.created_at, status: 'new' },
                      { label: 'Partners Dispatched', time: dispatches[0]?.sent_at, status: 'dispatching' },
                      { label: 'Awaiting Quotes', status: 'awaiting_quotes' },
                      { label: 'Quotes Received', status: 'quotes_received' },
                      { label: 'Quote Selected', status: 'selected' },
                      { label: 'Customer Notified', time: activeRequest.customer_offer_sent_at, status: 'customer_review' },
                      { label: 'Booking Confirmed', time: activeRequest.customer_approved_at, status: 'confirmed' },
                    ].map((step, i, arr) => {
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
                          isLast={i === arr.length - 1}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* ── Dispatches ──────────────────────────────────────── */}
                {dispatches.length > 0 && (
                  <div className={`${GLASS_1} rounded-2xl p-5`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${GOLD}10` }}>
                          <Send className="w-4 h-4" style={{ color: GOLD }} />
                        </div>
                        <h3 className="text-sm font-bold text-white">Partner Dispatches</h3>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-500 font-mono">{dispatches.length} partners</span>
                    </div>
                    <div className="space-y-1.5">
                      {dispatches.slice(0, 12).map((d: any) => (
                        <div key={d.id} className={`flex items-center justify-between py-2 px-3 rounded-xl ${GLASS_1}`}>
                          <div className="flex items-center gap-2.5">
                            <span className={`w-2 h-2 rounded-full ${
                              d.status === 'responded' ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' :
                              d.status === 'sent' ? 'bg-blue-500' :
                              d.status === 'failed' ? 'bg-red-500' : 'bg-zinc-600'
                            }`} />
                            <span className="text-xs text-white font-medium">{d.partner_name || `Partner #${d.partner_id?.slice(-6)}`}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                            <span className="flex items-center gap-1">
                              {d.channel?.includes('sms') && <Phone className="w-2.5 h-2.5" />}
                              {d.channel?.includes('email') && <Mail className="w-2.5 h-2.5" />}
                            </span>
                            <span className={`uppercase font-bold tracking-wider ${
                              d.status === 'responded' ? 'text-emerald-400' : d.status === 'failed' ? 'text-red-400' : 'text-zinc-500'
                            }`}>{d.status}</span>
                            <span className="font-mono">{relTime(d.sent_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Quotes ──────────────────────────────────────────── */}
                <div className={`${GLASS_1} rounded-2xl p-5`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${GOLD}10` }}>
                        <DollarSign className="w-4 h-4" style={{ color: GOLD }} />
                      </div>
                      <h3 className="text-sm font-bold text-white">Partner Quotes</h3>
                    </div>
                    {quotes.length > 0 && (
                      <span className="text-[10px] font-bold text-zinc-500 font-mono">{quotes.length} quotes</span>
                    )}
                  </div>

                  {quotes.length === 0 ? (
                    <EmptyState icon={FileText} title="No Quotes Yet" description="Dispatch this request to partners to start collecting competitive quotes." />
                  ) : (
                    <div className="space-y-2.5">
                      {quotes.map((q: any, i: number) => (
                        <QuoteCard
                          key={q.id}
                          quote={q}
                          margin={marginMap[q.id]}
                          isSelected={q.is_selected}
                          isRecommended={q.id === recommendedQuoteId}
                          index={i}
                          onSelect={() => selectQuoteMutation.mutate({ requestId: activeRequest.id, quoteId: q.id })}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Communication Log ───────────────────────────────── */}
                {commLogs.length > 0 && (
                  <div className={`${GLASS_1} rounded-2xl p-5`}>
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${GOLD}10` }}>
                        <MessageSquare className="w-4 h-4" style={{ color: GOLD }} />
                      </div>
                      <h3 className="text-sm font-bold text-white">Communication Log</h3>
                    </div>
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#27272a transparent' }}>
                      {commLogs.map((log: any) => (
                        <div key={log.id} className={`flex items-center gap-3 py-2 px-3 rounded-xl ${GLASS_1}`}>
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                            log.channel === 'sms' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-purple-500/10 border border-purple-500/20'
                          }`}>
                            {log.channel === 'sms' ? <Phone className="w-2.5 h-2.5 text-blue-400" /> : <Mail className="w-2.5 h-2.5 text-purple-400" />}
                          </span>
                          <span className="text-xs text-zinc-300 flex-1 truncate">{log.content_preview}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            log.delivery_status === 'sent' ? 'text-emerald-400' : 'text-red-400'
                          }`}>{log.delivery_status}</span>
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="text-[10px] text-zinc-600 font-mono">{relTime(log.sent_at)}</span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-[10px]">{log.sent_at ? new Date(log.sent_at).toLocaleString() : '—'}</TooltipContent>
                          </Tooltip>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── NEW REQUEST DIALOG ──────────────────────────────────────── */}
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
      <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-[0.1em]">{label}</label>
      <Input
        type={type}
        value={(form as any)[field]}
        onChange={(e) => setForm(prev => ({ ...prev, [field]: e.target.value }))}
        placeholder={placeholder}
        className="mt-1 h-9 text-xs bg-white/[0.03] border-white/[0.08] text-white placeholder:text-zinc-700 rounded-xl focus:border-[#C9A84C]/30"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#080808] border-white/[0.08] text-white max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base font-bold">
            <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${GOLD}10`, border: `1px solid ${GOLD}25` }}>
              <Bus className="w-4 h-4" style={{ color: GOLD }} />
            </div>
            New Coach Bus Request
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-3">
          <div>
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-[0.12em] mb-2.5">Customer Information</p>
            <div className="grid grid-cols-3 gap-3">
              <F label="Name" field="customer_name" placeholder="Full name" />
              <F label="Email" field="customer_email" type="email" placeholder="email@example.com" />
              <F label="Phone" field="customer_phone" type="tel" placeholder="+1..." />
            </div>
          </div>
          <div>
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-[0.12em] mb-2.5">Route</p>
            <div className="grid grid-cols-2 gap-3">
              <F label="Pickup City" field="pickup_city" placeholder="Miami" />
              <F label="Pickup State" field="pickup_state" placeholder="FL" />
              <F label="Dropoff City" field="dropoff_city" placeholder="Orlando" />
              <F label="Dropoff State" field="dropoff_state" placeholder="FL" />
            </div>
          </div>
          <div>
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-[0.12em] mb-2.5">Trip Details</p>
            <div className="grid grid-cols-3 gap-3">
              <F label="Date" field="trip_date" type="date" />
              <F label="Time" field="trip_time" type="time" />
              <F label="Passengers" field="passenger_count" type="number" placeholder="40" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-[0.1em]">Trip Type</label>
              <select
                value={form.trip_type}
                onChange={(e) => setForm(prev => ({ ...prev, trip_type: e.target.value }))}
                className="w-full mt-1 h-9 text-xs bg-white/[0.03] border border-white/[0.08] text-white rounded-xl px-3"
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
            <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-[0.1em]">Special Requests</label>
            <Textarea
              value={form.special_requests}
              onChange={(e) => setForm(prev => ({ ...prev, special_requests: e.target.value }))}
              placeholder="WiFi, luggage compartment, ADA accessible..."
              className="mt-1 text-xs bg-white/[0.03] border-white/[0.08] text-white min-h-[60px] rounded-xl placeholder:text-zinc-700"
            />
          </div>
          <Button
            className="w-full text-xs font-bold h-10 rounded-xl shadow-lg hover:scale-[1.01] transition-transform"
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
