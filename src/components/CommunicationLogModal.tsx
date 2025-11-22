import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { TemplateSelector } from '@/components/communication/TemplateSelector';

interface CommunicationLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'store' | 'wholesaler' | 'influencer';
  entityId: string;
  entityName: string;
  onSuccess?: () => void;
}

export function CommunicationLogModal({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
  onSuccess,
}: CommunicationLogModalProps) {
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>();

  const resetForm = () => {
    setChannel('');
    setNotes('');
    setFollowUpDate(undefined);
  };

  const handleSubmit = async () => {
    if (!channel) {
      toast.error('Please select a communication method');
      return;
    }

    if (!notes.trim()) {
      toast.error('Please add notes');
      return;
    }

    if (notes.length > 1000) {
      toast.error('Notes must be less than 1000 characters');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('You must be logged in to log communications');
        return;
      }

      const payload: Record<string, any> = {};
      if (followUpDate) {
        payload.follow_up_date = followUpDate.toISOString();
      }

      const { error } = await supabase
        .from('communication_events')
        .insert({
          channel,
          direction: 'outbound',
          event_type: 'manual_log',
          summary: notes.trim(),
          user_id: user.id,
          linked_entity_type: entityType,
          linked_entity_id: entityId,
          store_id: entityType === 'store' ? entityId : null,
          payload: Object.keys(payload).length > 0 ? payload : null,
        });

      if (error) throw error;

      // Create reminder if follow-up date is provided
      if (followUpDate) {
        const reminderData: any = {
          assigned_to: user.id,
          follow_up_date: format(followUpDate, 'yyyy-MM-dd'),
          notes: `Follow-up for: ${notes.trim().substring(0, 100)}`,
        };

        if (entityType === 'store') reminderData.store_id = entityId;
        else if (entityType === 'wholesaler') reminderData.wholesaler_id = entityId;
        else if (entityType === 'influencer') reminderData.influencer_id = entityId;

        const { error: reminderError } = await supabase
          .from('reminders')
          .insert(reminderData);

        if (reminderError) console.error('Error creating reminder:', reminderError);
      }

      toast.success('Communication logged');
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error logging communication:', error);
      toast.error('Failed to log communication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-background border-border">
        <DialogHeader>
          <DialogTitle>Log Communication - {entityName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="channel">Communication Method *</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger id="channel" className="bg-background">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border z-50">
                <SelectItem value="call">Phone Call</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="visit">In-Person Visit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="notes">Notes *</Label>
              <TemplateSelector onSelect={(template) => setNotes(template)} />
            </div>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter communication details..."
              className="min-h-[120px] resize-none bg-background"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              {notes.length}/1000 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label>Follow-up Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal bg-background',
                    !followUpDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {followUpDate ? format(followUpDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-background border-border z-50" align="start">
                <Calendar
                  mode="single"
                  selected={followUpDate}
                  onSelect={setFollowUpDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-primary hover:bg-primary-hover"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging...
              </>
            ) : (
              'Log Communication'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
