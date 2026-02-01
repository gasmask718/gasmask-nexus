/**
 * Modal for assigning an existing store to an ambassador
 * Used in Ambassador Profile to add stores to their operational responsibility
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Store, Search, Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssignStoreToAmbassadorModalProps {
  isOpen: boolean;
  onClose: () => void;
  ambassadorId: string;
  ambassadorName: string;
  existingStoreIds?: string[];
  onSuccess?: () => void;
}

export function AssignStoreToAmbassadorModal({
  isOpen,
  onClose,
  ambassadorId,
  ambassadorName,
  existingStoreIds = [],
  onSuccess,
}: AssignStoreToAmbassadorModalProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);

  // Fetch available stores (not already assigned to this ambassador)
  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['stores-for-assignment', ambassadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_master')
        .select('id, store_name, city, address, health_status, assigned_ambassador_id')
        .order('store_name')
        .limit(500);

      if (error) throw error;
      
      // Filter out stores already assigned to this ambassador
      return (data || []).filter(s => s.assigned_ambassador_id !== ambassadorId);
    },
    enabled: isOpen,
  });

  // Filter stores by search
  const filteredStores = stores.filter(store =>
    store.store_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    store.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Mutation to assign stores
  const assignMutation = useMutation({
    mutationFn: async (storeIds: string[]) => {
      // Update store_master with assigned_ambassador_id
      const { error: updateError } = await supabase
        .from('store_master')
        .update({ assigned_ambassador_id: ambassadorId })
        .in('id', storeIds);

      if (updateError) throw updateError;

      // Also create ambassador_assignments records for tracking
      const assignments = storeIds.map(storeId => ({
        ambassador_id: ambassadorId,
        store_id: storeId,
        assignment_role: 'assigned',
        active: true,
      }));

      const { error: assignError } = await supabase
        .from('ambassador_assignments')
        .upsert(assignments, { 
          onConflict: 'ambassador_id,store_id',
          ignoreDuplicates: false 
        });

      if (assignError) {
        console.warn('Assignment tracking insert warning:', assignError);
        // Don't throw - the main assignment succeeded
      }

      return storeIds;
    },
    onSuccess: (storeIds) => {
      toast.success(`${storeIds.length} store${storeIds.length > 1 ? 's' : ''} assigned to ${ambassadorName}`);
      queryClient.invalidateQueries({ queryKey: ['ambassador-assigned-stores', ambassadorId] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-sourced-stores', ambassadorId] });
      queryClient.invalidateQueries({ queryKey: ['stores-for-assignment', ambassadorId] });
      setSelectedStoreIds([]);
      setSearchQuery('');
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      console.error('Error assigning stores:', error);
      toast.error('Failed to assign stores');
    },
  });

  const handleToggleStore = (storeId: string) => {
    setSelectedStoreIds(prev =>
      prev.includes(storeId)
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
  };

  const handleSubmit = () => {
    if (selectedStoreIds.length === 0) {
      toast.error('Please select at least one store');
      return;
    }
    assignMutation.mutate(selectedStoreIds);
  };

  const handleClose = () => {
    setSelectedStoreIds([]);
    setSearchQuery('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Assign Stores to {ambassadorName}
          </DialogTitle>
          <DialogDescription>
            Select stores to add to this ambassador's operational responsibility
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search stores by name or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Store List */}
          <div className="border rounded-lg">
            <ScrollArea className="h-[300px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-full py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredStores.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Store className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No stores available to assign</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredStores.map((store) => {
                    const isSelected = selectedStoreIds.includes(store.id);
                    const isAlreadyAssigned = existingStoreIds.includes(store.id);
                    
                    return (
                      <div
                        key={store.id}
                        className={cn(
                          'flex items-center gap-3 p-3 cursor-pointer transition-colors',
                          isSelected && 'bg-primary/5',
                          isAlreadyAssigned && 'opacity-50 cursor-not-allowed',
                          !isAlreadyAssigned && 'hover:bg-muted/50'
                        )}
                        onClick={() => !isAlreadyAssigned && handleToggleStore(store.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={isAlreadyAssigned}
                          onCheckedChange={() => handleToggleStore(store.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Store className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{store.store_name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {store.city || store.address || 'No location'}
                          </div>
                        </div>
                        {store.assigned_ambassador_id && (
                          <Badge variant="outline" className="text-xs">
                            Has Manager
                          </Badge>
                        )}
                        {store.health_status && (
                          <Badge 
                            variant="outline"
                            className={cn(
                              'text-xs',
                              store.health_status === 'healthy' && 'text-green-500 border-green-500/30',
                              store.health_status === 'at_risk' && 'text-amber-500 border-amber-500/30',
                              store.health_status === 'dormant' && 'text-red-500 border-red-500/30',
                            )}
                          >
                            {store.health_status}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Selection Summary */}
          {selectedStoreIds.length > 0 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-sm text-muted-foreground">
                {selectedStoreIds.length} store{selectedStoreIds.length > 1 ? 's' : ''} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedStoreIds([])}
              >
                Clear selection
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedStoreIds.length === 0 || assignMutation.isPending}
          >
            {assignMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              `Assign ${selectedStoreIds.length || ''} Store${selectedStoreIds.length > 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
