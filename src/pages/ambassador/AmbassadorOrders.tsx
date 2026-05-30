/**
 * Ambassador Orders Page
 * Unified view of all orders across channels (store, wholesale, affiliate)
 * MASTER GENIUS ARCHITECT: Create Order quick action opens store selector, not analytics
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Package, Store, ShoppingCart, TrendingUp, Search, 
  DollarSign, Clock, CheckCircle,
  XCircle, Eye, Download, AlertCircle, Plus, RefreshCw
} from 'lucide-react';
import { ReceiptStatusIcon } from '@/components/invoice/ReceiptStatusIndicator';
import type { ReceiptStatus } from '@/components/invoice/ReceiptStatusIndicator';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { AmbassadorLayout } from '@/components/ambassador/AmbassadorLayout';
import { useAmbassadorOrders } from '@/hooks/useAmbassadorOrders';
import { CreateOrderStoreSelector } from '@/components/ambassador/CreateOrderStoreSelector';
import { CreateStoreInvoiceModal } from '@/components/store/CreateStoreInvoiceModal';
import { InvoiceDetailModal } from '@/components/ambassador/InvoiceDetailModal';
import type { PortfolioStore } from '@/hooks/useAmbassadorPortfolio';

export default function AmbassadorOrders() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // MASTER GENIUS: Create Order flow state
  const [showStoreSelector, setShowStoreSelector] = useState(false);
  const [selectedStore, setSelectedStore] = useState<PortfolioStore | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);

  // Handle ?action=create query param - open store selector immediately
  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setShowStoreSelector(true);
      // Clear the query param to prevent re-opening on navigation
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Handle store selection - open invoice modal
  const handleStoreSelected = (store: PortfolioStore) => {
    setSelectedStore(store);
    setShowStoreSelector(false);
    setShowInvoiceModal(true);
  };

  // Handle invoice creation success - invalidate all order-related queries
  const handleInvoiceSuccess = () => {
    setShowInvoiceModal(false);
    setSelectedStore(null);
    // Force refresh the orders list to show new invoice
    // Note: QueryClient invalidation is handled in CreateStoreInvoiceModal
  };

  // Fetch real orders
  const { orders, metrics, isLoading, isRefetching, isError, error, refetch } = useAmbassadorOrders({
    channel: channelFilter,
    status: statusFilter,
  });

  // Calculate totals from real data
  const totalOrders = metrics.totalOrders;
  const totalRevenue = metrics.totalRevenue;
  const pendingPayments = metrics.pendingPayments;

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'store': return <Store className="h-4 w-4" />;
      case 'wholesale': return <ShoppingCart className="h-4 w-4" />;
      case 'affiliate': return <TrendingUp className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case 'store':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Store</Badge>;
      case 'wholesale':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">Wholesale</Badge>;
      case 'affiliate':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">Affiliate</Badge>;
      default:
        return <Badge variant="outline">{channel}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30"><Clock className="h-3 w-3 mr-1" />Processing</Badge>;
      case 'shipped':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30"><Package className="h-3 w-3 mr-1" />Shipped</Badge>;
      case 'delivered':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" />Delivered</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/20 text-green-500"><DollarSign className="h-3 w-3 mr-1" />Paid</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-500"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'partial':
        return <Badge className="bg-orange-500/20 text-orange-500"><DollarSign className="h-3 w-3 mr-1" />Partial</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-500"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'refunded':
        return <Badge className="bg-gray-500/20 text-gray-500"><DollarSign className="h-3 w-3 mr-1" />Refunded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.entity_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Show loading state
  if (isLoading) {
    return (
      <AmbassadorLayout 
        title="Orders" 
        subtitle="View all orders from your portfolio"
        backPath="/ambassador/dashboard"
      >
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-[500px]" />
        </div>
      </AmbassadorLayout>
    );
  }

  // Show error state
  if (isError) {
    return (
      <AmbassadorLayout 
        title="Orders" 
        subtitle="View all orders from your portfolio"
        backPath="/ambassador/dashboard"
      >
        <div className="p-6">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p>Failed to load orders: {error?.message || 'Unknown error'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AmbassadorLayout>
    );
  }

  return (
    <AmbassadorLayout 
      title="Orders" 
      subtitle="View all orders from your portfolio"
      backPath="/ambassador/dashboard"
    >
      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold">{totalOrders}</p>
                </div>
                <Package className="h-8 w-8 text-primary/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-500">${totalRevenue.toFixed(2)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border-blue-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Store Orders</p>
                  <p className="text-2xl font-bold text-blue-500">
                    {orders.filter(o => o.channel === 'store').length}
                  </p>
                </div>
                <Store className="h-8 w-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border-yellow-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Payment</p>
                  <p className="text-2xl font-bold text-yellow-500">{pendingPayments}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters + Create Order Button */}
        <div className="flex flex-wrap gap-3">
          <Button 
            onClick={() => setShowStoreSelector(true)} 
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Order
          </Button>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by order # or entity..." 
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="store">Store Orders</SelectItem>
              <SelectItem value="wholesale">Wholesale</SelectItem>
              <SelectItem value="affiliate">Affiliate</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isRefetching} title="Refresh orders">
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>

        {/* Orders Table */}
        <Card>
          <div className="max-h-[500px] w-full overflow-auto">
            <Table>

              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow 
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setViewInvoiceId(order.id)}
                  >
                    <TableCell className="font-mono text-sm">{order.order_number}</TableCell>
                    <TableCell>{getChannelBadge(order.channel)}</TableCell>
                    <TableCell className="font-medium">{order.entity_name}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground" title={order.items_summary}>
                      {order.items_summary || '—'}
                    </TableCell>
                    <TableCell className="text-center">{order.items_count || '—'}</TableCell>
                    <TableCell className="text-right font-semibold">${order.total.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>{getPaymentStatusBadge(order.payment_status)}</TableCell>
                    <TableCell>
                      <ReceiptStatusIcon
                        status={order.receipt_status as ReceiptStatus}
                        sentAt={order.receipt_sent_at}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(order.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setViewInvoiceId(order.id); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No orders found matching your filters</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* MASTER GENIUS: Store Selector Modal */}
      <CreateOrderStoreSelector
        open={showStoreSelector}
        onOpenChange={setShowStoreSelector}
        onStoreSelected={handleStoreSelected}
      />

      {/* Invoice Creation Modal - opens after store is selected */}
      {selectedStore && (
        <CreateStoreInvoiceModal
          open={showInvoiceModal}
          onOpenChange={setShowInvoiceModal}
          storeId={selectedStore.store_id}
          storeName={selectedStore.store_name}
          onSuccess={handleInvoiceSuccess}
        />
      )}

      {/* Invoice Detail Modal */}
      <InvoiceDetailModal
        open={!!viewInvoiceId}
        onOpenChange={(open) => { if (!open) setViewInvoiceId(null); }}
        invoiceId={viewInvoiceId}
      />
    </AmbassadorLayout>
  );
}
