import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Search, Store, DollarSign, Users, Activity } from 'lucide-react';
import { useStorePerformance, exportToCSV } from '@/hooks/useReporting';
import { format } from 'date-fns';

export default function StoreReportsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: stores, isLoading } = useStorePerformance();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Filter by search
  const filtered = stores?.filter(s => 
    !searchTerm || 
    s.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.state?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Summary stats
  const totalStores = filtered.length;
  const storesWithActivity = filtered.filter(s => Number(s.commission_count) > 0).length;
  const totalRevenue = filtered.reduce((sum, s) => sum + Number(s.store_revenue || 0), 0);
  const totalCommissions = filtered.reduce((sum, s) => sum + Number(s.commissions_generated || 0), 0);

  const handleExport = () => {
    if (filtered.length) {
      exportToCSV(filtered, 'store_report');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Store Reports</h1>
          <p className="text-muted-foreground">Revenue and commission performance by store</p>
        </div>
        <Button onClick={handleExport} variant="outline" disabled={!filtered.length}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Stores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{totalStores}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{storesWithActivity} with activity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{formatCurrency(totalRevenue)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Commissions Generated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-500" />
              <span className="text-2xl font-bold">{formatCurrency(totalCommissions)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Commission Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold">
                {totalRevenue > 0 
                  ? `${((totalCommissions / totalRevenue) * 100).toFixed(1)}%`
                  : '-'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Store Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Store Performance</CardTitle>
              <CardDescription>Revenue and commission by location</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Events</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Commissions</TableHead>
                  <TableHead className="text-right">Commission %</TableHead>
                  <TableHead className="text-right">Ambassadors</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((store) => {
                  const commissionRate = Number(store.store_revenue) > 0 
                    ? (Number(store.commissions_generated) / Number(store.store_revenue)) * 100 
                    : 0;
                  
                  return (
                    <TableRow key={store.store_id}>
                      <TableCell>
                        <div className="font-medium">{store.store_name || 'Unknown'}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {[store.city, store.state].filter(Boolean).join(', ') || '-'}
                      </TableCell>
                      <TableCell className="text-right">{store.commission_count}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(store.store_revenue || 0))}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(Number(store.commissions_generated || 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {commissionRate > 0 ? (
                          <Badge variant={commissionRate > 10 ? "default" : "secondary"}>
                            {commissionRate.toFixed(1)}%
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right">{store.ambassadors_involved}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {store.last_activity 
                          ? format(new Date(store.last_activity), 'MMM d, yyyy')
                          : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No stores found
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
