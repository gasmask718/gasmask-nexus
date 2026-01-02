import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useStoreMasterResolver } from '@/hooks/useStoreMasterResolver';

interface AddOpportunityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  onSuccess: () => void;
}

export function AddOpportunityModal({
  open,
  onOpenChange,
  storeId,
  storeName,
  onSuccess,
}: AddOpportunityModalProps) {
  const [opportunityText, setOpportunityText] = useState('');
  const [saving, setSaving] = useState(false);

  // Resolve storeId to store_master.id
  const {
    storeMasterId,
    isLoading: resolving,
    needsCreation,
    createStoreMaster,
    isCreating,
  } = useStoreMasterResolver(storeId);

  const handleSubmit = async () => {
    if (!opportunityText.trim()) {
      toast.error('Please enter an opportunity');
      return;
    }

    // Check if we have a valid store_master.id
    if (!storeMasterId) {
      if (needsCreation) {
        try {
          const created = await createStoreMaster();
          // Retry with the newly created store_master.id
          await saveOpportunity(created.id);
        } catch (error: any) {
          toast.error('Failed to create store master: ' + error.message);
        }
      } else {
        toast.error('Store not linked to store master. Please try again.');
      }
      return;
    }

    await saveOpportunity(storeMasterId);
  };

  const saveOpportunity = async (masterId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('store_opportunities').insert({
        store_id: masterId,
        opportunity_text: opportunityText.trim(),
        source: 'manual',
        is_completed: false,
      });

      if (error) throw error;

      toast.success('Opportunity added successfully');
      setOpportunityText('');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error adding opportunity:', error);
      toast.error('Failed to add opportunity: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setOpportunityText('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Opportunity for {storeName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {resolving && (
            <div className="text-center py-2 text-sm text-muted-foreground">
              Resolving store...
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="opportunity-text">Opportunity</Label>
            <Input
              id="opportunity-text"
              value={opportunityText}
              onChange={(e) => setOpportunityText(e.target.value)}
              placeholder="e.g., Wants to be a wholesaler"
              className="text-base"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Describe the business opportunity (e.g., "Family has additional stores", "Wants other brands")
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !opportunityText.trim() || resolving || isCreating}
          >
            {saving ? 'Saving...' : isCreating ? 'Creating...' : 'Add Opportunity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

