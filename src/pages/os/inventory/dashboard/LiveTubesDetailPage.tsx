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
  ArrowLeft,
  Search,
  Download,
  MapPin,
  Package,
  Eye,
  Building,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function LiveTubesDetailPage() {
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  
  // Fetch inventory with store details
  const { data: storeInventory = [], isLoading } = useQuery({
    queryKey: ['live-tubes-detail'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_stock')
        .select(`
          id,
          quantity_on_hand,
          quantity_reserved,
          updated_at,
          products (id, name, sku, brand_id, brands (id, name)),
          warehouses (id, name, city, state)
        `)
        .gt('quantity_on_hand', 0);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Get unique cities
  const cities = [...new Set(storeInventory.map((s: any) => s.warehouses?.city).filter(Boolean))].sort();

  // Get unique brands
  const brands = [...new Set(storeInventory.map((s: any) => 
    (s.products as any)?.brands?.name
  ).filter(Boolean))].sort();

  // Calculate totals
  const totalOnHand = storeInventory.reduce((sum: number, item: any) => sum + (item.quantity_on_hand || 0), 0);
  const totalReserved = storeInventory.reduce((sum: number, item: any) => sum + (item.quantity_reserved || 0), 0);

  // Filter results
  const filtered = storeInventory.filter((item: any) => {
    if (cityFilter !== 'all' && item.warehouses?.city !== cityFilter) return false;
    if (brandFilter !== 'all' && (item.products as any)?.brands?.name !== brandFilter) return false;
    if (search) {
      const term = search.toLowerCase();
      const name = item.warehouses?.name?.toLowerCase() || '';
      const product = item.products?.name?.toLowerCase() || '';
      const sku = item.products?.sku?.toLowerCase() || '';
      return name.includes(term) || product.includes(term) || sku.includes(term);
    }
    return true;
  });

  const handleExport = () => {
    const csv = [
      ['Warehouse', 'City', 'State', 'Product', 'Brand', 'SKU', 'On Hand', 'Reserved', 'Last Updated'],
      ...filtered.map((item: any) => [
        item.warehouses?.name || '',
        item.warehouses?.city || '',
        item.warehouses?.state || '',
        item.products?.name || '',
        (item.products as any)?.brands?.name || '',
        item.products?.sku || '',
        item.quantity_on_hand || 0,
        item.quantity_reserved || 0,
        item.updated_at || '',
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'live-tubes-detail.csv';
    a.click();
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
              Live Inventory in Field
            </h1>
            <p className="text-muted-foreground">All stock currently distributed across warehouses</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{totalOnHand.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Units On Hand</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-500">{totalReserved.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Reserved Units</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{filtered.length}</p>
              <p className="text-sm text-muted-foreground">Stock Records</p>
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
                placeholder="Search by warehouse, product, or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="w-[180px]">
                <MapPin className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Cities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-[180px]">
                <Building className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {brands.map((brand) => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Detail ({filtered.length})</CardTitle>
          <CardDescription>Stock levels by warehouse and product</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.warehouses?.name || 'Unknown'}</TableCell>
                    <TableCell>
                      {item.warehouses?.city}, {item.warehouses?.state}
                    </TableCell>
                    <TableCell>{item.products?.name || 'Unknown'}</TableCell>
                    <TableCell>
                      {(item.products as any)?.brands?.name && (
                        <Badge variant="outline">{(item.products as any).brands.name}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.products?.sku || '-'}</TableCell>
                    <TableCell className="text-right font-medium">{item.quantity_on_hand || 0}</TableCell>
                    <TableCell className="text-right">{item.quantity_reserved || 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/os/inventory/warehouses/${item.warehouses?.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      No inventory records found
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