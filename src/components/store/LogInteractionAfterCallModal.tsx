import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/datetime-picker';
import { Phone, MessageSquare, Mail, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useStoreMasterResolver } from '@/hooks/useStoreMasterResolver';

interface LogInteractionAfterCallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  contactId?: string;
  contactName?: string;
  storeContacts?: Array<{ id: string; name: string }>;
  actionType: 'call' | 'text' | 'email';
  onSuccess?: () => void;
}

const OUTCOMES = [
  { value: 'SUCCESS', label: 'Success' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'NO_ANSWER', label: 'No Answer' },
  { value: 'FOLLOW_UP_NEEDED', label: 'Follow-up Needed' },
  { value: 'ESCALATED', label: 'Escalated' },
];

const SENTIMENTS = [
  { value: 'POSITIVE', label: '😊 Positive' },
  { value: 'NEUTRAL', label: '😐 Neutral' },
  { value: 'NEGATIVE', label: '😞 Negative' },
];

const CHANNEL_MAP = {
  call: 'CALL',
  text: 'SMS',
  email: 'EMAIL',
};

export function LogInteractionAfterCallModal({
  open,
  onOpenChange,
  storeId,
  storeName,
  contactId,
  contactName,
  storeContacts,
  actionType,
  onSuccess,
}: LogInteractionAfterCallModalProps) {
  const queryClient = useQueryClient();
  const [selectedContactId, setSelectedContactId] = useState(contactId || '');
  const [summary, setSummary] = useState('');
  const [outcome, setOutcome] = useState('SUCCESS');
  const [sentiment, setSentiment] = useState('NEUTRAL');
  const [nextAction, setNextAction] = useState('');
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>(undefined);
  const [saveInteraction, setSaveInteraction] = useState(true);

  const {
    storeMasterId,
    needsCreation,
    createStoreMaster,
  } = useStoreMasterResolver(storeId);

  const logInteractionMutation = useMutation({
    mutationFn: async () => {
      if (!saveInteraction) return;

      let resolvedStoreMasterId = storeMasterId;

      // Create store master if needed
      if (!resolvedStoreMasterId && needsCreation) {
        try {
          const created = await createStoreMaster();
          resolvedStoreMasterId = created.id;
        } catch (error: any) {
          toast.error('Failed to create store master: ' + error.message);
          return;
        }
      }

      if (!resolvedStoreMasterId) {
        throw new Error('Store not linked to store master');
      }

      const { error } = await supabase
        .from('contact_interactions')
        .insert({
          contact_id: selectedContactId || contactId,
          store_id: resolvedStoreMasterId,
          channel: CHANNEL_MAP[actionType],
          direction: 'OUTBOUND',
          subject: `${actionType === 'call' ? 'Phone Call' : actionType === 'text' ? 'SMS Text' : 'Email'} to ${contactName || storeName}`,
          summary: summary || null,
          outcome: outcome || null,
          sentiment: sentiment || null,
          next_action: nextAction || null,
          follow_up_at: followUpDate ? followUpDate.toISOString() : null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      if (saveInteraction) {
        toast.success('Interaction logged successfully');
        queryClient.invalidateQueries({ queryKey: ['contact-interactions'] });
        queryClient.invalidateQueries({ queryKey: ['store-interactions'] });
        queryClient.invalidateQueries({ queryKey: ['communication-stats'] });
      }
      onSuccess?.();
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(`Failed to log interaction: ${error.message}`);
    },
  });

  const resetForm = () => {
    setSelectedContactId(contactId || '');
    setSummary('');
    setOutcome('SUCCESS');
    setSentiment('NEUTRAL');
    setNextAction('');
    setFollowUpDate(undefined);
    setSaveInteraction(true);
  };

  const handleSubmit = () => {
    if (saveInteraction && !summary.trim()) {
      toast.error('Please enter a summary of the interaction');
      return;
    }
    logInteractionMutation.mutate();
  };

  const getActionIcon = () => {
    switch (actionType) {
      case 'call': return <Phone className="h-5 w-5" />;
      case 'text': return <MessageSquare className="h-5 w-5" />;
      case 'email': return <Mail className="h-5 w-5" />;
    }
  };

  const getActionLabel = () => {
    switch (actionType) {
      case 'call': return 'Call';
      case 'text': return 'Text';
      case 'email': return 'Email';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getActionIcon()}
            Log {getActionLabel()} Interaction
          </DialogTitle>
          <DialogDescription>
            Record details about your {actionType} with {contactName || storeName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Save Interaction Toggle */}
          <div className="flex items-center space-x-2 p-3 rounded-lg bg-secondary/30 border">
            <Checkbox
              id="saveInteraction"
              checked={saveInteraction}
              onCheckedChange={(checked) => setSaveInteraction(checked === true)}
            />
            <Label
              htmlFor="saveInteraction"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Save this interaction to history
            </Label>
          </div>

          {saveInteraction && (
            <>
              {/* Contact Selection */}
              {storeContacts && storeContacts.length > 1 && (
                <div className="space-y-2">
                  <Label>Contact</Label>
                  <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select contact" />
                    </SelectTrigger>
                    <SelectContent>
                      {storeContacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Summary */}
              <div className="space-y-2">
                <Label>Summary *</Label>
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder={`What happened during the ${actionType}?`}
                  rows={4}
                  className="bg-secondary/50"
                />
              </div>

              {/* Outcome & Sentiment */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Outcome</Label>
                  <Select value={outcome} onValueChange={setOutcome}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OUTCOMES.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sentiment</Label>
                  <Select value={sentiment} onValueChange={setSentiment}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SENTIMENTS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Next Action */}
              <div className="space-y-2">
                <Label>Next Action</Label>
                <Textarea
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="What should we do next?"
                  rows={2}
                  className="bg-secondary/50"
                />
              </div>

              {/* Follow-up Date */}
              <div className="space-y-2">
                <Label>Follow-up Date (Optional)</Label>
                <DatePicker
                  value={followUpDate}
                  onChange={setFollowUpDate}
                  placeholder="Pick a follow-up date"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
          >
            <X className="h-4 w-4 mr-2" />
            Skip
          </Button>
          {saveInteraction && (
            <Button
              onClick={handleSubmit}
              disabled={logInteractionMutation.isPending || !summary.trim()}
            >
              <Save className="h-4 w-4 mr-2" />
              {logInteractionMutation.isPending ? 'Saving...' : 'Save Interaction'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

