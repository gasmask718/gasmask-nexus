import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from 'lucide-react';
import { FollowUpActionSelector } from './FollowUpActionSelector';
import { useRescheduleFollowUp, type FollowUpQueueItem } from '@/hooks/useFollowUps';
import { format } from 'date-fns';

interface RescheduleDialogProps {
  followUp: FollowUpQueueItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RescheduleDialog({ followUp, open, onOpenChange }: RescheduleDialogProps) {
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newAction, setNewAction] = useState('');
  const reschedule = useRescheduleFollowUp();

  const handleSubmit = () => {
    if (!followUp || !newDate || !newTime) return;
    
    const newDueAt = new Date(`${newDate}T${newTime}`).toISOString();
    
    reschedule.mutate({
      id: followUp.id,
      due_at: newDueAt,
      recommended_action: newAction || followUp.recommended_action,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setNewDate('');
        setNewTime('');
        setNewAction('');
      }
    });
  };

  // Set defaults when dialog opens
  if (followUp && open && !newDate) {
    const dueDate = new Date(followUp.due_at);
    setNewDate(format(dueDate, 'yyyy-MM-dd'));
    setNewTime(format(dueDate, 'HH:mm'));
    setNewAction(followUp.recommended_action);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reschedule Follow-Up
          </DialogTitle>
          <DialogDescription>
            {followUp?.store?.name && `Reschedule follow-up for ${followUp.store.name}`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="date">New Date</Label>
            <Input
              id="date"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="time">New Time</Label>
            <Input
              id="time"
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
            />
          </div>
          
          <div className="grid gap-2">
            <Label>Recommended Action</Label>
            <FollowUpActionSelector
              value={newAction}
              onChange={setNewAction}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={reschedule.isPending || !newDate || !newTime}>
            {reschedule.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
