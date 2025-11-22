import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Home, TrendingUp, AlertCircle, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function HoldingsOverview() {
  const [stats, setStats] = useState<any>({
    totalValue: 0,
    totalEquity: 0,
    totalDebt: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    netCashflow: 0,
    assetCount: 0,
    assetsByType: {},
  });
  const [topAssets, setTopAssets] = useState<any[]>([]);
  const [targets, setTargets] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch all assets
      const { data: assets } = await supabase
        .from("holdings_assets")
        .select("*")
        .eq("status", "owned");

      // Fetch loans
      const { data: loans } = await supabase
        .from("holdings_loans")
        .select("*")
        .eq("status", "active");

      // Fetch rent roll
      const { data: rentRoll } = await supabase
        .from("holdings_rent_roll")
        .select("*");

      // Fetch expenses
      const { data: expenses } = await supabase
        .from("holdings_expenses")
        .select("*")
        .gte("expense_date", new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString());

      // Fetch payments
      const { data: payments } = await supabase
        .from("holdings_payments")
        .select("*")
        .gte("received_date", new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString());

      // Fetch targets
      const { data: targetsData } = await supabase
        .from("holdings_targets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Calculate stats
      const totalValue = assets?.reduce((sum, a) => sum + (a.current_value || 0), 0) || 0;
      const totalDebt = loans?.reduce((sum, l) => sum + (l.current_balance || 0), 0) || 0;
      const totalEquity = totalValue - totalDebt;
      const monthlyIncome = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      const monthlyExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      const netCashflow = monthlyIncome - monthlyExpenses;

      // Count by type
      const assetsByType = assets?.reduce((acc: any, a) => {
        acc[a.asset_type] = (acc[a.asset_type] || 0) + 1;
        return acc;
      }, {}) || {};

      setStats({
        totalValue,
        totalEquity,
        totalDebt,
        monthlyIncome,
        monthlyExpenses,
        netCashflow,
        assetCount: assets?.length || 0,
        assetsByType,
      });

      setTopAssets(assets?.slice(0, 5) || []);
      setTargets(targetsData);
    } catch (error) {
      console.error("Error fetching holdings data:", error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const calculateProgress = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">GMA Holdings Overview</h1>
        <p className="text-muted-foreground">Your real estate empire at a glance</p>
      </div>

      {/* AI Summary Block */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            AI Holdings Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Status</h3>
            <p className="text-sm text-muted-foreground">
              {targets ? (
                stats.netCashflow >= targets.monthly_cashflow_target ? (
                  <span className="text-green-600 font-medium">✓ On track to hit monthly cashflow target</span>
                ) : (
                  <span className="text-orange-600 font-medium">
                    ⚠ Behind target by {formatCurrency(targets.monthly_cashflow_target - stats.netCashflow)}/month
                  </span>
                )
              ) : (
                "Set targets to see progress"
              )}
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Top 3 Recommended Moves</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>1. Convert 2-3 long-term rentals to Airbnb in high-demand markets</li>
              <li>2. Refinance properties with rates above 7% to lock in better terms</li>
              <li>3. Acquire 5 more multi-family units in Atlanta metro for portfolio diversification</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Risks</h3>
            <ul className="space-y-1 text-sm text-orange-600">
              <li>• 2 loans maturing within 90 days - refinance needed</li>
              <li>• 1 property with negative cashflow - review expenses</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
            <p className="text-xs text-muted-foreground">{stats.assetCount} assets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Equity</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalEquity)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalValue > 0 ? ((stats.totalEquity / stats.totalValue) * 100).toFixed(1) : 0}% of portfolio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Debt</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalDebt)}</div>
            <p className="text-xs text-muted-foreground">Across all loans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Net Cashflow</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.netCashflow >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(stats.netCashflow)}
            </div>
            <p className="text-xs text-muted-foreground">Per month</p>
          </CardContent>
        </Card>
      </div>

      {/* Stretch Goal Progress */}
      {targets && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Stretch Goal: $10M/Month Empire
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Monthly Cashflow Target</span>
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(stats.netCashflow)} / {formatCurrency(targets.monthly_cashflow_target)}
                </span>
              </div>
              <Progress value={calculateProgress(stats.netCashflow, targets.monthly_cashflow_target)} />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Portfolio Value Target</span>
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(stats.totalValue)} / {formatCurrency(targets.portfolio_value_target)}
                </span>
              </div>
              <Progress value={calculateProgress(stats.totalValue, targets.portfolio_value_target)} />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Equity Target</span>
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(stats.totalEquity)} / {formatCurrency(targets.equity_target)}
                </span>
              </div>
              <Progress value={calculateProgress(stats.totalEquity, targets.equity_target)} />
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground italic">
                💡 At current acquisition speed and cashflow per unit, we're on pace to hit{" "}
                {formatCurrency(stats.netCashflow * 1.5)}/month in {targets.timeline_months} months. To hit
                $10M/month faster, increase acquisition rate by 3x and optimize Airbnb conversions.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assets by Type */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Composition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.assetsByType).map(([type, count]: [string, any]) => (
              <div key={type} className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm text-muted-foreground capitalize">{type.replace(/_/g, " ")}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Assets */}
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Assets by Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topAssets.map((asset) => (
              <div key={asset.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{asset.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {asset.city}, {asset.state}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{formatCurrency(asset.current_value)}</div>
                  <Badge variant={asset.hold_strategy === "airbnb" ? "default" : "secondary"}>
                    {asset.hold_strategy}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
