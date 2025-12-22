import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, TrendingUp, Users, Store } from 'lucide-react';

interface NeighborhoodSnapshotCardProps {
  storeId: string;
  neighborhood?: string;
  borough?: string;
}

export function NeighborhoodSnapshotCard({ storeId, neighborhood, borough }: NeighborhoodSnapshotCardProps) {
  // Fetch neighborhood stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ['neighborhood-stats', neighborhood, borough],
    queryFn: async () => {
      if (!neighborhood && !borough) return null;

      // Get stores in same neighborhood/borough
      let query = supabase
        .from('stores')
        .select('id, status, type')
        .neq('id', storeId);

      if (neighborhood) {
        query = query.ilike('address_city', `%${neighborhood}%`);
      } else if (borough) {
        query = query.ilike('address_city', `%${borough}%`);
      }

      const { data: stores, error } = await query;
      if (error) throw error;

      const activeStores = stores?.filter(s => s.status === 'active').length || 0;
      const totalStores = stores?.length || 0;

      // Get recent orders in the area
      const storeIds = stores?.map(s => s.id) || [];
      let recentOrdersCount = 0;
      
      if (storeIds.length > 0) {
        const { count } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .in('store_id', storeIds)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
        
        recentOrdersCount = count || 0;
      }

      return {
        totalStores,
        activeStores,
        recentOrders: recentOrdersCount,
        neighborhoodName: neighborhood || borough || 'Unknown',
      };
    },
    enabled: !!(neighborhood || borough),
  });

  if (!neighborhood && !borough) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Neighborhood Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : stats ? (
          <>
            {/* Location Badge */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {stats.neighborhoodName}
              </Badge>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg bg-secondary/30">
                <Store className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{stats.totalStores}</p>
                <p className="text-xs text-muted-foreground">Nearby Stores</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-green-500/10">
                <Users className="h-4 w-4 mx-auto mb-1 text-green-500" />
                <p className="text-lg font-bold text-green-500">{stats.activeStores}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                <p className="text-lg font-bold text-blue-500">{stats.recentOrders}</p>
                <p className="text-xs text-muted-foreground">Orders (7d)</p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No neighborhood data available
          </p>
        )}
      </CardContent>
    </Card>
  );
}
