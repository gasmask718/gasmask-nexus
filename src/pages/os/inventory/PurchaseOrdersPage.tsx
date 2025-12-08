// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY PURCHASE ORDERS PAGE — Track inventory purchases from suppliers
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  FileText,
  Plus,
  Search,
  ArrowLeft,
  Truck,
  Warehouse,
  Calendar,
  Loader2,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  placed: { label: 'Placed', variant: 'outline' },
  paid: { label: 'Paid', variant: 'default' },
  shipped: { label: 'Shipped', variant: 'default' },
  in_transit: { label: 'In Transit', variant: 'default' },
  arrived: { label: 'Arrived', variant: 'default' },
  received: { label: 'Received', variant: 'default' },
  closed: { label: 'Closed', variant: 'secondary' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

export default function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');

  // Fetch purchase orders with supplier info
  const { data: purchaseOrders, isLoading, error } = useQuery({
    queryKey: ['inventory-purchase-orders', search, statusFilter, supplierFilter],
    queryFn: async () => {
      let query = supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(id, name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (supplierFilter !== 'all') {
        query = query.eq('supplier_id', supplierFilter);
      }

      if (search) {
        query = query.or(`id.ilike.%${search}%,warehouse_location.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch suppliers for filter
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-for-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch warehouses for display
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-for-po'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatPONumber = (id: string) => {
    return `PO-${id.slice(0, 8).toUpperCase()}`;
  };

  const getWarehouseName = (warehouseLocation: string | null, targetWarehouseId: string | null) => {
    if (targetWarehouseId) {
      const wh = warehouses?.find((w) => w.id === targetWarehouseId);
      if (wh) return wh.name;
    }
    return warehouseLocation || '-';
  };

  const hasRequiredDependencies = suppliers && suppliers.length > 0 && warehouses && warehouses.length > 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/os/inventory">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                Purchase Orders
              </h1>
              <p className="text-muted-foreground mt-1">
                Track inventory purchases from suppliers into warehouses.
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate('/os/inventory/purchase-orders/new')}
            disabled={!hasRequiredDependencies}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Purchase Order
          </Button>
        </div>

        {/* Dependency Warning */}
        {!hasRequiredDependencies && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    Missing Dependencies
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You must create at least one Supplier and one Warehouse before you can create a Purchase Order.
                  </p>
                  <div className="flex gap-2 mt-3">
                    {(!suppliers || suppliers.length === 0) && (
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/os/inventory/suppliers">Add Supplier</Link>
                      </Button>
                    )}
                    {(!warehouses || warehouses.length === 0) && (
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/os/inventory/warehouses">Add Warehouse</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by PO number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="placed">Placed</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="arrived">Arrived</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Orders</CardTitle>
            <CardDescription>
              {purchaseOrders?.length || 0} order{purchaseOrders?.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">
                Error loading purchase orders. Please try again.
              </div>
            ) : purchaseOrders?.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No purchase orders yet.</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Click "Create Purchase Order" to start your first inbound shipment.
                </p>
                {hasRequiredDependencies && (
                  <Button
                    onClick={() => navigate('/os/inventory/purchase-orders/new')}
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Purchase Order
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>ETA</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrders?.map((po) => {
                    const status = statusConfig[po.status || 'draft'] || statusConfig.draft;
                    return (
                      <TableRow key={po.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-mono font-medium">{formatPONumber(po.id)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            <span>{(po.supplier as any)?.name || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Warehouse className="h-4 w-4 text-muted-foreground" />
                            <span>{getWarehouseName(po.warehouse_location, po.target_warehouse_id)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {po.estimated_arrival
                                ? new Date(po.estimated_arrival).toLocaleDateString()
                                : '-'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">
                          {formatCurrency(po.total_cost)}
                        </TableCell>
                        <TableCell>
                          {new Date(po.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/os/inventory/purchase-orders/${po.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
