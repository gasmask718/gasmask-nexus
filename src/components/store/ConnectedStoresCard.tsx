import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MapPin,
  Phone,
  Users,
  Package,
  ExternalLink,
  Store,
  Link2,
  Unlink,
  Plus,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { ConnectStoresModal } from './ConnectStoresModal';
import { DeleteConfirmModal } from '@/components/crud/DeleteConfirmModal';
import { toast } from 'sonner';
import {
  useConnectedStores,
  type ConnectedStoreRow,
} from '@/hooks/useConnectedStores';
import { formatDistanceToNow } from 'date-fns';

interface ConnectedStoresCardProps {
  storeId: string;
  currentStoreName: string;
  currentStoreGroupId: string | null;
  /** Legacy prop — retained for backwards compat but no longer used. Linking
   *  is by connected_group_id ONLY. */
  currentStoreOwnerName?: string | null;
  onConnectionChange?: () => void;
}

const brandColors: Record<string, string> = {
  gasmask: 'bg-red-500/10 text-red-500 border-red-500/20',
  gasmasktubes: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  hotmama: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  grabba: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  grabbar: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  hotscolatti: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
};

const formatBrandName = (brand: string) => {
  const normalized = brand.toLowerCase();
  if (normalized === 'gasmask' || (normalized.includes('gasmask') && !normalized.includes('gasmasktubes'))) {
    return 'Gasmask Bags';
  }
  return brand
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export function ConnectedStoresCard({
  storeId,
  currentStoreName,
  currentStoreGroupId,
  onConnectionChange,
}: ConnectedStoresCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectModalInitialMode, setConnectModalInitialMode] = useState<
    'search' | 'add'
  >('search');
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [disconnectingStore, setDisconnectingStore] = useState<ConnectedStoreRow | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const { data: connectedStores, isLoading, error } = useConnectedStores(
    storeId,
    currentStoreGroupId,
  );

  const handleDisconnect = (store: ConnectedStoreRow) => {
    setDisconnectingStore(store);
    setDisconnectModalOpen(true);
  };

  const confirmDisconnect = async () => {
    if (!disconnectingStore) return;
    setIsDisconnecting(true);
    try {
      const { error: err } = await supabase
        .from('stores')
        .update({ connected_group_id: null })
        .eq('id', disconnectingStore.id);
      if (err) throw err;

      // Sync trigger propagates to store_master; belt-and-suspenders:
      await supabase
        .from('store_master')
        .update({ connected_group_id: null })
        .eq('id', disconnectingStore.id);

      toast.success(`Disconnected ${disconnectingStore.name}`);
      queryClient.invalidateQueries({ queryKey: ['connected-stores'] });
      queryClient.invalidateQueries({ queryKey: ['connected-stores-count'] });
      onConnectionChange?.();
    } catch (err: any) {
      console.error('Error disconnecting store:', err);
      toast.error('Failed to disconnect store');
    } finally {
      setIsDisconnecting(false);
      setDisconnectModalOpen(false);
      setDisconnectingStore(null);
    }
  };

  const openConnectMode = () => {
    setConnectModalInitialMode('search');
    setConnectModalOpen(true);
  };
  const openAddMode = () => {
    setConnectModalInitialMode('add');
    setConnectModalOpen(true);
  };

  if (isLoading) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const hasConnectedStores = !!connectedStores && connectedStores.length > 0;

  return (
    <>
      <Card className="glass-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            All Owner's Stores
            {hasConnectedStores && ` (${connectedStores!.length})`}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={openAddMode}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Store
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openConnectMode}
              className="gap-2"
            >
              <Link2 className="h-4 w-4" />
              Link Existing
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Error loading connected stores
            </p>
          )}
          {!hasConnectedStores && !error && (
            <div className="text-center py-6 space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center">
                <Link2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {currentStoreGroupId
                    ? 'No other stores in this group yet'
                    : 'Not linked to an owner group'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click <strong>Add Store</strong> to create a new location for
                  this owner, or <strong>Link Existing</strong> to attach one
                  already in the system.
                </p>
              </div>
            </div>
          )}

          {hasConnectedStores &&
            connectedStores!.map((store) => {
              const fullAddress = [
                store.address_street,
                store.address_city,
                store.address_state,
                store.address_zip,
              ]
                .filter(Boolean)
                .join(', ');

              const inventoryByBrand = store.inventory.reduce((acc, item) => {
                const brandKey = item.brand.toLowerCase();
                if (!acc[brandKey]) {
                  acc[brandKey] = { brand: item.brand, totalCount: 0 };
                }
                acc[brandKey].totalCount += Math.max(0, item.current_tubes_left ?? 0);
                return acc;
              }, {} as Record<string, { brand: string; totalCount: number }>);

              const groupedInventory = Object.values(inventoryByBrand).sort((a, b) =>
                a.brand.localeCompare(b.brand),
              );

              const lastOrderLabel = store.last_order_date
                ? formatDistanceToNow(new Date(store.last_order_date), { addSuffix: true })
                : 'No orders yet';

              return (
                <div
                  key={store.id}
                  className="p-4 rounded-lg bg-secondary/30 border border-border/50 space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-base truncate">{store.name}</h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {store.status && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {String(store.status).replace(/_/g, ' ')}
                            </Badge>
                          )}
                          {store.needs_order && (
                            <Badge className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Needs Order
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Calendar className="h-3 w-3" />
                            {lastOrderLabel}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/stores/${store.id}`)}
                          className="h-8 gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDisconnect(store)}
                          className="h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Disconnect this store"
                        >
                          <Unlink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {fullAddress && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{fullAddress}</span>
                      </div>
                    )}

                    {store.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{store.phone}</span>
                      </div>
                    )}
                  </div>

                  {store.contacts.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Users className="h-3 w-3" />
                        Contacts
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {store.contacts.slice(0, 5).map((contact) => (
                          <Badge key={contact.id} variant="outline" className="text-xs">
                            {contact.name}
                            {contact.role && ` (${contact.role})`}
                          </Badge>
                        ))}
                        {store.contacts.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{store.contacts.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {groupedInventory.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Package className="h-3 w-3" />
                        Inventory
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {groupedInventory.map((item, idx) => (
                          <Badge
                            key={`${item.brand}-${idx}`}
                            className={`text-xs ${brandColors[item.brand.toLowerCase()] || 'bg-muted text-muted-foreground'}`}
                          >
                            {formatBrandName(item.brand)}: {item.totalCount}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </CardContent>
      </Card>

      <ConnectStoresModal
        open={connectModalOpen}
        onOpenChange={setConnectModalOpen}
        storeId={storeId}
        storeName={currentStoreName}
        currentGroupId={currentStoreGroupId}
        initialMode={connectModalInitialMode}
        onSuccess={onConnectionChange}
      />

      <DeleteConfirmModal
        open={disconnectModalOpen}
        onOpenChange={setDisconnectModalOpen}
        title="Disconnect Store"
        itemName={disconnectingStore?.name ?? undefined}
        onConfirm={confirmDisconnect}
      />
    </>
  );
}
