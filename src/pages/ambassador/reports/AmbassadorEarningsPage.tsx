import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Clock, ArrowUpRight } from 'lucide-react';
import { useMyMonthlyEarnings, useMyFinancialSummary } from '@/hooks/useReporting';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function AmbassadorEarningsPage() {
  const { data: monthlyData, isLoading: loadingMonthly } = useMyMonthlyEarnings();
  const { data: summary, isLoading: loadingSummary } = useMyFinancialSummary();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Chart data (reversed for chronological order)
  const chartData = [...(monthlyData || [])].reverse().map(m => ({
    month: m.month ? format(new Date(m.month), 'MMM') : '',
    direct: Number(m.direct_earned || 0),
    override: Number(m.override_earned || 0),
    paid: Number(m.paid_amount || 0),
  }));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">My Earnings</h1>
        <p className="text-muted-foreground">Your commission history and performance</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lifetime Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">
                {formatCurrency(Number(summary?.lifetime_earned || 0))}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Already Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-emerald-500" />
              <span className="text-2xl font-bold">
                {formatCurrency(Number(summary?.paid_amount || 0))}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold">
                {formatCurrency(Number(summary?.pending_amount || 0) + Number(summary?.approved_amount || 0))}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Outstanding — to be paid</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Override Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-500" />
              <span className="text-2xl font-bold">
                {formatCurrency(Number(summary?.override_total || 0))}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">From team activity</p>
          </CardContent>
        </Card>
      </div>

      {/* Earnings Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Earnings</CardTitle>
          <CardDescription>Direct commissions vs override earnings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {loadingMonthly ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Loading...
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis tickFormatter={(v) => `$${v}`} className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  <Legend />
                  <Bar
                    dataKey="direct"
                    name="Direct Earnings"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="override"
                    name="Override Earnings"
                    fill="hsl(280 70% 50%)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No earnings data yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Breakdown</CardTitle>
          <CardDescription>Detailed earnings by month</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingMonthly ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-3">
              {monthlyData?.map((month) => (
                <div
                  key={month.month}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div>
                    <div className="font-medium">
                      {month.month ? format(new Date(month.month), 'MMMM yyyy') : '-'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Direct: {formatCurrency(Number(month.direct_earned || 0))}
                      {Number(month.override_earned) > 0 && (
                        <span className="text-purple-500 ml-2">
                          + Override: {formatCurrency(Number(month.override_earned))}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      {formatCurrency(Number(month.total_earned || 0))}
                    </div>
                    <div className="flex gap-2 justify-end mt-1">
                      {Number(month.paid_amount) > 0 && (
                        <Badge className="bg-green-500 text-xs">
                          {formatCurrency(Number(month.paid_amount))} paid
                        </Badge>
                      )}
                      {Number(month.pending_amount) > 0 && (
                        <Badge variant="outline" className="text-amber-600 text-xs">
                          {formatCurrency(Number(month.pending_amount))} pending
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(!monthlyData || monthlyData.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  No earnings history yet
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
