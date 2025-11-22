import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function HoldingsExpenses() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [thisMonth, setThisMonth] = useState({ income: 0, expenses: 0, cashflow: 0 });
  const [lastMonth, setLastMonth] = useState({ income: 0, expenses: 0, cashflow: 0 });
  const [negativeAssets, setNegativeAssets] = useState<any[]>([]);

  useEffect(() => {
    fetchFinancials();
  }, []);

  const fetchFinancials = async () => {
    try {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      // Fetch this month's data
      const { data: thisMonthExpenses } = await supabase
        .from("holdings_expenses")
        .select("*")
        .gte("expense_date", thisMonthStart.toISOString().split("T")[0]);

      const { data: thisMonthPayments } = await supabase
        .from("holdings_payments")
        .select("*")
        .gte("received_date", thisMonthStart.toISOString().split("T")[0]);

      // Fetch last month's data
      const { data: lastMonthExpenses } = await supabase
        .from("holdings_expenses")
        .select("*")
        .gte("expense_date", lastMonthStart.toISOString().split("T")[0])
        .lte("expense_date", lastMonthEnd.toISOString().split("T")[0]);

      const { data: lastMonthPayments } = await supabase
        .from("holdings_payments")
        .select("*")
        .gte("received_date", lastMonthStart.toISOString().split("T")[0])
        .lte("received_date", lastMonthEnd.toISOString().split("T")[0]);

      // Calculate this month
      const thisMonthIncome = thisMonthPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      const thisMonthExpensesTotal = thisMonthExpenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

      setThisMonth({
        income: thisMonthIncome,
        expenses: thisMonthExpensesTotal,
        cashflow: thisMonthIncome - thisMonthExpensesTotal,
      });

      // Calculate last month
      const lastMonthIncome = lastMonthPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      const lastMonthExpensesTotal = lastMonthExpenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

      setLastMonth({
        income: lastMonthIncome,
        expenses: lastMonthExpensesTotal,
        cashflow: lastMonthIncome - lastMonthExpensesTotal,
      });

      setExpenses(thisMonthExpenses || []);
      setPayments(thisMonthPayments || []);

      // Find negative cashflow assets
      const { data: assets } = await supabase.from("holdings_assets").select("*").eq("status", "owned");

      const negatives = [];
      for (const asset of assets || []) {
        const assetExpenses = thisMonthExpenses?.filter((e) => e.asset_id === asset.id) || [];
        const assetPayments = thisMonthPayments?.filter((p) => p.asset_id === asset.id) || [];

        const assetIncome = assetPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const assetExpensesTotal = assetExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const assetCashflow = assetIncome - assetExpensesTotal;

        if (assetCashflow < 0) {
          negatives.push({
            ...asset,
            income: assetIncome,
            expenses: assetExpensesTotal,
            cashflow: assetCashflow,
          });
        }
      }
      setNegativeAssets(negatives);
    } catch (error) {
      console.error("Error fetching financials:", error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getExpenseTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      taxes: "destructive",
      insurance: "secondary",
      utilities: "default",
      repairs: "outline",
      capex: "destructive",
      management_fee: "secondary",
      cleaning: "default",
      hoa: "outline",
      cam: "default",
      misc: "secondary",
    };
    return colors[type] || "default";
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Expenses & Cashflow</h1>
        <p className="text-muted-foreground">Track income, expenses, and profitability</p>
      </div>

      {/* Monthly Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>This Month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Income</span>
              <span className="font-bold text-green-600">{formatCurrency(thisMonth.income)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Expenses</span>
              <span className="font-bold text-red-600">{formatCurrency(thisMonth.expenses)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t">
              <span className="font-medium">Net Cashflow</span>
              <span className={`font-bold text-lg ${thisMonth.cashflow >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(thisMonth.cashflow)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Last Month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Income</span>
              <span className="font-bold text-green-600">{formatCurrency(lastMonth.income)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Expenses</span>
              <span className="font-bold text-red-600">{formatCurrency(lastMonth.expenses)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t">
              <span className="font-medium">Net Cashflow</span>
              <span className={`font-bold text-lg ${lastMonth.cashflow >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(lastMonth.cashflow)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Month-over-Month Change</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4">
            {thisMonth.cashflow >= lastMonth.cashflow ? (
              <TrendingUp className="h-8 w-8 text-green-600" />
            ) : (
              <TrendingDown className="h-8 w-8 text-red-600" />
            )}
            <div className="text-center">
              <div className="text-2xl font-bold">
                {formatCurrency(Math.abs(thisMonth.cashflow - lastMonth.cashflow))}
              </div>
              <div className="text-sm text-muted-foreground">
                {thisMonth.cashflow >= lastMonth.cashflow ? "Improvement" : "Decline"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Negative Cashflow Assets */}
      {negativeAssets.length > 0 && (
        <Card className="border-red-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Negative Cashflow Assets - Review Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {negativeAssets.map((asset) => (
                <div key={asset.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{asset.name}</div>
                    <div className="font-bold text-red-600">{formatCurrency(asset.cashflow)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Income: </span>
                      <span>{formatCurrency(asset.income)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expenses: </span>
                      <span>{formatCurrency(asset.expenses)}</span>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground italic">
                    Consider: Increase rent, reduce expenses, refinance, or sell
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Expenses */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {expenses.slice(0, 20).map((expense) => (
              <div key={expense.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getExpenseTypeColor(expense.expense_type) as any}>
                      {expense.expense_type.replace(/_/g, " ")}
                    </Badge>
                    {expense.recurring && <Badge variant="outline">Recurring</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{expense.description || "No description"}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(expense.expense_date)}</div>
                </div>
                <div className="text-right font-bold text-red-600">{formatCurrency(expense.amount)}</div>
              </div>
            ))}

            {expenses.length === 0 && (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No expenses recorded for this month.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Income</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {payments.slice(0, 20).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Badge>{payment.source_type.replace(/_/g, " ")}</Badge>
                  <div className="text-sm text-muted-foreground mt-1">{payment.notes || payment.reference || "N/A"}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(payment.received_date)}</div>
                </div>
                <div className="text-right font-bold text-green-600">{formatCurrency(payment.amount)}</div>
              </div>
            ))}

            {payments.length === 0 && (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No income recorded for this month.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
