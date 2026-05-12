import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  MapPin,
  Store,
  Loader2,
  Link2,
  Unlink,
  Plus,
  ArrowLeft,
} from 'lucide-react';
import { StoreCaptureForm } from './StoreCaptureForm';

interface StoreForConnection {
  id: string;
  name: string;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  connected_group_id: string | null;
}

interface ConnectStoresModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  currentGroupId: string | null;
  onSuccess?: () => void;
}

export function ConnectStoresModal({
  open,
  onOpenChange,
  storeId,
  storeName,
  currentGroupId,
  onSuccess,
}: ConnectStoresModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [showCaptureForm, setShowCaptureForm] = useState(false);
  // Stable group ID used during capture (generated lazily if parent has none yet).
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const captureGroupId = useMemo(() => {
    return currentGroupId ?? pendingGroupId;
  }, [currentGroupId, pendingGroupId]);

  // Fetch all stores except current one
  const { data: allStores, isLoading: loadingStores } = useQuery({
    queryKey: ['stores-for-connection', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, address_street, address_city, address_state, connected_group_id')
        .neq('id', storeId)
        .is('deleted_at', null)
        .order('name');

      if (error) throw error;
      return data as StoreForConnection[];
    },
    enabled: open,
  });

  // Get currently connected stores
  const connectedStoreIds = allStores
    ?.filter((s) => currentGroupId && s.connected_group_id === currentGroupId)
    .map((s) => s.id) || [];

  // Filter stores based on search
  const filteredStores = allStores?.filter((store) => {
    const query = searchQuery.toLowerCase();
    return (
      store.name.toLowerCase().includes(query) ||
      store.address_city?.toLowerCase().includes(query) ||
      store.address_street?.toLowerCase().includes(query)
    );
  }) || [];

  // Mutation to connect stores
  const connectMutation = useMutation({
    mutationFn: async (storeIds: string[]) => {
      // Generate new group ID if current store doesn't have one
      const groupId = currentGroupId || crypto.randomUUID();

      // Update current store with group ID (if it doesn't have one)
      if (!currentGroupId) {
        const { error: currentError } = await supabase
          .from('stores')
          .update({ connected_group_id: groupId })
          .eq('id', storeId);

        if (currentError) throw currentError;
      }

      // Update all selected stores with same group ID
      const { error } = await supabase
        .from('stores')
        .update({ connected_group_id: groupId })
        .in('id', storeIds);

      if (error) throw error;

      return { groupId, count: storeIds.length };
    },
    onSuccess: (result) => {
      toast.success(`Connected ${result.count} store(s) successfully`);
      queryClient.invalidateQueries({ queryKey: ['connected-stores'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      setSelectedStores([]);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(`Failed to connect stores: ${error.message}`);
    },
  });

  // Mutation to disconnect a store
  const disconnectMutation = useMutation({
    mutationFn: async (disconnectStoreId: string) => {
      const { error } = await supabase
        .from('stores')
        .update({ connected_group_id: null })
        .eq('id', disconnectStoreId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Store disconnected');
      queryClient.invalidateQueries({ queryKey: ['connected-stores'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to disconnect: ${error.message}`);
    },
  });

  const handleToggleStore = (id: string) => {
    setSelectedStores((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleConnect = () => {
    if (selectedStores.length > 0) {
      connectMutation.mutate(selectedStores);
    }
  };

  const handleOpenCaptureForm = () => {
    // Generate a stable group id now if parent store doesn't have one,
    // so the captured store gets connected immediately.
    if (!currentGroupId && !pendingGroupId) {
      setPendingGroupId(crypto.randomUUID());
    }
    setShowCaptureForm(true);
  };

  const handleCaptured = async (newStoreId: string) => {
    try {
      // If parent store didn't have a group yet, write the freshly-minted
      // group id onto it so the new store is part of the group.
      if (!currentGroupId && pendingGroupId) {
        const { error } = await supabase
          .from('stores')
          .update({ connected_group_id: pendingGroupId })
          .eq('id', storeId);
        if (error) throw error;
      }
      toast.success('Store captured & connected');
      queryClient.invalidateQueries({ queryKey: ['stores-for-connection', storeId] });
      queryClient.invalidateQueries({ queryKey: ['connected-stores'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      setShowCaptureForm(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(`Captured but failed to link: ${err.message}`);
    }
  };

  const formatAddress = (store: StoreForConnection) => {
    return [store.address_street, store.address_city, store.address_state]
      .filter(Boolean)
      .join(', ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            {showCaptureForm ? 'Add New Store' : 'Connect Store Locations'}
          </DialogTitle>
          <DialogDescription>
            {showCaptureForm
              ? `New store will be connected to "${storeName}" automatically.`
              : `Connect "${storeName}" with other store locations. Connected stores share the same group and appear together.`}
          </DialogDescription>
        </DialogHeader>

        {showCaptureForm ? (
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCaptureForm(false)}
              className="w-fit"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to search
            </Button>
            <StoreCaptureForm
              connectedGroupId={captureGroupId}
              onCaptured={handleCaptured}
              onCancel={() => setShowCaptureForm(false)}
            />
          </div>
        ) : (
          <>
            {/* Currently Connected */}
            {connectedStoreIds.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Currently Connected</h4>
                <div className="flex flex-wrap gap-2">
                  {allStores
                    ?.filter((s) => connectedStoreIds.includes(s.id))
                    .map((store) => (
                      <Badge
                        key={store.id}
                        variant="secondary"
                        className="flex items-center gap-1 pr-1"
                      >
                        <Store className="h-3 w-3" />
                        {store.name}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 ml-1 hover:bg-destructive/20"
                          onClick={() => disconnectMutation.mutate(store.id)}
                          disabled={disconnectMutation.isPending}
                        >
                          <Unlink className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                </div>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stores by name or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Store List */}
            <ScrollArea className="h-[300px] border rounded-md">
              {loadingStores ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredStores.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Store className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No stores found</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredStores.map((store) => {
                    const isConnected = connectedStoreIds.includes(store.id);
                    const isSelected = selectedStores.includes(store.id);
                    const hasOtherGroup = store.connected_group_id && store.connected_group_id !== currentGroupId;

                    return (
                      <div
                        key={store.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          isConnected
                            ? 'bg-primary/5 border-primary/20'
                            : isSelected
                            ? 'bg-secondary border-primary/30'
                            : 'hover:bg-secondary/50 border-transparent'
                        }`}
                      >
                        <Checkbox
                          checked={isSelected || isConnected}
                          disabled={isConnected}
                          onCheckedChange={() => handleToggleStore(store.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{store.name}</span>
                            {isConnected && (
                              <Badge variant="outline" className="text-xs">
                                Connected
                              </Badge>
                            )}
                            {hasOtherGroup && (
                              <Badge variant="secondary" className="text-xs">
                                In another group
                              </Badge>
                            )}
                          </div>
                          {formatAddress(store) && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{formatAddress(store)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            <Button
              type="button"
              variant="outline"
              onClick={handleOpenCaptureForm}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Store
            </Button>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <div className="flex-1 text-sm text-muted-foreground">
                {selectedStores.length > 0 && (
                  <span>{selectedStores.length} store(s) selected</span>
                )}
              </div>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConnect}
                disabled={selectedStores.length === 0 || connectMutation.isPending}
              >
                {connectMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Connect {selectedStores.length > 0 ? `(${selectedStores.length})` : 'Stores'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
