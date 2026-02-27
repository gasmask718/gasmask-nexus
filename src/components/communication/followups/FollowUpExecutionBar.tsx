import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VoiceProviderSelector } from '@/components/communication/VoiceProviderSelector';
import { Phone, Zap, MessageSquare, ListPlus, X, Bot, User, AlertTriangle, CheckCircle, Loader2, Wrench, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { triggerFollowUp } from '@/services/followUpTriggerService';
import { useExecutionReadiness } from '@/hooks/useExecutionReadiness';
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

export function FollowUpExecutionBar({ executionTargets, onClear, onExecutionComplete }: FollowUpExecutionBarProps) {
  const [voiceProvider, setVoiceProvider] = useState('auto');
  const [callRoute, setCallRoute] = useState<CallRoute>('human');
  const [isExecuting, setIsExecuting] = useState(false);
  const [showFixPhones, setShowFixPhones] = useState(false);

  const readiness = useExecutionReadiness({
    executionTargets,
    voiceEngine: voiceProvider,
  });

  const followUpIds = useMemo(
    () => executionTargets.map((t) => t.follow_up_id).filter((id): id is string => !!id),
    [executionTargets]
  );

  // Stores missing phones for the Fix dialog
  const storesWithoutPhones = useMemo(
    () => readiness.enrichedTargets.filter(t => !t.phone?.replace(/\D/g, '')),
    [readiness.enrichedTargets]
  );

  if (executionTargets.length === 0) return null;

  // Compute execution state
  const executionState: ExecutionState = (() => {
    if (readiness.healthStatus === 'data_error') return 'NO_SELECTION';
    if (!readiness.hasTargets) return 'NO_SELECTION';
    if (!readiness.hasCallableNumbers) return 'NO_PHONES';
    if (readiness.agentReady) return 'READY_IMMEDIATE';
    return 'READY_QUEUE_ONLY';
  })();

  const buildFollowUpPayload = (target: ExecutionTarget, recommendedAction: FollowUpQueueItem['recommended_action']) => {
    return {
      id: target.follow_up_id || `cadence-${target.store_id}`,
      store_id: target.store_id,
      business_id: target.business_id || null,
      vertical_id: null,
      brand: null,
      reason: target.reason || 'followup_cadence',
      recommended_action: recommendedAction,
      priority: target.priority || 3,
      due_at: new Date().toISOString(),
      context: {
        execution_source: 'follow_up_manager',
        source: target.source,
      },
      status: 'pending',
      completed_at: null,
      completed_by: null,
      created_at: new Date().toISOString(),
      store: null,
      business: null,
      vertical: null,
    } as FollowUpQueueItem;
  };

  const handleCallNow = async () => {
    if (!readiness.hasCallableNumbers) {
      toast.error(`No callable phone numbers found among ${readiness.totalCount} selected stores`);
      return;
    }
    setIsExecuting(true);
    try {
      if (executionState === 'READY_IMMEDIATE') {
        // Direct call
        let successCount = 0;
        for (const target of readiness.enrichedTargets.filter(t => !!t.phone)) {
          const action = callRoute === 'ai' ? 'ai_call' : 'manual_call';
          const result = await triggerFollowUp(buildFollowUpPayload(target, action));
          if (result.success) successCount++;
        }
        toast.success(`${successCount}/${readiness.callableCount} calls initiated`);
      } else {
        // Queue calls (no agent available)
        await insertToQueue();
        toast.success(`${readiness.callableCount} calls queued — waiting for available agent`);
      }
      onClear();
      onExecutionComplete?.();
    } catch (err: any) {
      toast.error(`Failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const insertToQueue = async () => {
    const client = supabase as any;
    const entries = readiness.enrichedTargets
      .filter(t => !!t.phone?.replace(/\D/g, ''))
      .map((target) => ({
        entity_type: 'store',
        entity_id: target.store_id,
        phone_number: target.phone || null,
        priority: target.priority || 3,
        status: 'queued',
        source_reason: 'followup_execution',
        voice_provider: voiceProvider === 'auto' ? null : voiceProvider,
        metadata: {
          execution_source: 'follow_up_manager',
          source: target.source,
          follow_up_id: target.follow_up_id,
          reason: target.reason,
          route_type: callRoute,
        },
      }));

    if (entries.length > 0) {
      const { error } = await client.from('outbound_call_queue').insert(entries);
      if (error) throw error;
    }

    if (followUpIds.length > 0) {
      await client
        .from('follow_up_queue')
        .update({ status: 'in_progress' })
        .in('id', followUpIds);
    }
    return entries.length;
  };

  const handleAddToQueue = async () => {
    setIsExecuting(true);
    try {
      const count = await insertToQueue();
      toast.success(`${count} stores added to dialer queue`);
      onClear();
      onExecutionComplete?.();
    } catch (err: any) {
      toast.error(`Queue failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleTextOutreach = async () => {
    setIsExecuting(true);
    try {
      let successCount = 0;
      for (const target of readiness.enrichedTargets.filter(t => !!t.phone)) {
        const action = callRoute === 'ai' ? 'ai_text' : 'manual_text';
        const result = await triggerFollowUp(buildFollowUpPayload(target, action));
        if (result.success) successCount++;
      }
      toast.success(`${successCount}/${readiness.callableCount} text outreach triggered`);
      onClear();
      onExecutionComplete?.();
    } catch {
      toast.error('Failed to send texts');
    } finally {
      setIsExecuting(false);
    }
  };


  // Primary button config based on execution state
  const primaryButton = (() => {
    switch (executionState) {
      case 'NO_PHONES':
        return {
          label: 'No Phones Found',
          disabled: true,
          variant: 'destructive' as const,
          icon: <AlertTriangle className="h-3.5 w-3.5" />,
        };
      case 'READY_IMMEDIATE':
        return {
          label: `Call Now (${readiness.callableCount})`,
          disabled: false,
          variant: 'default' as const,
          icon: <Phone className="h-3.5 w-3.5" />,
        };
      case 'READY_QUEUE_ONLY':
        return {
          label: `Queue Calls (${readiness.callableCount})`,
          disabled: false,
          variant: 'secondary' as const,
          icon: <ListPlus className="h-3.5 w-3.5" />,
        };
      default:
        return {
          label: 'No Selection',
          disabled: true,
          variant: 'secondary' as const,
          icon: <Phone className="h-3.5 w-3.5" />,
        };
    }
  })();

  // Status line
  const statusText = (() => {
    if (executionState === 'NO_PHONES') return `${readiness.totalCount} stores selected — none have phone numbers`;
    if (executionState === 'READY_QUEUE_ONLY') return `${readiness.callableCount} callable — agents offline, calls will queue`;
    if (executionState === 'READY_IMMEDIATE') return `${readiness.callableCount} callable — ready to call`;
    return 'Select stores to begin';
  })();

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-xl shadow-2xl p-4 min-w-[500px] max-w-[760px] animate-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-sm bg-primary">
              ⚡ Execution Mode Active
            </Badge>
            <Badge variant="secondary" className="text-sm">
              {readiness.totalCount} Store{readiness.totalCount !== 1 ? 's' : ''} Selected
            </Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClear}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Data Error Banner */}
        {readiness.healthStatus === 'data_error' && (
          <div className="mb-3 flex items-center gap-2 text-xs bg-destructive/10 border border-destructive/30 rounded px-2 py-1.5 text-destructive">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span className="font-medium">Data Sync Error — Dialing disabled until resolved.</span>
          </div>
        )}

        {/* Readiness Status */}
        <div className="mb-3 flex items-center gap-2 text-xs">
          {/* Execution Health Badge */}
          <ExecutionHealthBadge status={readiness.healthStatus} />
          <span className="text-muted-foreground">•</span>
          {readiness.hasCallableNumbers ? (
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-3.5 w-3.5" />
              {readiness.callableCount} callable
            </span>
          ) : (
            <span className="flex items-center gap-1 text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              0 callable
            </span>
          )}
          <span className="text-muted-foreground">•</span>
          <span className={`flex items-center gap-1 ${readiness.agentReady ? 'text-green-600' : 'text-amber-500'}`}>
            {readiness.agentReady ? '🟢 Agent online' : '🟡 Agents offline (will queue)'}
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">🎙 {voiceProvider === 'auto' ? 'Auto' : voiceProvider === 'elevenlabs' ? 'ElevenLabs' : 'AWS Polly'}</span>
        </div>

        {/* Status text */}
        <div className="mb-3 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
          {statusText}
        </div>

        {/* Controls Row */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <VoiceProviderSelector
            provider={voiceProvider}
            onProviderChange={setVoiceProvider}
            showMode={false}
            compact
          />

          <Select value={callRoute} onValueChange={(v) => setCallRoute(v as CallRoute)}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="human" className="text-xs">
                <span className="flex items-center gap-1.5"><User className="h-3 w-3" /> Human Agent</span>
              </SelectItem>
              <SelectItem value="ai" className="text-xs">
                <span className="flex items-center gap-1.5"><Bot className="h-3 w-3" /> AI Agent</span>
              </SelectItem>
              <SelectItem value="hybrid" className="text-xs">
                <span className="flex items-center gap-1.5"><Zap className="h-3 w-3" /> AI → Human</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={primaryButton.variant}
            onClick={handleCallNow}
            disabled={isExecuting || primaryButton.disabled}
            className="gap-1.5"
          >
            {isExecuting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : primaryButton.icon}
            {primaryButton.label}
          </Button>

          {/* Fix Missing Phones CTA — only when NO_PHONES */}
          {executionState === 'NO_PHONES' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowFixPhones(true)}
              className="gap-1.5 border-amber-500 text-amber-600 hover:bg-amber-50"
            >
              <Wrench className="h-3.5 w-3.5" />
              Fix Missing Phones ({storesWithoutPhones.length})
            </Button>
          )}

          <Button
            size="sm"
            variant="secondary"
            onClick={handleAddToQueue}
            disabled={isExecuting || !readiness.hasTargets}
            className="gap-1.5"
          >
            <ListPlus className="h-3.5 w-3.5" />
            Add to Dialer ({readiness.totalCount})
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTextOutreach}
            disabled={isExecuting || !readiness.hasCallableNumbers}
            className="gap-1.5"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Text {readiness.hasCallableNumbers && `(${readiness.callableCount})`}
          </Button>
        </div>
      </div>

      {/* Fix Missing Phones Dialog */}
      <Dialog open={showFixPhones} onOpenChange={setShowFixPhones}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-amber-500" />
              Fix Missing Phone Numbers
            </DialogTitle>
            <DialogDescription>
              {storesWithoutPhones.length} selected store{storesWithoutPhones.length !== 1 ? 's' : ''} have no phone number on file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            {storesWithoutPhones.slice(0, 50).map((target) => (
              <div key={target.store_id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                <span className="font-medium truncate max-w-[200px]">
                  {target.store_id.slice(0, 8)}...
                </span>
                <span className="text-muted-foreground text-xs">No phone</span>
              </div>
            ))}
            {storesWithoutPhones.length > 50 && (
              <p className="text-xs text-muted-foreground text-center">
                ...and {storesWithoutPhones.length - 50} more
              </p>
            )}
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              To fix: Add phone numbers to these stores in the Store Master or Store Contacts table.
            </p>
            <Button variant="outline" size="sm" onClick={() => setShowFixPhones(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Small badge showing execution data health */
function ExecutionHealthBadge({ status }: { status: ExecutionHealthStatus }) {
  switch (status) {
    case 'data_error':
      return (
        <span className="flex items-center gap-1 text-destructive font-medium">
          🚫 Data Error
        </span>
      );
    case 'partial':
      return (
        <span className="flex items-center gap-1 text-amber-500 font-medium">
          ⚠ Partial
        </span>
      );
    case 'ok':
    default:
      return (
        <span className="flex items-center gap-1 text-green-600">
          ✅ Data OK
        </span>
      );
  }
}
