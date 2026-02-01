/**
 * Assigned Store Actions Component
 * Inline actions for operational accountability on managed stores
 */
import { useState } from 'react';
import { 
  Eye, MessageSquare, UserMinus, AlertTriangle, 
  Calendar, ClipboardList, MoreHorizontal, CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface AssignedStoreActionsProps {
  storeId: string;
  storeName: string;
  ambassadorId: string;
  onViewStore?: () => void;
  onMessage?: () => void;
  compact?: boolean;
}

type ActionType = 'log_visit' | 'log_followup' | 'reassign' | 'escalate';

interface ActionDialogState {
  open: boolean;
  type: ActionType | null;
  notes: string;
  loading: boolean;
}

export function AssignedStoreActions({
  storeId,
  storeName,
  ambassadorId,
  onViewStore,
  onMessage,
  compact = false,
}: AssignedStoreActionsProps) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<ActionDialogState>({
    open: false,
    type: null,
    notes: '',
    loading: false,
  });

  const openDialog = (type: ActionType) => {
    setDialog({ open: true, type, notes: '', loading: false });
  };

  const closeDialog = () => {
    setDialog({ open: false, type: null, notes: '', loading: false });
  };

  const handleAction = async () => {
    if (!dialog.type) return;

    setDialog(prev => ({ ...prev, loading: true }));

    try {
      switch (dialog.type) {
        case 'log_visit':
          // Update last_visit_at on store_master
          await supabase
            .from('store_master')
            .update({ last_visit_at: new Date().toISOString() })
            .eq('id', storeId);
          
          toast.success('Visit logged successfully');
          break;

        case 'log_followup':
          // Create a follow-up entry
          await supabase
            .from('follow_up_queue')
            .insert({
              store_id: storeId,
              status: 'pending',
              reason: 'Ambassador follow-up',
              recommended_action: dialog.notes || 'Follow-up scheduled from ambassador profile',
              due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
            });
          
          toast.success('Follow-up scheduled');
          break;

        case 'escalate':
          // Create an escalation record (using follow_up_queue with high priority)
          await supabase
            .from('follow_up_queue')
            .insert({
              store_id: storeId,
              status: 'pending',
              priority: 1, // High priority (1 = highest)
              reason: 'Store escalation',
              recommended_action: `ESCALATED: ${dialog.notes || 'Requires admin attention'}`,
              due_at: new Date().toISOString(),
            });
          
          toast.success('Store escalated for admin review');
          break;

        case 'reassign':
          // Clear the assignment (admin will need to reassign)
          await supabase
            .from('store_master')
            .update({ 
              assigned_ambassador_id: null,
              health_status: 'at_risk', // Mark as at-risk since it's being reassigned
            })
            .eq('id', storeId);
          
          // Deactivate any active assignments
          await supabase
            .from('ambassador_assignments')
            .update({ active: false })
            .eq('store_id', storeId)
            .eq('ambassador_id', ambassadorId);
          
          toast.success('Store unassigned - ready for reassignment');
          break;
      }

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['ambassador-assigned-stores'] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-sourced-stores'] });
      queryClient.invalidateQueries({ queryKey: ['store-follow-ups'] });
      
      closeDialog();
    } catch (error) {
      console.error('Action failed:', error);
      toast.error('Action failed. Please try again.');
    } finally {
      setDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const getDialogContent = () => {
    switch (dialog.type) {
      case 'log_visit':
        return {
          title: 'Log Store Visit',
          description: `Record a visit to ${storeName}. This will update the last visit timestamp.`,
          notesLabel: 'Visit Notes (optional)',
          notesPlaceholder: 'What was discussed? Any issues or opportunities?',
          confirmLabel: 'Log Visit',
        };
      case 'log_followup':
        return {
          title: 'Schedule Follow-Up',
          description: `Create a follow-up task for ${storeName}. Default due date is 7 days from now.`,
          notesLabel: 'Follow-Up Notes',
          notesPlaceholder: 'What needs to be followed up on?',
          confirmLabel: 'Schedule Follow-Up',
        };
      case 'escalate':
        return {
          title: 'Escalate Store',
          description: `Flag ${storeName} for admin review. Use this for issues you cannot resolve.`,
          notesLabel: 'Escalation Reason',
          notesPlaceholder: 'Why does this store need admin attention?',
          confirmLabel: 'Escalate to Admin',
        };
      case 'reassign':
        return {
          title: 'Reassign Store',
          description: `Remove your assignment from ${storeName}. An admin will need to assign a new ambassador.`,
          notesLabel: 'Reason for Reassignment',
          notesPlaceholder: 'Why are you requesting reassignment?',
          confirmLabel: 'Request Reassignment',
        };
      default:
        return null;
    }
  };

  const dialogContent = getDialogContent();

  if (compact) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Store Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openDialog('log_visit')}>
              <Eye className="h-4 w-4 mr-2" />
              Log Visit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openDialog('log_followup')}>
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Follow-Up
            </DropdownMenuItem>
            {onMessage && (
              <DropdownMenuItem onClick={onMessage}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Send Message
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openDialog('escalate')} className="text-amber-500">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Escalate Store
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openDialog('reassign')} className="text-destructive">
              <UserMinus className="h-4 w-4 mr-2" />
              Request Reassignment
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={dialog.open} onOpenChange={(open) => !open && closeDialog()}>
          {dialogContent && (
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{dialogContent.title}</DialogTitle>
                <DialogDescription>{dialogContent.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="notes">{dialogContent.notesLabel}</Label>
                  <Textarea
                    id="notes"
                    placeholder={dialogContent.notesPlaceholder}
                    value={dialog.notes}
                    onChange={(e) => setDialog(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog} disabled={dialog.loading}>
                  Cancel
                </Button>
                <Button onClick={handleAction} disabled={dialog.loading}>
                  {dialog.loading ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {dialogContent.confirmLabel}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
      </>
    );
  }

  // Expanded view with visible buttons
  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => openDialog('log_visit')}
        >
          <Eye className="h-3 w-3 mr-1" />
          Log Visit
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => openDialog('log_followup')}
        >
          <Calendar className="h-3 w-3 mr-1" />
          Follow-Up
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onMessage && (
              <DropdownMenuItem onClick={onMessage}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Send Message
              </DropdownMenuItem>
            )}
            {onViewStore && (
              <DropdownMenuItem onClick={onViewStore}>
                <ClipboardList className="h-4 w-4 mr-2" />
                View Store Profile
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openDialog('escalate')} className="text-amber-500">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Escalate Store
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openDialog('reassign')} className="text-destructive">
              <UserMinus className="h-4 w-4 mr-2" />
              Request Reassignment
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={dialog.open} onOpenChange={(open) => !open && closeDialog()}>
        {dialogContent && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dialogContent.title}</DialogTitle>
              <DialogDescription>{dialogContent.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="notes">{dialogContent.notesLabel}</Label>
                <Textarea
                  id="notes"
                  placeholder={dialogContent.notesPlaceholder}
                  value={dialog.notes}
                  onChange={(e) => setDialog(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog} disabled={dialog.loading}>
                Cancel
              </Button>
              <Button onClick={handleAction} disabled={dialog.loading}>
                {dialog.loading ? (
                  <>Processing...</>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {dialogContent.confirmLabel}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
