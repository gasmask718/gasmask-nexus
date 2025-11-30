import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Truck, CheckCircle, Clock, Package } from 'lucide-react';
import { usePurchaseOrders } from '@/services/procurement';
import { format } from 'date-fns';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: any }> = {
  draft: { label: 'Draft', variant: 'secondary', icon: FileText },
  placed: { label: 'Placed', variant: 'outline', icon: Clock },
  paid: { label: 'Paid', variant: 'default', icon: CheckCircle },
  in_transit: { label: 'In Transit', variant: 'default', icon: Truck },
  delivered: { label: 'Delivered', variant: 'default', icon: Package },
  received: { label: 'Received', variant: 'default', icon: CheckCircle },
  stocked: { label: 'Stocked', variant: 'default', icon: Package },
};

export function WarehousePurchaseOrdersTab() {
  const { data: purchaseOrders, isLoading } = usePurchaseOrders();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Purchase Orders</CardTitle>
          <CardDescription>Manage supplier purchase orders and receiving</CardDescription>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create PO
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading purchase orders...</div>
        ) : purchaseOrders?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrders.map((po) => {
                const status = statusConfig[po.status || 'draft'] || statusConfig.draft;
                const StatusIcon = status.icon;
                return (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono font-medium">
                      PO-{po.id.slice(0, 8).toUpperCase()}
                    </TableCell>
                    <TableCell>{po.supplier?.name || 'Unknown'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {po.warehouse_location || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {po.estimated_arrival
                        ? format(new Date(po.estimated_arrival), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${((po.total_cost || 0) + (po.shipping_cost || 0)).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost">View</Button>
                        {po.status === 'in_transit' && (
                          <Button size="sm" variant="outline">Receive</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No purchase orders found</p>
            <Button variant="outline" className="mt-3">
              <Plus className="h-4 w-4 mr-2" />
              Create First PO
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
