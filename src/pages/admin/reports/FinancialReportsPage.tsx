import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, DollarSign, TrendingUp, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useFinancialPeriodSummary, usePayoutLiability, exportToCSV } from '@/hooks/useReporting';
import { format } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function FinancialReportsPage() {
  const { data: periodData, isLoading: loadingPeriods } = useFinancialPeriodSummary();
  const { data: liabilityData, isLoading: loadingLiability } = usePayoutLiability();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate totals from period data
  const totals = periodData?.reduce(
    (acc, period) => ({
      grossRevenue: acc.grossRevenue + Number(period.gross_revenue || 0),
      totalCommissions: acc.totalCommissions + Number(period.total_commissions || 0),
      totalPaid: acc.totalPaid + Number(period.total_paid || 0),
      outstanding: acc.outstanding + Number(period.outstanding_liability || 0),
    }),
    { grossRevenue: 0, totalCommissions: 0, totalPaid: 0, outstanding: 0 }
  ) || { grossRevenue: 0, totalCommissions: 0, totalPaid: 0, outstanding: 0 };

  // Current liability
  const currentLiability = liabilityData?.[0]?.liability_amount || 0;
  const pendingItems = liabilityData?.[0]?.pending_items || 0;

  // Chart data (reversed for chronological order)
  const chartData = [...(periodData || [])].reverse().slice(-12).map(p => ({
    month: p.period_month ? format(new Date(p.period_month), 'MMM yy') : '',
    revenue: Number(p.gross_revenue || 0),
    commissions: Number(p.total_commissions || 0),
    paid: Number(p.total_paid || 0),
  }));

  const handleExport = () => {
    if (periodData) {
      exportToCSV(periodData, 'financial_report');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financial Reports</h1>
          <p className="text-muted-foreground">Month-by-month revenue, commissions, and liabilities</p>
        </div>
        <Button onClick={handleExport} variant="outline" disabled={!periodData?.length}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{formatCurrency(totals.grossRevenue)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Commissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{formatCurrency(totals.totalCommissions)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid Out</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-emerald-500" />
              <span className="text-2xl font-bold">{formatCurrency(totals.totalPaid)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Liability</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold">{formatCurrency(Number(currentLiability))}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{pendingItems} items pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue & Commissions Trend</CardTitle>
          <CardDescription>Last 12 months performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stackId="1"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.2}
                    name="Revenue"
                  />
                  <Area
                    type="monotone"
                    dataKey="commissions"
                    stackId="2"
                    stroke="hsl(var(--accent))"
                    fill="hsl(var(--accent))"
                    fillOpacity={0.4}
                    name="Commissions"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Period Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Breakdown</CardTitle>
          <CardDescription>Detailed financial data by period</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPeriods ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Gross Revenue</TableHead>
                  <TableHead className="text-right">Commissions</TableHead>
                  <TableHead className="text-right">Overrides</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Ambassadors</TableHead>
                  <TableHead className="text-right">Stores</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periodData?.map((period) => (
                  <TableRow key={period.period_month}>
                    <TableCell className="font-medium">
                      {period.period_month ? format(new Date(period.period_month), 'MMM yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(period.gross_revenue || 0))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(period.total_commissions || 0))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(period.total_overrides || 0))}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(Number(period.total_paid || 0))}</TableCell>
                    <TableCell className="text-right">
                      {Number(period.outstanding_liability || 0) > 0 && (
                        <Badge variant="outline" className="text-amber-600">
                          {formatCurrency(Number(period.outstanding_liability))}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{period.active_ambassadors}</TableCell>
                    <TableCell className="text-right">{period.active_stores}</TableCell>
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
