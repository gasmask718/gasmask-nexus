import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Navigation, Phone, Loader2, Brain, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export default function DriverRoutePage() {
  const queryClient = useQueryClient();
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [checklistItems, setChecklistItems] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [generatingChecklist, setGenerating] = useState<string | null>(null);
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: stops = [], refetch } = useQuery({
    queryKey: ['driver-route-today'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('gasmask_visit_triggers')
        .select('*')
        .eq('scheduled_for', today)
        .in('status', ['scheduled', 'in_route', 'completed'])
        .order('route_position', { ascending: true });
      return data || [];
    },
    refetchInterval: 30000,
  });

  const triggerIds = (stops as any[]).map((s: any) => s.id);
  const { data: checklists = [] } = useQuery({
    queryKey: ['driver-checklists', triggerIds.join(',')],
    queryFn: async () => {
      if (!triggerIds.length) return [];
      const { data } = await (supabase as any)
        .from('visit_action_checklists')
        .select('*')
        .in('trigger_id', triggerIds);
      return data || [];
    },
    enabled: triggerIds.length > 0,
  });

  const completedCount = (stops as any[]).filter((s: any) => s.status === 'completed').length;
  const totalCount = stops.length;
  const pct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  const getChecklist = (stopId: string) =>
    (checklists as any[]).find((c: any) => c.trigger_id === stopId);

  const generateChecklist = async (stop: any) => {
    setGenerating(stop.id);
    try {
      await supabase.functions.invoke('generate-visit-checklist', {
        body: { trigger_id: stop.id, assigned_to: stop.assigned_driver_name, assigned_role: 'driver' },
      });
      queryClient.invalidateQueries({ queryKey: ['driver-checklists'] });
      toast.success('Checklist generated!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(null);
    }
  };

  const completeStop = async (stop: any) => {
    setCompleting(stop.id);
    try {
      await (supabase as any).from('gasmask_visit_triggers').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completion_notes: notes,
      }).eq('id', stop.id);

      const checklist = getChecklist(stop.id);
      if (checklist) {
        await (supabase as any).from('visit_action_checklists').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completion_notes: notes,
          outcome: notes || 'Completed',
          items_completed: Object.entries(checklistItems).filter(([, v]) => v).map(([k]) => k),
        }).eq('id', checklist.id);
      }

      // Mark the canonical route_stop as completed (matched by route_id + store_id).
      // Progress is derived from route_stops.status — no counter to maintain.
      if (stop.route_id && stop.store_id) {
        await (supabase as any)
          .from('route_stops')
          .update({ status: 'completed', actual_departure: new Date().toISOString(), notes: notes || null })
          .eq('route_id', stop.route_id)
          .eq('store_id', stop.store_id);
      }

      toast.success('Stop completed! ✅');
      setActiveStopId(null);
      setNotes('');
      setChecklistItems({});
      refetch();
      queryClient.invalidateQueries({ queryKey: ['driver-checklists'] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCompleting(null);
    }
  };

  const toggleItem = (key: string) => {
    setChecklistItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      {/* Progress Header */}
      <div className="text-center space-y-2">
        <h1 className="text-xl font-bold">Today's Route</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMM d')}</p>
        <div className="text-3xl font-bold">{completedCount}/{totalCount} stops</div>
        <div className="w-full h-3 bg-muted rounded-full">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-sm text-muted-foreground">{pct}% complete</p>
      </div>

      {/* Stop Cards */}
      <div className="space-y-3">
        {(stops as any[]).map((stop: any, idx: number) => {
          const done = stop.status === 'completed';
          const checklist = getChecklist(stop.id);
          const isExpanded = activeStopId === stop.id;

          return (
            <Card key={stop.id} className={`transition-all ${done ? 'opacity-60 border-emerald-500/30' : 'border-primary/20'}`}>
              <CardContent className="p-4 space-y-3">
                {/* Stop header */}
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${done ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
                    {done ? <CheckCircle2 className="h-5 w-5" /> : stop.route_position || idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base">{stop.store_name}</h3>
                    {(stop.store_city || stop.store_state) && (
                      <p className="text-xs text-muted-foreground">
                        {[stop.store_city, stop.store_state].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className={`text-[9px] shrink-0 ${stop.urgency === 'critical' ? 'text-red-500 border-red-500/30' : stop.urgency === 'high' ? 'text-amber-500 border-amber-500/30' : ''}`}>
                    {stop.urgency}
                  </Badge>
                </div>

                {/* Trigger badges */}
                <div className="flex gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-xs">{stop.trigger_type?.replace(/_/g, ' ')}</Badge>
                  {checklist && <Badge variant="outline" className="text-xs text-emerald-500 border-emerald-500/30">🤖 Checklist ready</Badge>}
                </div>

                {/* CHECKLIST CONTENT */}
                {!done && (
                  <>
                    {checklist ? (
                      <div className="space-y-2">
                        {/* Objective */}
                        <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                          <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-0.5">🎯 Objective</p>
                          <p className="text-sm">{checklist.visit_objective}</p>
                        </div>

                        {/* Best approach (always visible) */}
                        {checklist.best_approach && (
                          <div className="p-2 rounded-lg bg-muted/50">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">💡 Approach</p>
                            <p className="text-xs text-muted-foreground">{checklist.best_approach}</p>
                          </div>
                        )}

                        {/* Collapsed preview */}
                        {!isExpanded && (
                          <div className="p-2 rounded-lg bg-muted/30">
                            <p className="text-xs font-medium">✅ {(checklist.priority_actions as any[])?.length || 0} Actions</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {(checklist.priority_actions as any[])?.[0]}
                              {(checklist.priority_actions as any[])?.length > 1 && ` +${(checklist.priority_actions as any[]).length - 1} more`}
                            </p>
                          </div>
                        )}

                        {/* Expanded checklist */}
                        {isExpanded && (
                          <div className="space-y-3">
                            {/* Products to bring */}
                            {(checklist.products_to_bring as any[])?.length > 0 && (
                              <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1">📦 Bring With You</p>
                                <div className="space-y-1">
                                  {(checklist.products_to_bring as any[]).map((item: string, i: number) => (
                                    <div key={i} className="flex items-start gap-1.5 text-xs">
                                      <span className="text-amber-500 shrink-0">▶</span>
                                      <span>{item}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Priority actions */}
                            <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1">✅ Actions to Complete</p>
                              <div className="space-y-1.5">
                                {(checklist.priority_actions as any[])?.map((action: string, i: number) => {
                                  const key = `action-${i}`;
                                  return (
                                    <label key={key} className="flex items-start gap-2 text-xs cursor-pointer">
                                      <input type="checkbox" checked={!!checklistItems[key]} onChange={() => toggleItem(key)} className="mt-0.5 shrink-0" />
                                      <span className={checklistItems[key] ? 'line-through text-muted-foreground' : ''}>{action}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Things to check */}
                            {(checklist.things_to_check as any[])?.length > 0 && (
                              <div className="p-2 rounded-lg bg-blue-500/5 border border-blue-500/20">
                                <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1">👁 Check These</p>
                                <div className="space-y-1.5">
                                  {(checklist.things_to_check as any[]).map((item: string, i: number) => {
                                    const key = `check-${i}`;
                                    return (
                                      <label key={key} className="flex items-start gap-2 text-xs cursor-pointer">
                                        <input type="checkbox" checked={!!checklistItems[key]} onChange={() => toggleItem(key)} className="mt-0.5 shrink-0" />
                                        <span className={checklistItems[key] ? 'line-through text-muted-foreground' : ''}>{item}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Talking points */}
                            {(checklist.talking_points as any[])?.length > 0 && (
                              <div className="p-2 rounded-lg bg-violet-500/5 border border-violet-500/20">
                                <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide mb-1">💬 Say to Owner</p>
                                <div className="space-y-1">
                                  {(checklist.talking_points as any[]).map((point: string, i: number) => (
                                    <p key={i} className="text-xs italic text-muted-foreground">"{point}"</p>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Photos required */}
                            {(checklist.photos_required as any[])?.length > 0 && (
                              <div className="p-2 rounded-lg bg-muted/50">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">📸 Photos to Take</p>
                                <div className="space-y-1">
                                  {(checklist.photos_required as any[]).map((photo: string, i: number) => (
                                    <div key={i} className="flex items-start gap-1.5 text-xs">
                                      <span className="shrink-0">📷</span>
                                      <span>{photo}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Store context */}
                            {checklist.store_context && (
                              <div className="p-2 rounded-lg bg-muted/30">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">📋 Store Context</p>
                                <p className="text-xs text-muted-foreground">{checklist.store_context}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-muted/50">
                        {stop.ai_recommendation ? (
                          <p className="text-xs">🤖 {stop.ai_recommendation}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">{stop.trigger_notes || 'No checklist generated yet'}</p>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        {stop.store_address && (
                          <Button variant="outline" size="sm" className="flex-1 gap-1" asChild>
                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.store_address + ' ' + (stop.store_city || ''))}`} target="_blank" rel="noopener noreferrer">
                              <Navigation className="h-3.5 w-3.5" /> Navigate
                            </a>
                          </Button>
                        )}
                        {stop.store_phone && (
                          <Button variant="outline" size="sm" className="gap-1" asChild>
                            <a href={`tel:${stop.store_phone}`}><Phone className="h-3.5 w-3.5" /></a>
                          </Button>
                        )}
                        {!checklist && (
                          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => generateChecklist(stop)} disabled={generatingChecklist === stop.id}>
                            {generatingChecklist === stop.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                            AI Checklist
                          </Button>
                        )}
                      </div>

                      {/* Expand/collapse toggle */}
                      {checklist && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs gap-1"
                          onClick={() => {
                            if (isExpanded) {
                              setActiveStopId(null);
                            } else {
                              setActiveStopId(stop.id);
                              setChecklistItems({});
                              setNotes('');
                            }
                          }}
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          {isExpanded ? 'Collapse Checklist' : 'Show Full Checklist'}
                        </Button>
                      )}

                      {/* Completion section (expanded) */}
                      {isExpanded && (
                        <div className="space-y-2 pt-1 border-t border-border">
                          <textarea
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[40px]"
                            placeholder="Completion notes..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                          />
                          <Button className="w-full gap-2 h-12 text-base" onClick={() => completeStop(stop)} disabled={completing === stop.id}>
                            {completing === stop.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                            Mark Complete
                          </Button>
                        </div>
                      )}

                      {/* Quick complete (collapsed) */}
                      {!isExpanded && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full text-xs text-emerald-600"
                          onClick={async () => {
                            await (supabase as any).from('gasmask_visit_triggers').update({
                              status: 'completed',
                              completed_at: new Date().toISOString(),
                            }).eq('id', stop.id);
                            refetch();
                            toast.success('Marked complete');
                          }}
                        >
                          Quick Complete ✓
                        </Button>
                      )}
                    </div>
                  </>
                )}

                {/* Completed state */}
                {done && (
                  <div className="text-xs text-emerald-600 flex items-center gap-1">
                    ✅ Completed{' '}
                    {stop.completed_at && formatDistanceToNow(new Date(stop.completed_at), { addSuffix: true })}
                    {stop.completion_notes && <span className="text-muted-foreground ml-1">— {stop.completion_notes}</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Empty state */}
        {stops.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <div className="text-5xl mb-4">🚚</div>
            <p className="font-medium">No stops scheduled today</p>
            <p className="text-sm mt-1">Routes will appear here when assigned by dispatch</p>
          </div>
        )}
      </div>
    </div>
  );
}
