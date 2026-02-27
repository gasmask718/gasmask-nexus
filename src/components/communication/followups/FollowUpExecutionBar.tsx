import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VoiceProviderSelector } from '@/components/communication/VoiceProviderSelector';
import { Phone, Zap, MessageSquare, ListPlus, X, Bot, User } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { triggerFollowUp } from '@/services/followUpTriggerService';
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

interface FollowUpExecutionBarProps {
  executionTargets: ExecutionTarget[];
  onClear: () => void;
  onExecutionComplete?: () => void;
}

export function FollowUpExecutionBar({ executionTargets, onClear, onExecutionComplete }: FollowUpExecutionBarProps) {
  const [voiceProvider, setVoiceProvider] = useState('auto');
  const [callRoute, setCallRoute] = useState<CallRoute>('human');
  const [isExecuting, setIsExecuting] = useState(false);

  const uniqueStoreTargets = useMemo(() => {
    const map = new Map<string, ExecutionTarget>();
    executionTargets.forEach((target) => {
      if (!map.has(target.store_id)) map.set(target.store_id, target);
    });
    return Array.from(map.values());
  }, [executionTargets]);

  const followUpIds = useMemo(
    () => executionTargets.map((t) => t.follow_up_id).filter((id): id is string => !!id),
    [executionTargets]
  );

  if (executionTargets.length === 0) return null;

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
    setIsExecuting(true);
    try {
      let successCount = 0;
      for (const target of uniqueStoreTargets) {
        const action = callRoute === 'ai' ? 'ai_call' : 'manual_call';
        const result = await triggerFollowUp(buildFollowUpPayload(target, action));
        if (result.success) successCount++;
      }
      toast.success(`${successCount}/${uniqueStoreTargets.length} calls initiated`);
      onClear();
      onExecutionComplete?.();
    } catch {
      toast.error('Failed to start calls');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleAddToQueue = async () => {
    setIsExecuting(true);
    try {
      const client = supabase as any;
      const entries = uniqueStoreTargets.map((target) => ({
        entity_type: 'store',
        entity_id: target.store_id,
        phone_number: target.phone || null,
        priority: target.priority || 3,
        status: 'queued',
        source_reason: 'followup_cadence',
        voice_provider: voiceProvider === 'auto' ? null : voiceProvider,
        metadata: {
          execution_source: 'follow_up_manager',
          source: target.source,
          follow_up_id: target.follow_up_id,
          reason: target.reason,
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

      toast.success(`${entries.length} stores added to dialer queue`);
      onClear();
      onExecutionComplete?.();
    } catch {
      toast.error('Failed to add to queue');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleTextOutreach = async () => {
    setIsExecuting(true);
    try {
      let successCount = 0;
      for (const target of uniqueStoreTargets) {
        const action = callRoute === 'ai' ? 'ai_text' : 'manual_text';
        const result = await triggerFollowUp(buildFollowUpPayload(target, action));
        if (result.success) successCount++;
      }
      toast.success(`${successCount}/${uniqueStoreTargets.length} text outreach triggered`);
      onClear();
      onExecutionComplete?.();
    } catch {
      toast.error('Failed to send texts');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-xl shadow-2xl p-4 min-w-[500px] max-w-[760px] animate-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-sm">
            ⚡ Execution Mode Active
          </Badge>
          <Badge variant="secondary" className="text-sm">
            {uniqueStoreTargets.length} Store{uniqueStoreTargets.length !== 1 ? 's' : ''} Selected
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mb-3 text-xs text-muted-foreground">Execution Targets: {executionTargets.length}</div>

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

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleCallNow} disabled={isExecuting} className="gap-1.5">
          <Phone className="h-3.5 w-3.5" />
          Call Now
        </Button>
        <Button size="sm" variant="secondary" onClick={handleAddToQueue} disabled={isExecuting} className="gap-1.5">
          <ListPlus className="h-3.5 w-3.5" />
          Add to Dialer
        </Button>
        <Button size="sm" variant="outline" onClick={handleTextOutreach} disabled={isExecuting} className="gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          Text
        </Button>
      </div>
    </div>
  );
}
