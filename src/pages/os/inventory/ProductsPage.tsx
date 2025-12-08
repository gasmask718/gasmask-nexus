// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS PAGE — Full Product Catalog Management (V1)
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Package,
  Plus,
  Search,
  ArrowLeft,
  ArrowRight,
  Star,
  TrendingDown,
  Barcode,
  MoreHorizontal,
  Eye,
  Edit,
  Download,
  Loader2,
} from 'lucide-react';
import { useProducts, Product } from '@/services/inventory';
import ProductFormModal from '@/components/inventory/ProductFormModal';

type StatusFilter = 'all' | 'active' | 'inactive';

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editProductId, setEditProductId] = useState<string | null>(null);

  const { data: products, isLoading } = useProducts({ search: search || undefined });

  // Filter products by status
  const filteredProducts = products?.filter(product => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return product.is_active;
    if (statusFilter === 'inactive') return !product.is_active;
    return true;
  });

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
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
            {/* TODO (Inventory + Revenue):
              - filter by low stock / high demand later
              - filter by brand/business
              - show hero/ghost score column when Revenue Engine V2 is active
            */}
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
                  <TableHead>Type</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Wholesale</TableHead>
                  <TableHead>Retail</TableHead>
                  <TableHead>Scores</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts?.map((product) => (
                  <TableRow key={product.id}>
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
                          <p className="font-medium">{product.name}</p>
                          <div className="flex items-center gap-1">
                            {product.brand && (
                              <Badge variant="outline" className="text-xs">
                                {product.brand.name}
                              </Badge>
                            )}
                            {product.variant && (
                              <span className="text-xs text-muted-foreground">
                                {product.variant}
                              </span>
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
                      <Badge variant="secondary" className="capitalize">{product.type}</Badge>
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
                          <DropdownMenuItem onClick={() => handleOpenEdit(product.id)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Product
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredProducts?.length && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                      <p className="text-muted-foreground">
                        {search || statusFilter !== 'all' 
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
    </div>
  );
}
