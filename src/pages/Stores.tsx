import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, Phone, Plus, User, Users, Flower2, Sticker, Tag } from 'lucide-react';

interface StoreContact {
  id: string;
  name: string;
  role: string;
  phone: string;
  can_receive_sms: boolean;
  is_primary: boolean;
}

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
}

const Stores = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [stickerFilter, setStickerFilter] = useState<string>('all');

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
      const { data: contactsData } = await supabase
        .from('store_contacts')
        .select('id, store_id, name, role, phone, can_receive_sms, is_primary')
        .in('store_id', storeIds);

      // Map contacts to stores
      const contactsByStore = (contactsData || []).reduce((acc, contact) => {
        if (!acc[contact.store_id]) acc[contact.store_id] = [];
        acc[contact.store_id].push(contact);
        return acc;
      }, {} as Record<string, StoreContact[]>);

      return (storesData || []).map(store => ({
        ...store,
        contacts: contactsByStore[store.id] || [],
      }));
    },
  });

  const filteredStores = stores.filter(store => {
    const matchesSearch = 
      store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.address_city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || store.status === statusFilter;
    
    // Tag filter - flowers
    const matchesTag = tagFilter === 'all' || 
      (tagFilter === 'flowers' && store.sells_flowers);
    
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
    contacts.filter(c => c.role?.toLowerCase().includes('owner'));
  
  const getWorkers = (contacts: StoreContact[]) => 
    contacts.filter(c => ['worker', 'manager'].includes(c.role?.toLowerCase()));

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
            const fullAddress = [store.address_street, store.address_city, store.address_state, store.address_zip]
              .filter(Boolean)
              .join(', ');

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
                    <Badge className={getStatusColor(store.status)}>
                      {store.status === 'needsFollowUp' ? 'Follow-up' : store.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Full Address */}
                  {fullAddress && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{fullAddress}</span>
                    </div>
                  )}
                  
                  {/* Store Phone */}
                  {store.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{store.phone}</span>
                    </div>
                  )}

                  {/* Owners */}
                  {owners.length > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <User className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
                      <div>
                        <span className="text-muted-foreground text-xs">Owners: </span>
                        <span className="font-medium">{owners.map(o => o.name).join(', ')}</span>
                      </div>
                    </div>
                  )}

                  {/* Workers */}
                  {workers.length > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <Users className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                      <div>
                        <span className="text-muted-foreground text-xs">Staff: </span>
                        <span className="font-medium">{workers.map(w => w.name).join(', ')}</span>
                      </div>
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
    </div>
  );
};

export default Stores;
