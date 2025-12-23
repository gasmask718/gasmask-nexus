// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY AUDIT LOG PAGE — Track all inventory changes with old/new values
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  History,
  ArrowLeft,
  Search,
  Loader2,
  ArrowRight,
  User,
  Bot,
  MapPin,
  Warehouse,
  Calendar,
  Download,
} from 'lucide-react';
import { useInventoryAuditLog, useAuditLogStats } from '@/services/inventory/useInventoryAuditLog';
import { format } from 'date-fns';

export default function InventoryAuditLogPage() {
  const [search, setSearch] = useState('');
  const [referenceType, setReferenceType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: stats } = useAuditLogStats();
  const { data: logs, isLoading } = useInventoryAuditLog({
    referenceType: referenceType !== 'all' ? referenceType : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: 200,
  });

  // Client-side search filter
  const filtered = (logs || []).filter(log => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      log.product?.name?.toLowerCase().includes(term) ||
      log.product?.sku?.toLowerCase().includes(term) ||
      log.store?.store_name?.toLowerCase().includes(term) ||
      log.store?.address?.toLowerCase().includes(term) ||
      log.warehouse?.name?.toLowerCase().includes(term) ||
      log.change_reason?.toLowerCase().includes(term)
    );
  });

  const getFullAddress = (store: any) => {
    if (!store) return null;
    return `${store.address}, ${store.city}, ${store.state} ${store.zip}`;
  };

  const formatDelta = (delta: number | null) => {
    if (!delta) return null;
    if (delta > 0) return <span className="text-green-600">+{delta}</span>;
    if (delta < 0) return <span className="text-destructive">{delta}</span>;
    return <span className="text-muted-foreground">0</span>;
  };

  const getReferenceTypeBadge = (type: string | null) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      purchase_order: { label: 'PO', variant: 'default' },
      manual: { label: 'Manual', variant: 'secondary' },
      sale: { label: 'Sale', variant: 'outline' },
      adjustment: { label: 'Adjustment', variant: 'secondary' },
      transfer: { label: 'Transfer', variant: 'outline' },
    };
    const c = config[type || ''] || { label: type || 'Unknown', variant: 'secondary' as const };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Product', 'Location', 'Field', 'Old Value', 'New Value', 'Delta', 'Reason', 'Type', 'Changed By'],
      ...filtered.map(log => [
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        log.product?.name || '-',
        log.store ? getFullAddress(log.store) : log.warehouse?.name || '-',
        log.field_changed,
        log.old_value || '-',
        log.new_value || '-',
        log.quantity_delta || '-',
        log.change_reason || '-',
        log.reference_type || '-',
        log.changed_by_system ? 'System' : (log.changed_by_profile?.name || log.changed_by || '-'),
      ]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory-audit-log.csv';
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
              <History className="h-8 w-8 text-primary" />
              Inventory Audit Log
            </h1>
            <p className="text-muted-foreground">
              Complete history of all inventory changes
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{stats?.totalThisWeek || 0}</p>
              <p className="text-sm text-muted-foreground">Changes This Week</p>
            </div>
          </CardContent>
        </Card>
        {Object.entries(stats?.byReferenceType || {}).slice(0, 3).map(([type, count]) => (
          <Card key={type}>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{count}</p>
                <p className="text-sm text-muted-foreground capitalize">{type}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by product, location, reason..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={referenceType} onValueChange={setReferenceType}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="purchase_order">Purchase Order</SelectItem>
                <SelectItem value="sale">Sale</SelectItem>
                <SelectItem value="adjustment">Adjustment</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                placeholder="From"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                placeholder="To"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Log ({filtered.length})</CardTitle>
          <CardDescription>Every inventory change with old/new values</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No audit log entries found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Changed By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{log.product?.name || '-'}</p>
                        {log.product?.sku && (
                          <p className="text-xs text-muted-foreground font-mono">{log.product.sku}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.store ? (
                        <div className="flex items-start gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground mt-1 flex-shrink-0" />
                          <span className="text-sm">{getFullAddress(log.store)}</span>
                        </div>
                      ) : log.warehouse ? (
                        <div className="flex items-center gap-1">
                          <Warehouse className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{log.warehouse.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-muted-foreground">
                          {log.old_value || '0'}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono text-sm">
                          {log.new_value || '0'}
                        </span>
                        {log.quantity_delta !== null && (
                          <span className="font-mono text-sm ml-1">
                            ({formatDelta(log.quantity_delta)})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">
                      {log.change_reason || '-'}
                    </TableCell>
                    <TableCell>
                      {getReferenceTypeBadge(log.reference_type)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {log.changed_by_system ? (
                          <>
                            <Bot className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">System</span>
                          </>
                        ) : (
                          <>
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">
                              {log.changed_by_profile?.name || 'Unknown'}
                            </span>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
