import { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  DollarSign, TrendingUp, TrendingDown, CreditCard, Wallet, 
  PiggyBank, AlertTriangle, ArrowUpRight, ArrowDownRight, 
  BarChart3, PieChart, Calendar, RefreshCw, Plus, Brain
} from 'lucide-react';
import { useFinancialDashboard, useFinancialInsights, useSubscriptions } from '@/hooks/useFinancialEngine';
import { format } from 'date-fns';

export default function FinancialDashboard() {
  const [refreshing, setRefreshing] = useState(false);
  const { data: dashboardData, isLoading, refetch } = useFinancialDashboard();
  const { data: insights } = useFinancialInsights();
  const { subscriptions } = useSubscriptions(true);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const summary = dashboardData?.businessSummary;

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Financial Command Center</h1>
            <p className="text-muted-foreground">Business + Personal Financial Brain</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${summary?.totalRevenue?.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="flex items-center mt-2 text-sm text-green-600">
                <ArrowUpRight className="h-4 w-4 mr-1" />
                <span>+12.5% from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Expenses</p>
                  <p className="text-2xl font-bold text-red-600">
                    ${summary?.totalExpenses?.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="flex items-center mt-2 text-sm text-muted-foreground">
                <ArrowDownRight className="h-4 w-4 mr-1" />
                <span>-3.2% from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Net Profit</p>
                  <p className={`text-2xl font-bold ${(summary?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${summary?.netProfit?.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="p-3 bg-primary/10 rounded-full">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Margin</span>
                  <span className="font-medium">{summary?.profitMargin?.toFixed(1) || 0}%</span>
                </div>
                <Progress value={Math.min(summary?.profitMargin || 0, 100)} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Payroll</p>
                  <p className="text-2xl font-bold text-orange-600">
                    ${dashboardData?.pendingPayroll?.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                  <Wallet className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Monthly subscriptions: ${dashboardData?.monthlySubscriptionCost?.toFixed(0) || '0'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="insights">AI Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Expense Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Expense Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {summary?.topExpenses?.length ? (
                      summary.topExpenses.map((expense, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full bg-primary`} style={{ opacity: 1 - (i * 0.15) }} />
                            <span className="text-sm">{expense.category}</span>
                          </div>
                          <span className="font-medium">${expense.amount.toLocaleString()}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">No expense data yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Revenue Streams */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Revenue by Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {summary?.revenueByCategory && Object.keys(summary.revenueByCategory).length > 0 ? (
                      Object.entries(summary.revenueByCategory)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 5)
                        .map(([category, amount], i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-green-500" style={{ opacity: 1 - (i * 0.15) }} />
                              <span className="text-sm">{category}</span>
                            </div>
                            <span className="font-medium text-green-600">${amount.toLocaleString()}</span>
                          </div>
                        ))
                    ) : (
                      <p className="text-muted-foreground text-sm">No revenue data yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="expenses">
            <Card>
              <CardHeader>
                <CardTitle>Expense Categories</CardTitle>
                <CardDescription>Monthly expense breakdown by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {summary?.expensesByCategory && Object.keys(summary.expensesByCategory).length > 0 ? (
                    Object.entries(summary.expensesByCategory)
                      .sort(([,a], [,b]) => b - a)
                      .map(([category, amount], i) => {
                        const percentage = summary.totalExpenses > 0 
                          ? (amount / summary.totalExpenses) * 100 
                          : 0;
                        return (
                          <div key={i} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>{category}</span>
                              <span className="font-medium">${amount.toLocaleString()} ({percentage.toFixed(1)}%)</span>
                            </div>
                            <Progress value={percentage} className="h-2" />
                          </div>
                        );
                      })
                  ) : (
                    <p className="text-muted-foreground">No expenses recorded this month</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscriptions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Active Subscriptions</CardTitle>
                  <CardDescription>
                    Monthly total: ${dashboardData?.monthlySubscriptionCost?.toFixed(2) || '0'}
                  </CardDescription>
                </div>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Subscription
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {subscriptions?.length ? (
                    subscriptions.map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{sub.service_name}</p>
                          <p className="text-sm text-muted-foreground">{sub.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${Number(sub.amount).toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">{sub.billing_cycle}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No subscriptions tracked</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Financial Insights
                </CardTitle>
                <CardDescription>
                  {dashboardData?.activeInsights || 0} active insights, {dashboardData?.criticalInsights || 0} critical
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {insights?.length ? (
                    insights.map((insight) => (
                      <div 
                        key={insight.id} 
                        className={`p-4 border rounded-lg ${
                          insight.severity === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-900/10' :
                          insight.severity === 'warning' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10' :
                          insight.severity === 'opportunity' ? 'border-green-500 bg-green-50 dark:bg-green-900/10' :
                          'border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={
                                insight.severity === 'critical' ? 'destructive' :
                                insight.severity === 'warning' ? 'secondary' :
                                'default'
                              }>
                                {insight.severity}
                              </Badge>
                              <span className="text-sm text-muted-foreground">{insight.insight_type}</span>
                            </div>
                            <p className="font-medium">{insight.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                          </div>
                          {insight.severity === 'critical' && (
                            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                          )}
                        </div>
                        {insight.recommendations && insight.recommendations.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-sm font-medium mb-1">Recommendations:</p>
                            <ul className="text-sm text-muted-foreground list-disc list-inside">
                              {insight.recommendations.map((rec, i) => (
                                <li key={i}>{rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No active insights</p>
                      <p className="text-sm">Financial AI is monitoring your data</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
