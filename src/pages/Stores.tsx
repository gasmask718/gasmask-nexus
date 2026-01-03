import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, MapPin, Phone, Plus, User, Users, Flower2, Sticker, Tag, Edit, CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

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
  payment_type: string | null;
  contacts: StoreContact[];
  tubeInventory: TubeInventory[];
}

const Stores = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [stickerFilter, setStickerFilter] = useState<string>('all');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('all');
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [newStoreName, setNewStoreName] = useState('');
  const [isSavingStoreName, setIsSavingStoreName] = useState(false);
  
  // Add Store Modal State
  const [showAddStore, setShowAddStore] = useState(false);
  const [newStoreData, setNewStoreData] = useState({
    name: '',
    type: 'retail',
    address_street: '',
    address_city: '',
    address_state: 'NY',
    address_zip: '',
    phone: '',
    status: 'prospect',
    primary_contact_name: '',
    notes: '',
  });

  const createStoreMutation = useMutation({
    mutationFn: async (data: typeof newStoreData) => {
      const { data: result, error } = await supabase
        .from('stores')
        .insert([{
          name: data.name,
          type: data.type as "bodega" | "gas_station" | "other" | "smoke_shop" | "wholesaler",
          address_street: data.address_street || null,
          address_city: data.address_city || null,
          address_state: data.address_state || null,
          address_zip: data.address_zip || null,
          phone: data.phone || null,
          status: data.status as "active" | "inactive" | "needsFollowUp" | "prospect",
          primary_contact_name: data.primary_contact_name || null,
        }])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['stores-with-contacts'] });
      toast.success('Store created successfully');
      setShowAddStore(false);
      resetNewStoreForm();
      // Navigate to store profile
      navigate(`/stores/${data.id}`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create store: ${error.message}`);
    },
  });

  const resetNewStoreForm = () => {
    setNewStoreData({
      name: '',
      type: 'retail',
      address_street: '',
      address_city: '',
      address_state: 'NY',
      address_zip: '',
      phone: '',
      status: 'prospect',
      primary_contact_name: '',
      notes: '',
    });
  };

  const handleCreateStore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreData.name.trim()) {
      toast.error('Store name is required');
      return;
    }
    createStoreMutation.mutate(newStoreData);
  };

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['stores-with-contacts'],
    queryFn: async () => {
      // Fetch stores with sticker fields and payment type
      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select('id, name, type, address_street, address_city, address_state, address_zip, phone, status, tags, sells_flowers, sticker_status, sticker_door, sticker_instore, sticker_phone, payment_type')
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
    
    // Payment type filter
    const matchesPaymentType = 
      paymentTypeFilter === 'all' || 
      (paymentTypeFilter === 'not_set' && !store.payment_type) ||
      (paymentTypeFilter !== 'not_set' && store.payment_type === paymentTypeFilter);
    
    return matchesSearch && matchesStatus && matchesTag && matchesSticker && matchesPaymentType;
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
  const paymentTypeCounts = {
    paysUpfront: stores.filter(s => s.payment_type === 'pays_upfront').length,
    billToBill: stores.filter(s => s.payment_type === 'bill_to_bill').length,
    notSet: stores.filter(s => !s.payment_type).length,
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

  const formatBrandName = (brand: string) => {
    const normalized = brand.toLowerCase();
    // Special case: gasmask should display as "gasmask bags"
    if (normalized === 'gasmask' || (normalized.includes('gasmask') && !normalized.includes('gasmasktubes'))) {
      return 'Gasmask Bags';
    }
    return brand
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const getBrandColor = (brand: string) => {
    const normalizedBrand = brand.toLowerCase();
    // Check gasmasktubes first (before gasmask) since it contains "gasmask"
    if (normalizedBrand.includes('gasmasktubes') || normalizedBrand === 'gasmasktubes') {
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
    if (normalizedBrand.includes('gasmask')) {
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    }
    if (normalizedBrand.includes('hotmama')) {
      return 'bg-pink-500/10 text-pink-500 border-pink-500/20';
    }
    if (normalizedBrand.includes('grabba') || normalizedBrand.includes('grabbar')) {
      return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    }
    if (normalizedBrand.includes('hotscolatti') || normalizedBrand.includes('hotscolatti')) {
      return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    }
    return 'bg-muted text-muted-foreground';
  };

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
        <Button className="bg-primary hover:bg-primary-hover" onClick={() => setShowAddStore(true)}>
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

          {/* Payment Type Filter */}
          <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
            <SelectTrigger className="w-48 bg-secondary/50 border-border/50">
              <CreditCard className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payment Types</SelectItem>
              <SelectItem value="pays_upfront">Pays Upfront ({paymentTypeCounts.paysUpfront})</SelectItem>
              <SelectItem value="bill_to_bill">Bill to Bill ({paymentTypeCounts.billToBill})</SelectItem>
              <SelectItem value="not_set">Not Set ({paymentTypeCounts.notSet})</SelectItem>
            </SelectContent>
          </Select>

          {/* Active Filters Display */}
          {(tagFilter !== 'all' || stickerFilter !== 'all' || paymentTypeFilter !== 'all') && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setTagFilter('all'); setStickerFilter('all'); setPaymentTypeFilter('all'); }}
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
            // Group inventory by brand (case-insensitive) and sum counts
            const inventoryByBrand = (store.tubeInventory || []).reduce((acc, item) => {
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

                  {groupedInventory.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {groupedInventory.map((item, idx) => (
                        <Badge key={`${item.brand}-${idx}`} className={`text-xs ${getBrandColor(item.brand)}`}>
                          {formatBrandName(item.brand)}: {item.totalCount}
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

      {/* Add Store Modal */}
      <Dialog open={showAddStore} onOpenChange={(open) => {
        if (!open && !createStoreMutation.isPending) {
          setShowAddStore(false);
          resetNewStoreForm();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Store</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateStore} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="new-store-name">Store Name *</Label>
                <Input
                  id="new-store-name"
                  value={newStoreData.name}
                  onChange={(e) => setNewStoreData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Store name"
                  autoFocus
                />
              </div>

              <div>
                <Label htmlFor="new-store-type">Store Type</Label>
                <Select
                  value={newStoreData.type}
                  onValueChange={(value) => setNewStoreData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger id="new-store-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smoke_shop">Smoke Shop</SelectItem>
                    <SelectItem value="bodega">Bodega</SelectItem>
                    <SelectItem value="gas_station">Gas Station</SelectItem>
                    <SelectItem value="wholesaler">Wholesaler</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="new-store-status">Status</Label>
                <Select
                  value={newStoreData.status}
                  onValueChange={(value) => setNewStoreData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger id="new-store-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="needsFollowUp">Needs Follow-up</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="new-store-contact">Primary Contact</Label>
                <Input
                  id="new-store-contact"
                  value={newStoreData.primary_contact_name}
                  onChange={(e) => setNewStoreData(prev => ({ ...prev, primary_contact_name: e.target.value }))}
                  placeholder="Owner/Manager name"
                />
              </div>

              <div>
                <Label htmlFor="new-store-phone">Phone</Label>
                <Input
                  id="new-store-phone"
                  value={newStoreData.phone}
                  onChange={(e) => setNewStoreData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(555) 555-5555"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="new-store-address">Street Address</Label>
                <Input
                  id="new-store-address"
                  value={newStoreData.address_street}
                  onChange={(e) => setNewStoreData(prev => ({ ...prev, address_street: e.target.value }))}
                  placeholder="123 Main St"
                />
              </div>

              <div>
                <Label htmlFor="new-store-city">City</Label>
                <Input
                  id="new-store-city"
                  value={newStoreData.address_city}
                  onChange={(e) => setNewStoreData(prev => ({ ...prev, address_city: e.target.value }))}
                  placeholder="City"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="new-store-state">State</Label>
                  <Input
                    id="new-store-state"
                    value={newStoreData.address_state}
                    onChange={(e) => setNewStoreData(prev => ({ ...prev, address_state: e.target.value }))}
                    placeholder="NY"
                  />
                </div>
                <div>
                  <Label htmlFor="new-store-zip">ZIP</Label>
                  <Input
                    id="new-store-zip"
                    value={newStoreData.address_zip}
                    onChange={(e) => setNewStoreData(prev => ({ ...prev, address_zip: e.target.value }))}
                    placeholder="10001"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddStore(false);
                  resetNewStoreForm();
                }}
                disabled={createStoreMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createStoreMutation.isPending || !newStoreData.name.trim()}>
                {createStoreMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Store
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Stores;
