// ═══════════════════════════════════════════════════════════════════════════════
// STOCK LEVELS PAGE — View inventory quantities by product and warehouse
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Package,
  Warehouse,
  Search,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Plus,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouses } from '@/services/warehouse';
import StockAdjustmentModal from '@/components/inventory/StockAdjustmentModal';

type StockStatus = 'all' | 'low' | 'out';

export default function StockLevelsPage() {
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<StockStatus>('all');
  const [search, setSearch] = useState('');
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);

  const { data: warehouses } = useWarehouses();

  const { data: stockLevels, isLoading } = useQuery({
    queryKey: ['stock-levels', warehouseFilter, stockFilter, search],
    queryFn: async () => {
      let query = supabase
        .from('inventory_stock')
        .select(`
          *,
          warehouse:warehouses(id, name, code),
          product:products(id, name, sku, brand_id, reorder_point, brand:brands(id, name))
        `)
        .order('created_at', { ascending: false });

      if (warehouseFilter && warehouseFilter !== 'all') {
        query = query.eq('warehouse_id', warehouseFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      let results = data || [];

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        results = results.filter(
          (item: any) =>
            item.product?.name?.toLowerCase().includes(searchLower) ||
            item.product?.sku?.toLowerCase().includes(searchLower)
        );
      }

      // Apply stock status filter
      if (stockFilter === 'out') {
        results = results.filter((item: any) => (item.quantity_on_hand || 0) === 0);
      } else if (stockFilter === 'low') {
        results = results.filter((item: any) => {
          const onHand = item.quantity_on_hand || 0;
          const reorderPoint = item.reorder_point || item.product?.reorder_point || 0;
          return onHand > 0 && reorderPoint > 0 && onHand <= reorderPoint;
        });
      }

      return results;
    },
  });

  const getStockStatus = (item: any) => {
    const onHand = item.quantity_on_hand || 0;
    const reorderPoint = item.reorder_point || item.product?.reorder_point || 0;

    if (onHand === 0) {
      return { label: 'Out of Stock', variant: 'destructive' as const, icon: XCircle };
    }
    if (reorderPoint > 0 && onHand <= reorderPoint) {
      return { label: 'Low Stock', variant: 'secondary' as const, icon: AlertTriangle };
    }
    return { label: 'OK', variant: 'default' as const, icon: CheckCircle };
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/os/inventory">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Stock Levels</h1>
            <p className="text-muted-foreground">See quantities by product and warehouse</p>
          </div>
        </div>
        <Button onClick={() => setAdjustmentModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Adjustment
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by product name or SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Warehouses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Warehouses</SelectItem>
                {warehouses?.map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>
                    {wh.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as StockStatus)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Stock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Stock</CardTitle>
          <CardDescription>
            {stockLevels?.length || 0} stock records found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : stockLevels?.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-2">No inventory levels yet.</p>
              <p className="text-sm text-muted-foreground">
                Once you receive Purchase Orders or create stock adjustments, they will appear here.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setAdjustmentModalOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Adjustment
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">In Transit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockLevels?.map((item: any) => {
                  const status = getStockStatus(item);
                  const StatusIcon = status.icon;
                  const available = Math.max(
                    0,
                    (item.quantity_on_hand || 0) - (item.quantity_reserved || 0)
                  );

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.product?.name || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground font-mono">
                            {item.product?.sku || '-'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.product?.brand?.name ? (
                          <Badge variant="outline">{item.product.brand.name}</Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Warehouse className="h-4 w-4 text-muted-foreground" />
                          {item.warehouse?.name || 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {item.quantity_on_hand || 0}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.quantity_reserved || 0}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {available}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {item.quantity_in_transit || 0}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" asChild>
                            <Link to={`/os/inventory/products/${item.product_id}`}>
                              View Product
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Adjustment Modal */}
      <StockAdjustmentModal
        open={adjustmentModalOpen}
        onClose={() => setAdjustmentModalOpen(false)}
      />
    </div>
  );
}
