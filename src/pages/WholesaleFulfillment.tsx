import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Truck, CheckCircle, DollarSign, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  cost_per_box_snapshot?: number | null;
  profit_per_box_snapshot?: number | null;
  margin_percent_snapshot?: number | null;
  revenue_total?: number | null;
  cogs_total?: number | null;
  profit_total?: number | null;
  products?: { name: string; cost?: number; units_per_box?: number };
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  delivered_at?: string | null;
  store_master?: { store_name: string; city?: string };
  store_order_items?: OrderItem[];
}

export default function WholesaleFulfillment() {
  const [selectedTab, setSelectedTab] = useState("pending");

  const { data: orders, refetch } = useQuery({
    queryKey: ["fulfillment-orders", selectedTab],
    queryFn: async () => {
      let query = supabase
        .from("store_orders")
        .select(`
          *,
          store_order_items(
            *,
            products(name, cost, units_per_box)
          )
        `)
        .order("created_at", { ascending: false });

      if (selectedTab !== "all") {
        query = query.eq("status", selectedTab);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch store names separately since the relationship might not be set up
      const storeIds = [...new Set((data || []).map(o => o.store_id).filter(Boolean))];
      let storeMap: Record<string, { store_name: string; city?: string }> = {};
      
      if (storeIds.length > 0) {
        const { data: stores } = await supabase
          .from('store_master')
          .select('id, store_name, city')
          .in('id', storeIds);
        
        storeMap = (stores || []).reduce((acc, s) => {
          acc[s.id] = { store_name: s.store_name, city: s.city };
          return acc;
        }, {} as Record<string, { store_name: string; city?: string }>);
      }
      
      return (data || []).map(order => ({
        ...order,
        store_master: storeMap[order.store_id] || null
      })) as Order[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: string }) => {
      const { error } = await supabase
        .from("store_orders")
        .update({ 
          status: newStatus,
          ...(newStatus === "delivered" && { delivered_at: new Date().toISOString() })
        })
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order status updated");
      refetch();
    },
    onError: (error: Error) => {
      toast.error("Failed to update status", { description: error.message });
    },
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "pending": return "outline";
      case "preparing": return "secondary";
      case "ready_for_pickup": return "default";
      case "out_for_delivery": return "default";
      case "delivered": return "default";
      case "cancelled": return "destructive";
      default: return "outline";
    }
  };

  const getNextStatus = (currentStatus: string) => {
    const statusFlow = {
      pending: "preparing",
      preparing: "ready_for_pickup",
      ready_for_pickup: "out_for_delivery",
      out_for_delivery: "delivered",
    };
    return statusFlow[currentStatus as keyof typeof statusFlow];
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Calculate order totals from items
  const getOrderProfitTotals = (items: OrderItem[] | undefined) => {
    if (!items?.length) return { revenue: 0, cogs: 0, profit: 0, margin: 0 };
    
    const revenue = items.reduce((sum, item) => sum + (item.revenue_total || item.total_price || 0), 0);
    const cogs = items.reduce((sum, item) => {
      if (item.cogs_total) return sum + item.cogs_total;
      // Fallback calculation if snapshot not present
      const cost = item.products?.cost || 0;
      const unitsPerBox = item.products?.units_per_box || 1;
      return sum + (cost * unitsPerBox * item.quantity);
    }, 0);
    const profit = revenue - cogs;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    
    return { revenue, cogs, profit, margin };
  };

  // Aggregate totals for summary
  const aggregateTotals = orders?.reduce((acc, order) => {
    const totals = getOrderProfitTotals(order.store_order_items);
    return {
      revenue: acc.revenue + totals.revenue,
      cogs: acc.cogs + totals.cogs,
      profit: acc.profit + totals.profit,
      orderCount: acc.orderCount + 1,
    };
  }, { revenue: 0, cogs: 0, profit: 0, orderCount: 0 }) || { revenue: 0, cogs: 0, profit: 0, orderCount: 0 };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Package className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Order Fulfillment</h1>
            <p className="text-muted-foreground">Manage incoming store orders with profit tracking</p>
          </div>
        </div>

        {/* Profit Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs">Total Revenue</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {formatCurrency(aggregateTotals.revenue)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <Package className="h-4 w-4" />
                <span className="text-xs">Total COGS</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {formatCurrency(aggregateTotals.cogs)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs">Gross Profit</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {formatCurrency(aggregateTotals.profit)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-900/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-400">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs">Avg Margin</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {aggregateTotals.revenue > 0 
                  ? ((aggregateTotals.profit / aggregateTotals.revenue) * 100).toFixed(1) + '%'
                  : '-'}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="preparing">Preparing</TabsTrigger>
            <TabsTrigger value="ready_for_pickup">Ready</TabsTrigger>
            <TabsTrigger value="out_for_delivery">Out for Delivery</TabsTrigger>
            <TabsTrigger value="delivered">Delivered</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="mt-6">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>COGS</TableHead>
                      <TableHead>Profit</TableHead>
                      <TableHead>Margin</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders?.map((order) => {
                      const profitTotals = getOrderProfitTotals(order.store_order_items);
                      
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.order_number}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{order.store_master?.store_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {order.store_master?.city}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {order.store_order_items?.length || 0} items
                          </TableCell>
                          <TableCell className="font-mono">
                            {formatCurrency(profitTotals.revenue)}
                          </TableCell>
                          <TableCell className="font-mono text-amber-600">
                            {formatCurrency(profitTotals.cogs)}
                          </TableCell>
                          <TableCell className={`font-mono ${profitTotals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(profitTotals.profit)}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={profitTotals.margin >= 20 ? 'default' : profitTotals.margin >= 10 ? 'secondary' : 'destructive'}
                              className="font-mono"
                            >
                              {profitTotals.margin.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(order.status)}>
                              {order.status.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(order.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {order.status !== "delivered" && order.status !== "cancelled" && (
                              <Button
                                size="sm"
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    orderId: order.id,
                                    newStatus: getNextStatus(order.status),
                                  })
                                }
                                disabled={updateStatusMutation.isPending}
                              >
                                {order.status === "ready_for_pickup" ? (
                                  <><Truck className="mr-2 h-4 w-4" /> Dispatch</>
                                ) : order.status === "out_for_delivery" ? (
                                  <><CheckCircle className="mr-2 h-4 w-4" /> Complete</>
                                ) : (
                                  "Next Stage"
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {(!orders || orders.length === 0) && (
                  <div className="text-center py-12 text-muted-foreground">
                    No orders in this status
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
