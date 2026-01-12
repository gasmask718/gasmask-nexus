// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT INVENTORY PAGE — Total Units Sold Per Product (Floor 3)
// Shows all sellable products with sales totals derived from invoices
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
  Package,
  ArrowLeft,
  Search,
  TrendingUp,
  Loader2,
  BarChart3,
  BoxesIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProductSalesSummary {
  brand: string;
  product_name: string;
  base_unit: string;
  total_sold: number;
  invoice_count: number;
  last_sale_date: string | null;
}

export default function ProductInventoryPage() {
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');

  // Fetch brands for filter
  const { data: brands = [] } = useQuery({
    queryKey: ['brands-filter'],
    queryFn: async () => {
      const { data } = await supabase
        .from('brands')
        .select('id, name, color')
        .eq('active', true)
        .order('name');
      return data || [];
    },
  });

  // Fetch product conversions to get base units
  const { data: conversions = [] } = useQuery({
    queryKey: ['product-conversions-inventory'],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_conversions')
        .select('brand, product_name, base_unit, base_units_per_unit, unit_type')
        .eq('is_active', true);
      return data || [];
    },
  });

  // Fetch aggregated sales from invoice line items
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['product-inventory-sales'],
    queryFn: async () => {
      // Get all invoice line items with invoice info
      const { data: lineItems } = await supabase
        .from('invoice_line_items')
        .select(`
          id,
          brand,
          product_name,
          quantity,
          unit_type,
          created_at,
          invoice_id
        `)
        .order('created_at', { ascending: false });

      if (!lineItems) return [];

      // Aggregate by brand + product
      const aggregated = new Map<string, {
        brand: string;
        product_name: string;
        total_quantity: number;
        invoice_ids: Set<string>;
        last_sale: string | null;
        unit_types: Map<string, number>;
      }>();

      lineItems.forEach(item => {
        const key = `${item.brand?.toLowerCase()}-${item.product_name?.toLowerCase()}`;
        
        if (!aggregated.has(key)) {
          aggregated.set(key, {
            brand: item.brand || 'Unknown',
            product_name: item.product_name || 'Unknown',
            total_quantity: 0,
            invoice_ids: new Set(),
            last_sale: item.created_at,
            unit_types: new Map(),
          });
        }

        const entry = aggregated.get(key)!;
        entry.total_quantity += item.quantity || 0;
        entry.invoice_ids.add(item.invoice_id);
        
        // Track quantities by unit type
        const currentQty = entry.unit_types.get(item.unit_type || 'SINGLE') || 0;
        entry.unit_types.set(item.unit_type || 'SINGLE', currentQty + (item.quantity || 0));
      });

      return Array.from(aggregated.values());
    },
  });

  // Helper to get conversion info for a product
  const getProductConversion = (brand: string, productName: string) => {
    return conversions.find(
      c => c.brand?.toLowerCase() === brand?.toLowerCase() &&
           c.product_name?.toLowerCase() === productName?.toLowerCase()
    );
  };

  // Calculate total base units sold considering conversions
  const calculateBaseUnits = (entry: typeof salesData[0]) => {
    let totalBaseUnits = 0;
    
    entry.unit_types.forEach((qty, unitType) => {
      // Find conversion for this unit type
      const conversion = conversions.find(
        c => c.brand?.toLowerCase() === entry.brand?.toLowerCase() &&
             c.product_name?.toLowerCase() === entry.product_name?.toLowerCase() &&
             c.unit_type === unitType
      );
      
      if (conversion) {
        totalBaseUnits += qty * (conversion.base_units_per_unit || 1);
      } else {
        // Default: 1 unit = 1 base unit
        totalBaseUnits += qty;
      }
    });

    return totalBaseUnits;
  };

  // Get base unit label for a product
  const getBaseUnitLabel = (brand: string, productName: string): string => {
    const conversion = getProductConversion(brand, productName);
    return conversion?.base_unit || 'UNIT';
  };

  // Get brand color
  const getBrandColor = (brandName: string): string => {
    const brand = brands.find(b => b.name?.toLowerCase() === brandName?.toLowerCase());
    return brand?.color || '#6366f1';
  };

  // Filter and process data
  const processedData: ProductSalesSummary[] = (salesData || [])
    .map(entry => ({
      brand: entry.brand,
      product_name: entry.product_name,
      base_unit: getBaseUnitLabel(entry.brand, entry.product_name),
      total_sold: calculateBaseUnits(entry),
      invoice_count: entry.invoice_ids.size,
      last_sale_date: entry.last_sale,
    }))
    .filter(item => {
      const searchMatch = search === '' || 
        item.brand.toLowerCase().includes(search.toLowerCase()) ||
        item.product_name.toLowerCase().includes(search.toLowerCase());
      
      const brandMatch = brandFilter === 'all' || 
        item.brand.toLowerCase() === brandFilter.toLowerCase();
      
      return searchMatch && brandMatch;
    })
    .sort((a, b) => b.total_sold - a.total_sold);

  // Calculate totals
  const totalProducts = processedData.length;
  const totalUnitsSold = processedData.reduce((sum, p) => sum + p.total_sold, 0);
  const totalInvoices = processedData.reduce((sum, p) => sum + p.invoice_count, 0);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
              <BoxesIcon className="h-8 w-8 text-primary" />
              Product Inventory
            </h1>
            <p className="text-muted-foreground">
              Floor 3 — Inventory Engine • Total units sold per product
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Products</p>
                <p className="text-2xl font-bold">{formatNumber(totalProducts)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Units Sold</p>
                <p className="text-2xl font-bold">{formatNumber(totalUnitsSold)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <BarChart3 className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Invoices</p>
                <p className="text-2xl font-bold">{formatNumber(totalInvoices)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by brand or product name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All Brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.name}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Products Sold</CardTitle>
          <CardDescription>
            Aggregated from all invoices • Real-time totals
          </CardDescription>
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
                  <TableHead>Brand</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Base Unit</TableHead>
                  <TableHead className="text-right">Total Sold</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead>Last Sale</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedData.map((product, index) => (
                  <TableRow key={`${product.brand}-${product.product_name}-${index}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getBrandColor(product.brand) }}
                        />
                        <span className="font-medium">{product.brand}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{product.product_name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {product.base_unit}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-lg">
                        {formatNumber(product.total_sold)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        {product.base_unit === 'TUBE' ? 'tubes' : 
                         product.base_unit === 'BAG' ? 'bags' : 
                         'units'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-muted-foreground">
                        {product.invoice_count}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(product.last_sale_date)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {processedData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                      <p className="text-muted-foreground">
                        {search || brandFilter !== 'all'
                          ? 'No products match your filters.'
                          : 'No product sales recorded yet.'}
                      </p>
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
