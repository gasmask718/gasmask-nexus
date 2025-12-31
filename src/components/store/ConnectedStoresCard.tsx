import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Users, Package, ExternalLink, Store } from 'lucide-react';

interface ConnectedStore {
  id: string;
  name: string;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  phone: string | null;
  primary_contact_name: string | null;
  connected_group_id: string | null;
}

interface StoreContact {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
}

interface TubeInventory {
  brand: string;
  current_tubes_left: number | null;
}

interface ConnectedStoreWithDetails extends ConnectedStore {
  contacts: StoreContact[];
  inventory: TubeInventory[];
}

interface ConnectedStoresCardProps {
  storeId: string;
  currentStoreName: string;
  currentStoreGroupId: string | null;
  currentStoreOwnerName: string | null;
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
  currentStoreOwnerName 
}: ConnectedStoresCardProps) {
  const navigate = useNavigate();

  const { data: connectedStores, isLoading, error } = useQuery({
    queryKey: ['connected-stores', storeId, currentStoreGroupId, currentStoreOwnerName],
    queryFn: async () => {
      let query = supabase
        .from('stores')
        .select('id, name, address_street, address_city, address_state, address_zip, phone, primary_contact_name, connected_group_id')
        .neq('id', storeId); // Exclude current store

      // Find connected stores by group_id or owner name
      if (currentStoreGroupId) {
        query = query.eq('connected_group_id', currentStoreGroupId);
      } else if (currentStoreOwnerName) {
        query = query.eq('primary_contact_name', currentStoreOwnerName);
      } else {
        // No connection method available, return empty
        return [];
      }

      const { data: storesData, error: storesError } = await query;
      if (storesError) throw storesError;
      if (!storesData || storesData.length === 0) return [];

      const storeIds = storesData.map(s => s.id);

      // Fetch contacts for all connected stores
      const { data: contactsData, error: contactsError } = await supabase
        .from('store_contacts')
        .select('id, store_id, name, role, phone')
        .in('store_id', storeIds);

      if (contactsError) throw contactsError;

      // Fetch inventory for all connected stores
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('store_tube_inventory')
        .select('store_id, brand, current_tubes_left')
        .in('store_id', storeIds);

      if (inventoryError) throw inventoryError;

      // Group contacts by store_id
      const contactsByStore = (contactsData || []).reduce((acc, contact) => {
        if (!acc[contact.store_id]) acc[contact.store_id] = [];
        acc[contact.store_id].push({
          id: contact.id,
          name: contact.name,
          role: contact.role,
          phone: contact.phone,
        });
        return acc;
      }, {} as Record<string, StoreContact[]>);

      // Group inventory by store_id
      const inventoryByStore = (inventoryData || []).reduce((acc, item) => {
        if (!acc[item.store_id]) acc[item.store_id] = [];
        acc[item.store_id].push({
          brand: item.brand,
          current_tubes_left: item.current_tubes_left,
        });
        return acc;
      }, {} as Record<string, TubeInventory[]>);

      // Combine stores with their contacts and inventory
      return storesData.map(store => ({
        ...store,
        contacts: contactsByStore[store.id] || [],
        inventory: inventoryByStore[store.id] || [],
      })) as ConnectedStoreWithDetails[];
    },
    enabled: !!storeId,
  });

  if (isLoading) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  // Check if we can search for connected stores
  const canSearchForConnections = !!currentStoreGroupId || !!currentStoreOwnerName;
  const hasConnectedStores = connectedStores && connectedStores.length > 0;

  // Only show card if we can search AND have connections, or if there's an error
  if (!canSearchForConnections && !hasConnectedStores && !error) {
    return null;
  }

  return (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          Connected Stores
          {hasConnectedStores && ` (${connectedStores.length})`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Error loading connected stores
          </p>
        )}
        {!canSearchForConnections && !hasConnectedStores && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No connected stores. Set connected_group_id or primary_contact_name to link stores.
          </p>
        )}
        {canSearchForConnections && !hasConnectedStores && !error && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No connected stores found with the same connection settings.
          </p>
        )}
        {hasConnectedStores && connectedStores.map((store) => {
          const fullAddress = [
            store.address_street,
            store.address_city,
            store.address_state,
            store.address_zip,
          ]
            .filter(Boolean)
            .join(', ');

          // Group inventory by brand
          const inventoryByBrand = store.inventory.reduce((acc, item) => {
            const brandKey = item.brand.toLowerCase();
            if (!acc[brandKey]) {
              acc[brandKey] = {
                brand: item.brand,
                totalCount: 0,
              };
            }
            acc[brandKey].totalCount += Math.max(0, item.current_tubes_left ?? 0);
            return acc;
          }, {} as Record<string, { brand: string; totalCount: number }>);

          const groupedInventory = Object.values(inventoryByBrand).sort((a, b) =>
            a.brand.localeCompare(b.brand)
          );

          return (
            <div
              key={store.id}
              className="p-4 rounded-lg bg-secondary/30 border border-border/50 space-y-3"
            >
              {/* Store Name & Address */}
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <h4 className="font-semibold text-base">{store.name}</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/stores/${store.id}`)}
                    className="h-8 gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View
                  </Button>
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

              {/* Contacts */}
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

              {/* Inventory */}
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

              {groupedInventory.length === 0 && store.contacts.length === 0 && (
                <p className="text-xs text-muted-foreground">No inventory or contacts data</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

