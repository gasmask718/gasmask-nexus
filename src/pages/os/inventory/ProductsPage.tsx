// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS PAGE — Full Product Catalog Management (V1)
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Package,
  Plus,
  Search,
  ArrowLeft,
  Star,
  TrendingDown,
  Barcode,
  MoreHorizontal,
  Eye,
  Edit,
  Download,
  Loader2,
  Trash2,
  DollarSign,
} from 'lucide-react';
import { useProducts, useDeleteProduct, Product } from '@/services/inventory';
import ProductFormModal from '@/components/inventory/ProductFormModal';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

type StatusFilter = 'all' | 'active' | 'inactive';

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const { data: products, isLoading } = useProducts({ 
    search: search || undefined,
    includeDeleted 
  });
  const deleteProduct = useDeleteProduct();

  // Fetch brands for filter dropdown
  const { data: brands = [] } = useQuery({
    queryKey: ['brands-filter'],
    queryFn: async () => {
      const { data } = await supabase
        .from('brands')
        .select('id, name')
        .order('name');
      return data || [];
    },
  });

  // Filter products by status and brand
  const filteredProducts = products?.filter(product => {
    const statusMatch = statusFilter === 'all' || 
      (statusFilter === 'active' && product.is_active) ||
      (statusFilter === 'inactive' && !product.is_active);
    const brandMatch = brandFilter === 'all' || product.brand_id === brandFilter;
    return statusMatch && brandMatch;
  });

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Calculate profit per box
  const getProfitPerBox = (product: Product) => {
    if (!product.cost || !product.wholesale_price) return null;
    const costPerBox = product.cost * (product.units_per_box || 1);
    const sellPricePerBox = product.wholesale_price;
    return sellPricePerBox - costPerBox;
  };

  const getMarginPercent = (product: Product) => {
    if (!product.wholesale_price) return null;
    const profit = getProfitPerBox(product);
    if (profit === null) return null;
    return ((profit / product.wholesale_price) * 100).toFixed(1);
  };

  const handleOpenCreate = () => {
    setEditProductId(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (productId: string) => {
    setEditProductId(productId);
    setIsFormModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsFormModalOpen(false);
    setEditProductId(null);
  };

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteConfirmText('');
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete || deleteConfirmText !== 'DELETE') return;
    await deleteProduct.mutateAsync(productToDelete.id);
    setDeleteModalOpen(false);
    setProductToDelete(null);
    setDeleteConfirmText('');
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
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              Products
            </h1>
            <p className="text-muted-foreground">Manage SKUs across all brands and warehouses.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Filters Row */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, SKU, or barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            {/* Brand Filter */}
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {brands.map((brand: any) => (
                  <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Include Deleted Toggle (Admin) */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-deleted"
                checked={includeDeleted}
                onCheckedChange={(checked) => setIncludeDeleted(checked === true)}
              />
              <Label htmlFor="include-deleted" className="text-sm text-muted-foreground cursor-pointer">
                Show Deleted
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Products ({filteredProducts?.length || 0})</CardTitle>
          <CardDescription>Your complete product catalog</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Units/Box</TableHead>
                  <TableHead>Cost/Unit</TableHead>
                  <TableHead>Sell Price</TableHead>
                  <TableHead>Profit/Box</TableHead>
                  <TableHead>Margin</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts?.map((product) => {
                  const profitPerBox = getProfitPerBox(product);
                  const margin = getMarginPercent(product);
                  const isDeleted = (product as any).is_deleted;
                  
                  return (
                    <TableRow key={product.id} className={isDeleted ? 'opacity-50 bg-muted/30' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                            {product.image_url ? (
                              <img 
                                src={product.image_url} 
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{product.name}</p>
                              {isDeleted && (
                                <Badge variant="destructive" className="text-xs">Deleted</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {product.brand && (
                                <Badge variant="outline" className="text-xs">
                                  {product.brand.name}
                                </Badge>
                              )}
                            </div>
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
                        <span className="text-sm">{product.units_per_box || 1}</span>
                      </TableCell>
                      <TableCell className="font-mono">{formatCurrency(product.cost)}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(product.wholesale_price)}</TableCell>
                      <TableCell>
                        {profitPerBox !== null ? (
                          <span className={`font-mono ${profitPerBox >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(profitPerBox)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {margin !== null ? (
                          <Badge 
                            variant={parseFloat(margin) >= 20 ? 'default' : 'destructive'}
                            className="font-mono"
                          >
                            {margin}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.is_active ? 'default' : 'secondary'}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleOpenEdit(product.id)}
                            disabled={isDeleted}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link to={`/os/inventory/products/${product.id}`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              {!isDeleted && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => handleDeleteClick(product)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Product
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!filteredProducts?.length && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                      <p className="text-muted-foreground">
                        {search || statusFilter !== 'all' || brandFilter !== 'all'
                          ? 'No products match your filters.' 
                          : "No products yet. Click 'Add Product' to create your first SKU."}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Product Form Modal */}
      <ProductFormModal
        open={isFormModalOpen}
        onClose={handleCloseModal}
        productId={editProductId || undefined}
      />

      {/* Delete Confirmation Modal */}
      <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Product?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                This will remove <strong>"{productToDelete?.name}"</strong> from active product lists. 
                Existing orders with this product remain unchanged.
              </p>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm font-medium text-destructive mb-2">
                  Type DELETE to confirm:
                </p>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                  placeholder="Type DELETE"
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteConfirmText !== 'DELETE' || deleteProduct.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProduct.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
