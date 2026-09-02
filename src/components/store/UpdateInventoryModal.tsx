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
import { VALID_TUBE_BRANDS } from './UnifiedTubeIntelligenceCard';
import { invalidateStoreInventoryQueries } from '@/lib/inventory/invalidation';
import { resolveProductIdForBrand } from '@/lib/inventory/skuDisplay';
import { writeStoreTubeCounts } from '@/lib/inventory/writeTubeCounts';

interface UpdateInventoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  onSuccess?: () => void;
}

// Use the same brands as Tube Inventory, including HotScolatti Light and Dark
const BRANDS = [
  { id: 'gasmask', name: 'GasMask Bags' },
  { id: 'gasmasktubes', name: 'GasMask Tubes' },
  { id: 'hotmama', name: 'HotMama' },
  { id: 'grabba', name: 'Grabba r us' },
  { id: 'hotscolatti-light', name: 'Hotscolatti Light' },
  { id: 'hotscolatti-dark', name: 'Hotscolatti Dark' },
];

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

      const { data: { user } } = await supabase.auth.getUser();

      // Canonical inventory write → store_tube_inventory_status
      await writeStoreTubeCounts({
        storeId,
        updates: [{ brandId: brand, count }],
        actorId: user?.id ?? null,
        method: 'manual_update',
      });

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
      invalidateStoreInventoryQueries(queryClient, storeId);
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
                {BRANDS.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
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
