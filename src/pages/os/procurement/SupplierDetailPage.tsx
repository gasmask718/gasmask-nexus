// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIER DETAIL PAGE
// ═══════════════════════════════════════════════════════════════════════════════

import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Globe,
  Mail,
  Phone,
  MessageSquare,
  Star,
  Clock,
  Package,
  FileText,
  AlertTriangle,
  Edit,
} from 'lucide-react';
import { useSupplier, useSupplierProducts, usePurchaseOrders } from '@/services/procurement';

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: supplier, isLoading } = useSupplier(id || '');
  const { data: products } = useSupplierProducts(id);
  const { data: allPOs } = usePurchaseOrders();

  const supplierPOs = allPOs?.filter(po => po.supplier_id === id) || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <p className="text-muted-foreground">Loading supplier...</p>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Supplier not found</p>
        <Button asChild>
          <Link to="/os/procurement/suppliers">Back to Suppliers</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/os/procurement/suppliers">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{supplier.name}</h1>
              <Badge variant={supplier.status === 'active' ? 'default' : 'secondary'}>
                {supplier.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-muted-foreground mt-1">
              {supplier.country && (
                <span className="flex items-center gap-1">
                  <Globe className="h-4 w-4" />
                  {supplier.country}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 text-amber-500" />
                {supplier.reliability_score || 0}% reliability
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {supplier.lead_time_days || 0} day lead time
              </span>
            </div>
          </div>
        </div>
        <Button variant="outline">
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      {/* Contact Info */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Contact</p>
            <p className="font-medium">{supplier.contact_name || 'N/A'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Email</p>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium truncate">{supplier.contact_email || 'N/A'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Phone</p>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">{supplier.contact_phone || 'N/A'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">WeChat</p>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">{supplier.wechat || 'N/A'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Spend</p>
            <p className="text-3xl font-bold">{formatCurrency(supplier.total_spend || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Products</p>
            <p className="text-3xl font-bold">{products?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Purchase Orders</p>
            <p className="text-3xl font-bold">{supplierPOs.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">
            <Package className="h-4 w-4 mr-2" />
            Products
          </TabsTrigger>
          <TabsTrigger value="orders">
            <FileText className="h-4 w-4 mr-2" />
            Purchase Orders
          </TabsTrigger>
          <TabsTrigger value="risk">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Risk Evaluation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Supplier Products</CardTitle>
              <CardDescription>Products available from this supplier</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>MOQ</TableHead>
                    <TableHead>Unit Cost</TableHead>
                    <TableHead>Bulk Cost</TableHead>
                    <TableHead>Processing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products?.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="font-mono text-sm">{product.sku || 'N/A'}</TableCell>
                      <TableCell>{product.moq || 1}</TableCell>
                      <TableCell>{formatCurrency(product.unit_cost || 0)}</TableCell>
                      <TableCell>{formatCurrency(product.bulk_cost || 0)}</TableCell>
                      <TableCell>{product.processing_time_days || 0} days</TableCell>
                    </TableRow>
                  ))}
                  {!products?.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No products from this supplier yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Purchase Orders</CardTitle>
              <CardDescription>Order history with this supplier</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierPOs.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-mono">{po.id.slice(0, 8).toUpperCase()}</TableCell>
                      <TableCell>
                        <Badge variant={po.status === 'delivered' ? 'default' : 'secondary'}>
                          {po.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{po.products?.length || 0}</TableCell>
                      <TableCell>{formatCurrency((po.total_cost || 0) + (po.shipping_cost || 0))}</TableCell>
                      <TableCell>
                        {po.created_at && new Date(po.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!supplierPOs.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No purchase orders yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Risk Evaluation</CardTitle>
              <CardDescription>AI-powered supplier assessment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Reliability Score</p>
                  <p className="text-2xl font-bold text-green-600">{supplier.reliability_score || 0}%</p>
                </div>
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Risk Level</p>
                  <p className="text-2xl font-bold text-green-600">Low</p>
                </div>
              </div>
              {supplier.notes && (
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm font-medium mb-2">Notes</p>
                  <p className="text-sm text-muted-foreground">{supplier.notes}</p>
                </div>
              )}
              <Button variant="outline" className="w-full">
                Run AI Assessment
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
