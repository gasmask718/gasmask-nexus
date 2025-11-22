import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Truck, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function WholesaleFulfillment() {
  const [selectedTab, setSelectedTab] = useState("pending");

  const { data: orders, refetch } = useQuery({
    queryKey: ["fulfillment-orders", selectedTab],
    queryFn: async () => {
      let query = supabase
        .from("store_orders")
        .select(`
          *,
          stores(name, address_city),
          store_order_items(*, products(name))
        `)
        .order("created_at", { ascending: false });

      if (selectedTab !== "all") {
        query = query.eq("status", selectedTab);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
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

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Package className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Order Fulfillment</h1>
            <p className="text-muted-foreground">Manage incoming store orders</p>
          </div>
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
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders?.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.stores?.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {order.stores?.address_city}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {order.store_order_items?.length || 0} items
                        </TableCell>
                        <TableCell className="font-bold">
                          ${order.total_amount.toFixed(2)}
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
                    ))}
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
