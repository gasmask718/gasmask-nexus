import { useState } from 'react';
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

interface FollowUpExecutionBarProps {
  selectedItems: FollowUpQueueItem[];
  onClear: () => void;
  onExecutionComplete?: () => void;
}

export function FollowUpExecutionBar({ selectedItems, onClear, onExecutionComplete }: FollowUpExecutionBarProps) {
  const [voiceProvider, setVoiceProvider] = useState('auto');
  const [callRoute, setCallRoute] = useState<CallRoute>('human');
  const [isExecuting, setIsExecuting] = useState(false);

  if (selectedItems.length === 0) return null;

  const handleCallNow = async () => {
    setIsExecuting(true);
    try {
      let successCount = 0;
      for (const item of selectedItems) {
        const action = callRoute === 'ai' ? 'ai_call' : 'manual_call';
        const modified = { ...item, recommended_action: action };
        const result = await triggerFollowUp(modified);
        if (result.success) successCount++;
      }
      toast.success(`${successCount}/${selectedItems.length} calls initiated`);
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
      const entries = selectedItems
        .filter(item => item.store_id)
        .map(item => ({
          entity_type: 'store',
          entity_id: item.store_id,
          phone_number: null,
          priority: item.priority || 3,
          status: 'queued',
          source_reason: 'followup_cadence',
          voice_provider: voiceProvider === 'auto' ? null : voiceProvider,
          metadata: {
            execution_source: 'follow_up_manager',
            follow_up_id: item.id,
            reason: item.reason,
          },
        }));

      if (entries.length > 0) {
        const { error } = await client.from('outbound_call_queue').insert(entries);
        if (error) throw error;
      }

      // Mark follow-ups as in_progress
      const ids = selectedItems.map(i => i.id);
      await client
        .from('follow_up_queue')
        .update({ status: 'in_progress' })
        .in('id', ids);

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
      for (const item of selectedItems) {
        const modified = { ...item, recommended_action: callRoute === 'ai' ? 'ai_text' : 'manual_text' };
        const result = await triggerFollowUp(modified);
        if (result.success) successCount++;
      }
      toast.success(`${successCount}/${selectedItems.length} text outreach triggered`);
      onClear();
      onExecutionComplete?.();
    } catch {
      toast.error('Failed to send texts');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-xl shadow-2xl p-4 min-w-[500px] max-w-[700px] animate-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-sm">
            {selectedItems.length} Store{selectedItems.length !== 1 ? 's' : ''} Selected
          </Badge>
          <span className="text-xs text-muted-foreground">
            Ready for outreach
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        {/* Voice Provider */}
        <VoiceProviderSelector
          provider={voiceProvider}
          onProviderChange={setVoiceProvider}
          showMode={false}
          compact
        />

        {/* Call Route */}
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
