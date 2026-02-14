// ═══════════════════════════════════════════════════════════════════════════════
// AI SUGGESTIONS PANEL — Phase 4: Advisory Intelligence (Visual Only)
// ═══════════════════════════════════════════════════════════════════════════════
// No auto-dispatch. No mutations. Human-in-the-loop only.
// Phase 5A: Telemetry tracking for learning analytics.

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  useAIDispatchSuggestions,
  type AIRecommendation,
  type AIDispatchSettings,
} from '@/hooks/useAIDispatchSuggestions';
import { useAIDispatchTelemetry } from '@/hooks/useAIDispatchTelemetry';
import { useConfidenceCorrections } from '@/hooks/useConfidenceCorrections';
import { FeedbackReasonModal } from './FeedbackReasonModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Brain,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  MapPin,
  Truck,
  Users,
  Eye,
  EyeOff,
  Settings2,
  Sparkles,
  Package,
  RotateCcw,
  Layers,
} from 'lucide-react';

interface AISuggestionsPanelProps {
  onApplySuggestion: (rec: AIRecommendation) => void;
}

const ACTION_LABELS: Record<string, { label: string; icon: typeof Truck; color: string }> = {
  assign: { label: 'Assign', icon: Truck, color: 'bg-primary/10 text-primary border-primary/30' },
  delay: { label: 'Delay', icon: Clock, color: 'bg-muted text-muted-foreground border-muted-foreground/30' },
  bundle: { label: 'Bundle', icon: Layers, color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  revisit: { label: 'Revisit', icon: RotateCcw, color: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
};

const RISK_STYLES: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/30',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  low: 'bg-green-500/10 text-green-600 border-green-500/30',
};

export function AISuggestionsPanel({ onApplySuggestion }: AISuggestionsPanelProps) {
  const [settings, setSettings] = useState<AIDispatchSettings>({
    enabled: true,
    minConfidence: 70,
    maxBundleSize: 5,
    slaDominance: true,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [requireDoubleConfirm, setRequireDoubleConfirm] = useState(false);
  const [pendingApply, setPendingApply] = useState<string | null>(null);
  const [visibilityTimestamps, setVisibilityTimestamps] = useState<Map<string, number>>(new Map());
  const [feedbackModal, setFeedbackModal] = useState<{ open: boolean; feedbackId: string | null; eventType: 'applied' | 'dismissed' }>({ open: false, feedbackId: null, eventType: 'applied' });
  const { user } = useAuth();

  const { recommendations, isLoading, totalSignals } = useAIDispatchSuggestions(settings);
  const { trackShown, trackApplied, trackDismissed, startIgnoreTimer, cancelIgnoreTimer } = useAIDispatchTelemetry();
  const { approvedCorrections, translateConfidence } = useConfidenceCorrections();

  const visibleRecs = useMemo(
    () => recommendations.filter(r => !dismissedIds.has(r.store_id)),
    [recommendations, dismissedIds]
  );

  const toggleExpanded = (storeId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  };

  const handleApply = (rec: AIRecommendation) => {
    if (requireDoubleConfirm && pendingApply !== rec.store_id) {
      setPendingApply(rec.store_id);
      return;
    }
    
    // Cancel ignore timer and record "applied" event
    cancelIgnoreTimer(rec.store_id);
    const latencySeconds = visibilityTimestamps.get(rec.store_id)
      ? Math.round((Date.now() - visibilityTimestamps.get(rec.store_id)!) / 1000)
      : 0;
    trackApplied(rec, latencySeconds);
    
    // Find the feedback ID for the reason modal
    findFeedbackId(rec.store_id, 'applied');
    
    setPendingApply(null);
    onApplySuggestion(rec);
  };

  const findFeedbackId = useCallback(async (storeId: string, eventType: 'applied' | 'dismissed') => {
    try {
      const { data } = await supabase
        .from('ai_dispatch_feedback')
        .select('id')
        .eq('store_id', storeId)
        .eq('event_type', eventType)
        .order('created_at', { ascending: false })
        .limit(1);
      if (data?.[0]) {
        setFeedbackModal({ open: true, feedbackId: data[0].id, eventType });
      }
    } catch {
      // Silent — modal is optional
    }
  }, []);

  const handleDismiss = (storeId: string) => {
    const rec = recommendations.find(r => r.store_id === storeId);
    if (rec) {
      cancelIgnoreTimer(storeId);
      const latencySeconds = visibilityTimestamps.get(storeId)
        ? Math.round((Date.now() - visibilityTimestamps.get(storeId)!) / 1000)
        : 0;
      trackDismissed(rec, latencySeconds);
      findFeedbackId(storeId, 'dismissed');
    }
    setDismissedIds(prev => new Set(prev).add(storeId));
  };

  if (!settings.enabled) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <Brain className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground mb-3">AI Suggestions are disabled</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettings(s => ({ ...s, enabled: true }))}
          >
            <Eye className="h-4 w-4 mr-1" />
            Enable AI Suggestions
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Suggestions
              <Badge variant="outline" className="text-xs font-normal">Advisory</Badge>
            </CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              AI suggestion — you are in control
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettings(s => ({ ...s, enabled: false }))}
              title="Turn off AI suggestions"
            >
              <EyeOff className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Admin Controls */}
        {showSettings && (
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="pt-4 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Controls
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Minimum Confidence: {settings.minConfidence}%</Label>
                <Slider
                  value={[settings.minConfidence]}
                  onValueChange={([v]) => setSettings(s => ({ ...s, minConfidence: v }))}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Max Bundle Size: {settings.maxBundleSize}</Label>
                <Slider
                  value={[settings.maxBundleSize]}
                  onValueChange={([v]) => setSettings(s => ({ ...s, maxBundleSize: v }))}
                  min={2}
                  max={10}
                  step={1}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">SLA Dominance</Label>
                <Switch
                  checked={settings.slaDominance}
                  onCheckedChange={(v) => setSettings(s => ({ ...s, slaDominance: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Double-confirm on Apply</Label>
                <Switch
                  checked={requireDoubleConfirm}
                  onCheckedChange={setRequireDoubleConfirm}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Bar */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>
            {visibleRecs.length} suggestion{visibleRecs.length !== 1 ? 's' : ''} from {totalSignals} signal{totalSignals !== 1 ? 's' : ''}
          </span>
          {dismissedIds.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-6"
              onClick={() => setDismissedIds(new Set())}
            >
              Show {dismissedIds.size} dismissed
            </Button>
          )}
        </div>

        {/* Recommendations */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : visibleRecs.length === 0 ? (
          <EmptyState
            icon={Brain}
            title="No suggestions"
            description={
              totalSignals === 0
                ? 'No active signals to analyze'
                : `No stores meet the ${settings.minConfidence}% confidence threshold`
            }
          />
        ) : (
          <ScrollArea className="h-[500px] pr-2">
            <div className="space-y-3">
              {visibleRecs.map(rec => {
                const actionMeta = ACTION_LABELS[rec.recommended_action] || ACTION_LABELS.assign;
                const ActionIcon = actionMeta.icon;
                const isExpanded = expandedIds.has(rec.store_id);
                const isPendingConfirm = pendingApply === rec.store_id;

                // Track visibility on mount
                useEffect(() => {
                  if (!visibilityTimestamps.has(rec.store_id)) {
                    const timestamp = Date.now();
                    setVisibilityTimestamps(prev => new Map(prev).set(rec.store_id, timestamp));
                    trackShown(rec);
                    // Start ignore timer (10 min default)
                    startIgnoreTimer(rec, 10 * 60 * 1000);
                  }
                }, [rec, visibilityTimestamps, trackShown, startIgnoreTimer]);

                return (
                  <Card
                    key={rec.store_id}
                    className={`transition-all ${
                      rec.risk_level === 'high'
                        ? 'border-l-4 border-l-destructive'
                        : rec.risk_level === 'medium'
                        ? 'border-l-4 border-l-amber-500'
                        : ''
                    }`}
                  >
                    <CardContent className="pt-4 pb-3 space-y-3">
                      {/* Header Row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">{rec.store_name}</span>
                            {rec.territory && (
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                <MapPin className="h-3 w-3 mr-0.5" />
                                {rec.territory}
                              </Badge>
                            )}
                          </div>

                          {/* Action + Risk + Confidence */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={actionMeta.color}>
                              <ActionIcon className="h-3 w-3 mr-1" />
                              {actionMeta.label}
                            </Badge>
                            <Badge variant="outline" className={RISK_STYLES[rec.risk_level]}>
                              {rec.risk_level === 'high' && <AlertTriangle className="h-3 w-3 mr-1" />}
                              {rec.risk_level}
                            </Badge>
                            {(() => {
                              const translated = translateConfidence(rec.confidence, {
                                sla: rec.contributing_factors.sla_severity,
                                risk: rec.risk_level,
                              });
                              return (
                                <>
                                  <span className="text-xs font-mono text-muted-foreground">
                                    {translated.corrected ? (
                                      <span title={`Raw: ${translated.raw}%`}>
                                        {translated.displayed}% conf.
                                        {' '}
                                        <Badge variant="secondary" className="text-xs">Adjusted</Badge>
                                      </span>
                                    ) : (
                                      `${rec.confidence}% conf.`
                                    )}
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Suggested Worker */}
                        {rec.suggested_assignee_names.length > 0 && (
                          <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                            <Users className="h-3.5 w-3.5 inline mr-1" />
                            {rec.suggested_assignee_names[0]}
                          </div>
                        )}
                      </div>

                      {/* Top Reasons (always visible) */}
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {rec.reasons.slice(0, 2).map((reason, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>

                      {/* Expandable "Why" Section */}
                      {rec.reasons.length > 2 && (
                        <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(rec.store_id)}>
                          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:underline">
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            {isExpanded ? 'Hide details' : `+${rec.reasons.length - 2} more reasons`}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2 space-y-2">
                            <div className="text-xs text-muted-foreground space-y-0.5 pl-3 border-l-2 border-primary/20">
                              {rec.reasons.slice(2).map((reason, i) => (
                                <div key={i} className="flex items-start gap-1.5">
                                  <span className="text-primary mt-0.5">•</span>
                                  <span>{reason}</span>
                                </div>
                              ))}
                            </div>

                            {/* Contributing Factors */}
                            <div className="grid grid-cols-3 gap-2 p-2 bg-muted/30 rounded text-xs">
                              <div>
                                <div className="text-muted-foreground">SLA</div>
                                <div className="font-mono">{rec.contributing_factors.sla_severity}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Urgency</div>
                                <div className="font-mono">{rec.contributing_factors.urgency_score}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Last Visit</div>
                                <div className="font-mono">
                                  {rec.contributing_factors.last_visit_days !== null
                                    ? `${rec.contributing_factors.last_visit_days}d`
                                    : 'never'}
                                </div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Opp Age</div>
                                <div className="font-mono">
                                  {rec.contributing_factors.opportunity_age_days !== null
                                    ? `${rec.contributing_factors.opportunity_age_days}d`
                                    : '—'}
                                </div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">FU Overdue</div>
                                <div className="font-mono">
                                  {rec.contributing_factors.follow_up_overdue_hours !== null
                                    ? `${rec.contributing_factors.follow_up_overdue_hours}h`
                                    : '—'}
                                </div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Worker Load</div>
                                <div className="font-mono">{rec.contributing_factors.worker_load_score}</div>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => handleApply(rec)}
                          className={isPendingConfirm ? 'bg-amber-600 hover:bg-amber-700' : ''}
                        >
                          {isPendingConfirm ? 'Confirm Apply?' : 'Apply to Route'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDismiss(rec.store_id)}
                        >
                          Dismiss
                        </Button>
                        {isPendingConfirm && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPendingApply(null)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Phase 5B: Optional Feedback Reason Modal */}
      <FeedbackReasonModal
        open={feedbackModal.open}
        onClose={() => setFeedbackModal({ open: false, feedbackId: null, eventType: 'applied' })}
        feedbackId={feedbackModal.feedbackId}
        eventType={feedbackModal.eventType}
      />
    </Card>
  );
}
