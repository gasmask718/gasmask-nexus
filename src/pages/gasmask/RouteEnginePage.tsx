import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Truck, Brain, Plus, MapPin, Clock, AlertTriangle, CheckCircle2, Calendar, RefreshCw, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

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
  floor1_crm: 'CRM',
  floor2_inventory: 'INV',
  floor3_comms: 'COMMS',
  floor4_delivery: 'DELIV',
  floor5_territory: 'TERR',
  floor9_ai_ops: 'AI',
  penthouse: 'CEO',
  manual: 'MANUAL',
};

export default function RouteEnginePage() {
  const queryClient = useQueryClient();
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showRouteBuilder, setShowRouteBuilder] = useState(false);
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [routeBuilderStep, setRouteBuilderStep] = useState(1);
  const [routeConfig, setRouteConfig] = useState({ driver_name: '', scheduled_date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
  const [buildingRoute, setBuildingRoute] = useState(false);

  // Manual trigger form state
  const [triggerForm, setTriggerForm] = useState({
    store_name: '', store_address: '', store_city: '', store_state: '', store_phone: '',
    trigger_type: 'follow_up', floor_source: 'manual', urgency: 'normal', priority_score: 5, trigger_notes: '',
  });

  const { data: triggers = [], refetch: refetchTriggers } = useQuery({
    queryKey: ['gasmask-visit-triggers'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('gasmask_visit_triggers').select('*').order('priority_score', { ascending: false });
      return data || [];
    },
    refetchInterval: 15000,
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['gasmask-route-runs'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('gasmask_route_runs').select('*').order('created_at', { ascending: false }).limit(10);
      return data || [];
    },
  });

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('route-engine-triggers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gasmask_visit_triggers' }, () => {
        queryClient.invalidateQueries({ queryKey: ['gasmask-visit-triggers'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const pending = triggers.filter((t: any) => t.status === 'pending');
  const scheduled = triggers.filter((t: any) => t.status === 'scheduled' && t.scheduled_for === format(new Date(), 'yyyy-MM-dd'));
  const completed = triggers.filter((t: any) => t.status === 'completed' && t.completed_at && new Date(t.completed_at).toDateString() === new Date().toDateString());
  const critical = pending.filter((t: any) => t.urgency === 'critical');
  const high = pending.filter((t: any) => t.urgency === 'high');
  const normal = pending.filter((t: any) => t.urgency === 'normal' || t.urgency === 'low');

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('gasmask-route-agent', { body: { action: 'analyze' } });
      if (error) throw error;
      setAnalysis(data?.analysis);
      toast.success('AI analysis complete');
      refetchTriggers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const submitManualTrigger = async () => {
    if (!triggerForm.store_name) { toast.error('Store name required'); return; }
    try {
      const { data, error } = await supabase.functions.invoke('gasmask-route-agent', {
        body: { action: 'create_trigger', trigger_source: 'Manual Entry', ...triggerForm },
      });
      if (error) throw error;
      if (data?.duplicate) { toast.info('Trigger already exists for this store'); } else { toast.success('Trigger added'); }
      setShowAddForm(false);
      setTriggerForm({ store_name: '', store_address: '', store_city: '', store_state: '', store_phone: '', trigger_type: 'follow_up', floor_source: 'manual', urgency: 'normal', priority_score: 5, trigger_notes: '' });
      refetchTriggers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const buildRoute = async () => {
    if (!selectedTriggers.length) { toast.error('Select triggers first'); return; }
    setBuildingRoute(true);
    try {
      const { data, error } = await supabase.functions.invoke('gasmask-route-agent', {
        body: { action: 'build_route', trigger_ids: selectedTriggers, driver_name: routeConfig.driver_name, scheduled_date: routeConfig.scheduled_date, route_notes: routeConfig.notes },
      });
      if (error) throw error;
      toast.success(`Route created: ${data?.total_stops} stops, ~${data?.estimated_hours}h`);
      setShowRouteBuilder(false);
      setSelectedTriggers([]);
      setRouteBuilderStep(1);
      refetchTriggers();
      queryClient.invalidateQueries({ queryKey: ['gasmask-route-runs'] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBuildingRoute(false);
    }
  };

  const completeTrigger = async (id: string) => {
    await (supabase as any).from('gasmask_visit_triggers').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id);
    toast.success('Marked complete');
    refetchTriggers();
  };

  const snoozeTrigger = async (id: string) => {
    await (supabase as any).from('gasmask_visit_triggers').update({ status: 'snoozed' }).eq('id', id);
    toast.info('Snoozed');
    refetchTriggers();
  };

  const toggleTriggerSelection = (id: string) => {
    setSelectedTriggers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const TriggerCard = ({ trigger }: { trigger: any }) => {
    const uc = URGENCY_CONFIG[trigger.urgency] || URGENCY_CONFIG.normal;
    const tc = TRIGGER_TYPE_COLORS[trigger.trigger_type] || TRIGGER_TYPE_COLORS.other;
    const fl = FLOOR_LABELS[trigger.floor_source] || trigger.floor_source;
    const age = Math.round((Date.now() - new Date(trigger.created_at).getTime()) / 3600000);
    const isSelected = selectedTriggers.includes(trigger.id);

    return (
      <div className={`rounded-lg border p-3 space-y-2 transition-all cursor-pointer hover:shadow-md ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'bg-card'}`} onClick={() => toggleTriggerSelection(trigger.id)}>
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-sm leading-tight">{trigger.store_name}</h4>
          <Badge variant="outline" className={`text-[10px] shrink-0 ${uc.color}`}>{uc.icon} {uc.label}</Badge>
        </div>
        {(trigger.store_city || trigger.store_state) && (
          <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{[trigger.store_city, trigger.store_state].filter(Boolean).join(', ')}</p>
        )}
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className={`text-[10px] ${tc}`}>{trigger.trigger_type.replace('_', ' ')}</Badge>
          <Badge variant="outline" className="text-[10px]">{fl}</Badge>
          <Badge variant="outline" className="text-[10px]">P{trigger.priority_score}</Badge>
        </div>
        {trigger.ai_recommendation && (
          <p className="text-xs text-muted-foreground bg-muted/50 rounded p-1.5 leading-relaxed">🤖 {trigger.ai_recommendation}</p>
        )}
        {trigger.trigger_notes && (
          <p className="text-xs text-muted-foreground truncate">{trigger.trigger_notes}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{age}h ago</span>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => completeTrigger(trigger.id)}>✅</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => snoozeTrigger(trigger.id)}>💤</Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="h-6 w-6" />Multi-Brand Delivery Route Engine</h1>
          <p className="text-sm text-muted-foreground">All visit triggers organized into optimized driver runs</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={runAnalysis} disabled={analyzing} className="gap-2">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            AI Analyze & Advise
          </Button>
          <Button variant="outline" onClick={() => { setShowRouteBuilder(true); setRouteBuilderStep(1); }} disabled={!selectedTriggers.length} className="gap-2">
            <MapPin className="h-4 w-4" />Build Route{selectedTriggers.length > 0 && ` (${selectedTriggers.length})`}
          </Button>
          <Button variant="outline" onClick={() => setShowAddForm(true)} className="gap-2"><Plus className="h-4 w-4" />Add Trigger</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Critical', count: critical.length, icon: '🔴', cls: 'border-red-500/30' },
          { label: 'High', count: high.length, icon: '🟠', cls: 'border-amber-500/30' },
          { label: 'Normal', count: normal.length, icon: '🟡', cls: 'border-border' },
          { label: "Today's Routes", count: routes.filter((r: any) => r.scheduled_date === format(new Date(), 'yyyy-MM-dd')).length, icon: '✅', cls: 'border-emerald-500/30' },
          { label: 'Total Pending', count: pending.length, icon: '📍', cls: 'border-primary/30' },
        ].map(s => (
          <Card key={s.label} className={`border ${s.cls}`}>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">{s.icon} {s.count}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Advisory Panel */}
      {analysis && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4" />AI Route Intelligence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{analysis.summary}</p>
            {analysis.stores_to_prioritize?.length > 0 && (
              <div>
                <p className="font-medium mb-1">Stores to Prioritize:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                  {analysis.stores_to_prioritize.map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            {analysis.stores_at_risk?.length > 0 && (
              <div>
                <p className="font-medium mb-1 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" />At-Risk Accounts:</p>
                {analysis.stores_at_risk.map((s: any, i: number) => (
                  <div key={i} className="bg-amber-500/10 rounded p-2 text-xs mb-1">
                    <span className="font-medium">{s.store}</span> — {s.reason} → <span className="text-amber-600">{s.action}</span>
                  </div>
                ))}
              </div>
            )}
            {analysis.route_groups?.length > 0 && (
              <div>
                <p className="font-medium mb-1">Suggested Route Groups:</p>
                {analysis.route_groups.map((g: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-muted/50 rounded p-2 text-xs mb-1">
                    <span>📍 {g.group_name} — {g.trigger_ids?.length || 0} stops</span>
                    <span>~{Math.round((g.estimated_duration_minutes || 0) / 60 * 10) / 10}h • {g.suggested_date}</span>
                  </div>
                ))}
                <Button size="sm" variant="outline" className="mt-2" onClick={() => {
                  if (analysis.route_groups?.[0]?.trigger_ids) {
                    setSelectedTriggers(analysis.route_groups[0].trigger_ids);
                    setShowRouteBuilder(true);
                    setRouteBuilderStep(1);
                  }
                }}>Create Routes from Suggestions</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Trigger Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Critical */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-red-500/30">
            <span className="text-sm font-semibold text-red-500">🔴 Critical</span>
            <Badge variant="outline" className="text-[10px]">{critical.length}</Badge>
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {critical.map((t: any) => <TriggerCard key={t.id} trigger={t} />)}
            {!critical.length && <p className="text-xs text-muted-foreground text-center py-4">No critical triggers</p>}
          </div>
        </div>

        {/* High */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-amber-500/30">
            <span className="text-sm font-semibold text-amber-500">🟠 High Priority</span>
            <Badge variant="outline" className="text-[10px]">{high.length}</Badge>
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {high.map((t: any) => <TriggerCard key={t.id} trigger={t} />)}
            {!high.length && <p className="text-xs text-muted-foreground text-center py-4">No high priority</p>}
          </div>
        </div>

        {/* Normal */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b">
            <span className="text-sm font-semibold">🟡 Normal</span>
            <Badge variant="outline" className="text-[10px]">{normal.length}</Badge>
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {normal.map((t: any) => <TriggerCard key={t.id} trigger={t} />)}
            {!normal.length && <p className="text-xs text-muted-foreground text-center py-4">No normal triggers</p>}
          </div>
        </div>

        {/* Scheduled Today */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-blue-500/30">
            <span className="text-sm font-semibold text-blue-500">📅 Scheduled Today</span>
            <Badge variant="outline" className="text-[10px]">{scheduled.length}</Badge>
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {scheduled.map((t: any) => <TriggerCard key={t.id} trigger={t} />)}
            {!scheduled.length && <p className="text-xs text-muted-foreground text-center py-4">None scheduled today</p>}
          </div>
        </div>

        {/* Completed Today */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-emerald-500/30">
            <span className="text-sm font-semibold text-emerald-500">✅ Completed Today</span>
            <Badge variant="outline" className="text-[10px]">{completed.length}</Badge>
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {completed.map((t: any) => <TriggerCard key={t.id} trigger={t} />)}
            {!completed.length && <p className="text-xs text-muted-foreground text-center py-4">None completed yet</p>}
          </div>
        </div>
      </div>

      {/* Active Routes Panel */}
      {routes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Active Routes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {routes.filter((r: any) => r.status !== 'cancelled').slice(0, 5).map((route: any) => (
              <div key={route.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div>
                  <p className="font-medium text-sm">{route.run_name}</p>
                  <p className="text-xs text-muted-foreground">{route.driver_name} • {route.scheduled_date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium">{route.completed_stops}/{route.total_stops} stops</p>
                    <div className="w-20 h-1.5 bg-muted rounded-full mt-1">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${route.total_stops ? (route.completed_stops / route.total_stops) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{route.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Add Trigger Modal */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Visit Trigger</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '🔴 Low Stock', type: 'restock', floor: 'floor2_inventory', urg: 'high' },
                { label: '🟠 Follow-Up', type: 'follow_up', floor: 'floor1_crm', urg: 'normal' },
                { label: '🔴 Complaint', type: 'complaint', floor: 'floor3_comms', urg: 'critical' },
              ].map(q => (
                <Button key={q.type} variant="outline" size="sm" className="text-xs h-auto py-2" onClick={() => setTriggerForm(f => ({ ...f, trigger_type: q.type, floor_source: q.floor, urgency: q.urg }))}>
                  {q.label}
                </Button>
              ))}
            </div>
            <div><Label className="text-xs">Store Name *</Label><Input value={triggerForm.store_name} onChange={e => setTriggerForm(f => ({ ...f, store_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">City</Label><Input value={triggerForm.store_city} onChange={e => setTriggerForm(f => ({ ...f, store_city: e.target.value }))} /></div>
              <div><Label className="text-xs">State</Label><Input value={triggerForm.store_state} onChange={e => setTriggerForm(f => ({ ...f, store_state: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Trigger Type</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={triggerForm.trigger_type} onChange={e => setTriggerForm(f => ({ ...f, trigger_type: e.target.value }))}>
                {['restock', 'urgent_visit', 'follow_up', 'audit', 'prospecting', 'first_visit', 'pickup', 'complaint', 'escalation', 'ai_flag', 'merchandising', 'compliance', 'collection', 'training', 'other'].map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
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
            <div><Label className="text-xs">Notes</Label><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]" value={triggerForm.trigger_notes} onChange={e => setTriggerForm(f => ({ ...f, trigger_notes: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={submitManualTrigger}>Submit Trigger</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Route Builder Modal */}
      <Dialog open={showRouteBuilder} onOpenChange={setShowRouteBuilder}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Build Route — Step {routeBuilderStep}/2</DialogTitle></DialogHeader>
          {routeBuilderStep === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{selectedTriggers.length} triggers selected. Configure route:</p>
              <div><Label className="text-xs">Driver Name</Label><Input value={routeConfig.driver_name} onChange={e => setRouteConfig(c => ({ ...c, driver_name: e.target.value }))} placeholder="Driver name" /></div>
              <div><Label className="text-xs">Date</Label><Input type="date" value={routeConfig.scheduled_date} onChange={e => setRouteConfig(c => ({ ...c, scheduled_date: e.target.value }))} /></div>
              <div><Label className="text-xs">Notes</Label><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]" value={routeConfig.notes} onChange={e => setRouteConfig(c => ({ ...c, notes: e.target.value }))} /></div>
              <p className="text-xs text-muted-foreground">Selected stops:</p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {pending.filter((t: any) => selectedTriggers.includes(t.id)).map((t: any) => (
                  <div key={t.id} className="flex items-center gap-2 text-xs p-1.5 bg-muted/50 rounded">
                    <MapPin className="h-3 w-3 shrink-0" />{t.store_name} — {t.trigger_type.replace('_', ' ')}
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRouteBuilder(false)}>Cancel</Button>
            <Button onClick={buildRoute} disabled={buildingRoute} className="gap-2">
              {buildingRoute ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirm & Create Route
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
