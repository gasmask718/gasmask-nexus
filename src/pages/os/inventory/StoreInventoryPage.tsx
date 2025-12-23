// ═══════════════════════════════════════════════════════════════════════════════
// STORE INVENTORY PAGE — Track products at store level by FULL ADDRESS
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Store,
  Package,
  Search,
  ArrowLeft,
  AlertTriangle,
  MapPin,
  Edit,
  Plus,
  Loader2,
  Download,
  Filter,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStoreInventory, useStoreInventoryStats, useUpdateStoreInventory } from '@/services/inventory/useStoreInventory';
import { toast } from 'sonner';

export default function StoreInventoryPage() {
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [boroughFilter, setBoroughFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editItem, setEditItem] = useState<any>(null);
  const [editQty, setEditQty] = useState('');
  const [editReason, setEditReason] = useState('');

  const { data: stats } = useStoreInventoryStats();
  const updateInventory = useUpdateStoreInventory();

  // Fetch cities
  const { data: cities = [] } = useQuery({
    queryKey: ['store-cities'],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_master')
        .select('city')
        .not('city', 'is', null);
      return [...new Set((data || []).map(s => s.city).filter(Boolean))].sort();
    },
  });

  // Fetch boroughs
  const { data: boroughs = [] } = useQuery({
    queryKey: ['boroughs-list'],
    queryFn: async () => {
      const { data } = await supabase.from('boroughs').select('id, name').order('name');
      return data || [];
    },
  });

  const { data: inventory, isLoading } = useStoreInventory({
    city: cityFilter !== 'all' ? cityFilter : undefined,
    boroughId: boroughFilter !== 'all' ? boroughFilter : undefined,
    lowStockOnly: statusFilter === 'low',
    search: search || undefined,
  });

  // Filter by status
  const filtered = (inventory || []).filter(item => {
    if (statusFilter === 'out') return item.quantity_on_hand === 0;
    if (statusFilter === 'low') return item.quantity_on_hand > 0 && item.quantity_on_hand <= item.reorder_point;
    if (statusFilter === 'ok') return item.quantity_on_hand > item.reorder_point;
    return true;
  });

  const getFullAddress = (store: any) => {
    if (!store) return '-';
    return `${store.address}, ${store.city}, ${store.state} ${store.zip}`;
  };

  const getStatus = (qty: number, reorderPoint: number) => {
    if (qty === 0) return { label: 'Out of Stock', variant: 'destructive' as const };
    if (qty <= reorderPoint) return { label: 'Low Stock', variant: 'secondary' as const };
    return { label: 'OK', variant: 'default' as const };
  };

  const handleEditOpen = (item: any) => {
    setEditItem(item);
    setEditQty(String(item.quantity_on_hand));
    setEditReason('');
  };

  const handleEditSave = async () => {
    if (!editItem) return;
    const newQty = parseInt(editQty, 10);
    if (isNaN(newQty) || newQty < 0) {
      toast.error('Quantity must be a non-negative number');
      return;
    }
    await updateInventory.mutateAsync({
      id: editItem.id,
      quantity_on_hand: newQty,
      reason: editReason || 'Manual adjustment',
    });
    setEditItem(null);
  };

  const handleExport = () => {
    const csv = [
      ['Full Address', 'Store Name', 'Product', 'SKU', 'Qty On Hand', 'Reorder Point', 'Status'],
      ...filtered.map(item => [
        getFullAddress(item.store),
        item.store?.store_name || '',
        item.product?.name || '',
        item.product?.sku || '',
        item.quantity_on_hand,
        item.reorder_point,
        getStatus(item.quantity_on_hand, item.reorder_point).label,
      ]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'store-inventory.csv';
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
              <Store className="h-8 w-8 text-primary" />
              Store Inventory
            </h1>
            <p className="text-muted-foreground">
              Track product levels at each store by full address
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button asChild>
            <Link to="/os/inventory/store-inventory/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Inventory
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{stats?.totalRecords || 0}</p>
              <p className="text-sm text-muted-foreground">Total Records</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{stats?.totalUnits?.toLocaleString() || 0}</p>
              <p className="text-sm text-muted-foreground">Total Units</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-500">{stats?.lowStockCount || 0}</p>
              <p className="text-sm text-muted-foreground">Low Stock</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-destructive">{stats?.outOfStockCount || 0}</p>
              <p className="text-sm text-muted-foreground">Out of Stock</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by store, address, product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cities.map(city => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={boroughFilter} onValueChange={setBoroughFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Borough" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Boroughs</SelectItem>
                {boroughs.map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Store Inventory ({filtered.length})</CardTitle>
          <CardDescription>Products tracked at each store location</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Store className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No store inventory records found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Full Address</TableHead>
                  <TableHead>Store Name</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty On Hand</TableHead>
                  <TableHead className="text-right">Reorder Point</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(item => {
                  const status = getStatus(item.quantity_on_hand, item.reorder_point);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{getFullAddress(item.store)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.store?.store_name || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.product?.name || '-'}</p>
                          {item.product?.sku && (
                            <p className="text-xs text-muted-foreground font-mono">{item.product.sku}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.quantity_on_hand}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {item.reorder_point}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>
                          {status.label === 'Low Stock' && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEditOpen(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Inventory</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{editItem?.product?.name}</p>
              <p className="text-sm text-muted-foreground">{editItem?.store?.store_name}</p>
              <p className="text-xs text-muted-foreground">{getFullAddress(editItem?.store)}</p>
            </div>
            <div className="space-y-2">
              <Label>New Quantity</Label>
              <Input
                type="number"
                min="0"
                value={editQty}
                onChange={(e) => setEditQty(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Current: {editItem?.quantity_on_hand} | Change: {editItem ? parseInt(editQty || '0', 10) - editItem.quantity_on_hand : 0}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Reason for Change</Label>
              <Textarea
                placeholder="e.g., Physical count, Sale, Restock, Damaged..."
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={updateInventory.isPending}>
              {updateInventory.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
