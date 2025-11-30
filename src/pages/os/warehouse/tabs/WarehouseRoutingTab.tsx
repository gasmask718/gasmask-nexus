import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Truck, Package, AlertCircle, CheckCircle, Brain } from 'lucide-react';
import { useRunWarehouseBrain } from '@/services/warehouse';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function WarehouseRoutingTab() {
  const runBrain = useRunWarehouseBrain();

  // Get unrouted orders (paid orders needing routing)
  const { data: unroutedOrders, isLoading } = useQuery({
    queryKey: ['unrouted-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_orders')
        .select('id, order_type, total_amount, shipping_state, shipping_country, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  // Get routed orders
  const { data: routedOrders } = useQuery({
    queryKey: ['order-routing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_routing')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  const handleRunRouting = () => {
    runBrain.mutate('route_orders');
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unroutedOrders?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Awaiting Routing</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Truck className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {routedOrders?.filter((r: any) => r.status === 'pending').length || 0}
                </p>
                <p className="text-xs text-muted-foreground">In Routing</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {routedOrders?.filter((r: any) => r.status === 'shipped').length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Shipped Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Routing Engine */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Routing Engine
          </CardTitle>
          <CardDescription>
            Automatically route orders to optimal warehouses and fulfillment centers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleRunRouting} disabled={runBrain.isPending} size="lg">
            <RefreshCw className={`h-4 w-4 mr-2 ${runBrain.isPending ? 'animate-spin' : ''}`} />
            {runBrain.isPending ? 'Running...' : 'Run AI Routing Engine'}
          </Button>
        </CardContent>
      </Card>

      {/* Unrouted Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Orders Awaiting Routing</CardTitle>
          <CardDescription>Paid orders that need fulfillment assignment</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
          ) : unroutedOrders?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unroutedOrders.map((order: any) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono font-medium">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {order.order_type || 'Customer'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {order.items?.[0]?.count || 0} items
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${order.total_amount?.toLocaleString() || 0}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.shipping_state || order.shipping_country || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Needs Routing
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>All orders have been routed</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
