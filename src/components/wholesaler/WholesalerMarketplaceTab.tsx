/**
 * WholesalerMarketplaceTab — Engine 2: Wholesale Marketplace Portal
 * "How is this wholesaler performing inside our marketplace?"
 * 
 * Surfaces: Uploaded Products, Inventory, Platform Orders, Commissions, Payouts
 * Data Source: wholesale_products, marketplace_inventory, wholesale_orders_platform,
 *             marketplace_commissions, wholesaler_payouts
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingBag, Package, DollarSign, 
  CheckCircle, XCircle, Loader2, TrendingUp, Truck,
  Percent, Archive
} from 'lucide-react';
import { format } from 'date-fns';

interface WholesalerMarketplaceTabProps {
  wholesalerId: string;
}

export const WholesalerMarketplaceTab: React.FC<WholesalerMarketplaceTabProps> = ({
  wholesalerId,
}) => {
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['marketplace-products', wholesalerId],
    queryFn: async () => {
      const { data, error } = await supabase.from('wholesale_products').select('*').eq('wholesaler_id', wholesalerId).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!wholesalerId,
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['marketplace-inventory', wholesalerId],
    queryFn: async () => {
      const { data, error } = await supabase.from('marketplace_inventory').select('*').eq('wholesaler_id', wholesalerId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!wholesalerId,
  });

  const { data: platformOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['marketplace-orders-platform', wholesalerId],
    queryFn: async () => {
      const { data, error } = await supabase.from('wholesale_orders_platform').select('*').eq('wholesaler_id', wholesalerId).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!wholesalerId,
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ['marketplace-commissions', wholesalerId],
    queryFn: async () => {
      const { data, error } = await supabase.from('marketplace_commissions').select('*').eq('wholesaler_id', wholesalerId).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!wholesalerId,
  });

  const { data: payouts, isLoading: payoutsLoading } = useQuery({
    queryKey: ['marketplace-payouts', wholesalerId],
    queryFn: async () => {
      const { data, error } = await supabase.from('wholesaler_payouts').select('*').eq('wholesaler_id', wholesalerId).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!wholesalerId,
  });

  if (productsLoading || ordersLoading || payoutsLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const activeProducts = (products || []).filter((p: any) => p.is_active);
  const totalRevenue = (platformOrders || []).reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
  const totalPayouts = (payouts || []).reduce((sum: number, p: any) => sum + (p.net_amount || 0), 0);
  const totalFees = (payouts || []).reduce((sum: number, p: any) => sum + (p.platform_fee || 0), 0);
  const totalCommission = commissions.reduce((sum: number, c: any) => sum + (c.commission_amount || 0), 0);
  const pendingPayouts = (payouts || []).filter((p: any) => p.status === 'pending');
  const completedOrders = (platformOrders || []).filter((o: any) => o.status === 'completed' || o.status === 'delivered');
  const lowStockItems = inventory.filter((i: any) => i.quantity_available <= (i.reorder_point || 10));

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard label="Products Listed" value={`${activeProducts.length}`} sub={`${(products || []).length} total`} icon={Package} accent="text-purple-400" />
        <KPICard label="Platform Revenue" value={`$${totalRevenue.toLocaleString()}`} sub={`${(platformOrders || []).length} orders`} icon={DollarSign} accent="text-emerald-400" />
        <KPICard label="Commission Earned" value={`$${totalCommission.toLocaleString()}`} sub={`$${totalFees.toLocaleString()} in fees`} icon={Percent} accent="text-blue-400" />
        <KPICard label="Fulfillment Rate" value={platformOrders && platformOrders.length > 0 ? `${Math.round((completedOrders.length / platformOrders.length) * 100)}%` : 'N/A'} sub={`${completedOrders.length} completed`} icon={Truck} accent="text-amber-400" />
      </div>

      <Tabs defaultValue="products">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="products" className="text-xs"><ShoppingBag className="h-3.5 w-3.5 mr-1" /> Products</TabsTrigger>
          <TabsTrigger value="inventory" className="text-xs">
            <Archive className="h-3.5 w-3.5 mr-1" /> Inventory
            {lowStockItems.length > 0 && <Badge className="ml-1 h-4 px-1 text-[10px] bg-amber-500/15 text-amber-400">{lowStockItems.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="orders" className="text-xs"><Package className="h-3.5 w-3.5 mr-1" /> Orders</TabsTrigger>
          <TabsTrigger value="payouts" className="text-xs"><DollarSign className="h-3.5 w-3.5 mr-1" /> Payouts</TabsTrigger>
        </TabsList>

        {/* Products */}
        <TabsContent value="products" className="mt-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> Uploaded Products</CardTitle>
                <Badge variant="outline">{activeProducts.length} active</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {(products || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No products uploaded to marketplace yet</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {(products || []).map((product: any) => (
                    <div key={product.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        {product.is_active ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                        <div>
                          <p className="text-sm font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.category || 'Uncategorized'} • Stock: {product.stock ?? 'N/A'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">${(product.price || 0).toLocaleString()}</p>
                        <Badge variant="outline" className={`text-xs ${product.is_active ? 'text-emerald-400 border-emerald-500/30' : 'text-muted-foreground'}`}>{product.is_active ? 'Active' : 'Inactive'}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory */}
        <TabsContent value="inventory" className="mt-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Inventory Levels</CardTitle>
                {lowStockItems.length > 0 && <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">{lowStockItems.length} low stock</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              {inventory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No inventory records</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {inventory.map((item: any) => {
                    const isLow = item.quantity_available <= (item.reorder_point || 10);
                    return (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/30 transition-colors">
                        <div>
                          <p className="text-sm font-medium">Product {item.product_id?.slice(0, 8)}...</p>
                          <p className="text-xs text-muted-foreground">Reserved: {item.reserved_quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${isLow ? 'text-amber-400' : ''}`}>{item.quantity_available} avail</p>
                          {isLow && <Badge className="text-xs bg-amber-500/15 text-amber-400">Low Stock</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Orders */}
        <TabsContent value="orders" className="mt-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" /> Platform Orders</CardTitle></CardHeader>
            <CardContent>
              {(platformOrders || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No platform orders yet</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {(platformOrders || []).slice(0, 15).map((order: any) => (
                    <div key={order.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="text-sm font-medium">{format(new Date(order.created_at), 'MMM d, yyyy')}</p>
                        <Badge variant="outline" className="text-xs">{order.status || 'pending'}</Badge>
                      </div>
                      <p className="text-sm font-bold">${(order.total_amount || 0).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payouts */}
        <TabsContent value="payouts" className="mt-4 space-y-4">
          {/* Commission Breakdown */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Commission Breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-xs text-muted-foreground">Gross Revenue</p><p className="text-lg font-bold">${commissions.reduce((s: number, c: any) => s + (c.gross_amount || 0), 0).toLocaleString()}</p></div>
                <div><p className="text-xs text-muted-foreground">Commission</p><p className="text-lg font-bold text-blue-400">${totalCommission.toLocaleString()}</p></div>
                <div><p className="text-xs text-muted-foreground">Net to Wholesaler</p><p className="text-lg font-bold text-emerald-400">${commissions.reduce((s: number, c: any) => s + (c.wholesaler_net || 0), 0).toLocaleString()}</p></div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Payout History</CardTitle>
                {pendingPayouts.length > 0 && <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">{pendingPayouts.length} pending</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              {(payouts || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No payouts recorded</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(payouts || []).slice(0, 8).map((payout: any) => (
                    <div key={payout.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="text-sm font-medium">
                          {payout.period_start && payout.period_end 
                            ? `${format(new Date(payout.period_start), 'MMM d, yyyy')} – ${format(new Date(payout.period_end), 'MMM d, yyyy')}`
                            : format(new Date(payout.created_at), 'MMM d, yyyy')}
                        </p>
                        <p className="text-xs text-muted-foreground">{payout.payout_method || 'N/A'} • Fee: ${(payout.platform_fee || 0).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-400">${(payout.net_amount || 0).toLocaleString()}</p>
                        <Badge variant="outline" className={`text-xs ${payout.status === 'paid' ? 'text-emerald-400 border-emerald-500/30' : payout.status === 'pending' ? 'text-amber-400 border-amber-500/30' : 'text-muted-foreground'}`}>{payout.status || 'pending'}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

function KPICard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string; icon: any; accent: string;
}) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${accent}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
