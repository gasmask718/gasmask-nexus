import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, MapPin, Phone, Plus, User, Users, Flower2, Sticker, Tag, Edit } from 'lucide-react';
import { toast } from 'sonner';

interface StoreContact {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  can_receive_sms: boolean | null;
  is_primary: boolean | null;
}

interface TubeInventory {
  id: string;
  brand: string;
  current_tubes_left: number | null;
}

type StoreContactRow = StoreContact & { store_id: string };
type TubeInventoryRow = TubeInventory & { store_id: string };

interface Store {
  id: string;
  name: string;
  type: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  phone: string;
  status: string;
  tags: string[];
  sells_flowers: boolean;
  sticker_status: string;
  sticker_door: boolean;
  sticker_instore: boolean;
  sticker_phone: boolean;
  contacts: StoreContact[];
  tubeInventory: TubeInventory[];
}

const normalizeBrandKey = (brand?: string | null) =>
  (brand || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const BRAND_BADGE_STYLES: Record<string, string> = {
  gasmask: 'bg-red-500/10 text-red-600 border-red-500/30',
  hotmama: 'bg-rose-500/10 text-rose-600 border-rose-500/30',
  grabbarus: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  hotscolatti: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
};

const DEFAULT_BRAND_BADGE_CLASS =
  'bg-muted/20 text-muted-foreground border-border/40';

const getBrandBadgeClass = (brand: string) =>
  BRAND_BADGE_STYLES[normalizeBrandKey(brand)] ?? DEFAULT_BRAND_BADGE_CLASS;

const Stores = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [stickerFilter, setStickerFilter] = useState<string>('all');
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [newStoreName, setNewStoreName] = useState('');
  const [isSavingStoreName, setIsSavingStoreName] = useState(false);

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['stores-with-contacts'],
    queryFn: async () => {
      // Fetch stores with sticker fields
      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select('id, name, type, address_street, address_city, address_state, address_zip, phone, status, tags, sells_flowers, sticker_status, sticker_door, sticker_instore, sticker_phone')
        .order('name');

      if (storesError) throw storesError;

      // Fetch all contacts for these stores
      const storeIds = storesData?.map(s => s.id) || [];

      let contactsData: StoreContactRow[] = [];
      if (storeIds.length) {
        const { data, error } = await supabase
          .from('store_contacts')
          .select('id, store_id, name, role, phone, can_receive_sms, is_primary')
          .in('store_id', storeIds);
        if (error) throw error;
        contactsData = data || [];
      }

      let tubeInventoryData: TubeInventoryRow[] = [];
      if (storeIds.length) {
        const { data, error } = await supabase
          .from('store_tube_inventory')
          .select('id, store_id, brand, current_tubes_left')
          .in('store_id', storeIds);
        if (error) throw error;
        tubeInventoryData = data || [];
      }

      // Map contacts to stores
      const contactsByStore = contactsData.reduce((acc, contact) => {
        if (!acc[contact.store_id]) acc[contact.store_id] = [];
        acc[contact.store_id].push(contact);
        return acc;
      }, {} as Record<string, StoreContact[]>);

      const inventoryByStore = tubeInventoryData.reduce((acc, item) => {
        if (!acc[item.store_id]) acc[item.store_id] = [];
        acc[item.store_id].push({
          id: item.id,
          brand: item.brand,
          current_tubes_left: item.current_tubes_left,
        });
        return acc;
      }, {} as Record<string, TubeInventory[]>);

      return (storesData || []).map(store => ({
        ...store,
        contacts: contactsByStore[store.id] || [],
        tubeInventory: inventoryByStore[store.id] || [],
      }));
    },
  });

  const availableStoreTags = Array.from(
    new Set(
      stores
        .flatMap(store => store.tags ?? [])
        .map(tag => tag?.trim())
        .filter((tag): tag is string => Boolean(tag))
    )
  ).sort((a, b) => a.localeCompare(b));

  const filteredStores = stores.filter(store => {
    const matchesSearch = 
      store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.address_city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || store.status === statusFilter;
    
    const matchesTag =
      tagFilter === 'all' ||
      (tagFilter === 'flowers' && store.sells_flowers) ||
      store.tags?.some(tag => tag.toLowerCase() === tagFilter.toLowerCase());
    
    // Sticker filter
    const matchesSticker = stickerFilter === 'all' ||
      (stickerFilter === 'has_door' && store.sticker_door) ||
      (stickerFilter === 'has_instore' && store.sticker_instore) ||
      (stickerFilter === 'has_phone' && store.sticker_phone) ||
      (stickerFilter === 'has_any' && (store.sticker_door || store.sticker_instore || store.sticker_phone)) ||
      (stickerFilter === 'no_sticker' && !store.sticker_door && !store.sticker_instore && !store.sticker_phone);
    
    return matchesSearch && matchesStatus && matchesTag && matchesSticker;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'inactive': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      case 'prospect': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'needsFollowUp': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const statusCounts = {
    all: stores.length,
    active: stores.filter(s => s.status === 'active').length,
    prospect: stores.filter(s => s.status === 'prospect').length,
    needsFollowUp: stores.filter(s => s.status === 'needsFollowUp').length,
  };

  const flowersCount = stores.filter(s => s.sells_flowers).length;
  const stickerCounts = {
    hasDoor: stores.filter(s => s.sticker_door).length,
    hasInstore: stores.filter(s => s.sticker_instore).length,
    hasPhone: stores.filter(s => s.sticker_phone).length,
    hasAny: stores.filter(s => s.sticker_door || s.sticker_instore || s.sticker_phone).length,
    noSticker: stores.filter(s => !s.sticker_door && !s.sticker_instore && !s.sticker_phone).length,
  };

  // Helper to get owners and workers from contacts
  const getOwners = (contacts: StoreContact[]) =>
    contacts.filter(contact => {
      const role = contact.role?.toLowerCase() || '';
      return role.includes('owner') || Boolean(contact.is_primary);
    });

  const workerRoleKeywords = ['worker', 'manager', 'staff', 'cashier', 'clerk', 'employee', 'team'];

  const getWorkers = (contacts: StoreContact[]) =>
    contacts.filter(contact => {
      const role = contact.role?.toLowerCase() || '';
      if (!role || role.includes('owner')) return false;
      return workerRoleKeywords.some(keyword => role.includes(keyword));
    });

  const formatBrandName = (brand: string) =>
    brand
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const openEditStoreName = (store: Store) => {
    setEditingStore(store);
    setNewStoreName(store.name);
  };

  const closeEditStoreName = () => {
    setEditingStore(null);
    setNewStoreName('');
  };

  const handleSaveStoreName = async () => {
    if (!editingStore) return;

    const trimmedName = newStoreName.trim();
    if (!trimmedName) {
      toast.error('Store name cannot be empty');
      return;
    }

    setIsSavingStoreName(true);
    try {
      const { error } = await supabase
        .from('stores')
        .update({ name: trimmedName })
        .eq('id', editingStore.id);

      if (error) throw error;

      toast.success('Store name updated');
      closeEditStoreName();
      await queryClient.invalidateQueries({ queryKey: ['stores-with-contacts'] });
    } catch (error) {
      console.error('Error updating store name:', error);
      toast.error('Failed to update store name');
    } finally {
      setIsSavingStoreName(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Stores</h2>
          <p className="text-muted-foreground">
            Manage your distribution network • {filteredStores.length} stores
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary-hover">
          <Plus className="h-4 w-4 mr-2" />
          Add Store
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search stores by name, location, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary/50 border-border/50"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-secondary/50 border-border/50">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores ({statusCounts.all})</SelectItem>
              <SelectItem value="active">Active ({statusCounts.active})</SelectItem>
              <SelectItem value="prospect">Prospects ({statusCounts.prospect})</SelectItem>
              <SelectItem value="needsFollowUp">Needs Follow-up ({statusCounts.needsFollowUp})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Additional Filters Row */}
        <div className="flex flex-wrap gap-2">
          {/* Tag Filter */}
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-44 bg-secondary/50 border-border/50">
              <Tag className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              <SelectItem value="flowers">
                <span className="flex items-center gap-2">
                  <Flower2 className="h-4 w-4 text-pink-500" />
                  Sells Flowers ({flowersCount})
                </span>
              </SelectItem>
              {availableStoreTags.map(tagValue => (
                <SelectItem key={tagValue} value={tagValue}>
                  <span className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" />
                    {tagValue}
                    <span className="text-xs text-muted-foreground">
                      (
                      {
                        stores.filter(store =>
                          store.tags?.some(tag => tag.toLowerCase() === tagValue.toLowerCase())
                        ).length
                      }
                      )
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sticker Filter */}
          <Select value={stickerFilter} onValueChange={setStickerFilter}>
            <SelectTrigger className="w-52 bg-secondary/50 border-border/50">
              <Sticker className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Stickers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sticker Status</SelectItem>
              <SelectItem value="has_any">Has Any Sticker ({stickerCounts.hasAny})</SelectItem>
              <SelectItem value="has_door">Door Sticker ({stickerCounts.hasDoor})</SelectItem>
              <SelectItem value="has_instore">In-Store Sticker ({stickerCounts.hasInstore})</SelectItem>
              <SelectItem value="has_phone">Phone Sticker ({stickerCounts.hasPhone})</SelectItem>
              <SelectItem value="no_sticker">No Stickers ({stickerCounts.noSticker})</SelectItem>
            </SelectContent>
          </Select>

          {/* Active Filters Display */}
          {(tagFilter !== 'all' || stickerFilter !== 'all') && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setTagFilter('all'); setStickerFilter('all'); }}
              className="text-muted-foreground"
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Stores Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredStores.map((store, index) => {
            const owners = getOwners(store.contacts);
            const workers = getWorkers(store.contacts);
            const cityStateZip = [store.address_city, store.address_state, store.address_zip]
              .filter(Boolean)
              .join(', ');
            const sortedInventory = [...(store.tubeInventory || [])].sort((a, b) =>
              a.brand.localeCompare(b.brand)
            );

            return (
              <Card
                key={store.id}
                className="glass-card border-border/50 hover-lift hover-glow cursor-pointer"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => navigate(`/stores/${store.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{store.name}</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {store.type.replace('_', ' ')}
                      </Badge>
                    </div>
                  <div className="flex items-start gap-2">
                    <Badge className={getStatusColor(store.status)}>
                      {store.status === 'needsFollowUp' ? 'Follow-up' : store.status}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditStoreName(store);
                      }}
                      aria-label={`Edit ${store.name} name`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Full Address */}
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      {store.address_street ? (
                        <span className="block text-foreground">{store.address_street}</span>
                      ) : (
                        <span>No street address on file</span>
                      )}
                      {cityStateZip ? (
                        <span>{cityStateZip}</span>
                      ) : (
                        <span>No city / state / zip on file</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Store Phone */}
                  {store.phone ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{store.phone}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>No phone on file</span>
                    </div>
                  )}

                  {/* Owners */}
                  <div className="flex items-start gap-2 text-sm">
                    <User className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
                    <div>
                      <span className="text-muted-foreground text-xs">Owners: </span>
                      <span className="font-medium">
                        {owners.length > 0 ? owners.map(o => o.name).join(', ') : 'Not on file'}
                      </span>
                    </div>
                  </div>

                  {/* Workers */}
                  <div className="flex items-start gap-2 text-sm">
                    <Users className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                    <div>
                      <span className="text-muted-foreground text-xs">Staff: </span>
                      <span className="font-medium">
                        {workers.length > 0 ? workers.map(w => w.name).join(', ') : 'Not on file'}
                      </span>
                    </div>
                  </div>

                  {sortedInventory.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {sortedInventory.map(item => (
                        <Badge
                          key={item.id}
                          variant="outline"
                          className={`text-xs ${getBrandBadgeClass(item.brand)}`}
                        >
                          {formatBrandName(item.brand)}: {Math.max(0, item.current_tubes_left ?? 0)}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Operations Tags */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {store.sells_flowers && (
                      <Badge className="text-xs bg-pink-500/10 text-pink-600 border-pink-500/30">
                        <Flower2 className="h-3 w-3 mr-1" />
                        Flowers
                      </Badge>
                    )}
                    {(store.sticker_door || store.sticker_instore || store.sticker_phone) && (
                      <Badge className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
                        <Sticker className="h-3 w-3 mr-1" />
                        Sticker
                      </Badge>
                    )}
                  </div>

                  {/* Tags */}
                  {store.tags && store.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {store.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {store.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{store.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!isLoading && filteredStores.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No stores found matching your filters</p>
        </div>
      )}

      <Dialog
        open={Boolean(editingStore)}
        onOpenChange={(open) => {
          if (!open && !isSavingStoreName) {
            closeEditStoreName();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Store Name</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="store-name-input">Store Name</Label>
              <Input
                id="store-name-input"
                value={newStoreName}
                onChange={(event) => setNewStoreName(event.target.value)}
                placeholder="Enter store name"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeEditStoreName}
              disabled={isSavingStoreName}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveStoreName}
              disabled={isSavingStoreName || !newStoreName.trim()}
            >
              {isSavingStoreName ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Stores;
