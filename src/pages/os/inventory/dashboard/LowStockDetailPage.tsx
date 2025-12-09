import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  AlertTriangle,
  Eye,
  ShoppingCart,
  Warehouse,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function LowStockDetailPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  
  // Fetch low stock items with forecasts
  const { data: lowStockItems = [], isLoading } = useQuery({
    queryKey: ['low-stock-detail'],
    queryFn: async () => {
      // Get inventory with reorder points
      const { data: inventory, error: invError } = await supabase
        .from('inventory_stock')
        .select(`
          id,
          product_id,
          warehouse_id,
          quantity_on_hand,
          quantity_reserved,
          reorder_point,
          products (id, name, sku, brand_id),
          warehouses (id, name, city, state)
        `);
      
      if (invError) throw invError;

      // Get forecasts for risk levels
      const { data: forecasts } = await supabase
        .from('inventory_forecasts')
        .select('product_id, warehouse_id, risk_level, days_until_runout, projected_runout_date');

      // Create forecast map
      const forecastMap = new Map();
      (forecasts || []).forEach((f: any) => {
        forecastMap.set(`${f.product_id}|${f.warehouse_id}`, f);
      });

      // Filter to low stock only
      return (inventory || [])
        .filter((item: any) => {
          const available = (item.quantity_on_hand || 0) - (item.quantity_reserved || 0);
          const reorderPoint = item.reorder_point || 0;
          return available <= reorderPoint || available <= 0;
        })
        .map((item: any) => {
          const forecast = forecastMap.get(`${item.product_id}|${item.warehouse_id}`);
          return {
            ...item,
            available: (item.quantity_on_hand || 0) - (item.quantity_reserved || 0),
            risk_level: forecast?.risk_level || 'unknown',
            days_until_runout: forecast?.days_until_runout,
            projected_runout_date: forecast?.projected_runout_date,
          };
        });
    },
  });

  // Filter results
  const filtered = lowStockItems.filter((item: any) => {
    if (riskFilter !== 'all' && item.risk_level !== riskFilter) return false;
    if (search) {
      const term = search.toLowerCase();
      const product = item.products?.name?.toLowerCase() || '';
      const warehouse = item.warehouses?.name?.toLowerCase() || '';
      return product.includes(term) || warehouse.includes(term);
    }
    return true;
  });

  const handleExport = () => {
    const csv = [
      ['Warehouse', 'City', 'Product', 'SKU', 'Available', 'Reorder Point', 'Risk Level', 'Days Until Runout', 'Projected Runout'],
      ...filtered.map((item: any) => [
        item.warehouses?.name || '',
        item.warehouses?.city || '',
        item.products?.name || '',
        item.products?.sku || '',
        item.available,
        item.reorder_point || 0,
        item.risk_level,
        item.days_until_runout || '',
        item.projected_runout_date || '',
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'low-stock-detail.csv';
    a.click();
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'critical': return <Badge variant="destructive">Critical</Badge>;
      case 'high': return <Badge variant="destructive">High</Badge>;
      case 'medium': return <Badge variant="secondary">Medium</Badge>;
      case 'low': return <Badge variant="outline">Low</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
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
              <AlertTriangle className="h-8 w-8 text-destructive" />
              Low Stock Alerts
            </h1>
            <p className="text-muted-foreground">Items below reorder threshold requiring attention</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => navigate('/os/inventory/procurement')}>
            <ShoppingCart className="h-4 w-4 mr-2" />
            Go to Procurement
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-destructive">
                {filtered.filter((i: any) => i.risk_level === 'critical').length}
              </p>
              <p className="text-sm text-muted-foreground">Critical Items</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-500">
                {filtered.filter((i: any) => i.risk_level === 'high').length}
              </p>
              <p className="text-sm text-muted-foreground">High Risk Items</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{filtered.length}</p>
              <p className="text-sm text-muted-foreground">Total Low Stock Items</p>
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
                placeholder="Search by product or warehouse..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-[180px]">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Risk Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Low Stock Items ({filtered.length})</CardTitle>
          <CardDescription>Products requiring reorder attention</CardDescription>
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
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Reorder Point</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead className="text-right">Days Left</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item: any) => (
                  <TableRow key={item.id} className={item.risk_level === 'critical' ? 'bg-destructive/5' : ''}>
                    <TableCell className="font-medium">{item.warehouses?.name || 'Unknown'}</TableCell>
                    <TableCell>{item.warehouses?.city}, {item.warehouses?.state}</TableCell>
                    <TableCell>{item.products?.name || 'Unknown'}</TableCell>
                    <TableCell className="font-mono text-sm">{item.products?.sku || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={item.available <= 0 ? 'destructive' : 'secondary'}>
                        {item.available}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{item.reorder_point || 0}</TableCell>
                    <TableCell>{getRiskBadge(item.risk_level)}</TableCell>
                    <TableCell className="text-right">
                      {item.days_until_runout !== null && item.days_until_runout !== undefined ? (
                        <span className={item.days_until_runout <= 7 ? 'text-destructive font-medium' : ''}>
                          {item.days_until_runout}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/os/inventory/products/${item.products?.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      No low stock items found
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