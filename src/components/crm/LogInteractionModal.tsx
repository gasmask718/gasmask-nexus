import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Phone, MessageSquare, Mail, Users, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

const CHANNELS = [
  { value: 'CALL', label: 'Phone Call', icon: Phone },
  { value: 'SMS', label: 'SMS Text', icon: MessageSquare },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: MessageSquare },
  { value: 'IN_PERSON', label: 'In Person', icon: Users },
  { value: 'EMAIL', label: 'Email', icon: Mail },
  { value: 'OTHER', label: 'Other', icon: MessageSquare },
];

const DIRECTIONS = [
  { value: 'OUTBOUND', label: 'Outbound (We contacted them)', icon: ArrowUpRight },
  { value: 'INBOUND', label: 'Inbound (They contacted us)', icon: ArrowDownLeft },
];

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

interface LogInteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactId?: string;
  contactName?: string;
  storeMasterId?: string; // Must be store_master.id
  storeName?: string;
  storeContacts?: Array<{ id: string; name: string }>;
}

export function LogInteractionModal({
  isOpen,
  onClose,
  contactId,
  contactName,
  storeMasterId,
  storeName,
  storeContacts,
}: LogInteractionModalProps) {
  const queryClient = useQueryClient();
  const [selectedContactId, setSelectedContactId] = useState(contactId || '');
  const [channel, setChannel] = useState('CALL');
  const [direction, setDirection] = useState('OUTBOUND');
  const [subject, setSubject] = useState('');
  const [summary, setSummary] = useState('');
  const [outcome, setOutcome] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');

  // Validate storeMasterId exists in store_master table
  const { data: validatedStore } = useQuery({
    queryKey: ['validate-store-master', storeMasterId],
    queryFn: async () => {
      if (!storeMasterId) return null;
      const { data, error } = await supabase
        .from('store_master')
        .select('id, store_name')
        .eq('id', storeMasterId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!storeMasterId,
  });

  const isValidStore = !storeMasterId || !!validatedStore;

  const createInteraction = useMutation({
    mutationFn: async () => {
      // Only use store_id if it's a valid store_master.id
      const validStoreId = validatedStore?.id || null;
      
      const { error } = await supabase.from('contact_interactions').insert({
        contact_id: selectedContactId || contactId,
        store_id: validStoreId,
        channel,
        direction,
        subject,
        summary: summary || null,
        outcome: outcome || null,
        sentiment: sentiment || null,
        next_action: nextAction || null,
        follow_up_at: followUpAt ? new Date(followUpAt).toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Interaction logged successfully');
      queryClient.invalidateQueries({ queryKey: ['contact-interactions'] });
      queryClient.invalidateQueries({ queryKey: ['store-interactions'] });
      queryClient.invalidateQueries({ queryKey: ['store-master'] });
      resetForm();
      onClose();
    },
    onError: (error: any) => {
      toast.error('Failed to log interaction: ' + error.message);
    },
  });

  const resetForm = () => {
    setChannel('CALL');
    setDirection('OUTBOUND');
    setSubject('');
    setSummary('');
    setOutcome('');
    setSentiment('');
    setNextAction('');
    setFollowUpAt('');
    if (!contactId) setSelectedContactId('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }
    if (!selectedContactId && !contactId) {
      toast.error('Please select a contact');
      return;
    }
    createInteraction.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Interaction</DialogTitle>
          {contactName && (
            <p className="text-sm text-muted-foreground">
              with <span className="font-medium">{contactName}</span>
              {storeName && <> at {storeName}</>}
            </p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Contact Selector (if from store page) */}
          {!contactId && storeContacts && storeContacts.length > 0 && (
            <div className="space-y-2">
              <Label>Contact *</Label>
              <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  {storeContacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Channel & Direction */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Channel *</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">
                        <c.icon className="h-4 w-4" /> {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Direction *</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIRECTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      <span className="flex items-center gap-2">
                        <d.icon className="h-4 w-4" /> {d.value === 'OUTBOUND' ? 'Outbound' : 'Inbound'}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label>Subject *</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Restock Hot Mama, Payment follow-up"
            />
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <Label>Summary</Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Notes about what happened..."
              rows={3}
            />
          </div>

          {/* Outcome & Sentiment */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Outcome</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger>
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sentiment</Label>
              <Select value={sentiment} onValueChange={setSentiment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sentiment" />
                </SelectTrigger>
                <SelectContent>
                  {SENTIMENTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Next Action */}
          <div className="space-y-2">
            <Label>Next Action</Label>
            <Input
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="What should we do next?"
            />
          </div>

          {/* Follow-up Date */}
          <div className="space-y-2">
            <Label>Follow-up Date</Label>
            <Input
              type="datetime-local"
              value={followUpAt}
              onChange={(e) => setFollowUpAt(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createInteraction.isPending}>
              {createInteraction.isPending ? 'Saving...' : 'Save Interaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
