import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { VoiceProviderSelector } from '@/components/communication/VoiceProviderSelector';
import { Phone, Zap, MessageSquare, ListPlus, X, Bot, User, AlertTriangle, CheckCircle, Loader2, Wrench, ShieldAlert, Play, Pause, Square, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { triggerFollowUp } from '@/services/followUpTriggerService';
import { useExecutionReadiness } from '@/hooks/useExecutionReadiness';
import { useExecutionRun, SpeedPreset } from '@/hooks/useExecutionRun';
import type { ExecutionHealthStatus } from '@/hooks/useExecutionReadiness';
import type { FollowUpQueueItem } from '@/hooks/useFollowUps';

type CallRoute = 'human' | 'ai' | 'hybrid';

export type ExecutionTarget = {
  store_id: string;
  source: 'cadence' | 'followup';
  reason?: string;
  phone?: string | null;
  contact_id?: string;
  follow_up_id?: string;
  priority?: number;
  business_id?: string | null;
};

type ExecutionState = 'NO_SELECTION' | 'RESOLVING' | 'NO_PHONES' | 'READY_IMMEDIATE' | 'READY_QUEUE_ONLY';

interface FollowUpExecutionBarProps {
  executionTargets: ExecutionTarget[];
  onClear: () => void;
  onExecutionComplete?: () => void;
}

const LARGE_SELECTION_THRESHOLD = 50;

export function FollowUpExecutionBar({ executionTargets, onClear, onExecutionComplete }: FollowUpExecutionBarProps) {
  const [voiceProvider, setVoiceProvider] = useState('auto');
  const [callRoute, setCallRoute] = useState<CallRoute>('human');
  const [isExecuting, setIsExecuting] = useState(false);
  const [showFixPhones, setShowFixPhones] = useState(false);
  const [showRunConfirm, setShowRunConfirm] = useState(false);
  const [speedPreset, setSpeedPreset] = useState<SpeedPreset>('safe');

  const readiness = useExecutionReadiness({ executionTargets, voiceEngine: voiceProvider });
  const executionRun = useExecutionRun();

  const storesWithoutPhones = useMemo(
    () => readiness.enrichedTargets.filter(t => !t.phone?.replace(/\D/g, '')),
    [readiness.enrichedTargets]
  );

  if (executionTargets.length === 0 && !executionRun.activeRunId) return null;

  // If a run is active, show run progress UI
  if (executionRun.activeRunId && executionRun.runProgress) {
    const rp = executionRun.runProgress;
    const processed = (rp.queued_targets || 0) + (rp.completed_targets || 0) + (rp.failed_targets || 0);
    const pct = rp.callable_targets > 0 ? Math.round((processed / rp.callable_targets) * 100) : 0;
    const isWaiting = rp.notes?.includes('Waiting');

    const handleForceWave = async () => {
      // Clear stale queue items to unblock
      const client = supabase as any;
      await client.from('outbound_call_queue')
        .update({ status: 'failed' })
        .eq('business_id', rp.business_id || '')
        .in('status', ['queued', 'dialing']);
      // Trigger worker immediately
      await supabase.functions.invoke('followup-execution-worker', { body: { run_id: rp.id } });
      toast.info('Forced next wave — cleared stale queue');
    };

    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-xl shadow-2xl p-4 min-w-[500px] max-w-[760px] animate-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-sm bg-primary">
              <Rocket className="h-3 w-3 mr-1" />
              Execution Run
            </Badge>
            <Badge variant={rp.status === 'running' ? 'default' : rp.status === 'paused' ? 'secondary' : 'outline'} className="text-sm">
              {rp.status.toUpperCase()}
            </Badge>
            {isWaiting && (
              <Badge variant="outline" className="text-sm text-amber-600 border-amber-400">
                🟡 Waiting — Concurrency Limit
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { executionRun.cancelRun(); onClear(); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Waiting explanation */}
        {isWaiting && (
          <div className="mb-3 flex items-center gap-2 text-xs bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1.5 text-amber-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{rp.notes}</span>
          </div>
        )}

        {/* Progress */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{processed} / {rp.callable_targets} processed</span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-2 mb-3 text-center text-xs">
          <div className="bg-muted/50 rounded p-1.5">
            <div className="font-semibold text-sm">{rp.total_targets}</div>
            <div className="text-muted-foreground">Total</div>
          </div>
          <div className="bg-muted/50 rounded p-1.5">
            <div className="font-semibold text-sm">{rp.callable_targets}</div>
            <div className="text-muted-foreground">Callable</div>
          </div>
          <div className="bg-muted/50 rounded p-1.5">
            <div className="font-semibold text-sm text-blue-600">{rp.queued_targets}</div>
            <div className="text-muted-foreground">Queued</div>
          </div>
          <div className="bg-muted/50 rounded p-1.5">
            <div className="font-semibold text-sm text-green-600">{rp.completed_targets}</div>
            <div className="text-muted-foreground">Done</div>
          </div>
          <div className="bg-muted/50 rounded p-1.5">
            <div className="font-semibold text-sm text-destructive">{rp.failed_targets}</div>
            <div className="text-muted-foreground">Failed</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {executionRun.isRunning && (
            <Button size="sm" variant="secondary" onClick={executionRun.pauseRun} className="gap-1.5">
              <Pause className="h-3.5 w-3.5" /> Pause
            </Button>
          )}
          {executionRun.isPaused && (
            <Button size="sm" variant="default" onClick={executionRun.resumeRun} className="gap-1.5">
              <Play className="h-3.5 w-3.5" /> Resume
            </Button>
          )}
          {isWaiting && (
            <Button size="sm" variant="outline" onClick={handleForceWave} className="gap-1.5 border-amber-500 text-amber-600">
              <Zap className="h-3.5 w-3.5" /> Force Next Wave
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={() => { executionRun.cancelRun(); onClear(); }} className="gap-1.5">
            <Square className="h-3.5 w-3.5" /> Stop
          </Button>
          {executionRun.isCompleted && (
            <Button size="sm" variant="outline" onClick={() => { onClear(); onExecutionComplete?.(); }}>
              Dismiss
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Standard selection bar ──
  const executionState: ExecutionState = (() => {
    if (readiness.healthStatus === 'data_error') return 'NO_SELECTION';
    if (!readiness.hasTargets) return 'NO_SELECTION';
    if (!readiness.hasCallableNumbers) return 'NO_PHONES';
    if (readiness.agentReady) return 'READY_IMMEDIATE';
    return 'READY_QUEUE_ONLY';
  })();

  const isLargeSelection = executionTargets.length >= LARGE_SELECTION_THRESHOLD;

  const handleExecute = () => {
    if (isLargeSelection) {
      setShowRunConfirm(true);
    } else {
      handleSmallCall();
    }
  };

  const handleSmallCall = async () => {
    if (!readiness.hasCallableNumbers) {
      toast.error(`No callable phone numbers found`);
      return;
    }
    setIsExecuting(true);
    try {
      const client = supabase as any;
      const entries = readiness.enrichedTargets
        .filter(t => !!t.phone?.replace(/\D/g, ''))
        .map(t => ({
          entity_type: 'store',
          entity_id: t.store_id,
          phone_number: t.phone || null,
          priority: t.priority || 3,
          status: 'queued',
          source_reason: 'followup_execution',
          voice_provider: voiceProvider === 'auto' ? null : voiceProvider,
          metadata: {
            execution_source: 'follow_up_manager',
            source: t.source,
            follow_up_id: t.follow_up_id,
            route_type: callRoute,
          },
        }));
      if (entries.length > 0) {
        const { error } = await client.from('outbound_call_queue').insert(entries);
        if (error) throw error;
      }
      toast.success(`${entries.length} calls queued`);
      onClear();
      onExecutionComplete?.();
    } catch (err: any) {
      toast.error(`Failed: ${err?.message || 'Unknown'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleStartRun = async () => {
    setShowRunConfirm(false);
    await executionRun.startRun({
      storeIds: executionTargets.map(t => t.store_id),
      mode: callRoute,
      voiceEngine: voiceProvider,
      speedPreset,
    });
  };

  const statusText = (() => {
    if (executionState === 'NO_PHONES') return `${readiness.totalCount} stores selected — none have phone numbers`;
    if (executionState === 'READY_QUEUE_ONLY') return `${readiness.callableCount} callable — agents offline, calls will queue`;
    if (executionState === 'READY_IMMEDIATE') return `${readiness.callableCount} callable — ready to call`;
    return 'Select stores to begin';
  })();

  const primaryButton = (() => {
    if (executionState === 'NO_PHONES') return { label: 'No Phones Found', disabled: true, variant: 'destructive' as const, icon: <AlertTriangle className="h-3.5 w-3.5" /> };
    if (isLargeSelection) return { label: `Start Execution Run (${readiness.callableCount})`, disabled: !readiness.hasCallableNumbers, variant: 'default' as const, icon: <Rocket className="h-3.5 w-3.5" /> };
    if (executionState === 'READY_IMMEDIATE') return { label: `Call Now (${readiness.callableCount})`, disabled: false, variant: 'default' as const, icon: <Phone className="h-3.5 w-3.5" /> };
    if (executionState === 'READY_QUEUE_ONLY') return { label: `Queue Calls (${readiness.callableCount})`, disabled: false, variant: 'secondary' as const, icon: <ListPlus className="h-3.5 w-3.5" /> };
    return { label: 'No Selection', disabled: true, variant: 'secondary' as const, icon: <Phone className="h-3.5 w-3.5" /> };
  })();

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-xl shadow-2xl p-4 min-w-[500px] max-w-[760px] animate-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-sm bg-primary">⚡ Execution Mode</Badge>
            <Badge variant="secondary" className="text-sm">{readiness.totalCount} Selected</Badge>
            {isLargeSelection && <Badge variant="outline" className="text-sm text-amber-600 border-amber-400">Bulk — Throttled Run</Badge>}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClear}><X className="h-4 w-4" /></Button>
        </div>

        {readiness.healthStatus === 'data_error' && (
          <div className="mb-3 flex items-center gap-2 text-xs bg-destructive/10 border border-destructive/30 rounded px-2 py-1.5 text-destructive">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span className="font-medium">Data Sync Error — Dialing disabled.</span>
          </div>
        )}

        {/* Readiness */}
        <div className="mb-3 flex items-center gap-2 text-xs flex-wrap">
          <ExecutionHealthBadge status={readiness.healthStatus} />
          <span className="text-muted-foreground">•</span>
          <span className={`flex items-center gap-1 ${readiness.hasCallableNumbers ? 'text-green-600' : 'text-destructive'}`}>
            {readiness.hasCallableNumbers ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {readiness.callableCount} callable
          </span>
          <span className="text-muted-foreground">•</span>
          <span className={readiness.agentReady ? 'text-green-600' : 'text-amber-500'}>
            {readiness.agentReady ? '🟢 Agent online' : '🟡 Agents offline'}
          </span>
        </div>

        <div className="mb-3 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">{statusText}</div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <VoiceProviderSelector provider={voiceProvider} onProviderChange={setVoiceProvider} showMode={false} compact />
          <Select value={callRoute} onValueChange={(v) => setCallRoute(v as CallRoute)}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="human" className="text-xs"><span className="flex items-center gap-1.5"><User className="h-3 w-3" /> Human</span></SelectItem>
              <SelectItem value="ai" className="text-xs"><span className="flex items-center gap-1.5"><Bot className="h-3 w-3" /> AI</span></SelectItem>
              <SelectItem value="hybrid" className="text-xs"><span className="flex items-center gap-1.5"><Zap className="h-3 w-3" /> Hybrid</span></SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button size="sm" variant={primaryButton.variant} onClick={handleExecute} disabled={isExecuting || executionRun.isStarting || primaryButton.disabled} className="gap-1.5">
            {isExecuting || executionRun.isStarting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : primaryButton.icon}
            {primaryButton.label}
          </Button>

          {executionState === 'NO_PHONES' && (
            <Button size="sm" variant="outline" onClick={() => setShowFixPhones(true)} className="gap-1.5 border-amber-500 text-amber-600 hover:bg-amber-50">
              <Wrench className="h-3.5 w-3.5" /> Fix Phones ({storesWithoutPhones.length})
            </Button>
          )}

          <Button size="sm" variant="outline" onClick={onClear} className="gap-1.5">
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      </div>

      {/* Execution Run Confirm Modal */}
      <Dialog open={showRunConfirm} onOpenChange={setShowRunConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Start Execution Run
            </DialogTitle>
            <DialogDescription>
              You selected {readiness.totalCount} stores ({readiness.callableCount} callable).
              Calls will be processed in throttled waves to avoid overload.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Speed Preset</label>
              <div className="grid grid-cols-3 gap-2">
                {(['safe', 'fast', 'ai_burst'] as SpeedPreset[]).map(preset => (
                  <button
                    key={preset}
                    onClick={() => setSpeedPreset(preset)}
                    className={`p-3 rounded-lg border text-center text-xs transition-colors ${
                      speedPreset === preset
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="font-semibold capitalize">{preset === 'ai_burst' ? 'AI Burst' : preset}</div>
                    <div className="text-muted-foreground mt-0.5">
                      {preset === 'safe' && '1×/agent'}
                      {preset === 'fast' && '2×/agent'}
                      {preset === 'ai_burst' && 'Up to 20'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-muted/50 rounded p-3 text-xs space-y-1">
              <div className="flex justify-between"><span>Mode:</span><span className="font-medium capitalize">{callRoute}</span></div>
              <div className="flex justify-between"><span>Voice:</span><span className="font-medium">{voiceProvider}</span></div>
              <div className="flex justify-between"><span>Batch size:</span><span className="font-medium">{speedPreset === 'safe' ? 25 : 50}</span></div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRunConfirm(false)}>Cancel</Button>
            <Button onClick={handleStartRun} disabled={executionRun.isStarting} className="gap-1.5">
              {executionRun.isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              Launch Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fix Missing Phones Dialog */}
      <Dialog open={showFixPhones} onOpenChange={setShowFixPhones}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wrench className="h-5 w-5 text-amber-500" /> Fix Missing Phones</DialogTitle>
            <DialogDescription>{storesWithoutPhones.length} stores have no phone number.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            {storesWithoutPhones.slice(0, 50).map(t => (
              <div key={t.store_id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                <span className="font-medium truncate max-w-[200px]">{t.store_id.slice(0, 8)}...</span>
                <span className="text-muted-foreground text-xs">No phone</span>
              </div>
            ))}
            {storesWithoutPhones.length > 50 && <p className="text-xs text-muted-foreground text-center">...and {storesWithoutPhones.length - 50} more</p>}
          </div>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setShowFixPhones(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExecutionHealthBadge({ status }: { status: ExecutionHealthStatus }) {
  switch (status) {
    case 'data_error': return <span className="flex items-center gap-1 text-destructive font-medium">🚫 Data Error</span>;
    case 'partial': return <span className="flex items-center gap-1 text-amber-500 font-medium">⚠ Partial</span>;
    default: return <span className="flex items-center gap-1 text-green-600">✅ Data OK</span>;
  }
}
