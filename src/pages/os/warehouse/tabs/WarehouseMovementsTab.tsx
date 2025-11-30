import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ArrowDown, ArrowUp, RefreshCw } from 'lucide-react';
import { useInventoryMovements } from '@/services/warehouse';
import { format } from 'date-fns';

const movementTypeConfig: Record<string, { label: string; color: string; icon: any }> = {
  production_in: { label: 'Production In', color: 'bg-green-500', icon: ArrowDown },
  supplier_in: { label: 'Supplier In', color: 'bg-blue-500', icon: ArrowDown },
  customer_order_out: { label: 'Customer Out', color: 'bg-orange-500', icon: ArrowUp },
  store_order_out: { label: 'Store Out', color: 'bg-purple-500', icon: ArrowUp },
  wholesaler_order_out: { label: 'Wholesaler Out', color: 'bg-pink-500', icon: ArrowUp },
  transfer: { label: 'Transfer', color: 'bg-cyan-500', icon: ArrowRight },
  adjustment: { label: 'Adjustment', color: 'bg-yellow-500', icon: RefreshCw },
  return: { label: 'Return', color: 'bg-red-500', icon: ArrowDown },
  reservation: { label: 'Reservation', color: 'bg-gray-500', icon: RefreshCw },
};

export function WarehouseMovementsTab() {
  const { data: movements, isLoading } = useInventoryMovements({ limit: 100 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory Movements</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading movements...</div>
        ) : movements?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((mov) => {
                const config = movementTypeConfig[mov.movement_type || ''] || {
                  label: mov.movement_type || 'Unknown',
                  color: 'bg-gray-500',
                  icon: RefreshCw,
                };
                const Icon = config.icon;
                return (
                  <TableRow key={mov.id}>
                    <TableCell className="text-sm">
                      {mov.created_at ? format(new Date(mov.created_at), 'MMM d, HH:mm') : '-'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {mov.product_id?.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {mov.from_warehouse_id?.slice(0, 8) || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {mov.to_warehouse_id?.slice(0, 8) || '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {mov.quantity?.toLocaleString() || 0}
                    </TableCell>
                    <TableCell className="text-sm">
                      {mov.reference_type && (
                        <span className="text-muted-foreground">
                          {mov.reference_type}: {mov.reference_id?.slice(0, 8)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <RefreshCw className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No inventory movements recorded</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
