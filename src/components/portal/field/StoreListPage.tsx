import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Store, Search, MapPin, ClipboardCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface StoreItem {
  id: string;
  store_name: string;
  address: string;
  city: string;
  state: string;
}

interface StoreListPageProps {
  portalType: 'driver' | 'biker';
}

export function StoreListPage({ portalType }: StoreListPageProps) {
  const navigate = useNavigate();
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchStores() {
      try {
        let query = supabase
          .from('store_master')
          .select('id, store_name, address, city, state')
          .order('store_name')
          .limit(50);

        if (search) {
          query = query.or(`store_name.ilike.%${search}%,address.ilike.%${search}%,city.ilike.%${search}%`);
        }

        const { data } = await query;
        if (data) {
          setStores(data);
        }
      } catch (error) {
        console.error('Error fetching stores:', error);
      } finally {
        setLoading(false);
      }
    }

    const debounce = setTimeout(fetchStores, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  const basePath = portalType === 'driver' ? '/portal/driver' : '/portal/biker';
  const accentClass = portalType === 'driver' ? 'text-hud-cyan' : 'text-hud-green';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Stores</h1>
          <p className="text-sm text-muted-foreground">Select a store to start a visit</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search stores by name, address, or city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Store List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Store className="h-5 w-5" />
            Available Stores
          </CardTitle>
          <CardDescription>
            {stores.length} stores found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : stores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Store className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No stores found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stores.map((store) => (
                <div 
                  key={store.id}
                  className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`${basePath}/visit/${store.id}`)}
                >
                  <div className={`w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center ${accentClass}`}>
                    <Store className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{store.store_name}</p>
                    <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {store.address}, {store.city}, {store.state}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    active
                  </Badge>
                  <Button size="sm" variant="outline">
                    <ClipboardCheck className="h-4 w-4 mr-1" />
                    Visit
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
