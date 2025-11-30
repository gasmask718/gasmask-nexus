// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASE ORDERS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, ArrowLeft, ArrowRight, Filter } from 'lucide-react';
import { usePurchaseOrders } from '@/services/procurement';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'placed', label: 'Placed' },
  { value: 'paid', label: 'Paid' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'stocked', label: 'Stocked' },
];

export default function PurchaseOrdersPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const { data: purchaseOrders, isLoading } = usePurchaseOrders(
    statusFilter !== 'all' ? statusFilter : undefined
  );

  const filteredPOs = purchaseOrders?.filter(po =>
    po.id.toLowerCase().includes(search.toLowerCase()) ||
    (po.supplier as any)?.name?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'delivered':
      case 'stocked':
        return 'default';
      case 'in_transit':
        return 'secondary';
      case 'paid':
      case 'placed':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/os/procurement">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Purchase Orders</h1>
            <p className="text-muted-foreground">Track and manage procurement orders</p>
          </div>
        </div>
        <Button asChild>
          <Link to="/os/procurement/purchase-orders/new">
            <Plus className="h-4 w-4 mr-2" />
            New PO
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by PO # or supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* PO Table */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Orders ({filteredPOs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Shipping</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPOs.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono text-sm">
                      {po.id.slice(0, 8).toUpperCase()}
                    </TableCell>
                    <TableCell className="font-medium">
                      {(po.supplier as any)?.name || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(po.status)}>
                        {po.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{po.products?.length || 0} items</TableCell>
                    <TableCell>{formatCurrency(po.total_cost || 0)}</TableCell>
                    <TableCell>{formatCurrency(po.shipping_cost || 0)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {po.estimated_arrival
                        ? new Date(po.estimated_arrival).toLocaleDateString()
                        : 'TBD'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {po.tracking_number || '-'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/os/procurement/purchase-orders/${po.id}`}>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredPOs.length && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No purchase orders found
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
