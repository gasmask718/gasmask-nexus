import { useState } from "react";
import { Link } from "react-router-dom";
import { useWholesalerOrders } from "@/services/wholesaler/useWholesalerOrders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, Search, Package, Clock, Truck, CheckCircle, 
  Eye, Printer, MoreVertical
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export default function WholesalerOrders() {
  const { orders, isLoading, pendingCount, processingCount, shippedCount, updateOrderStatus } = useWholesalerOrders();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(search.toLowerCase());
    if (activeTab === "all") return matchesSearch;
    return matchesSearch && order.fulfillment_status === activeTab;
  });

  const handleMarkShipped = async (orderId: string) => {
    await updateOrderStatus({ orderId, status: 'shipped' });
  };

  const handleMarkProcessing = async (orderId: string) => {
    await updateOrderStatus({ orderId, status: 'processing' });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/portal/wholesaler">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-muted-foreground">{orders.length} total orders</p>
        </div>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">All ({orders.length})</TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({pendingCount})
            {pendingCount > 0 && <span className="ml-1 w-2 h-2 rounded-full bg-amber-500" />}
          </TabsTrigger>
          <TabsTrigger value="processing">Processing ({processingCount})</TabsTrigger>
          <TabsTrigger value="shipped">Shipped ({shippedCount})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading orders...</div>
          ) : filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No orders found</h3>
                <p className="text-muted-foreground">
                  {search ? "Try a different search term" : "Orders will appear here when customers purchase your products"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <Card key={order.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">
                            Order #{order.id.slice(0, 8).toUpperCase()}
                          </h3>
                          <Badge variant={
                            order.fulfillment_status === 'pending' ? 'destructive' :
                            order.fulfillment_status === 'processing' ? 'secondary' :
                            order.fulfillment_status === 'shipped' ? 'default' :
                            'outline'
                          }>
                            {order.fulfillment_status}
                          </Badge>
                          <Badge variant="outline">
                            {order.payment_status}
                          </Badge>
                        </div>

                        <div className="text-sm text-muted-foreground mb-3">
                          <span>{new Date(order.created_at || '').toLocaleDateString()}</span>
                          <span className="mx-2">•</span>
                          <span>{order.items?.length || 0} items</span>
                          <span className="mx-2">•</span>
                          <span className="font-medium text-foreground">${Number(order.total || 0).toFixed(2)}</span>
                        </div>

                        {/* Order Items */}
                        <div className="space-y-2">
                          {order.items?.slice(0, 3).map((item) => (
                            <div key={item.id} className="flex items-center gap-3 text-sm bg-muted/50 rounded p-2">
                              <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <span className="flex-1">{item.product?.product_name || 'Product'}</span>
                              <span className="text-muted-foreground">×{item.qty}</span>
                              <span className="font-medium">${Number(item.price_each || 0).toFixed(2)}</span>
                            </div>
                          ))}
                          {(order.items?.length || 0) > 3 && (
                            <p className="text-xs text-muted-foreground pl-2">
                              +{(order.items?.length || 0) - 3} more items
                            </p>
                          )}
                        </div>

                        {/* Shipping Address */}
                        {order.shipping_address && (
                          <div className="mt-3 text-sm">
                            <p className="font-medium">Ship to:</p>
                            <p className="text-muted-foreground">
                              {order.shipping_address.fullName}, {order.shipping_address.street}, {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zipCode}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {order.fulfillment_status === 'pending' && (
                          <Button size="sm" onClick={() => handleMarkProcessing(order.id)}>
                            <Clock className="h-4 w-4 mr-1" />
                            Start Processing
                          </Button>
                        )}
                        {order.fulfillment_status === 'processing' && (
                          <Button size="sm" onClick={() => handleMarkShipped(order.id)}>
                            <Truck className="h-4 w-4 mr-1" />
                            Mark Shipped
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/portal/wholesaler/orders/${order.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Printer className="h-4 w-4 mr-2" />
                              Print Packing Slip
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
