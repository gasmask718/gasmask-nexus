import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Package } from 'lucide-react';

interface UpdateInventoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  onSuccess?: () => void;
}

const BRANDS = ['grabba', 'gasmask', 'fronto'];

export function UpdateInventoryModal({
  open,
  onOpenChange,
  storeId,
  storeName,
  onSuccess,
}: UpdateInventoryModalProps) {
  const queryClient = useQueryClient();
  const [brand, setBrand] = useState('');
  const [tubeCount, setTubeCount] = useState('');
  const [notes, setNotes] = useState('');

  const updateMutation = useMutation({
    mutationFn: async () => {
      const count = parseInt(tubeCount, 10);
      if (isNaN(count) || count < 0) {
        throw new Error('Invalid tube count');
      }

      // Check if record exists for this brand
      const { data: existing } = await supabase
        .from('store_tube_inventory')
        .select('id')
        .eq('store_id', storeId)
        .eq('brand', brand)
        .single();

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('store_tube_inventory')
          .update({
            current_tubes_left: count,
            last_updated: new Date().toISOString(),
            created_by: 'manual_update',
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('store_tube_inventory')
          .insert({
            store_id: storeId,
            brand,
            current_tubes_left: count,
            created_by: 'manual_update',
          });

        if (error) throw error;
      }

      // Log the inventory event
      await supabase.from('inventory_events').insert({
        store_id: storeId,
        event_type: 'count_update',
        brand,
        quantity: count,
        notes: notes || null,
        created_by: 'manual_update',
      });
    },
    onSuccess: () => {
      toast.success(`Inventory updated: ${tubeCount} ${brand} tubes`);
      queryClient.invalidateQueries({ queryKey: ['store-tube-inventory', storeId] });
      setBrand('');
      setTubeCount('');
      setNotes('');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(`Failed to update inventory: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand) {
      toast.error('Please select a brand');
      return;
    }
    if (!tubeCount) {
      toast.error('Please enter tube count');
      return;
    }
    updateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Update Inventory
          </DialogTitle>
          <DialogDescription>
            Record tube count for {storeName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Brand *</Label>
            <Select value={brand} onValueChange={setBrand}>
              <SelectTrigger>
                <SelectValue placeholder="Select brand" />
              </SelectTrigger>
              <SelectContent>
                {BRANDS.map((b) => (
                  <SelectItem key={b} value={b} className="capitalize">
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Current Tube Count *</Label>
            <Input
              type="number"
              min="0"
              value={tubeCount}
              onChange={(e) => setTubeCount(e.target.value)}
              placeholder="Enter current tube count"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Counted during visit, restocked, etc."
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex-1"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Count'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
