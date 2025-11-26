import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Store, Truck, Package, DollarSign } from 'lucide-react';

export function GrabbaCluster() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClusterData();
  }, []);

  const fetchClusterData = async () => {
    try {
      // Fetch Grabba-related data
      const { data: stores } = await supabase
        .from('store_master')
        .select('*, store_brand_accounts(brand)')
        .limit(10);

      const { data: routes } = await supabase
        .from('routes')
        .select('*')
        .eq('status', 'completed')
        .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      const { data: orders } = await supabase
        .from('wholesale_orders')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const totalOrders = orders?.length || 0;
      const totalRevenue = 0; // Calculate from visit_logs instead

      setData({
        stores,
        routes,
        totalOrders,
        totalRevenue,
      });
    } catch (error) {
      console.error('Error fetching cluster data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Card className="p-8 text-center">Loading Grabba Cluster data...</Card>;
  }

  return (
    <div className="space-y-6">
      {/* Cluster Overview */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Grabba Cluster Performance</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Stores</p>
            <p className="text-2xl font-bold">{data?.stores?.length || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Deliveries (7 days)</p>
            <p className="text-2xl font-bold">{data?.routes?.length || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Brands Active</p>
            <p className="text-2xl font-bold">{Object.keys(data?.brandStats || {}).length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Multi-Brand Stores</p>
            <p className="text-2xl font-bold">
              {data?.stores?.filter((s: any) => s.store_brand_accounts?.length > 1).length || 0}
            </p>
          </div>
        </div>
      </Card>

      {/* Orders Summary */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Package className="h-5 w-5" />
          Orders Summary (Last 24h)
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-muted-foreground">Total Orders</p>
            <p className="text-2xl font-bold">{data?.totalOrders || 0}</p>
          </div>
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold">${data?.totalRevenue?.toLocaleString() || 0}</p>
          </div>
        </div>
      </Card>

      {/* Top 10 Stores */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Store className="h-5 w-5" />
          Top Cluster Stores
        </h3>
        <div className="space-y-2">
          {data?.stores?.slice(0, 10).map((store: any, index: number) => (
            <div key={store.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium">{store.store_name}</p>
                  <p className="text-xs text-muted-foreground">{store.address}</p>
                </div>
              </div>
              <Badge variant="outline">
                {store.store_brand_accounts?.length || 0} brands
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}