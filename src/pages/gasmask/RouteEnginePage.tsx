import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import {
  Truck, Brain, Plus, MapPin, Clock, AlertTriangle, CheckCircle2,
  RefreshCw, Loader2, Search, X, Phone, Navigation, BarChart3,
  List, LayoutGrid, ExternalLink, ChevronRight, ClipboardList
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const URGENCY_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  critical: { color: 'bg-red-500/10 text-red-500 border-red-500/30', icon: '🔴', label: 'Critical' },
  high: { color: 'bg-amber-500/10 text-amber-500 border-amber-500/30', icon: '🟠', label: 'High' },
  normal: { color: 'bg-muted text-muted-foreground border-border', icon: '🟡', label: 'Normal' },
  low: { color: 'bg-muted/50 text-muted-foreground border-border', icon: '⚪', label: 'Low' },
};

const TRIGGER_TYPE_COLORS: Record<string, string> = {
  restock: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  urgent_visit: 'bg-red-500/10 text-red-500 border-red-500/30',
  follow_up: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  audit: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
  prospecting: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  complaint: 'bg-red-500/10 text-red-500 border-red-500/30',
  ai_flag: 'bg-violet-500/10 text-violet-500 border-violet-500/30',
  first_visit: 'bg-sky-500/10 text-sky-500 border-sky-500/30',
  pickup: 'bg-teal-500/10 text-teal-500 border-teal-500/30',
  escalation: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
  merchandising: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30',
  compliance: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  collection: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  training: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30',
  other: 'bg-muted text-muted-foreground border-border',
};

const FLOOR_LABELS: Record<string, string> = {
  floor1_crm: 'CRM', floor2_inventory: 'INV', floor3_comms: 'COMMS',
  floor4_delivery: 'DELIV', floor5_territory: 'TERR', floor9_ai_ops: 'AI',
  penthouse: 'CEO', manual: 'MANUAL',
};

const TRIGGER_TYPES = ['restock','urgent_visit','follow_up','audit','prospecting','first_visit','pickup','complaint','escalation','ai_flag','merchandising','compliance','collection','training','other'];

const QUICK_PRESETS = [
  { label: '🔴 Low Stock', type: 'restock', floor: 'floor2_inventory', urg: 'high', score: 8 },
  { label: '🟠 Follow-Up', type: 'follow_up', floor: 'floor1_crm', urg: 'normal', score: 5 },
  { label: '🔴 Complaint', type: 'complaint', floor: 'floor3_comms', urg: 'critical', score: 10 },
  { label: '🟡 Prospect', type: 'prospecting', floor: 'floor5_territory', urg: 'normal', score: 5 },
  { label: '🤖 AI Flag', type: 'ai_flag', floor: 'floor9_ai_ops', urg: 'critical', score: 10 },
  { label: '💰 Collections', type: 'collection', floor: 'floor1_crm', urg: 'high', score: 8 },
];

