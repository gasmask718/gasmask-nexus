// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS PAGE — Full Product Catalog Management
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Package,
  Plus,
  Search,
  ArrowLeft,
  ArrowRight,
  Star,
  TrendingDown,
  Barcode,
  DollarSign,
} from 'lucide-react';
import { useProducts, useCreateProduct, Product } from '@/services/inventory';

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const { data: products, isLoading } = useProducts({ search: search || undefined });
  const createProduct = useCreateProduct();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState<Partial<Product>>({
    name: '',
    sku: '',
    barcode: '',
    type: 'standard',
    category: '',
    unit_type: 'unit',
    cost: 0,
    wholesale_price: 0,
    suggested_retail_price: 0,
    case_size: 1,
    reorder_point: 0,
    safety_stock: 0,
    is_active: true,
  });

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleCreate = async () => {
    try {
      await createProduct.mutateAsync(form);
      setIsDialogOpen(false);
      setForm({
        name: '',
        sku: '',
        barcode: '',
        type: 'standard',
        category: '',
        unit_type: 'unit',
        cost: 0,
        wholesale_price: 0,
        suggested_retail_price: 0,
        case_size: 1,
        reorder_point: 0,
        safety_stock: 0,
        is_active: true,
      });
    } catch (error) {
      // Error handled by hook
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/os/warehouse">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              Products
            </h1>
            <p className="text-muted-foreground">Manage your product catalog</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Product Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Grabba Leaf 2oz"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input
                    value={form.sku || ''}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="GRB-2OZ-001"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Barcode</Label>
                  <Input
                    value={form.barcode || ''}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    placeholder="123456789012"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={form.category || ''}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Tobacco"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="bundle">Bundle</SelectItem>
                      <SelectItem value="variant">Variant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unit Type</Label>
                  <Select value={form.unit_type} onValueChange={(v) => setForm({ ...form, unit_type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unit">Unit</SelectItem>
                      <SelectItem value="box">Box</SelectItem>
                      <SelectItem value="case">Case</SelectItem>
                      <SelectItem value="pack">Pack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Case Size</Label>
                  <Input
                    type="number"
                    value={form.case_size || 1}
                    onChange={(e) => setForm({ ...form, case_size: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Cost</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.cost || 0}
                    onChange={(e) => setForm({ ...form, cost: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Wholesale Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.wholesale_price || 0}
                    onChange={(e) => setForm({ ...form, wholesale_price: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Retail Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.suggested_retail_price || 0}
                    onChange={(e) => setForm({ ...form, suggested_retail_price: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Reorder Point</Label>
                  <Input
                    type="number"
                    value={form.reorder_point || 0}
                    onChange={(e) => setForm({ ...form, reorder_point: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Safety Stock</Label>
                  <Input
                    type="number"
                    value={form.safety_stock || 0}
                    onChange={(e) => setForm({ ...form, safety_stock: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Product description..."
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!form.name || createProduct.isPending}>
                {createProduct.isPending ? 'Creating...' : 'Create Product'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, SKU, or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Products ({products?.length || 0})</CardTitle>
          <CardDescription>Your complete product catalog</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Wholesale</TableHead>
                  <TableHead>Retail</TableHead>
                  <TableHead>Scores</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.brand && (
                            <Badge variant="outline" className="text-xs">
                              {product.brand.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Barcode className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono text-sm">{product.sku || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{product.type}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{formatCurrency(product.cost)}</TableCell>
                    <TableCell className="font-mono">{formatCurrency(product.wholesale_price)}</TableCell>
                    <TableCell className="font-mono">{formatCurrency(product.suggested_retail_price)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {product.hero_score && product.hero_score >= 50 && (
                          <div className="flex items-center gap-1 text-amber-500">
                            <Star className="h-3 w-3" />
                            <span className="text-xs">{product.hero_score.toFixed(0)}</span>
                          </div>
                        )}
                        {product.ghost_score && product.ghost_score >= 50 && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <TrendingDown className="h-3 w-3" />
                            <span className="text-xs">{product.ghost_score.toFixed(0)}</span>
                          </div>
                        )}
                        {!product.hero_score && !product.ghost_score && (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.is_active ? 'default' : 'secondary'}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/os/inventory/products/${product.id}`}>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!products?.length && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No products found. Add your first product to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
