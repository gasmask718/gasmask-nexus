import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Target, 
  Search,
  Store,
  Package,
  ShoppingCart,
  Sparkles,
  UserX,
  Gift,
  RefreshCw,
  ExternalLink,
  User,
  Clock,
  Lightbulb,
  CheckCircle2,
  Circle,
  Eye,
  AlertCircle,
  X,
  HelpCircle,
  Check,
  ThumbsUp,
  ThumbsDown,
  Sticker,
  Repeat,
  MessageSquare,
  Phone,
  Brain,
  Truck,
  TrendingUp,
  ArrowLeftRight,
  Zap,
  Loader2,
} from 'lucide-react';
import { format, isToday, isThisWeek, formatDistanceToNow } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGlobalTubeIntelligence, useTubeIntelSummary, TUBE_BRANDS } from '@/hooks/useTubeIntelligence';
import { useStickerSummary } from '@/hooks/useBrandStickers';
import { useStoreOpportunities, useOpportunitiesSummary, useCompleteOpportunity, useReopenOpportunity } from '@/hooks/useStoreOpportunities';
import { ExportButton } from '@/components/crud/ExportButton';
import { DataTablePagination } from '@/components/crud/DataTablePagination';
import { Checkbox } from '@/components/ui/checkbox';
import { RouteAssignmentDialog } from '@/components/delivery/RouteAssignmentDialog';
import { toast } from 'sonner';

type MainTab = 'signals' | 'opportunities' | 'messaging' | 'dialer' | 'visits' | 'ready-close' | 'ai-opps';
type SignalTab = 'all' | 'needs_order' | 'bring_samples' | 'starter_kit' | 'switch_tubes' | 'interested' | 'not_interested';
type TimeFilter = 'all' | 'today' | 'this_week';
type OpportunityFilter = 'all' | 'pending' | 'completed';

interface StoreIntelRow {
  id: string;
  store_id: string;
  store_name: string;
  brand_id: string;
  brand_name: string;
  product_introduced: boolean;
  owner_interested: boolean | null;
  needs_order: boolean;
  bring_samples: boolean;
  bring_starter_kit: boolean;
  needs_switch: boolean;
  switch_quantity: number | null;
  has_ever_ordered: boolean;
  last_order_date: string | null;
  last_updated_by: string | null;
  last_updated_by_role: string | null;
  last_updated_at: string;
  city: string | null;
  borough: string | null;
}

// ── Opportunity card used across all new tabs ──
interface OpportunityItem {
  id: string;
  name: string;
  brand?: string;
  city?: string;
  state?: string;
  phone?: string;
  urgency?: 'critical' | 'high' | 'normal';
  signal?: string;
  message?: string;
  context?: string;
  timeAgo?: string;
  source?: string;
  primaryAction?: string;
  primaryActionLabel?: string;
  raw?: any;
}

const URGENCY_STYLES: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/30',
  high: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  normal: 'bg-muted text-muted-foreground border-border',
};

function OpportunityCard({
  opp,
  onAction,
}: {
  opp: OpportunityItem;
  onAction: (type: string, opp: OpportunityItem) => void;
}) {
  return (
    <div
      className={`rounded-lg border p-3 transition-all hover:shadow-sm ${
        opp.urgency === 'critical'
          ? 'border-l-2 border-l-destructive border-border'
          : opp.urgency === 'high'
          ? 'border-l-2 border-l-amber-500 border-border'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-sm truncate">{opp.name}</span>
            {opp.brand && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-border bg-muted text-muted-foreground flex-shrink-0">
                {opp.brand}
              </span>
            )}
            {opp.urgency && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${URGENCY_STYLES[opp.urgency] || URGENCY_STYLES.normal}`}>
                {opp.urgency}
              </span>
            )}
          </div>

          {/* Location */}
          <div className="text-xs text-muted-foreground mb-2">
            {[opp.city, opp.state].filter(Boolean).join(', ')}
            {opp.context && <span className="ml-2">· {opp.context}</span>}
          </div>

          {/* Signal */}
          {opp.signal && (
            <div className="text-[11px] bg-muted/50 rounded px-2 py-1 mb-2 italic text-muted-foreground">
              💡 {opp.signal}
            </div>
          )}

          {/* Message preview */}
          {opp.message && (
            <div className="text-[11px] bg-primary/5 border border-primary/20 rounded px-2 py-1 mb-2">
              <span className="text-primary font-medium">Reply: </span>
              &ldquo;{opp.message.substring(0, 120)}{opp.message.length > 120 ? '…' : ''}&rdquo;
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[10px] text-muted-foreground">
              {opp.timeAgo}
              {opp.source && (
                <span className="ml-1.5 px-1 py-0.5 rounded bg-muted text-[9px]">{opp.source}</span>
              )}
            </span>

            <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
              {opp.primaryAction && (
                <Button size="sm" className="h-7 text-[10px] px-2" onClick={() => onAction(opp.primaryAction!, opp)}>
                  {opp.primaryActionLabel}
                </Button>
              )}
              {opp.phone && (
                <>
                  <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => onAction('sms', opp)}>
                    <MessageSquare className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => onAction('call', opp)}>
                    <Phone className="h-3 w-3" />
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => onAction('route', opp)}>
                <Truck className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reusable list for opportunity items ──
function OpportunityList({
  items,
  onAction,
  emptyIcon: EmptyIcon,
  emptyText,
}: {
  items: OpportunityItem[];
  onAction: (type: string, opp: OpportunityItem) => void;
  emptyIcon?: any;
  emptyText?: string;
}) {
  if (!items.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {EmptyIcon && <EmptyIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />}
        <p className="text-sm">{emptyText || 'No items found'}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((opp) => (
        <OpportunityCard key={opp.id} opp={opp} onAction={onAction} />
      ))}
    </div>
  );
}

