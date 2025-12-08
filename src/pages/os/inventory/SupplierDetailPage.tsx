// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIER DETAIL PAGE — View & manage individual supplier
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Truck,
  ArrowLeft,
  Edit,
  Star,
  Clock,
  Mail,
  Phone,
  Globe,
  FileText,
  Package,
  TrendingUp,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import SupplierFormModal from '@/components/inventory/SupplierFormModal';

export default function SupplierDetailPage() {
  const { supplierId } = useParams();
  const queryClient = useQueryClient();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [linkProductModalOpen, setLinkProductModalOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({
    product_id: '',
    supplier_sku: '',
    unit_cost: '',
    moq: '',
    processing_time_days: '',
  });

  // Fetch supplier
  const { data: supplier, isLoading } = useQuery({
    queryKey: ['inventory-supplier', supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', supplierId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!supplierId,
  });

  // Fetch supplier products (linked products)
  const { data: supplierProducts } = useQuery({
    queryKey: ['supplier-products-linked', supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_products')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!supplierId,
  });

  // Fetch all products for linking
  const { data: allProducts } = useQuery({
    queryKey: ['products-for-linking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: linkProductModalOpen,
  });

  // Fetch purchase orders for this supplier
  const { data: purchaseOrders } = useQuery({
    queryKey: ['supplier-purchase-orders', supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!supplierId,
  });

  // Link product mutation
  const linkProductMutation = useMutation({
    mutationFn: async () => {
      const product = allProducts?.find(p => p.id === linkForm.product_id);
      const { error } = await supabase.from('supplier_products').insert({
        supplier_id: supplierId,
        name: product?.name || 'Unknown',
        sku: linkForm.supplier_sku || product?.sku,
        unit_cost: linkForm.unit_cost ? parseFloat(linkForm.unit_cost) : null,
        moq: linkForm.moq ? parseInt(linkForm.moq) : null,
        processing_time_days: linkForm.processing_time_days ? parseInt(linkForm.processing_time_days) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-products-linked', supplierId] });
      setLinkProductModalOpen(false);
      setLinkForm({ product_id: '', supplier_sku: '', unit_cost: '', moq: '', processing_time_days: '' });
      toast.success('Product linked to supplier');
    },
    onError: (error: Error) => {
      toast.error(`Failed to link product: ${error.message}`);
    },
  });

  // Remove product link
  const removeLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from('supplier_products').delete().eq('id', linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-products-linked', supplierId] });
      toast.success('Product unlinked');
    },
    onError: (error: Error) => {
      toast.error(`Failed to unlink: ${error.message}`);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <Truck className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Supplier Not Found</h2>
          <Button asChild variant="outline">
            <Link to="/os/inventory/suppliers">Back to Suppliers</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/os/inventory/suppliers">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-foreground">{supplier.name}</h1>
                <Badge variant={supplier.status === 'active' ? 'default' : 'secondary'}>
                  {supplier.status || 'active'}
                </Badge>
              </div>
              {supplier.country && (
                <div className="flex items-center gap-1 text-muted-foreground mt-1">
                  <Globe className="h-4 w-4" />
                  {supplier.country}
                </div>
              )}
            </div>
          </div>
          <Button onClick={() => setEditModalOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Supplier
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Mail className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <p className="font-medium">{supplier.contact_name || '-'}</p>
                  <p className="text-xs text-muted-foreground">{supplier.contact_email || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <FileText className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Terms</p>
                  <p className="font-medium">{supplier.payment_terms || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lead Time</p>
                  <p className="font-medium">
                    {supplier.lead_time_days ? `${supplier.lead_time_days} days` : '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Star className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rating</p>
                  <p className="font-medium">
                    {supplier.reliability_score ? `${supplier.reliability_score}%` : 'Not rated yet'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {supplier.contact_phone || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">WeChat</p>
                    <p className="font-medium">{supplier.wechat || '-'}</p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Notes</p>
                  <p className="text-sm">{supplier.notes || 'No notes added.'}</p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Linked Products</p>
                    <p className="font-medium">{supplierProducts?.length || 0} products</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Purchase Orders</p>
                    <p className="font-medium">{purchaseOrders?.length || 0} orders</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Linked Products</CardTitle>
                  <CardDescription>Products supplied by this vendor</CardDescription>
                </div>
                <Button onClick={() => setLinkProductModalOpen(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Link Product
                </Button>
              </CardHeader>
              <CardContent>
                {supplierProducts?.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No products linked yet.</p>
                    <Button
                      onClick={() => setLinkProductModalOpen(true)}
                      variant="outline"
                      className="mt-4"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Link First Product
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Supplier SKU</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>MOQ</TableHead>
                        <TableHead>Lead Time</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierProducts?.map((sp) => (
                        <TableRow key={sp.id}>
                          <TableCell className="font-medium">{sp.name}</TableCell>
                          <TableCell className="font-mono text-sm">{sp.sku || '-'}</TableCell>
                          <TableCell>{formatCurrency(sp.unit_cost)}</TableCell>
                          <TableCell>{sp.moq || '-'}</TableCell>
                          <TableCell>
                            {sp.processing_time_days ? `${sp.processing_time_days} days` : '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLinkMutation.mutate(sp.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            {/* TODO (Inventory & Revenue Engine V2+):
              - recommend optimal supplier for each product
              - auto-suggest cost renegotiations */}
          </TabsContent>

          <TabsContent value="purchase-orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Purchase Orders</CardTitle>
                <CardDescription>Recent orders from this supplier</CardDescription>
              </CardHeader>
              <CardContent>
                {purchaseOrders?.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">
                      Purchase orders with this supplier will appear here after Purchase Orders V1 is active.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PO #</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>ETA</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseOrders?.map((po) => (
                        <TableRow key={po.id}>
                          <TableCell className="font-mono text-sm">
                            {po.id.slice(0, 8).toUpperCase()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{po.status}</Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(po.total_cost)}</TableCell>
                          <TableCell>
                            {po.estimated_arrival
                              ? new Date(po.estimated_arrival).toLocaleDateString()
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {new Date(po.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            {/* TODO (Purchase Orders V1+):
              - fetchPurchaseOrdersBySupplier(supplierId)
              - show total ordered value, last order date */}
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Analytics</CardTitle>
                <CardDescription>Supplier reliability and metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    On-time rate, defect rate, and AI supplier score will appear here in a future version.
                  </p>
                </div>
                {/* TODO (AI Supplier Scoring V3+):
                  - compute on-time delivery rate
                  - compute defect/damage rate
                  - show AI-generated recommendations */}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Modal */}
      <SupplierFormModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        supplierId={supplierId}
      />

      {/* Link Product Modal */}
      <Dialog open={linkProductModalOpen} onOpenChange={setLinkProductModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Product to Supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select
                value={linkForm.product_id}
                onValueChange={(v) => setLinkForm({ ...linkForm, product_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product..." />
                </SelectTrigger>
                <SelectContent>
                  {allProducts?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Supplier SKU</Label>
                <Input
                  value={linkForm.supplier_sku}
                  onChange={(e) => setLinkForm({ ...linkForm, supplier_sku: e.target.value })}
                  placeholder="Supplier's SKU"
                />
              </div>
              <div className="space-y-2">
                <Label>Cost per Unit</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={linkForm.unit_cost}
                  onChange={(e) => setLinkForm({ ...linkForm, unit_cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>MOQ</Label>
                <Input
                  type="number"
                  value={linkForm.moq}
                  onChange={(e) => setLinkForm({ ...linkForm, moq: e.target.value })}
                  placeholder="Min order qty"
                />
              </div>
              <div className="space-y-2">
                <Label>Lead Time (days)</Label>
                <Input
                  type="number"
                  value={linkForm.processing_time_days}
                  onChange={(e) => setLinkForm({ ...linkForm, processing_time_days: e.target.value })}
                  placeholder="Processing days"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkProductModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => linkProductMutation.mutate()}
              disabled={!linkForm.product_id || linkProductMutation.isPending}
            >
              {linkProductMutation.isPending ? 'Linking...' : 'Link Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
