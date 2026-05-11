import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Package, DollarSign, Calendar, ShoppingCart, Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { dynastyDate } from '@/lib/dates';
import { toast } from 'sonner';

interface Order {
  id: string;
  visit_datetime: string | null;
  created_at: string;
  cash_collected: number | null;
  payment_method: string | null;
  customer_response: string | null;
  products_delivered: any;
  user?: {
    name: string;
    role?: string;
  } | null;
}

interface OrderHistoryCardProps {
  storeId: string;
  onCreateOrder?: () => void;
}

export function OrderHistoryCard({ storeId, onCreateOrder }: OrderHistoryCardProps) {
  const queryClient = useQueryClient();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['store-orders-history', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visit_logs')
        .select(`
          id,
          visit_datetime,
          created_at,
          cash_collected,
          payment_method,
          customer_response,
          products_delivered,
          user:profiles(name, role)
        `)
        .eq('store_id', storeId)
        .eq('visit_type', 'order')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Order[];
    },
    enabled: !!storeId,
  });

  // Helper function to get payment status - must be defined early
  const getPaymentStatus = (order: Order): string => {
    if (order.cash_collected && order.cash_collected > 0) {
      return 'paid';
    }
    return 'unpaid';
  };

  const togglePaymentStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus, orderAmount }: { orderId: string; newStatus: string; orderAmount: number }) => {
      const updateData: any = {};

      if (newStatus === 'paid') {
        // If marking as paid, set cash_collected to the order amount (or keep existing if already set)
        // We need to get the current order to see if it has an amount
        const { data: currentOrder } = await supabase
          .from('visit_logs')
          .select('cash_collected, products_delivered')
          .eq('id', orderId)
          .single();

        if (currentOrder) {
          // If order has products, try to calculate total from product prices
          let calculatedAmount: number = orderAmount;
          if (currentOrder.products_delivered && Array.isArray(currentOrder.products_delivered)) {
            // Fetch product prices
            const productIds = currentOrder.products_delivered.map((p: any) => p.product_id).filter(Boolean);
            if (productIds.length > 0) {
              const { data: products } = await supabase
                .from('products')
                .select('id, wholesale_price')
                .in('id', productIds);

              if (products) {
                const priceMap = new Map(products.map(p => [p.id, Number(p.wholesale_price) || 0]));
                const calculated = currentOrder.products_delivered.reduce((sum: number, item: any) => {
                  const price = priceMap.get(item.product_id) || 0;
                  return sum + (Number(price) * Number(item.quantity || 0));
                }, 0);
                calculatedAmount = Number(calculated) || calculatedAmount;
              }
            }
          }

          updateData.cash_collected = calculatedAmount > 0 ? calculatedAmount : (Number(currentOrder.cash_collected) || orderAmount);
        } else {
          updateData.cash_collected = orderAmount;
        }
      } else {
        // If marking as unpaid, set cash_collected to null
        updateData.cash_collected = null;
      }

      const { error } = await supabase
        .from('visit_logs')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      // Try to find and update corresponding invoice if it exists
      const order = orders.find(o => o.id === orderId);
      if (order) {
        const orderDate = new Date(order.created_at);
        const startDate = new Date(orderDate.getTime() - 60000);
        const endDate = new Date(orderDate.getTime() + 60000);

        const { data: matchingInvoices } = await supabase
          .from('invoices')
          .select('id')
          .eq('store_id', storeId)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());

        if (matchingInvoices && matchingInvoices.length > 0) {
          const invoiceToUpdate = matchingInvoices[0];
          await supabase
            .from('invoices')
            .update({
              payment_status: newStatus,
              paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
            })
            .eq('id', invoiceToUpdate.id);
        }
      }
    },
    onSuccess: () => {
      toast.success(`Order status updated to ${newStatus}`);
      queryClient.invalidateQueries({ queryKey: ['store-orders-history', storeId] });
      queryClient.invalidateQueries({ queryKey: ['store-invoices', storeId] });
      setConfirmDialogOpen(false);
      setSelectedOrder(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  const handleToggleStatus = (order: Order) => {
    const currentStatus = getPaymentStatus(order);
    const nextStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    setSelectedOrder(order);
    setNewStatus(nextStatus);
    setConfirmDialogOpen(true);
  };

  const handleConfirmToggle = () => {
    if (selectedOrder) {
      // Calculate order amount - use cash_collected if available, otherwise estimate from products
      let orderAmount = selectedOrder.cash_collected || 0;
      if (orderAmount === 0 && selectedOrder.products_delivered && Array.isArray(selectedOrder.products_delivered)) {
        // Estimate from products (we'll fetch prices in the mutation)
        orderAmount = 100; // Default estimate, will be calculated properly in mutation
      }

      togglePaymentStatusMutation.mutate({
        orderId: selectedOrder.id,
        newStatus,
        orderAmount,
      });
    }
  };

  // Calculate totals from orders
  const totalPaid = orders
    .filter(order => order.cash_collected && order.cash_collected > 0)
    .reduce((sum, order) => sum + (Number(order.cash_collected) || 0), 0);

  // Calculate total order value from products
  const totalOrderValue = orders.reduce((sum, order) => {
    if (order.products_delivered && Array.isArray(order.products_delivered)) {
      // If products are listed, we'd need to fetch prices - for now use cash_collected as estimate
      return sum + (Number(order.cash_collected) || 0);
    }
    return sum + (Number(order.cash_collected) || 0);
  }, 0);

  const totalUnpaid = totalOrderValue - totalPaid;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/10 text-green-600 border-green-500/30';
      case 'unpaid':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/30';
    }
  };

  const getProductCount = (order: Order): number => {
    if (!order.products_delivered) return 0;
    if (Array.isArray(order.products_delivered)) {
      return order.products_delivered.length;
    }
    return 1;
  };

  if (isLoading) {
    return (
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Order History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Order History
          </CardTitle>
          {onCreateOrder && (
            <Button
              onClick={onCreateOrder}
              size="sm"
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Order
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Money Tracking Summary */}
        <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-secondary/30 border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
            <p className="text-lg font-bold text-green-600">${totalPaid.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Unpaid</p>
            <p className="text-lg font-bold text-yellow-600">${totalUnpaid.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Value</p>
            <p className="text-lg font-bold">${totalOrderValue.toFixed(2)}</p>
          </div>
        </div>

        {/* Order List */}
        {orders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No orders yet</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {orders.map((order) => {
              const paymentStatus = getPaymentStatus(order);
              const productCount = getProductCount(order);
              
              return (
                <div
                  key={order.id}
                  className="p-4 rounded-lg bg-secondary/30 border space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          Order #{order.id.slice(0, 8).toUpperCase()}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor(paymentStatus)}`}
                          onClick={() => handleToggleStatus(order)}
                          title={`Click to mark as ${paymentStatus === 'paid' ? 'unpaid' : 'paid'}`}
                        >
                          {paymentStatus}
                        </Badge>
                      </div>
                      {productCount > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {productCount} product{productCount !== 1 ? 's' : ''}
                        </p>
                      )}
                      {order.customer_response && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {order.customer_response}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {order.cash_collected && order.cash_collected > 0 ? (
                        <p className="text-lg font-bold">${Number(order.cash_collected).toFixed(2)}</p>
                      ) : (
                        <p className="text-lg font-bold text-muted-foreground">$0.00</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground pt-2 border-t">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {order.visit_datetime
                          ? dynastyDate(order.visit_datetime)
                          : order.created_at
                          ? dynastyDate(order.created_at)
                          : 'N/A'}
                      </span>
                    </div>
                    {order.payment_method && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        <span className="capitalize">{order.payment_method}</span>
                      </div>
                    )}
                    {order.user?.name && (
                      <div className="flex items-center gap-1">
                        <span>By: {order.user.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Payment Status?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark order <strong>#{selectedOrder?.id.slice(0, 8).toUpperCase()}</strong> as <strong>{newStatus}</strong>?
              {newStatus === 'paid' && (
                <span className="block mt-2 text-green-600">
                  This will record the payment and update the totals.
                </span>
              )}
              {newStatus === 'unpaid' && (
                <span className="block mt-2 text-yellow-600">
                  This will remove the payment record and update the totals.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={togglePaymentStatusMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmToggle}
              disabled={togglePaymentStatusMutation.isPending}
            >
              {togglePaymentStatusMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

