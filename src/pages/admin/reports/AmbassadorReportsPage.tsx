import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Search, Users, DollarSign, Clock, TrendingUp } from 'lucide-react';
import { useAmbassadorFinancialSummary, exportToCSV } from '@/hooks/useReporting';
import { format } from 'date-fns';

export default function AmbassadorReportsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: ambassadors, isLoading } = useAmbassadorFinancialSummary();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Filter by search
  const filtered = ambassadors?.filter(a => 
    !searchTerm || 
    a.ambassador_name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Summary stats
  const totalAmbassadors = filtered.length;
  const totalLifetime = filtered.reduce((sum, a) => sum + Number(a.lifetime_earned || 0), 0);
  const totalPending = filtered.reduce((sum, a) => sum + Number(a.pending_amount || 0), 0);
  const totalOverrides = filtered.reduce((sum, a) => sum + Number(a.override_total || 0), 0);

  const handleExport = () => {
    if (filtered.length) {
      exportToCSV(filtered, 'ambassador_report');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ambassador Reports</h1>
          <p className="text-muted-foreground">Performance and earnings by ambassador</p>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Ambassadors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{totalAmbassadors}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lifetime Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{formatCurrency(totalLifetime)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold">{formatCurrency(totalPending)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Override Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-500" />
              <span className="text-2xl font-bold">{formatCurrency(totalOverrides)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Ambassador Performance</CardTitle>
              <CardDescription>Lifetime earnings and activity</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ambassadors..."
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
                  <TableHead>Ambassador</TableHead>
                  <TableHead className="text-right">Commissions</TableHead>
                  <TableHead className="text-right">Lifetime Earned</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Approved</TableHead>
                  <TableHead className="text-right">Overrides</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((amb) => (
                  <TableRow key={amb.ambassador_id}>
                    <TableCell>
                      <div className="font-medium">{amb.ambassador_name || 'Unknown'}</div>
                    </TableCell>
                    <TableCell className="text-right">{amb.commission_count}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(amb.lifetime_earned || 0))}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(Number(amb.paid_amount || 0))}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(amb.pending_amount || 0) > 0 && (
                        <Badge variant="outline" className="text-amber-600">
                          {formatCurrency(Number(amb.pending_amount))}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(amb.approved_amount || 0) > 0 && (
                        <Badge variant="secondary">
                          {formatCurrency(Number(amb.approved_amount))}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-purple-600">
                      {Number(amb.override_total || 0) > 0 
                        ? formatCurrency(Number(amb.override_total)) 
                        : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {amb.last_earned_at 
                        ? format(new Date(amb.last_earned_at), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No ambassadors found
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
