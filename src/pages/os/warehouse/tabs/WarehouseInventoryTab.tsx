import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { useInventoryStock, useWarehouses } from '@/services/warehouse';

export function WarehouseInventoryTab() {
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const { data: warehouses } = useWarehouses();
  const { data: inventory, isLoading } = useInventoryStock(
    selectedWarehouse === 'all' ? undefined : selectedWarehouse
  );

  const getStockStatus = (stock: any) => {
    const onHand = stock.quantity_on_hand || 0;
    const reorderPoint = stock.reorder_point || 0;
    
    if (onHand === 0) return { label: 'Critical', variant: 'destructive' as const, icon: AlertTriangle };
    if (reorderPoint && onHand <= reorderPoint) return { label: 'Low', variant: 'secondary' as const, icon: AlertTriangle };
    return { label: 'OK', variant: 'default' as const, icon: CheckCircle };
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Inventory Stock
        </CardTitle>
        <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Warehouses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Warehouses</SelectItem>
            {warehouses?.map((wh) => (
              <SelectItem key={wh.id} value={wh.id}>
                {wh.name} ({wh.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading inventory...</div>
        ) : inventory?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">On Hand</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead className="text-right">In Transit</TableHead>
                <TableHead className="text-right">Reorder Point</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventory.map((stock) => {
                const status = getStockStatus(stock);
                const StatusIcon = status.icon;
                return (
                  <TableRow key={stock.id}>
                    <TableCell className="font-medium">
                      {stock.product_id?.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      {stock.warehouse?.name || stock.warehouse_id?.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {stock.quantity_on_hand?.toLocaleString() || 0}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {stock.quantity_reserved?.toLocaleString() || 0}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {stock.quantity_in_transit?.toLocaleString() || 0}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {stock.reorder_point?.toLocaleString() || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No inventory stock records</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