export default function MasterOpportunities() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── State ──
  const [mainTab, setMainTab] = useState<MainTab>('signals');
  const activeSignalTab: SignalTab = (searchParams.get('signal') as SignalTab) || 'all';
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [oppSearchQuery, setOppSearchQuery] = useState('');
  const [oppStatusFilter, setOppStatusFilter] = useState<OpportunityFilter>('pending');
  const [oppCurrentPage, setOppCurrentPage] = useState(1);
  const [oppPageSize, setOppPageSize] = useState(25);
  const [scanning, setScanning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedSignalStores, setSelectedSignalStores] = useState<string[]>([]);
  const [dispatchStores, setDispatchStores] = useState<string[] | null>(null);

  // ── Existing hooks ──
  const { data: signalSummary, isLoading: signalSummaryLoading } = useTubeIntelSummary();
  const { data: stickerSummary, isLoading: stickerSummaryLoading } = useStickerSummary();
  const { data: oppSummary, isLoading: oppSummaryLoading } = useOpportunitiesSummary();

  const signalFilters = useMemo(() => {
    switch (activeSignalTab) {
      case 'needs_order': return { needsOrder: true };
      case 'bring_samples': return { bringSamples: true };
      case 'starter_kit': return { bringStarterKit: true };
      case 'switch_tubes': return { needsSwitch: true };
      case 'interested': return { interested: true };
      case 'not_interested': return { notInterested: true };
      default: return {};
    }
  }, [activeSignalTab]);

  const { data: rawSignalData, isLoading: signalsLoading, refetch: refetchSignals } = useGlobalTubeIntelligence(signalFilters);
  const { data: rawOpportunities, isLoading: opportunitiesLoading, refetch: refetchOpportunities } = useStoreOpportunities();
  const completeOpportunity = useCompleteOpportunity();
  const reopenOpportunity = useReopenOpportunity();

  // ── GasMask store messaging (SEPARATE from Brandaro) ──
  const { data: gasmaskMessages } = useQuery({
    queryKey: ['gasmask-store-messages'],
    queryFn: async () => {
      const { data } = await supabase
        .from('communication_messages')
        .select('*')
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    refetchInterval: 30000,
  });

  const { data: dialerResults } = useQuery({
    queryKey: ['opp-dialer-results'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brandaro_intent_log')
        .select('*, brandaro_qualified_leads(id, business_name, phone_number, city, industry, pipeline_stage)')
        .in('intent', ['interested', 'positive', 'booking', 'question'])
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    refetchInterval: 30000,
  });

  const { data: visitTriggers } = useQuery({
    queryKey: ['opp-visit-triggers'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('gasmask_visit_triggers')
        .select('*')
        .in('trigger_type', ['first_visit', 'prospecting', 'merchandising', 'audit', 'compliance'])
        .eq('status', 'pending')
        .order('priority_score', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  const { data: readyToClose } = useQuery({
    queryKey: ['opp-ready-close'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brandaro_qualified_leads')
        .select('*')
        .in('pipeline_stage', ['booked', 'interested'])
        .gte('priority_score', 7)
        .order('priority_score', { ascending: false })
        .limit(30);
      return data || [];
    },
  });

  const { data: agentOpps } = useQuery({
    queryKey: ['opp-agent-insights'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('dynasty_agent_insights')
        .select('*')
        .eq('insight_type', 'opportunity')
        .eq('dismissed', false)
        .order('created_at', { ascending: false })
        .limit(30);
      return data || [];
    },
    refetchInterval: 60000,
  });

  // ── Realtime for GasMask store messages ──
  useEffect(() => {
    const channels = [
      supabase
        .channel('opp-gasmask-msgs-rt')
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'communication_messages',
          filter: 'direction=eq.inbound',
        }, () => {
          queryClient.invalidateQueries({ queryKey: ['gasmask-store-messages'] });
          toast.info('New GasMask store reply!', { duration: 5000 });
        })
        .subscribe(),
      supabase
        .channel('opp-intent-rt')
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'brandaro_intent_log',
        }, (payload: any) => {
          if (['interested', 'positive', 'booking'].includes(payload.new?.intent)) {
            queryClient.invalidateQueries({ queryKey: ['opp-dialer-results'] });
            toast.success('🎯 Interested lead detected!', { duration: 8000 });
          }
        })
        .subscribe(),
    ];
    return () => { channels.forEach((ch) => supabase.removeChannel(ch)); };
  }, [queryClient]);

  // ── Transform GasMask store messages into OpportunityItem ──
  const messagingItems: OpportunityItem[] = useMemo(() =>
    (gasmaskMessages || []).map((msg: any) => ({
      id: msg.id,
      name: msg.metadata?.store_name || msg.from_number || msg.phone_number || 'Unknown Store',
      city: msg.metadata?.city,
      phone: msg.phone_number || msg.from_number,
      urgency: 'high' as const,
      signal: 'GasMask store replied — needs response',
      message: msg.content,
      source: 'GasMask Store SMS',
      primaryAction: 'sms',
      primaryActionLabel: '📱 Reply',
      timeAgo: msg.created_at ? formatDistanceToNow(new Date(msg.created_at), { addSuffix: true }) : '',
      raw: msg,
    })), [gasmaskMessages]);

  const dialerItems: OpportunityItem[] = useMemo(() =>
    (dialerResults || []).map((entry: any) => ({
      id: entry.id,
      name: entry.brandaro_qualified_leads?.business_name || 'Unknown',
      city: entry.brandaro_qualified_leads?.city,
      phone: entry.brandaro_qualified_leads?.phone_number,
      urgency: (entry.intent === 'booking' ? 'critical' : entry.intent === 'interested' ? 'high' : 'normal') as OpportunityItem['urgency'],
      signal: `${entry.intent} — score: ${entry.intent_score}/10 — "${entry.reason || ''}"`,
      message: entry.message_text,
      source: 'AI Dialer',
      primaryAction: entry.intent === 'booking' ? 'book' : 'sms',
      primaryActionLabel: entry.intent === 'booking' ? '📅 Book Call' : '📱 Follow Up',
      timeAgo: entry.created_at ? formatDistanceToNow(new Date(entry.created_at), { addSuffix: true }) : '',
      raw: entry,
    })), [dialerResults]);

  const visitItems: OpportunityItem[] = useMemo(() =>
    (visitTriggers || []).map((t: any) => ({
      id: t.id,
      name: t.store_name,
      city: t.store_city,
      state: t.store_state,
      urgency: (t.urgency === 'critical' ? 'critical' : t.urgency === 'high' ? 'high' : 'normal') as OpportunityItem['urgency'],
      signal: t.trigger_notes || `${t.trigger_type?.replace(/_/g, ' ')} visit needed`,
      source: t.floor_source?.replace(/_/g, ' '),
      primaryAction: 'route',
      primaryActionLabel: '🚚 Schedule Visit',
      timeAgo: t.created_at ? formatDistanceToNow(new Date(t.created_at), { addSuffix: true }) : '',
      raw: t,
    })), [visitTriggers]);

  const closeItems: OpportunityItem[] = useMemo(() =>
    (readyToClose || []).map((lead: any) => ({
      id: lead.id,
      name: lead.business_name,
      city: lead.city,
      phone: lead.phone_number,
      urgency: (lead.priority_score >= 9 ? 'critical' : 'high') as OpportunityItem['urgency'],
      signal: `Stage: ${lead.pipeline_stage} · P${lead.priority_score} · ${lead.industry || ''}`,
      source: 'Brandaro CRM',
      primaryAction: 'call',
      primaryActionLabel: '📞 Close Call',
      raw: lead,
    })), [readyToClose]);

  const aiOppItems: OpportunityItem[] = useMemo(() =>
    (agentOpps || []).map((insight: any) => ({
      id: insight.id,
      name: insight.related_store || insight.brand || 'Multiple stores',
      brand: insight.brand,
      urgency: (insight.priority === 'critical' ? 'critical' : insight.priority === 'high' ? 'high' : 'normal') as OpportunityItem['urgency'],
      signal: insight.body,
      source: insight.agent_name,
      primaryAction: 'view',
      primaryActionLabel: '👁 View',
      timeAgo: insight.created_at ? formatDistanceToNow(new Date(insight.created_at), { addSuffix: true }) : '',
      raw: insight,
    })), [agentOpps]);

  // ── Action handler ──
  const handleAction = useCallback(async (actionType: string, opp: OpportunityItem) => {
    switch (actionType) {
      case 'sms':
        if (!opp.phone) { toast.error('No phone number'); return; }
        try {
          await supabase.functions.invoke('send-sms', {
            body: {
              to_number: opp.phone,
              message_body: `Hi ${opp.name}, we wanted to reach out regarding your account. Please give us a call when you get a chance!`,
              idempotency_key: `opp-${opp.id}-${Date.now()}`,
            },
          });
          toast.success('SMS sent');
        } catch (err: any) { toast.error(err.message); }
        break;
      case 'call':
        if (!opp.phone) { toast.error('No phone number'); return; }
        // Determine if GasMask store or Brandaro lead
        if (opp.source?.includes('GasMask') || opp.source?.includes('Store') ||
            opp.source?.includes('CRM') || opp.source?.includes('tube_intel') ||
            opp.source?.includes('floor') || opp.source?.includes('Auto Sync') ||
            opp.source?.includes('Account Health')) {
          // GasMask store AI call
          try {
            const { data } = await supabase.functions.invoke('gasmask-ai-caller', {
              body: {
                store_name: opp.name,
                store_phone: opp.phone,
                city: opp.city,
                call_purpose: opp.raw?.needs_order ? 'needs_order'
                  : opp.raw?.bring_samples ? 'bring_samples'
                  : opp.raw?.bring_starter_kit ? 'starter_kit'
                  : opp.raw?.needs_switch ? 'switch_tubes'
                  : 'follow_up',
              },
            });
            toast.success(`GasMask AI call initiated to ${opp.name}`);
          } catch (err: any) { toast.error(err.message); }
        } else {
          // Brandaro website lead — open tel: link
          window.open(`tel:${opp.phone}`);
        }
        break;
      case 'reply':
        navigate('/communication/messaging-hub');
        break;
      case 'book':
        if (!opp.phone) { toast.error('No phone number'); return; }
        try {
          await supabase.functions.invoke('send-sms', {
            body: {
              to_number: opp.phone,
              message_body: `Hi ${opp.name}! When is a good time for a quick call? Book here: https://calendly.com/brandarodigital-sales/website-strategy-call`,
              idempotency_key: `book-${opp.id}-${Date.now()}`,
            },
          });
          toast.success('Booking link sent');
        } catch (err: any) { toast.error(err.message); }
        break;
      case 'route':
        try {
          await supabase.functions.invoke('gasmask-route-agent', {
            body: {
              action: 'create_trigger',
              store_name: opp.name,
              store_city: opp.city,
              store_state: opp.state,
              store_phone: opp.phone,
              trigger_source: `All Opportunities — ${mainTab}`,
              trigger_type: 'follow_up',
              floor_source: 'floor1_crm',
              urgency: opp.urgency || 'normal',
              priority_score: 6,
              trigger_notes: opp.signal,
            },
          });
          toast.success('Visit trigger created');
        } catch (err: any) { toast.error(err.message); }
        break;
      case 'view':
        toast.info(opp.signal || 'No details');
        break;
    }
  }, [navigate, mainTab]);

  // ── AI Scan ──
  const runAIAnalysis = async () => {
    setScanning(true);
    toast.info('Running AI scan…');
    try {
      await supabase.functions.invoke('dynasty-agent-runner', { body: { agent_name: 'Account Health Agent' } });
      await supabase.functions.invoke('dynasty-agent-runner', { body: { agent_name: 'Revenue Intelligence Agent' } });
      queryClient.invalidateQueries({ queryKey: ['opp-agent-insights'] });
      toast.success('AI scan complete');
    } catch (err: any) { toast.error(err.message); }
    finally { setScanning(false); }
  };

  // ── Sync to Route Engine ──
  const runSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('gasmask-opportunity-sync');
      if (error) throw error;
      toast.success('Synced to Route Engine', {
        description: `${data?.total_triggers_created || 0} new triggers · ${data?.skipped_duplicates || 0} duplicates skipped`,
        duration: 6000,
      });
      queryClient.invalidateQueries({ queryKey: ['opp-visit-triggers'] });
      queryClient.invalidateQueries({ queryKey: ['gasmask-triggers-all'] });
    } catch (err: any) { toast.error(err.message); }
    finally { setSyncing(false); }
  };

  // ── Existing signal logic ──
  useEffect(() => { setCurrentPage(1); }, [activeSignalTab]);

  const signalRows: StoreIntelRow[] = useMemo(() => {
    if (!rawSignalData) return [];
    return rawSignalData.map((item: any) => ({
      id: item.id,
      store_id: item.store_id,
      store_name: item.store?.store_name || 'Unknown Store',
      brand_id: item.brand_id,
      brand_name: item.brand_name,
      product_introduced: item.product_introduced,
      owner_interested: item.owner_interested,
      needs_order: item.needs_order,
      bring_samples: item.bring_samples,
      bring_starter_kit: item.bring_starter_kit,
      needs_switch: item.needs_switch,
      switch_quantity: (item as any).switch_quantity || null,
      has_ever_ordered: item.has_ever_ordered,
      last_order_date: item.last_order_date,
      last_updated_by: item.last_updated_by,
      last_updated_by_role: item.last_updated_by_role,
      last_updated_at: item.last_updated_at,
      city: item.store?.city || null,
      borough: item.store?.borough_id || null,
    }));
  }, [rawSignalData]);

  const filteredSignalRows = useMemo(() => {
    return signalRows.filter((row) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!row.store_name.toLowerCase().includes(q) && !row.brand_name.toLowerCase().includes(q) && !(row.city?.toLowerCase().includes(q) ?? false) && !(row.borough?.toLowerCase().includes(q) ?? false)) return false;
      }
      if (brandFilter !== 'all' && row.brand_id !== brandFilter) return false;
      if (roleFilter !== 'all' && row.last_updated_by_role !== roleFilter) return false;
      if (timeFilter !== 'all') {
        const d = new Date(row.last_updated_at);
        if (timeFilter === 'today' && !isToday(d)) return false;
        if (timeFilter === 'this_week' && !isThisWeek(d)) return false;
      }
      return true;
    });
  }, [signalRows, searchQuery, brandFilter, roleFilter, timeFilter]);

  const filteredOpportunities = useMemo(() => {
    if (!rawOpportunities) return [];
    return rawOpportunities.filter((opp) => {
      if (oppSearchQuery) {
        const q = oppSearchQuery.toLowerCase();
        if (!opp.opportunity_text.toLowerCase().includes(q) && !(opp.store?.store_name?.toLowerCase().includes(q) ?? false)) return false;
      }
      if (oppStatusFilter === 'pending' && opp.is_completed) return false;
      if (oppStatusFilter === 'completed' && !opp.is_completed) return false;
      return true;
    });
  }, [rawOpportunities, oppSearchQuery, oppStatusFilter]);

  const signalTotalPages = Math.ceil(filteredSignalRows.length / pageSize);
  const paginatedSignalRows = filteredSignalRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const oppTotalPages = Math.ceil(filteredOpportunities.length / oppPageSize);
  const paginatedOpportunities = filteredOpportunities.slice((oppCurrentPage - 1) * oppPageSize, oppCurrentPage * oppPageSize);

  const handleFilterChange = () => setCurrentPage(1);
  const handleOppFilterChange = () => setOppCurrentPage(1);
  const handleViewStore = (storeId: string) => navigate(`/stores/${storeId}`);

  const handleSignalTabClick = useCallback((tab: SignalTab) => {
    if (tab === 'all') setSearchParams({});
    else setSearchParams({ signal: tab });
  }, [setSearchParams]);

  const handleClearFilter = useCallback(() => {
    setSearchParams({});
    setSearchQuery('');
    setBrandFilter('all');
    setRoleFilter('all');
    setTimeFilter('all');
  }, [setSearchParams]);

  const handleCompleteOpportunity = async (id: string) => {
    try { await completeOpportunity.mutateAsync({ id }); toast.success('Opportunity completed'); }
    catch { toast.error('Failed'); }
  };
  const handleReopenOpportunity = async (id: string) => {
    try { await reopenOpportunity.mutateAsync(id); toast.success('Reopened'); }
    catch { toast.error('Failed'); }
  };

  const getSignalBadges = (row: StoreIntelRow) => {
    const badges: JSX.Element[] = [];
    if (row.needs_order) badges.push(<Badge key="no" variant="default" className="bg-yellow-500 text-yellow-950 text-xs"><ShoppingCart className="h-3 w-3 mr-1" />Needs Order</Badge>);
    if (row.bring_samples) badges.push(<Badge key="bs" variant="default" className="bg-blue-500 text-white text-xs"><Package className="h-3 w-3 mr-1" />Bring Samples</Badge>);
    if (row.bring_starter_kit) badges.push(<Badge key="sk" variant="default" className="bg-purple-500 text-white text-xs"><Gift className="h-3 w-3 mr-1" />Starter Kit</Badge>);
    if (row.needs_switch) badges.push(<Badge key="sw" variant="default" className="bg-red-600 text-white text-xs"><Repeat className="h-3 w-3 mr-1" />Switch{row.switch_quantity ? ` (${row.switch_quantity})` : ' Required'}</Badge>);
    if (row.owner_interested === true) badges.push(<Badge key="int" variant="default" className="bg-green-500 text-white text-xs"><Check className="h-3 w-3 mr-1" />Interested</Badge>);
    if (row.owner_interested === false) badges.push(<Badge key="ni" variant="destructive" className="text-xs"><UserX className="h-3 w-3 mr-1" />Not Interested</Badge>);
    if (row.owner_interested === null) badges.push(<Badge key="na" variant="outline" className="border-gray-400 text-gray-600 text-xs"><HelpCircle className="h-3 w-3 mr-1" />Not Asked</Badge>);
    return badges;
  };

  const getRoleBadge = (role: string | null) => {
    if (!role) return null;
    const roleColors: Record<string, string> = { admin: 'bg-red-100 text-red-800', va: 'bg-orange-100 text-orange-800', ambassador: 'bg-green-100 text-green-800', biker: 'bg-blue-100 text-blue-800', driver: 'bg-gray-100 text-gray-800' };
    return <Badge variant="secondary" className={`text-xs ${roleColors[role] || ''}`}><User className="h-3 w-3 mr-1" />{role.charAt(0).toUpperCase() + role.slice(1)}</Badge>;
  };

  const signalExportColumns = [
    { key: 'store_name', label: 'Store Name' }, { key: 'brand_name', label: 'Brand' },
    { key: 'last_order_date', label: 'Last Order' }, { key: 'needs_order', label: 'Needs Order' },
    { key: 'bring_samples', label: 'Bring Samples' }, { key: 'bring_starter_kit', label: 'Starter Kit' },
    { key: 'needs_switch', label: 'Switch Tubes' }, { key: 'product_introduced', label: 'Introduced' },
    { key: 'owner_interested', label: 'Interested' }, { key: 'last_updated_by_role', label: 'Reported By' },
    { key: 'last_updated_at', label: 'Last Updated' },
  ];
  const oppExportColumns = [
    { key: 'store.store_name', label: 'Store Name' }, { key: 'opportunity_text', label: 'Opportunity' },
    { key: 'source', label: 'Source' }, { key: 'is_completed', label: 'Completed' }, { key: 'created_at', label: 'Created At' },
  ];

  const isLoading = signalsLoading || signalSummaryLoading || stickerSummaryLoading || opportunitiesLoading || oppSummaryLoading;

  // ── Opportunity score cards (top-level KPIs) ──
  const oppCards = [
    { icon: ShoppingCart, label: 'Needs Order', count: signalSummary?.needsOrder || 0, color: 'text-yellow-500', bg: 'bg-yellow-500/10', tab: 'signals' as MainTab, desc: 'Field signals' },
    { icon: MessageSquare, label: 'Store Replies', count: gasmaskMessages?.length || 0, color: 'text-blue-500', bg: 'bg-blue-500/10', tab: 'messaging' as MainTab, desc: 'GasMask store SMS', pulse: (gasmaskMessages?.length || 0) > 0 },
    { icon: Phone, label: 'Dialer Results', count: dialerResults?.length || 0, color: 'text-green-500', bg: 'bg-green-500/10', tab: 'dialer' as MainTab, desc: 'AI called, interested' },
    { icon: Package, label: 'Visit Triggers', count: visitTriggers?.length || 0, color: 'text-purple-500', bg: 'bg-purple-500/10', tab: 'visits' as MainTab, desc: 'Pending field visits' },
    { icon: TrendingUp, label: 'Ready to Close', count: readyToClose?.length || 0, color: 'text-emerald-500', bg: 'bg-emerald-500/10', tab: 'ready-close' as MainTab, desc: 'Booked/interested P7+' },
    { icon: Brain, label: 'AI Opps', count: agentOpps?.length || 0, color: 'text-violet-500', bg: 'bg-violet-500/10', tab: 'ai-opps' as MainTab, desc: 'Agent detected' },
    { icon: Lightbulb, label: 'Opportunities', count: oppSummary?.pending || 0, color: 'text-amber-500', bg: 'bg-amber-500/10', tab: 'opportunities' as MainTab, desc: 'Human-created' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            All Opportunities
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Store intelligence · Messaging signals · AI dialer results · All brands
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant={selectedSignalStores.length > 0 ? 'default' : 'outline'}
            className="gap-1.5 text-xs"
            disabled={selectedSignalStores.length === 0}
            onClick={() => setDispatchStores([...new Set(selectedSignalStores)])}
          >
            <Truck className="h-3.5 w-3.5" />
            Dispatch Selected{selectedSignalStores.length > 0 ? ` (${selectedSignalStores.length})` : ''}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            disabled={filteredSignalRows.length === 0}
            onClick={() => {
              const ids = [...new Set(filteredSignalRows.map((r) => r.store_id))];
              setDispatchStores(ids);
            }}
            title="Dispatch all stores matching current signal filter"
          >
            <Truck className="h-3.5 w-3.5" />
            Dispatch {activeSignalTab === 'all' ? 'All Filtered' : activeSignalTab.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())} ({[...new Set(filteredSignalRows.map((r) => r.store_id))].length})
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => navigate('/gasmask/route-engine')}>
            Route Engine →
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={runSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync Triggers
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={runAIAnalysis} disabled={scanning}>
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
            AI Scan
          </Button>
        </div>
      </div>

      {/* ── Score Cards ── */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {oppCards.map((card) => (
          <button
            key={card.tab}
            onClick={() => setMainTab(card.tab)}
            className={`flex-shrink-0 p-3 rounded-xl border transition-all text-left min-w-[120px] ${
              mainTab === card.tab
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border bg-card hover:bg-muted/50'
            }`}
          >
            <div className={`p-2 rounded-lg ${card.bg} w-fit mb-2 relative`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
              {card.pulse && <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-blue-500 animate-pulse" />}
            </div>
            <div className={`text-2xl font-bold ${card.color}`}>{card.count}</div>
            <div className="text-xs font-medium mt-0.5">{card.label}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{card.desc}</div>
          </button>
        ))}
      </div>

      {/* ── Main Tabs ── */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as MainTab)}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="signals" className="text-xs gap-1"><Sparkles className="h-3.5 w-3.5" />Store Intel</TabsTrigger>
          <TabsTrigger value="opportunities" className="text-xs gap-1"><Lightbulb className="h-3.5 w-3.5" />Opportunities</TabsTrigger>
          <TabsTrigger value="messaging" className="text-xs gap-1"><MessageSquare className="h-3.5 w-3.5" />Store Replies{gasmaskMessages?.length ? <Badge className="h-4 text-[9px] px-1 bg-blue-500 text-white border-0 ml-1">{gasmaskMessages.length}</Badge> : null}</TabsTrigger>
          <TabsTrigger value="dialer" className="text-xs gap-1"><Phone className="h-3.5 w-3.5" />Dialer</TabsTrigger>
          <TabsTrigger value="visits" className="text-xs gap-1"><Truck className="h-3.5 w-3.5" />Visits</TabsTrigger>
          <TabsTrigger value="ready-close" className="text-xs gap-1"><TrendingUp className="h-3.5 w-3.5" />Close</TabsTrigger>
          <TabsTrigger value="ai-opps" className="text-xs gap-1"><Brain className="h-3.5 w-3.5" />AI</TabsTrigger>
        </TabsList>

        {/* ── SIGNALS TAB (preserved) ── */}
        <TabsContent value="signals" className="space-y-6">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Signals Board — Observational Only</p>
              <p className="text-xs text-amber-700 mt-0.5">Field team observations for route planning and visit preparation</p>
            </div>
          </div>

          {/* Signal Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-7">
            {([
              { tab: 'needs_order' as SignalTab, label: 'Needs Order', count: signalSummary?.needsOrder || 0, color: 'text-yellow-600', ringColor: 'ring-yellow-500', Icon: ShoppingCart },
              { tab: 'bring_samples' as SignalTab, label: 'Bring Samples', count: signalSummary?.bringSamples || 0, color: 'text-blue-600', ringColor: 'ring-blue-500', Icon: Package },
              { tab: 'starter_kit' as SignalTab, label: 'Starter Kit', count: signalSummary?.bringStarterKit || 0, color: 'text-purple-600', ringColor: 'ring-purple-500', Icon: Gift },
              { tab: 'switch_tubes' as SignalTab, label: 'Switch Tubes', count: signalSummary?.needsSwitch || 0, color: 'text-red-600', ringColor: 'ring-red-600', Icon: Repeat, extra: (signalSummary?.totalSwitchQuantity ?? 0) > 0 ? `${signalSummary?.totalSwitchQuantity?.toLocaleString()} Tubes` : undefined },
              { tab: 'interested' as SignalTab, label: 'Interested', count: signalSummary?.interested || 0, color: 'text-green-600', ringColor: 'ring-green-500', Icon: ThumbsUp },
              { tab: 'not_interested' as SignalTab, label: 'Not Interested', count: signalSummary?.notInterested || 0, color: 'text-red-600', ringColor: 'ring-red-500', Icon: ThumbsDown },
            ]).map((item) => (
              <Card
                key={item.tab}
                className={`cursor-pointer transition-all hover:shadow-md ${activeSignalTab === item.tab ? `ring-2 ${item.ringColor} shadow-md` : 'hover:bg-muted/50'}`}
                onClick={() => handleSignalTabClick(item.tab)}
              >
                <CardContent className="pt-6 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                      <p className={`text-2xl font-bold ${item.color}`}>{item.count}</p>
                      {item.extra && <p className="text-xs text-red-500 mt-0.5">{item.extra}</p>}
                    </div>
                    <item.Icon className={`h-8 w-8 ${item.color} opacity-50`} />
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card className="hover:bg-muted/50 transition-all">
              <CardContent className="pt-6 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Sticker Compliance</p>
                    <p className="text-2xl font-bold text-emerald-600">{stickerSummary?.completionPercentage || 0}%</p>
                  </div>
                  <Sticker className="h-8 w-8 text-emerald-500 opacity-50" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{stickerSummary?.installedStickers || 0} / {stickerSummary?.totalStickers || 0} Installed</p>
              </CardContent>
            </Card>
          </div>

          {/* Active Filter */}
          {activeSignalTab !== 'all' && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
              <span className="text-sm text-muted-foreground">Filtering by:</span>
              <Badge variant="secondary" className="flex items-center gap-1">
                {activeSignalTab.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </Badge>
              <Button variant="ghost" size="sm" onClick={handleClearFilter} className="ml-auto text-xs">
                <X className="h-3 w-3 mr-1" />Clear
              </Button>
            </div>
          )}

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search stores, brands, or locations…" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); handleFilterChange(); }} className="pl-10" />
                </div>
                <Select value={brandFilter} onValueChange={(v) => { setBrandFilter(v); handleFilterChange(); }}>
                  <SelectTrigger className="w-full lg:w-[180px]"><SelectValue placeholder="All Brands" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Brands</SelectItem>
                    {TUBE_BRANDS.map((brand) => <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); handleFilterChange(); }}>
                  <SelectTrigger className="w-full lg:w-[180px]"><SelectValue placeholder="All Roles" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="ambassador">Ambassador</SelectItem>
                    <SelectItem value="biker">Biker</SelectItem>
                    <SelectItem value="driver">Driver</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="va">VA</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={timeFilter} onValueChange={(v) => { setTimeFilter(v as TimeFilter); handleFilterChange(); }}>
                  <SelectTrigger className="w-full lg:w-[180px]"><SelectValue placeholder="All Time" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Updated Today</SelectItem>
                    <SelectItem value="this_week">This Week</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  {activeSignalTab !== 'all' && <Button variant="outline" onClick={() => handleSignalTabClick('all')}>Clear</Button>}
                  <Button variant="outline" size="icon" onClick={() => refetchSignals()}><RefreshCw className="h-4 w-4" /></Button>
                  <ExportButton data={filteredSignalRows as any} filename="store-signals" columns={signalExportColumns} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Signal Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" />Signals ({filteredSignalRows.length})</CardTitle>
                <CardDescription>{activeSignalTab === 'all' ? 'All signals' : activeSignalTab.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {filteredSignalRows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No signals found</p>
                  <p className="text-sm mt-1">{searchQuery || brandFilter !== 'all' ? 'Try adjusting your filters' : 'Signals appear when field teams report store observations'}</p>
                </div>
              ) : (
                <>
                  <DataTablePagination currentPage={currentPage} totalPages={signalTotalPages} pageSize={pageSize} totalItems={filteredSignalRows.length} onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} />
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">
                            <Checkbox
                              checked={
                                paginatedSignalRows.length > 0 &&
                                paginatedSignalRows.every((r) => selectedSignalStores.includes(r.store_id))
                              }
                              onCheckedChange={(checked) => {
                                const pageIds = paginatedSignalRows.map((r) => r.store_id);
                                if (checked) {
                                  setSelectedSignalStores((prev) => [...new Set([...prev, ...pageIds])]);
                                } else {
                                  setSelectedSignalStores((prev) => prev.filter((id) => !pageIds.includes(id)));
                                }
                              }}
                              aria-label="Select all on page"
                            />
                          </TableHead>
                          <TableHead>Store</TableHead>
                          <TableHead>Brand</TableHead>
                          <TableHead>Last Order</TableHead>
                          <TableHead>Signals</TableHead>
                          <TableHead>Reported By</TableHead>
                          <TableHead>Last Updated</TableHead>
                          <TableHead className="w-[50px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedSignalRows.map((row) => (
                          <TableRow key={row.id} className="hover:bg-muted/50">
                            <TableCell>
                              <Checkbox
                                checked={selectedSignalStores.includes(row.store_id)}
                                onCheckedChange={(checked) => {
                                  setSelectedSignalStores((prev) =>
                                    checked
                                      ? [...new Set([...prev, row.store_id])]
                                      : prev.filter((id) => id !== row.store_id)
                                  );
                                }}
                                aria-label={`Select ${row.store_name}`}
                              />
                            </TableCell>
                            <TableCell>
                              <button onClick={() => handleViewStore(row.store_id)} className="font-medium text-left hover:text-primary transition-colors">{row.store_name}</button>
                              {(row.city || row.borough) && <p className="text-xs text-muted-foreground">{[row.borough, row.city].filter(Boolean).join(', ')}</p>}
                            </TableCell>
                            <TableCell><span className="font-medium">{row.brand_name}</span></TableCell>
                            <TableCell>{row.last_order_date ? <span className="text-sm">{format(new Date(row.last_order_date), 'MMM d, yyyy')}</span> : <span className="text-sm text-muted-foreground">Never</span>}</TableCell>
                            <TableCell><div className="flex flex-wrap gap-1">{getSignalBadges(row)}</div></TableCell>
                            <TableCell>{getRoleBadge(row.last_updated_by_role)}</TableCell>
                            <TableCell><div className="flex items-center gap-1 text-sm text-muted-foreground"><Clock className="h-3 w-3" />{format(new Date(row.last_updated_at), 'MMM d, h:mm a')}</div></TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => setDispatchStores([row.store_id])} className="h-8 w-8" title="Dispatch this store">
                                  <Truck className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleViewStore(row.store_id)} className="h-8 w-8"><ExternalLink className="h-4 w-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── OPPORTUNITIES TAB (preserved) ── */}
        <TabsContent value="opportunities" className="space-y-6">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
            <Lightbulb className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">Opportunities — Human-Created Action Candidates</p>
              <p className="text-xs text-green-700 mt-0.5">Manually created items requiring human review and follow-up</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{oppSummary?.total || 0}</p></div><Lightbulb className="h-8 w-8 text-primary opacity-50" /></div></CardContent></Card>
            <Card className={`cursor-pointer transition-all ${oppStatusFilter === 'pending' ? 'ring-2 ring-amber-500' : 'hover:bg-muted/50'}`} onClick={() => { setOppStatusFilter('pending'); handleOppFilterChange(); }}>
              <CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Pending</p><p className="text-2xl font-bold text-amber-600">{oppSummary?.pending || 0}</p></div><Circle className="h-8 w-8 text-amber-500 opacity-50" /></div></CardContent>
            </Card>
            <Card className={`cursor-pointer transition-all ${oppStatusFilter === 'completed' ? 'ring-2 ring-green-500' : 'hover:bg-muted/50'}`} onClick={() => { setOppStatusFilter('completed'); handleOppFilterChange(); }}>
              <CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Completed</p><p className="text-2xl font-bold text-green-600">{oppSummary?.completed || 0}</p></div><CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" /></div></CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search opportunities…" value={oppSearchQuery} onChange={(e) => { setOppSearchQuery(e.target.value); handleOppFilterChange(); }} className="pl-10" />
                </div>
                <Select value={oppStatusFilter} onValueChange={(v) => { setOppStatusFilter(v as OpportunityFilter); handleOppFilterChange(); }}>
                  <SelectTrigger className="w-full lg:w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => refetchOpportunities()}><RefreshCw className="h-4 w-4" /></Button>
                  <ExportButton data={filteredOpportunities as any} filename="store-opportunities" columns={oppExportColumns} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-primary" />Opportunities ({filteredOpportunities.length})</CardTitle>
                <CardDescription>{oppStatusFilter === 'all' ? 'All' : oppStatusFilter.charAt(0).toUpperCase() + oppStatusFilter.slice(1)}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {filteredOpportunities.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground"><Lightbulb className="h-16 w-16 mx-auto mb-4 opacity-50" /><p className="text-lg font-medium">No opportunities found</p></div>
              ) : (
                <>
                  <DataTablePagination currentPage={oppCurrentPage} totalPages={oppTotalPages} pageSize={oppPageSize} totalItems={filteredOpportunities.length} onPageChange={setOppCurrentPage} onPageSizeChange={(size) => { setOppPageSize(size); setOppCurrentPage(1); }} />
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader><TableRow><TableHead>Store</TableHead><TableHead>Opportunity</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead className="w-[100px]">Actions</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {paginatedOpportunities.map((opp) => (
                          <TableRow key={opp.id} className="hover:bg-muted/50">
                            <TableCell>
                              <button onClick={() => handleViewStore(opp.store_id)} className="font-medium text-left hover:text-primary transition-colors">{opp.store?.store_name || 'Unknown'}</button>
                              {opp.store?.city && <p className="text-xs text-muted-foreground">{opp.store.city}</p>}
                            </TableCell>
                            <TableCell><span className="text-sm">{opp.opportunity_text}</span></TableCell>
                            <TableCell><Badge variant="outline" className="text-xs capitalize">{opp.source}</Badge></TableCell>
                            <TableCell>
                              {opp.is_completed
                                ? <Badge variant="default" className="bg-green-500 text-white text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>
                                : <Badge variant="secondary" className="text-xs"><Circle className="h-3 w-3 mr-1" />Pending</Badge>}
                            </TableCell>
                            <TableCell><div className="flex items-center gap-1 text-sm text-muted-foreground"><Clock className="h-3 w-3" />{format(new Date(opp.created_at), 'MMM d, yyyy')}</div></TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleViewStore(opp.store_id)} className="h-8 w-8"><ExternalLink className="h-4 w-4" /></Button>
                                {opp.is_completed
                                  ? <Button variant="ghost" size="icon" onClick={() => handleReopenOpportunity(opp.id)} className="h-8 w-8" disabled={reopenOpportunity.isPending}><RefreshCw className="h-4 w-4" /></Button>
                                  : <Button variant="ghost" size="icon" onClick={() => handleCompleteOpportunity(opp.id)} className="h-8 w-8 text-green-600" disabled={completeOpportunity.isPending}><CheckCircle2 className="h-4 w-4" /></Button>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── MESSAGING TAB ── */}
        <TabsContent value="messaging" className="space-y-4">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-blue-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-400">Inbound Messaging Replies</p>
              <p className="text-xs text-blue-300/70 mt-0.5">Leads and stores that replied to SMS/WhatsApp outreach</p>
            </div>
          </div>
          <OpportunityList items={messagingItems} onAction={handleAction} emptyIcon={MessageSquare} emptyText="No inbound messages yet" />
        </TabsContent>

        {/* ── DIALER TAB ── */}
        <TabsContent value="dialer" className="space-y-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
            <Phone className="h-5 w-5 text-green-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-400">AI Dialer — Interested Results</p>
              <p className="text-xs text-green-300/70 mt-0.5">Leads that showed interest during AI-powered calls</p>
            </div>
          </div>
          <OpportunityList items={dialerItems} onAction={handleAction} emptyIcon={Phone} emptyText="No interested dialer results yet" />
        </TabsContent>

        {/* ── VISITS TAB ── */}
        <TabsContent value="visits" className="space-y-4">
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
            <Truck className="h-5 w-5 text-purple-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-purple-400">Pending Visit Triggers</p>
              <p className="text-xs text-purple-300/70 mt-0.5">First visits, prospecting, merchandising, audit, and compliance triggers</p>
            </div>
          </div>
          <OpportunityList items={visitItems} onAction={handleAction} emptyIcon={Truck} emptyText="No pending visit triggers" />
        </TabsContent>

        {/* ── READY TO CLOSE TAB ── */}
        <TabsContent value="ready-close" className="space-y-4">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-400">Ready to Close</p>
              <p className="text-xs text-emerald-300/70 mt-0.5">High-priority leads in booked or interested stage (P7+)</p>
            </div>
          </div>
          <OpportunityList items={closeItems} onAction={handleAction} emptyIcon={TrendingUp} emptyText="No leads ready to close" />
        </TabsContent>

        {/* ── AI OPPORTUNITIES TAB ── */}
        <TabsContent value="ai-opps" className="space-y-4">
          <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
            <Brain className="h-5 w-5 text-violet-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-violet-400">AI Agent Opportunities</p>
              <p className="text-xs text-violet-300/70 mt-0.5">Opportunities detected by AI agents across all brands</p>
            </div>
            <Button size="sm" variant="outline" className="ml-auto text-xs gap-1" onClick={runAIAnalysis} disabled={scanning}>
              {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Rescan
            </Button>
          </div>
          <OpportunityList items={aiOppItems} onAction={handleAction} emptyIcon={Brain} emptyText="No AI-detected opportunities — run an AI Scan" />
        </TabsContent>
      </Tabs>

      {dispatchStores && (
        <RouteAssignmentDialog
          open={!!dispatchStores}
          onOpenChange={(o) => { if (!o) setDispatchStores(null); }}
          assigneeId=""
          assigneeName=""
          assigneeType="ambassador"
          bulkMode
          preselectedStores={dispatchStores}
          onAssigned={() => {
            setDispatchStores(null);
            setSelectedSignalStores([]);
            toast.success('Route created');
          }}
        />
      )}
    </div>
  );
}
