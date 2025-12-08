// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY MOVEMENTS PAGE — Timeline of all stock changes
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
  ArrowLeft,
  Search,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Package,
  FileText,
  Activity,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouses } from '@/services/warehouse';
import { useProducts } from '@/services/inventory';
import { format } from 'date-fns';

const movementTypeConfig: Record<string, { label: string; color: string; icon: any }> = {
  PO_RECEIPT: { label: 'PO Receipt', color: 'text-green-600', icon: ArrowDownLeft },
  ADJUSTMENT: { label: 'Adjustment', color: 'text-blue-600', icon: ArrowRightLeft },
  TRANSFER_IN: { label: 'Transfer In', color: 'text-green-600', icon: ArrowDownLeft },
  TRANSFER_OUT: { label: 'Transfer Out', color: 'text-orange-600', icon: ArrowUpRight },
  CORRECTION: { label: 'Correction', color: 'text-purple-600', icon: ArrowRightLeft },
  INITIAL_LOAD: { label: 'Initial Load', color: 'text-blue-600', icon: ArrowDownLeft },
  SALE: { label: 'Sale', color: 'text-red-600', icon: ArrowUpRight },
  inbound: { label: 'Inbound', color: 'text-green-600', icon: ArrowDownLeft },
  outbound: { label: 'Outbound', color: 'text-red-600', icon: ArrowUpRight },
  adjustment: { label: 'Adjustment', color: 'text-blue-600', icon: ArrowRightLeft },
  transfer: { label: 'Transfer', color: 'text-purple-600', icon: ArrowRightLeft },
};

export default function MovementsPage() {
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data: warehouses } = useWarehouses();
  const { data: products } = useProducts();

  const { data: movements, isLoading } = useQuery({
    queryKey: ['inventory-movements-page', warehouseFilter, productFilter, typeFilter, search],
    queryFn: async () => {
      let query = supabase
        .from('inventory_movements')
        .select(`
          *,
          product:products(id, name, sku),
          from_warehouse:warehouses!inventory_movements_from_warehouse_id_fkey(id, name, code),
          to_warehouse:warehouses!inventory_movements_to_warehouse_id_fkey(id, name, code)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (warehouseFilter && warehouseFilter !== 'all') {
        query = query.or(
          `from_warehouse_id.eq.${warehouseFilter},to_warehouse_id.eq.${warehouseFilter}`
        );
      }

      if (productFilter && productFilter !== 'all') {
        query = query.eq('product_id', productFilter);
      }

      if (typeFilter && typeFilter !== 'all') {
        query = query.eq('movement_type', typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      let results = data || [];

      // Apply search filter on notes/reference
      if (search) {
        const searchLower = search.toLowerCase();
        results = results.filter(
          (m: any) =>
            m.notes?.toLowerCase().includes(searchLower) ||
            m.reference_id?.toLowerCase().includes(searchLower) ||
            m.product?.name?.toLowerCase().includes(searchLower)
        );
      }

      return results;
    },
  });

  const getMovementConfig = (type: string) => {
    return movementTypeConfig[type] || {
      label: type || 'Unknown',
      color: 'text-muted-foreground',
      icon: Activity,
    };
  };

  const formatQuantityChange = (movement: any) => {
    const qty = movement.quantity || 0;
    const type = movement.movement_type?.toLowerCase() || '';
    
    // Determine if inbound or outbound based on type or presence of to/from warehouse
    if (
      type.includes('receipt') ||
      type.includes('in') ||
      type === 'initial_load' ||
      (movement.to_warehouse_id && !movement.from_warehouse_id)
    ) {
      return { value: `+${qty}`, isPositive: true };
    }
    if (
      type.includes('out') ||
      type === 'sale' ||
      (movement.from_warehouse_id && !movement.to_warehouse_id)
    ) {
      return { value: `-${qty}`, isPositive: false };
    }
    // For adjustments/corrections, assume positive unless marked otherwise
    return { value: qty.toString(), isPositive: true };
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
            <h1 className="text-3xl font-bold">Inventory Movements</h1>
            <p className="text-muted-foreground">Timeline of all stock changes across warehouses</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by notes or reference..."
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
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {products?.slice(0, 50).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="PO_RECEIPT">PO Receipt</SelectItem>
                <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                <SelectItem value="TRANSFER_IN">Transfer In</SelectItem>
                <SelectItem value="TRANSFER_OUT">Transfer Out</SelectItem>
                <SelectItem value="CORRECTION">Correction</SelectItem>
                <SelectItem value="INITIAL_LOAD">Initial Load</SelectItem>
                <SelectItem value="SALE">Sale</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Movements Table */}
      <Card>
        <CardHeader>
          <CardTitle>Movement History</CardTitle>
          <CardDescription>
            {movements?.length || 0} movements found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : movements?.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-2">No movements recorded yet.</p>
              <p className="text-sm text-muted-foreground">
                Movements will appear here when stock changes occur through PO receiving or adjustments.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Qty Change</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements?.map((movement: any) => {
                  const config = getMovementConfig(movement.movement_type);
                  const MovementIcon = config.icon;
                  const qtyChange = formatQuantityChange(movement);
                  const warehouseName =
                    movement.to_warehouse?.name ||
                    movement.from_warehouse?.name ||
                    '-';

                  return (
                    <TableRow key={movement.id}>
                      <TableCell className="text-sm">
                        {movement.created_at
                          ? format(new Date(movement.created_at), 'MMM d, yyyy HH:mm')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {movement.product?.name || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {movement.product?.sku || '-'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1 ${config.color}`}>
                          <MovementIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{warehouseName}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-mono font-semibold ${
                            qtyChange.isPositive ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {qtyChange.value}
                        </span>
                      </TableCell>
                      <TableCell>
                        {movement.reference_type === 'purchase_order' && movement.reference_id ? (
                          <Button variant="link" size="sm" className="h-auto p-0" asChild>
                            <Link to={`/os/inventory/purchase-orders/${movement.reference_id}`}>
                              <FileText className="h-3 w-3 mr-1" />
                              PO-{movement.reference_id.slice(0, 8).toUpperCase()}
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {movement.reference_type || 'Manual'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {movement.notes || '-'}
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
  );
}
