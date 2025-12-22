// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASE ORDER DETAIL PAGE
// ═══════════════════════════════════════════════════════════════════════════════

import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Package,
  Truck,
  Calendar,
  MapPin,
  FileText,
  Edit,
  Printer,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { usePurchaseOrder } from '@/services/procurement';
import { format } from 'date-fns';

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: po, isLoading } = usePurchaseOrder(id || '');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'placed':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'shipped':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'delivered':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'draft':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'placed':
        return <Clock className="h-4 w-4" />;
      case 'shipped':
        return <Truck className="h-4 w-4" />;
      case 'delivered':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <p className="text-muted-foreground">Loading purchase order...</p>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Purchase order not found</p>
        <Button asChild>
          <Link to="/os/procurement/purchase-orders">Back to Purchase Orders</Link>
        </Button>
      </div>
    );
  }

  const totalProductCost = po.products?.reduce((sum, p) => sum + (p.qty * p.unit_cost), 0) || 0;
  const grandTotal = totalProductCost + (po.shipping_cost || 0);

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/os/procurement/purchase-orders">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">
                PO #{po.id.slice(0, 8).toUpperCase()}
              </h1>
              <Badge className={getStatusColor(po.status || 'draft')}>
                <span className="flex items-center gap-1">
                  {getStatusIcon(po.status || 'draft')}
                  {po.status || 'Draft'}
                </span>
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Created {format(new Date(po.created_at), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Supplier Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Supplier
              </CardTitle>
            </CardHeader>
            <CardContent>
              {po.supplier ? (
                <div className="space-y-2">
                  <p className="font-semibold text-lg">{po.supplier.name}</p>
                  {po.supplier.country && (
                    <p className="text-muted-foreground">{po.supplier.country}</p>
                  )}
                  {po.supplier.contact_name && (
                    <p className="text-sm">Contact: {po.supplier.contact_name}</p>
                  )}
                  {po.supplier.contact_email && (
                    <p className="text-sm">{po.supplier.contact_email}</p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">No supplier information</p>
              )}
            </CardContent>
          </Card>

          {/* Products Table */}
          <Card>
            <CardHeader>
              <CardTitle>Products</CardTitle>
              <CardDescription>Items in this purchase order</CardDescription>
            </CardHeader>
            <CardContent>
              {po.products && po.products.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50%]">Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {po.products.map((product, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-right">{product.qty}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(product.unit_cost)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(product.qty * product.unit_cost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">No products in this order</p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {po.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{po.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Products ({po.products?.length || 0})
                  </span>
                  <span>{formatCurrency(totalProductCost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{formatCurrency(po.shipping_cost || 0)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Shipping Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {po.estimated_arrival && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Estimated Arrival</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(po.estimated_arrival), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              )}
              {po.tracking_number && (
                <div className="flex items-start gap-3">
                  <Package className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Tracking Number</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {po.tracking_number}
                    </p>
                  </div>
                </div>
              )}
              {po.warehouse_location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Destination</p>
                    <p className="text-sm text-muted-foreground">
                      {po.warehouse_location}
                    </p>
                  </div>
                </div>
              )}
              {!po.estimated_arrival && !po.tracking_number && !po.warehouse_location && (
                <p className="text-muted-foreground text-sm">No shipping details available</p>
              )}
            </CardContent>
          </Card>

          {/* Status Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {po.status === 'draft' && (
                <Button className="w-full">Submit Order</Button>
              )}
              {po.status === 'placed' && (
                <Button className="w-full">Mark as Shipped</Button>
              )}
              {po.status === 'shipped' && (
                <Button className="w-full">Mark as Delivered</Button>
              )}
              <Button variant="outline" className="w-full">Download PDF</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
