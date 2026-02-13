// ═══════════════════════════════════════════════════════════════════════════════
// STOP RESOLUTION DIALOG — Phase 3.3 Post-Completion Prompt
// ═══════════════════════════════════════════════════════════════════════════════
// Human-confirmed closure of linked opportunities/follow-ups after stop completion.
// Zero auto-resolution. Every mutation is explicit.

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, AlertTriangle, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface StopResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stopId: string;
  storeId: string;
  storeName: string;
  opportunityIds: string[];
}

interface ResolutionItem {
  id: string;
  type: 'opportunity' | 'follow_up';
  text: string;
  checked: boolean;
  note: string;
}

export function StopResolutionDialog({
  open,
  onOpenChange,
  stopId,
  storeId,
  storeName,
  opportunityIds,
}: StopResolutionDialogProps) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ResolutionItem[]>([]);

  // Fetch linked opportunities
  const { data: opportunities = [] } = useQuery({
    queryKey: ['resolution-opportunities', opportunityIds],
    queryFn: async () => {
      if (opportunityIds.length === 0) return [];
      const { data, error } = await supabase
        .from('store_opportunities')
        .select('id, opportunity_text, is_completed')
        .in('id', opportunityIds)
        .eq('is_completed', false);
      if (error) throw error;
      return data || [];
    },
    enabled: open && opportunityIds.length > 0,
  });

  // Fetch linked follow-ups for this store
  const { data: followUps = [] } = useQuery({
    queryKey: ['resolution-follow-ups', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follow_up_queue')
        .select('id, reason, recommended_action, status')
        .eq('store_id', storeId)
        .in('status', ['pending', 'overdue']);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!storeId,
  });

  // Build resolution items when data loads
  useEffect(() => {
    const newItems: ResolutionItem[] = [];
    opportunities.forEach(opp => {
      newItems.push({
        id: opp.id,
        type: 'opportunity',
        text: opp.opportunity_text,
        checked: false,
        note: '',
      });
    });
    followUps.forEach(fu => {
      newItems.push({
        id: fu.id,
        type: 'follow_up',
        text: fu.reason || fu.recommended_action || 'Follow-up',
        checked: false,
        note: '',
      });
    });
    setItems(newItems);
  }, [opportunities, followUps]);

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const updateNote = (id: string, note: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, note } : item
    ));
  };

  const resolvesMutation = useMutation({
    mutationFn: async () => {
      const checkedItems = items.filter(i => i.checked);
      if (checkedItems.length === 0) return;

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || null;

      for (const item of checkedItems) {
        if (item.type === 'opportunity') {
          const { error } = await supabase
            .from('store_opportunities')
            .update({
              is_completed: true,
              completed_at: new Date().toISOString(),
              completed_by: userId,
            })
            .eq('id', item.id);
          if (error) throw error;
        } else if (item.type === 'follow_up') {
          const { error } = await supabase
            .from('follow_up_queue')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              completed_by: userId,
            })
            .eq('id', item.id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      const count = items.filter(i => i.checked).length;
      toast.success(`${count} item${count !== 1 ? 's' : ''} resolved`);
      queryClient.invalidateQueries({ queryKey: ['store-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['store-follow-ups'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-intake-view'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities-summary'] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to resolve items');
    },
  });

  const hasItems = items.length > 0;
  const checkedCount = items.filter(i => i.checked).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Stop Completed
          </DialogTitle>
          <DialogDescription>
            {storeName} — Review linked items and mark what was addressed.
          </DialogDescription>
        </DialogHeader>

        {!hasItems ? (
          <div className="py-6 text-center text-muted-foreground">
            <p className="text-sm">No linked opportunities or follow-ups.</p>
            <p className="text-xs mt-1">Nothing to resolve.</p>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              This stop was linked to {items.length} item{items.length !== 1 ? 's' : ''}.
              Mark what was addressed:
            </p>

            {items.map(item => (
              <div
                key={item.id}
                className="p-3 border rounded-lg space-y-2"
              >
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={item.checked}
                    onCheckedChange={() => toggleItem(item.id)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={item.type === 'opportunity' ? 'secondary' : 'destructive'}
                        className="text-[10px]"
                      >
                        {item.type === 'opportunity' ? (
                          <><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Opportunity</>
                        ) : (
                          <><AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Follow-Up</>
                        )}
                      </Badge>
                    </div>
                    <p className="text-sm mt-1">{item.text}</p>
                  </div>
                </div>

                {item.checked && (
                  <div className="pl-6">
                    <Textarea
                      placeholder="Add a note (optional)..."
                      value={item.note}
                      onChange={(e) => updateNote(item.id, e.target.value)}
                      className="text-sm h-16"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <Separator />

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Skip
          </Button>
          {checkedCount > 0 && (
            <Button
              onClick={() => resolvesMutation.mutate()}
              disabled={resolvesMutation.isPending}
            >
              Resolve {checkedCount} item{checkedCount !== 1 ? 's' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
