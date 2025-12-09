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
  ShoppingCart,
  Eye,
  Building,
  CheckCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function BoxesSoldDetailPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Fetch purchase order items (boxes sold/ordered)
  const { data: salesData = [], isLoading } = useQuery({
    queryKey: ['boxes-sold-detail'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select(`
          id,
          quantity,
          unit_cost,
          line_total,
          created_at,
          purchase_orders (
            id,
            po_number,
            status,
            order_date,
            suppliers (id, name)
          ),
          products (id, name, sku, brand_id, brands (id, name))
        `)
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Get unique statuses
  const statuses = [...new Set(salesData.map((s: any) => s.purchase_orders?.status).filter(Boolean))].sort();

  // Filter results
  const filtered = salesData.filter((item: any) => {
    if (statusFilter !== 'all' && item.purchase_orders?.status !== statusFilter) return false;
    if (search) {
      const term = search.toLowerCase();
      const product = item.products?.name?.toLowerCase() || '';
      const poNumber = item.purchase_orders?.po_number?.toLowerCase() || '';
      const supplier = item.purchase_orders?.suppliers?.name?.toLowerCase() || '';
      return product.includes(term) || poNumber.includes(term) || supplier.includes(term);
    }
    return true;
  });

  // Calculate totals
  const totalBoxes = filtered.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
  const totalValue = filtered.reduce((sum: number, item: any) => sum + (item.line_total || 0), 0);
  const receivedItems = filtered.filter((i: any) => i.purchase_orders?.status === 'received').length;

  const handleExport = () => {
    const csv = [
      ['PO Number', 'Supplier', 'Product', 'Brand', 'SKU', 'Quantity', 'Unit Cost', 'Line Total', 'Status', 'Order Date'],
      ...filtered.map((item: any) => [
        item.purchase_orders?.po_number || '',
        item.purchase_orders?.suppliers?.name || '',
        item.products?.name || '',
        (item.products as any)?.brands?.name || '',
        item.products?.sku || '',
        item.quantity || 0,
        item.unit_cost || 0,
        item.line_total || 0,
        item.purchase_orders?.status || '',
        item.purchase_orders?.order_date || '',
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'boxes-sold-detail.csv';
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
              <ShoppingCart className="h-8 w-8 text-primary" />
              Boxes Sold / Ordered
            </h1>
            <p className="text-muted-foreground">Complete purchase order item history</p>
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
              <p className="text-3xl font-bold text-primary">{totalBoxes.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Units Ordered</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">${totalValue.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Order Value</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{receivedItems}</p>
              <p className="text-sm text-muted-foreground">Items Received</p>
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
                placeholder="Search by product, PO number, or supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <CheckCircle className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status} className="capitalize">{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items ({filtered.length})</CardTitle>
          <CardDescription>All purchase order line items</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.purchase_orders?.po_number || '-'}</TableCell>
                    <TableCell>{item.purchase_orders?.suppliers?.name || '-'}</TableCell>
                    <TableCell className="font-medium">{item.products?.name || 'Unknown'}</TableCell>
                    <TableCell>
                      {(item.products as any)?.brands?.name && (
                        <Badge variant="outline">{(item.products as any).brands.name}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.products?.sku || '-'}</TableCell>
                    <TableCell className="text-right font-medium">{item.quantity || 0}</TableCell>
                    <TableCell className="text-right">${(item.unit_cost || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">${(item.line_total || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={
                        item.purchase_orders?.status === 'received' ? 'default' :
                        item.purchase_orders?.status === 'shipped' ? 'secondary' : 'outline'
                      }>
                        {item.purchase_orders?.status || 'draft'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/os/inventory/purchase-orders/${item.purchase_orders?.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      No order items found
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