export default function RouteEnginePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingChecklists, setGeneratingChecklists] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showRouteBuilder, setShowRouteBuilder] = useState(false);
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [routeBuilderStep, setRouteBuilderStep] = useState(1);
  const [routeConfig, setRouteConfig] = useState({ scheduled_date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
  const [selectedAssignee, setSelectedAssignee] = useState<{ id: string; name: string; userId: string; role: 'driver' | 'biker' | 'ambassador' } | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');

  const [buildingRoute, setBuildingRoute] = useState(false);
  const [detailTrigger, setDetailTrigger] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<'details' | 'actions' | 'history'>('details');

  // Filters
  const [activeTab, setActiveTab] = useState<'triggers' | 'routes' | 'advisory' | 'analytics'>('triggers');
  const [filterUrgency, setFilterUrgency] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterFloor, setFilterFloor] = useState('all');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  const [triggerForm, setTriggerForm] = useState({
    store_name: '', store_address: '', store_city: '', store_state: '', store_phone: '',
    trigger_type: 'follow_up', floor_source: 'manual' as string, urgency: 'normal',
    priority_score: 5, trigger_notes: '', visit_duration_minutes: 20,
  });

  // Fetch ALL triggers — no limit
  const { data: triggers = [], refetch: refetchTriggers } = useQuery({
    queryKey: ['gasmask-visit-triggers'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('gasmask_visit_triggers')
        .select('*')
        .order('urgency', { ascending: true })
        .order('priority_score', { ascending: false })
        .order('created_at', { ascending: true });
      return data || [];
    },
    refetchInterval: 15000,
  });

  // Fetch routes — canonical routes table, gasmask_agent source only, last 50
  const { data: routes = [] } = useQuery({
    queryKey: ['gasmask-routes-canonical'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('routes')
        .select(`
          *,
          route_stops (
            id, planned_order, status, store_id, notes,
            stores ( id, name, address_street, address_city, address_state )
          )
        `)
        .eq('source', 'gasmask_agent')
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Fetch assignable people across all 3 roles (active + has user_id)
  const { data: assignablePeople = [] } = useQuery({
    queryKey: ['route-engine-assignable-people'],
    queryFn: async () => {
      const [drv, bk, amb] = await Promise.all([
        (supabase as any).from('drivers').select('id, full_name, user_id').eq('status', 'active').not('user_id', 'is', null).order('full_name'),
        (supabase as any).from('bikers').select('id, full_name, user_id').eq('status', 'active').not('user_id', 'is', null).order('full_name'),
        (supabase as any).from('ambassadors').select('id, name, user_id').eq('is_active', true).not('user_id', 'is', null).order('name'),
      ]);
      const drivers = (drv.data || []).map((r: any) => ({ id: r.id, name: r.full_name || 'Driver', userId: r.user_id, role: 'driver' as const }));
      const bikers = (bk.data || []).map((r: any) => ({ id: r.id, name: r.full_name || 'Biker', userId: r.user_id, role: 'biker' as const }));
      const ambs = (amb.data || []).map((r: any) => ({ id: r.id, name: (r.name || '').trim() || 'Ambassador', userId: r.user_id, role: 'ambassador' as const }));
      return [...drivers, ...bikers, ...ambs];
    },
  });


  // Fetch store history for detail panel
  const { data: storeHistory = [] } = useQuery({
    queryKey: ['trigger-store-history', detailTrigger?.store_name],
    queryFn: async () => {
      if (!detailTrigger?.store_name) return [];
      const { data } = await (supabase as any)
        .from('gasmask_visit_triggers')
        .select('*')
        .eq('store_name', detailTrigger.store_name)
        .neq('id', detailTrigger.id)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!detailTrigger?.store_name,
  });

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('route-engine-triggers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gasmask_visit_triggers' }, () => {
        queryClient.invalidateQueries({ queryKey: ['gasmask-visit-triggers'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'routes', filter: 'source=eq.gasmask_agent' }, () => {
        queryClient.invalidateQueries({ queryKey: ['gasmask-routes-canonical'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'route_stops' }, () => {
        queryClient.invalidateQueries({ queryKey: ['gasmask-routes-canonical'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  // Computed counts
  const today = format(new Date(), 'yyyy-MM-dd');
  const pending = triggers.filter((t: any) => t.status === 'pending');
  const scheduled = triggers.filter((t: any) => t.status === 'scheduled' && t.scheduled_for === today);
  const completedToday = triggers.filter((t: any) => t.status === 'completed' && t.completed_at && new Date(t.completed_at).toDateString() === new Date().toDateString());
  const critical = pending.filter((t: any) => t.urgency === 'critical');
  const high = pending.filter((t: any) => t.urgency === 'high');
  const todayRoutes = routes.filter((r: any) => r.date === today);
  const estHours = (pending.reduce((s: number, t: any) => s + (t.visit_duration_minutes || 20), 0) / 60).toFixed(1);

  // Filtered triggers for table/kanban
  const filteredTriggers = useMemo(() => {
    return triggers.filter((t: any) => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterUrgency !== 'all' && t.urgency !== filterUrgency) return false;
      if (filterType !== 'all' && t.trigger_type !== filterType) return false;
      if (filterFloor !== 'all' && t.floor_source !== filterFloor) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (t.store_name?.toLowerCase().includes(q) ||
          t.store_city?.toLowerCase().includes(q) ||
          t.trigger_notes?.toLowerCase().includes(q));
      }
      return true;
    });
  }, [triggers, filterStatus, filterUrgency, filterType, filterFloor, searchQuery]);

  const hasActiveFilters = filterUrgency !== 'all' || filterType !== 'all' || filterFloor !== 'all' || filterStatus !== 'pending' || searchQuery !== '';

  // Actions
  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('gasmask-route-agent', { body: { action: 'analyze' } });
      if (error) throw error;
      setAnalysis(data?.analysis);
      setActiveTab('advisory');
      toast.success('AI analysis complete');
      refetchTriggers();
    } catch (err: any) { toast.error(err.message); }
    finally { setAnalyzing(false); }
  };

  const submitManualTrigger = async () => {
    if (!triggerForm.store_name) { toast.error('Store name required'); return; }
    try {
      const { data, error } = await supabase.functions.invoke('gasmask-route-agent', {
        body: { action: 'create_trigger', trigger_source: 'Manual Entry', ...triggerForm },
      });
      if (error) throw error;
      if (data?.duplicate) toast.info('Trigger already exists for this store');
      else toast.success('Trigger added');
      setShowAddForm(false);
      setTriggerForm({ store_name: '', store_address: '', store_city: '', store_state: '', store_phone: '', trigger_type: 'follow_up', floor_source: 'manual', urgency: 'normal', priority_score: 5, trigger_notes: '', visit_duration_minutes: 20 });
      refetchTriggers();
    } catch (err: any) { toast.error(err.message); }
  };

  const buildRoute = async () => {
    if (!selectedTriggers.length) { toast.error('Select triggers first'); return; }
    if (!selectedAssignee) { toast.error('Pick an assignee (driver, biker, or ambassador)'); return; }
    setBuildingRoute(true);
    try {
      const { data, error } = await supabase.functions.invoke('gasmask-route-agent', {
        body: {
          action: 'build_route',
          trigger_ids: selectedTriggers,
          driver_name: selectedAssignee.name,
          assigned_to_user_id: selectedAssignee.userId,
          assignee_type: selectedAssignee.role,
          scheduled_date: routeConfig.scheduled_date,
          route_notes: routeConfig.notes,
        },
      });
      if (error) throw error;
      toast.success(`Route created: ${data?.total_stops} stops → ${selectedAssignee.name} (${selectedAssignee.role})`);
      setShowRouteBuilder(false);
      setSelectedTriggers([]);
      setRouteBuilderStep(1);
      setSelectedAssignee(null);
      refetchTriggers();
      queryClient.invalidateQueries({ queryKey: ['gasmask-routes-canonical'] });
      queryClient.invalidateQueries({ queryKey: ['driver-routes'] });
      queryClient.invalidateQueries({ queryKey: ['biker-routes'] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-routes'] });
    } catch (err: any) { toast.error(err.message); }
    finally { setBuildingRoute(false); }
  };


  const completeTrigger = async (id: string) => {
    await (supabase as any).from('gasmask_visit_triggers').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id);
    toast.success('Marked complete');
    refetchTriggers();
    if (detailTrigger?.id === id) setDetailTrigger(null);
  };

  const snoozeTrigger = async (id: string) => {
    await (supabase as any).from('gasmask_visit_triggers').update({ status: 'snoozed' }).eq('id', id);
    toast.info('Snoozed 24h');
    refetchTriggers();
    if (detailTrigger?.id === id) setDetailTrigger(null);
  };

  const cancelTrigger = async (id: string) => {
    await (supabase as any).from('gasmask_visit_triggers').update({ status: 'cancelled' }).eq('id', id);
    toast.info('Trigger cancelled');
    refetchTriggers();
    if (detailTrigger?.id === id) setDetailTrigger(null);
  };

  const escalateTrigger = async (id: string) => {
    await (supabase as any).from('gasmask_visit_triggers').update({ urgency: 'critical', priority_score: 10 }).eq('id', id);
    toast.success('Escalated to critical');
    refetchTriggers();
  };

  const toggleTriggerSelection = (id: string) => {
    setSelectedTriggers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const completeAllSelected = async () => {
    for (const id of selectedTriggers) {
      await (supabase as any).from('gasmask_visit_triggers').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id);
    }
    toast.success(`${selectedTriggers.length} triggers completed`);
    setSelectedTriggers([]);
    refetchTriggers();
  };

  const snoozeAllSelected = async () => {
    for (const id of selectedTriggers) {
      await (supabase as any).from('gasmask_visit_triggers').update({ status: 'snoozed' }).eq('id', id);
    }
    toast.info(`${selectedTriggers.length} triggers snoozed`);
    setSelectedTriggers([]);
    refetchTriggers();
  };

  const ageString = (created: string) => {
    const h = Math.round((Date.now() - new Date(created).getTime()) / 3600000);
    if (h < 1) return '<1h ago';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  // ─── Analytics computed ───
  const analyticsThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    const weekTriggers = triggers.filter((t: any) => new Date(t.created_at).getTime() > weekAgo);
    const created = weekTriggers.length;
    const done = weekTriggers.filter((t: any) => t.status === 'completed').length;
    return { created, done, rate: created ? Math.round((done / created) * 100) : 0 };
  }, [triggers]);

  const analyticsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    triggers.forEach((t: any) => { counts[t.trigger_type] = (counts[t.trigger_type] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [triggers]);

  const analyticsByFloor = useMemo(() => {
    const counts: Record<string, number> = {};
    triggers.forEach((t: any) => { counts[t.floor_source] = (counts[t.floor_source] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [triggers]);

  const topStores = useMemo(() => {
    const counts: Record<string, number> = {};
    triggers.forEach((t: any) => { counts[t.store_name] = (counts[t.store_name] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [triggers]);

  // ─── Kanban columns ───
  const kanbanCritical = filteredTriggers.filter((t: any) => t.status === 'pending' && t.urgency === 'critical');
  const kanbanHigh = filteredTriggers.filter((t: any) => t.status === 'pending' && t.urgency === 'high');
  const kanbanNormal = filteredTriggers.filter((t: any) => t.status === 'pending' && (t.urgency === 'normal' || t.urgency === 'low'));
  const kanbanScheduled = filteredTriggers.filter((t: any) => t.status === 'scheduled');
  const kanbanDone = filteredTriggers.filter((t: any) => t.status === 'completed');

  // ─── TriggerCard ───
  const TriggerCard = ({ trigger }: { trigger: any }) => {
    const uc = URGENCY_CONFIG[trigger.urgency] || URGENCY_CONFIG.normal;
    const tc = TRIGGER_TYPE_COLORS[trigger.trigger_type] || TRIGGER_TYPE_COLORS.other;
    const fl = FLOOR_LABELS[trigger.floor_source] || trigger.floor_source;
    const isSelected = selectedTriggers.includes(trigger.id);

    return (
      <div
        className={`rounded-lg border p-3 space-y-1.5 transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'bg-card'}`}
      >
        <div className="flex items-start gap-2">
          <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={isSelected} onCheckedChange={() => toggleTriggerSelection(trigger.id)} />
          </div>
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => { setDetailTrigger(trigger); setDetailTab('details'); }}
          >
            <div className="flex items-start justify-between gap-1">
              <h4 className="font-semibold text-sm leading-tight truncate">{trigger.store_name}</h4>
              <Badge variant="outline" className={`text-[10px] shrink-0 ${uc.color}`}>{uc.icon} {uc.label}</Badge>
            </div>
            {(trigger.store_city || trigger.store_state) && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{[trigger.store_city, trigger.store_state].filter(Boolean).join(', ')}</p>
            )}
            <div className="flex flex-wrap gap-1 mt-1">
              <Badge variant="outline" className={`text-[10px] ${tc}`}>{trigger.trigger_type.replace(/_/g, ' ')}</Badge>
              <Badge variant="outline" className="text-[10px]">{fl}</Badge>
              <Badge variant="outline" className="text-[10px]">P{trigger.priority_score}</Badge>
            </div>
            {trigger.ai_recommendation && (
              <p className="text-[11px] text-muted-foreground italic mt-1 line-clamp-2">🤖 {trigger.ai_recommendation}</p>
            )}
            {trigger.trigger_notes && (
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{trigger.trigger_notes}</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between pl-6">
          <span className="text-[10px] text-muted-foreground">{ageString(trigger.created_at)}</span>
          <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-xs" onClick={() => completeTrigger(trigger.id)} title="Complete">✅</Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-xs" onClick={() => snoozeTrigger(trigger.id)} title="Snooze">💤</Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-xs" onClick={() => { setSelectedTriggers(p => [...new Set([...p, trigger.id])]); setShowRouteBuilder(true); setRouteBuilderStep(1); }} title="Add to route">+🚚</Button>
          </div>
        </div>
      </div>
    );
  };

  // ─── KanbanColumn ───
  const KanbanColumn = ({ title, items, borderColor, textColor }: { title: string; items: any[]; borderColor: string; textColor: string }) => (
    <div className="min-w-[260px] flex-1 space-y-2">
      <div className={`flex items-center gap-2 pb-2 border-b ${borderColor}`}>
        <span className={`text-sm font-semibold ${textColor}`}>{title}</span>
        <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
      </div>
      <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
        {items.map((t: any) => <TriggerCard key={t.id} trigger={t} />)}
        {!items.length && <p className="text-xs text-muted-foreground text-center py-8 opacity-50">Empty</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <button onClick={() => navigate('/grabba/multi-brand-delivery')} className="hover:text-foreground transition-colors">← Delivery &amp; Logistics</button>
        <span>/</span>
        <span className="text-foreground font-medium">Route Engine</span>
      </div>

      {/* ── SECTION 1: Command Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Truck className="h-5 w-5" />Multi-Brand Route Engine</h1>
          <p className="text-xs text-muted-foreground">All field visits organized by AI</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={runAnalysis} disabled={analyzing} className="gap-1.5">
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}AI Analyze
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              setGeneratingChecklists(true);
              try {
                const pendingIds = (triggers as any[])
                  .filter((t: any) => t.status === 'pending' || t.status === 'scheduled')
                  .map((t: any) => t.id);
                if (!pendingIds.length) { toast.info('No pending triggers to generate checklists for'); return; }
                const { error } = await supabase.functions.invoke('generate-visit-checklist', {
                  body: { generate_batch: true, batch_trigger_ids: pendingIds, assigned_role: 'driver' },
                });
                if (error) throw error;
                toast.success('AI checklists generated', {
                  description: `${pendingIds.length} stops now have detailed AI instructions`,
                });
                queryClient.invalidateQueries({ queryKey: ['driver-checklists'] });
                queryClient.invalidateQueries({ queryKey: ['gasmask-visit-triggers'] });
              } catch (err: any) { toast.error(err.message); }
              finally { setGeneratingChecklists(false); }
            }}
            disabled={generatingChecklists}
            className="gap-1.5"
          >
            {generatingChecklists ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardList className="h-3.5 w-3.5" />}
            Generate Checklists
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setShowRouteBuilder(true); setRouteBuilderStep(1); }} disabled={!selectedTriggers.length} className="gap-1.5">
            <MapPin className="h-3.5 w-3.5" />Build Route{selectedTriggers.length > 0 && ` (${selectedTriggers.length})`}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5" />Add Trigger</Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/gasmask/driver-route')} className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />Driver View
          </Button>
        </div>
      </div>

      {/* ── SECTION 2: KPI Strip ── */}
      <div className="grid grid-cols-4 lg:grid-cols-7 gap-2">
        {[
          { label: 'Critical', count: critical.length, icon: '🔴', cls: 'border-red-500/30 hover:border-red-500/60', onClick: () => { setFilterUrgency('critical'); setFilterStatus('pending'); setActiveTab('triggers'); } },
          { label: 'High', count: high.length, icon: '🟠', cls: 'border-amber-500/30 hover:border-amber-500/60', onClick: () => { setFilterUrgency('high'); setFilterStatus('pending'); setActiveTab('triggers'); } },
          { label: 'Pending', count: pending.length, icon: '🟡', cls: 'border-border hover:border-primary/40', onClick: () => { setFilterUrgency('all'); setFilterStatus('pending'); setActiveTab('triggers'); } },
          { label: 'Today', count: scheduled.length, icon: '📅', cls: 'border-blue-500/30 hover:border-blue-500/60', onClick: () => { setFilterStatus('scheduled'); setActiveTab('triggers'); } },
          { label: 'Done Today', count: completedToday.length, icon: '✅', cls: 'border-emerald-500/30 hover:border-emerald-500/60', onClick: () => { setFilterStatus('completed'); setActiveTab('triggers'); } },
          { label: 'Routes', count: todayRoutes.length, icon: '🚚', cls: 'border-border hover:border-primary/40', onClick: () => setActiveTab('routes') },
          { label: 'Est Hours', count: estHours, icon: '⏱', cls: 'border-border hover:border-primary/40', onClick: () => {} },
        ].map(s => (
          <Card key={s.label} className={`border cursor-pointer transition-colors ${s.cls}`} onClick={s.onClick}>
            <CardContent className="p-2 text-center">
              <div className="text-lg font-bold leading-tight">{s.icon} {s.count}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── SECTION 3: Filter Bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search stores..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <select className="h-9 rounded-md border border-input bg-background px-2 text-xs" value={filterUrgency} onChange={e => setFilterUrgency(e.target.value)}>
          <option value="all">All Urgency</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <select className="h-9 rounded-md border border-input bg-background px-2 text-xs" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          {TRIGGER_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="h-9 rounded-md border border-input bg-background px-2 text-xs" value={filterFloor} onChange={e => setFilterFloor(e.target.value)}>
          <option value="all">All Floors</option>
          {Object.entries(FLOOR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="h-9 rounded-md border border-input bg-background px-2 text-xs" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="pending">Pending</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_route">In Route</option>
          <option value="completed">Completed</option>
          <option value="snoozed">Snoozed</option>
          <option value="all">All Status</option>
        </select>
        <div className="flex border rounded-md overflow-hidden">
          <button className={`px-2 py-1.5 text-xs ${viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : 'bg-background'}`} onClick={() => setViewMode('kanban')}><LayoutGrid className="h-3.5 w-3.5" /></button>
          <button className={`px-2 py-1.5 text-xs ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'bg-background'}`} onClick={() => setViewMode('table')}><List className="h-3.5 w-3.5" /></button>
        </div>
        {hasActiveFilters && (
          <Button size="sm" variant="ghost" className="h-9 gap-1 text-xs" onClick={() => { setFilterUrgency('all'); setFilterType('all'); setFilterFloor('all'); setFilterStatus('pending'); setSearchQuery(''); }}>
            <X className="h-3 w-3" />Clear
          </Button>
        )}
      </div>

      {/* ── SECTION 4: Tabs ── */}
      <div className="flex gap-1 border-b">
        {[
          { key: 'triggers' as const, label: '📍 Triggers', count: filteredTriggers.length },
          { key: 'routes' as const, label: '🚚 Routes', count: routes.length },
          { key: 'advisory' as const, label: '🤖 AI Advisory' },
          { key: 'analytics' as const, label: '📊 Analytics' },
        ].map(tab => (
          <button
            key={tab.key}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
          </button>
        ))}
      </div>

      {/* ═══ TAB: TRIGGERS ═══ */}
      {activeTab === 'triggers' && (
        <>
          {viewMode === 'kanban' ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              <KanbanColumn title="🔴 Critical" items={kanbanCritical} borderColor="border-red-500/30" textColor="text-red-500" />
              <KanbanColumn title="🟠 High Priority" items={kanbanHigh} borderColor="border-amber-500/30" textColor="text-amber-500" />
              <KanbanColumn title="🟡 Normal" items={kanbanNormal} borderColor="border-border" textColor="text-foreground" />
              <KanbanColumn title="📅 Scheduled" items={kanbanScheduled} borderColor="border-blue-500/30" textColor="text-blue-500" />
              <KanbanColumn title="✅ Completed" items={kanbanDone} borderColor="border-emerald-500/30" textColor="text-emerald-500" />
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left w-8"><Checkbox checked={selectedTriggers.length === filteredTriggers.length && filteredTriggers.length > 0} onCheckedChange={(c) => setSelectedTriggers(c ? filteredTriggers.map((t: any) => t.id) : [])} /></th>
                      <th className="p-2 text-left text-xs font-medium">Store</th>
                      <th className="p-2 text-left text-xs font-medium">City</th>
                      <th className="p-2 text-left text-xs font-medium">Type</th>
                      <th className="p-2 text-left text-xs font-medium">Floor</th>
                      <th className="p-2 text-left text-xs font-medium">Urgency</th>
                      <th className="p-2 text-left text-xs font-medium">P</th>
                      <th className="p-2 text-left text-xs font-medium">Notes</th>
                      <th className="p-2 text-left text-xs font-medium">Age</th>
                      <th className="p-2 text-left text-xs font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTriggers.slice(0, 100).map((t: any) => {
                      const uc = URGENCY_CONFIG[t.urgency] || URGENCY_CONFIG.normal;
                      return (
                        <tr key={t.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => { setDetailTrigger(t); setDetailTab('details'); }}>
                          <td className="p-2" onClick={e => e.stopPropagation()}><Checkbox checked={selectedTriggers.includes(t.id)} onCheckedChange={() => toggleTriggerSelection(t.id)} /></td>
                          <td className="p-2 font-medium text-xs">{t.store_name}</td>
                          <td className="p-2 text-xs text-muted-foreground">{t.store_city}</td>
                          <td className="p-2"><Badge variant="outline" className={`text-[10px] ${TRIGGER_TYPE_COLORS[t.trigger_type] || ''}`}>{t.trigger_type.replace(/_/g, ' ')}</Badge></td>
                          <td className="p-2 text-[10px]">{FLOOR_LABELS[t.floor_source] || t.floor_source}</td>
                          <td className="p-2"><Badge variant="outline" className={`text-[10px] ${uc.color}`}>{uc.icon} {uc.label}</Badge></td>
                          <td className="p-2 text-xs">{t.priority_score}</td>
                          <td className="p-2 text-xs text-muted-foreground max-w-[200px] truncate">{t.trigger_notes}</td>
                          <td className="p-2 text-[10px] text-muted-foreground">{ageString(t.created_at)}</td>
                          <td className="p-2" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-0.5">
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => completeTrigger(t.id)}>✅</Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => snoozeTrigger(t.id)}>💤</Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredTriggers.length > 100 && <p className="text-xs text-muted-foreground text-center py-2">Showing 100 of {filteredTriggers.length}</p>}
            </div>
          )}
        </>
      )}

      {/* ═══ TAB: ROUTES ═══ */}
      {activeTab === 'routes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {routes.length === 0 && <p className="text-sm text-muted-foreground col-span-2 text-center py-12">No routes yet. Select triggers and build your first route.</p>}
          {routes.map((route: any) => {
            const stops = ((route.route_stops || []) as any[]).slice().sort((a, b) => (a.planned_order || 0) - (b.planned_order || 0));
            const totalStops = route.total_stops || stops.length;
            const completedStops = stops.filter((s: any) => s.status === 'completed').length;
            const progress = totalStops ? Math.round((completedStops / totalStops) * 100) : 0;
            return (
              <Card key={route.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-sm">{route.name || 'Unnamed Route'}</h3>
                      <p className="text-xs text-muted-foreground">{route.date}{route.territory ? ` · ${route.territory}` : ''}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{route.status}</Badge>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>{completedStops}/{totalStops} stops</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Est: {Math.round((route.estimated_duration_minutes || 0) / 60 * 10) / 10}h · {ageString(route.created_at)}</p>
                  {stops.length > 0 && (
                    <div className="space-y-1">
                      {stops.slice(0, 3).map((s: any, i: number) => (
                        <div key={s.id} className="flex items-center gap-2 text-xs p-1.5 bg-muted/40 rounded">
                          <span className="font-medium text-muted-foreground">{s.planned_order ?? i + 1}.</span>
                          <span className="truncate">{s.stores?.name || 'Unknown store'}</span>
                          {(s.stores?.address_street || s.stores?.address_city) && (
                            <span className="text-muted-foreground truncate">— {[s.stores.address_street, s.stores.address_city, s.stores.address_state].filter(Boolean).join(', ')}</span>
                          )}
                          {s.status === 'completed' && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 ml-auto" />}
                        </div>
                      ))}
                      {stops.length > 3 && <p className="text-[10px] text-muted-foreground pl-6">+{stops.length - 3} more stops</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ═══ TAB: AI ADVISORY ═══ */}
      {activeTab === 'advisory' && (
        <div className="space-y-4">
          {!analysis ? (
            <Card>
              <CardContent className="p-8 text-center space-y-3">
                <Brain className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No AI analysis yet</p>
                <Button onClick={runAnalysis} disabled={analyzing} className="gap-2">
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}Run AI Analysis
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm flex items-center gap-2"><Brain className="h-4 w-4" />AI Route Intelligence</h3>
                    <Button size="sm" variant="ghost" onClick={runAnalysis} disabled={analyzing} className="gap-1">
                      <RefreshCw className={`h-3 w-3 ${analyzing ? 'animate-spin' : ''}`} />Refresh
                    </Button>
                  </div>
                  <p className="text-sm">{analysis.summary}</p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Critical: {analysis.critical_count || 0}</span>
                    <span>High: {analysis.high_count || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {analysis.stores_to_prioritize?.length > 0 && (
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <h4 className="font-semibold text-sm">🎯 Stores to Prioritize</h4>
                      {analysis.stores_to_prioritize.map((s: string, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-muted/40 rounded text-xs">
                          <span>#{i + 1} {s}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
                {analysis.stores_at_risk?.length > 0 && (
                  <Card className="border-red-500/20">
                    <CardContent className="p-4 space-y-2">
                      <h4 className="font-semibold text-sm flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-red-500" />At-Risk Accounts</h4>
                      {analysis.stores_at_risk.map((s: any, i: number) => (
                        <div key={i} className="p-2 bg-red-500/5 border border-red-500/10 rounded text-xs space-y-1">
                          <p className="font-medium">{s.store}</p>
                          <p className="text-muted-foreground">{s.reason}</p>
                          <p className="text-red-500">→ {s.action}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {analysis.route_groups?.length > 0 && (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h4 className="font-semibold text-sm">📍 Suggested Route Groups</h4>
                    {analysis.route_groups.map((g: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-muted/40 rounded">
                        <div>
                          <p className="text-sm font-medium">{g.group_name}</p>
                          <p className="text-xs text-muted-foreground">{g.trigger_ids?.length || 0} stops · ~{Math.round((g.estimated_duration_minutes || 0) / 60 * 10) / 10}h · {g.suggested_date}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => {
                          if (g.trigger_ids) {
                            setSelectedTriggers(g.trigger_ids);
                            setShowRouteBuilder(true);
                            setRouteBuilderStep(1);
                          }
                        }}>Create Route</Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ TAB: ANALYTICS ═══ */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold">{analyticsThisWeek.created}</div><div className="text-xs text-muted-foreground">Created This Week</div></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold">{analyticsThisWeek.done}</div><div className="text-xs text-muted-foreground">Completed This Week</div></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold">{analyticsThisWeek.rate}%</div><div className="text-xs text-muted-foreground">Completion Rate</div></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 space-y-2">
                <h4 className="font-semibold text-sm">By Trigger Type</h4>
                {analyticsByType.map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] min-w-[80px] justify-center ${TRIGGER_TYPE_COLORS[type] || ''}`}>{type.replace(/_/g, ' ')}</Badge>
                    <div className="flex-1 h-2 bg-muted rounded-full"><div className="h-full bg-primary/60 rounded-full" style={{ width: `${(count / (analyticsByType[0]?.[1] || 1)) * 100}%` }} /></div>
                    <span className="text-xs font-medium w-6 text-right">{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-2">
                <h4 className="font-semibold text-sm">By Floor Source</h4>
                {analyticsByFloor.map(([floor, count]) => (
                  <div key={floor} className="flex items-center gap-2">
                    <span className="text-xs min-w-[60px]">{FLOOR_LABELS[floor] || floor}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full"><div className="h-full bg-primary/60 rounded-full" style={{ width: `${(count / (analyticsByFloor[0]?.[1] || 1)) * 100}%` }} /></div>
                    <span className="text-xs font-medium w-6 text-right">{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h4 className="font-semibold text-sm">Top Stores Needing Visits</h4>
              {topStores.map(([store, count], i) => (
                <div key={store} className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs">
                  <span><span className="font-medium text-muted-foreground mr-2">#{i + 1}</span>{store}</span>
                  <Badge variant="outline" className="text-[10px]">{count} triggers</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Floating Selection Bar ── */}
      {selectedTriggers.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
            <span className="text-sm font-medium">{selectedTriggers.length} triggers selected</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setShowRouteBuilder(true); setRouteBuilderStep(1); }} className="gap-1.5">🗺 Build Route</Button>
              <Button size="sm" variant="outline" onClick={completeAllSelected} className="gap-1.5">✅ Complete All</Button>
              <Button size="sm" variant="outline" onClick={snoozeAllSelected} className="gap-1.5">💤 Snooze All</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedTriggers([])}><X className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Trigger Detail Slide-Out ── */}
      <Sheet open={!!detailTrigger} onOpenChange={(open) => { if (!open) setDetailTrigger(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {detailTrigger && (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg">{detailTrigger.store_name}</SheetTitle>
                <p className="text-sm text-muted-foreground">{[detailTrigger.store_city, detailTrigger.store_state].filter(Boolean).join(', ')}</p>
              </SheetHeader>

              <div className="flex gap-1 mt-4 border-b pb-2">
                {(['details', 'actions', 'history'] as const).map(tab => (
                  <button key={tab} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${detailTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`} onClick={() => setDetailTab(tab)}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {detailTab === 'details' && (
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><p className="text-[10px] text-muted-foreground uppercase">Type</p><Badge variant="outline" className={`${TRIGGER_TYPE_COLORS[detailTrigger.trigger_type] || ''}`}>{detailTrigger.trigger_type.replace(/_/g, ' ')}</Badge></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase">Floor</p><p className="text-sm">{FLOOR_LABELS[detailTrigger.floor_source] || detailTrigger.floor_source}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase">Urgency</p><Badge variant="outline" className={URGENCY_CONFIG[detailTrigger.urgency]?.color}>{URGENCY_CONFIG[detailTrigger.urgency]?.icon} {URGENCY_CONFIG[detailTrigger.urgency]?.label}</Badge></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase">Priority</p><p className="text-sm font-bold">{detailTrigger.priority_score}/10</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase">Status</p><p className="text-sm capitalize">{detailTrigger.status}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase">Created</p><p className="text-sm">{ageString(detailTrigger.created_at)}</p></div>
                  </div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Source</p><p className="text-sm">{detailTrigger.trigger_source}</p></div>
                  {detailTrigger.trigger_notes && <div><p className="text-[10px] text-muted-foreground uppercase">Notes</p><p className="text-sm">{detailTrigger.trigger_notes}</p></div>}
                  {detailTrigger.ai_recommendation && (
                    <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
                      <p className="text-[10px] text-muted-foreground uppercase mb-1">🤖 AI Recommendation</p>
                      <p className="text-sm">{detailTrigger.ai_recommendation}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {detailTrigger.store_phone && (
                      <Button size="sm" variant="outline" className="gap-1.5" asChild><a href={`tel:${detailTrigger.store_phone}`}><Phone className="h-3.5 w-3.5" />Call Store</a></Button>
                    )}
                    {detailTrigger.store_address && (
                      <Button size="sm" variant="outline" className="gap-1.5" asChild><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(detailTrigger.store_address + ' ' + (detailTrigger.store_city || ''))}`} target="_blank" rel="noopener"><Navigation className="h-3.5 w-3.5" />Directions</a></Button>
                    )}
                  </div>
                </div>
              )}

              {detailTab === 'actions' && (
                <div className="space-y-2 mt-4">
                  <Button className="w-full justify-start gap-2" variant="outline" onClick={() => completeTrigger(detailTrigger.id)}>✅ Mark Complete</Button>
                  <Button className="w-full justify-start gap-2" variant="outline" onClick={() => { setSelectedTriggers([detailTrigger.id]); setShowRouteBuilder(true); setRouteBuilderStep(1); setDetailTrigger(null); }}>📍 Add to Route</Button>
                  <Button className="w-full justify-start gap-2" variant="outline" onClick={() => snoozeTrigger(detailTrigger.id)}>⏸ Snooze 24h</Button>
                  <Button className="w-full justify-start gap-2" variant="outline" onClick={() => escalateTrigger(detailTrigger.id)}>🔺 Escalate to Critical</Button>
                  <Button className="w-full justify-start gap-2" variant="outline" onClick={() => cancelTrigger(detailTrigger.id)}>❌ Cancel Trigger</Button>
                </div>
              )}

              {detailTab === 'history' && (
                <div className="space-y-2 mt-4">
                  <p className="text-xs text-muted-foreground">Other triggers for {detailTrigger.store_name}</p>
                  {storeHistory.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No other triggers for this store</p>}
                  {storeHistory.map((h: any) => (
                    <div key={h.id} className="p-2 bg-muted/40 rounded text-xs space-y-0.5">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={`text-[10px] ${TRIGGER_TYPE_COLORS[h.trigger_type] || ''}`}>{h.trigger_type.replace(/_/g, ' ')}</Badge>
                        <span className="text-muted-foreground capitalize">{h.status}</span>
                      </div>
                      <p className="text-muted-foreground">{h.trigger_notes}</p>
                      <p className="text-muted-foreground">{ageString(h.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Add Trigger Sheet ── */}
      <Sheet open={showAddForm} onOpenChange={setShowAddForm}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Add Visit Trigger</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Quick Presets</p>
              <div className="grid grid-cols-3 gap-1.5">
                {QUICK_PRESETS.map(q => (
                  <Button key={q.type} variant="outline" size="sm" className="text-[11px] h-auto py-2 leading-tight" onClick={() => setTriggerForm(f => ({ ...f, trigger_type: q.type, floor_source: q.floor, urgency: q.urg, priority_score: q.score }))}>
                    {q.label}
                  </Button>
                ))}
              </div>
            </div>
            <div><Label className="text-xs">Store Name *</Label><Input value={triggerForm.store_name} onChange={e => setTriggerForm(f => ({ ...f, store_name: e.target.value }))} /></div>
            <div><Label className="text-xs">Store Address</Label><Input value={triggerForm.store_address} onChange={e => setTriggerForm(f => ({ ...f, store_address: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">City</Label><Input value={triggerForm.store_city} onChange={e => setTriggerForm(f => ({ ...f, store_city: e.target.value }))} /></div>
              <div><Label className="text-xs">State</Label><Input value={triggerForm.store_state} onChange={e => setTriggerForm(f => ({ ...f, store_state: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Phone</Label><Input value={triggerForm.store_phone} onChange={e => setTriggerForm(f => ({ ...f, store_phone: e.target.value }))} /></div>
            <div><Label className="text-xs">Trigger Type</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={triggerForm.trigger_type} onChange={e => setTriggerForm(f => ({ ...f, trigger_type: e.target.value }))}>
                {TRIGGER_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div><Label className="text-xs">Floor Source</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={triggerForm.floor_source} onChange={e => setTriggerForm(f => ({ ...f, floor_source: e.target.value }))}>
                {Object.entries(FLOOR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Urgency</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={triggerForm.urgency} onChange={e => setTriggerForm(f => ({ ...f, urgency: e.target.value }))}>
                  {['critical', 'high', 'normal', 'low'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Priority (1-10)</Label>
                <Input type="number" min={1} max={10} value={triggerForm.priority_score} onChange={e => setTriggerForm(f => ({ ...f, priority_score: parseInt(e.target.value) || 5 }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Est. Visit Duration: {triggerForm.visit_duration_minutes} min</Label>
              <Slider value={[triggerForm.visit_duration_minutes]} onValueChange={([v]) => setTriggerForm(f => ({ ...f, visit_duration_minutes: v }))} min={10} max={60} step={5} className="mt-2" />
            </div>
            <div><Label className="text-xs">Notes</Label><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]" value={triggerForm.trigger_notes} onChange={e => setTriggerForm(f => ({ ...f, trigger_notes: e.target.value }))} /></div>
            <Button onClick={submitManualTrigger} className="w-full">Submit Trigger</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Route Builder Sheet ── */}
      <Sheet open={showRouteBuilder} onOpenChange={setShowRouteBuilder}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Build Route — Step {routeBuilderStep}/2</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            {routeBuilderStep === 1 && (
              <>
                <p className="text-sm text-muted-foreground">{selectedTriggers.length} triggers selected</p>
                <div className="space-y-2">
                  <Label className="text-xs">Assign To (driver / biker / ambassador)</Label>
                  {selectedAssignee && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/30">
                      <Badge variant="outline" className="text-[10px] capitalize">{selectedAssignee.role}</Badge>
                      <span className="text-sm flex-1 truncate">{selectedAssignee.name}</span>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setSelectedAssignee(null)}><X className="h-3 w-3" /></Button>
                    </div>
                  )}
                  <Input
                    placeholder="Search name or role..."
                    value={assigneeSearch}
                    onChange={(e) => setAssigneeSearch(e.target.value)}
                  />
                  <div className="max-h-48 overflow-y-auto rounded-md border p-1">
                    {assignablePeople
                      .filter((p: any) => {
                        const q = assigneeSearch.trim().toLowerCase();
                        if (!q) return true;
                        return p.name.toLowerCase().includes(q) || p.role.includes(q);
                      })
                      .map((p: any) => (
                        <div
                          key={`${p.role}-${p.id}`}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ${selectedAssignee?.id === p.id && selectedAssignee?.role === p.role ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                          onClick={() => setSelectedAssignee(p)}
                        >
                          <span className="flex-1 truncate">{p.name}</span>
                          <Badge variant="outline" className="text-[10px] capitalize">{p.role}</Badge>
                        </div>
                      ))}
                    {assignablePeople.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">No active assignable people</p>
                    )}
                  </div>
                </div>
                <div><Label className="text-xs">Date</Label><Input type="date" value={routeConfig.scheduled_date} onChange={e => setRouteConfig(c => ({ ...c, scheduled_date: e.target.value }))} /></div>
                <div><Label className="text-xs">Notes</Label><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]" value={routeConfig.notes} onChange={e => setRouteConfig(c => ({ ...c, notes: e.target.value }))} /></div>
                <Button onClick={() => setRouteBuilderStep(2)} disabled={!selectedAssignee} className="w-full">Next — Review Stops →</Button>

              </>
            )}
            {routeBuilderStep === 2 && (
              <>
                <p className="text-sm font-medium">Review stops in route</p>
                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                  {triggers.filter((t: any) => selectedTriggers.includes(t.id)).map((t: any, i: number) => (
                    <div key={t.id} className="flex items-center gap-2 p-2 bg-muted/40 rounded text-xs">
                      <span className="font-bold text-muted-foreground w-5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{t.store_name}</p>
                        <p className="text-muted-foreground">{t.trigger_type.replace(/_/g, ' ')} · {t.store_city || ''}</p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${URGENCY_CONFIG[t.urgency]?.color}`}>{URGENCY_CONFIG[t.urgency]?.icon}</Badge>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => setSelectedTriggers(p => p.filter(x => x !== t.id))}><X className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Claude AI will optimize the stop order after creation.</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setRouteBuilderStep(1)} className="flex-1">← Back</Button>
                  <Button onClick={buildRoute} disabled={buildingRoute} className="flex-1 gap-2">
                    {buildingRoute ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Create Route
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ONE canonical operational activity table — same feed as Delivery Floor
          and the store profile. Opens the exact canonical store row. */}
      <div className="mt-6">
        <AccountActivityTable
          title="Account activity — what still needs action"
          defaultOpenState="open"
          defaultPageSize={25}
        />
      </div>
    </div>

  );
}
