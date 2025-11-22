import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, Brain, TrendingUp, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function HoldingsStrategy() {
  const [targets, setTargets] = useState<any>(null);
  const [formData, setFormData] = useState({
    monthly_cashflow_target: 1000000,
    portfolio_value_target: 100000000,
    equity_target: 50000000,
    timeline_months: 36,
  });
  const [currentStats, setCurrentStats] = useState({
    cashflow: 0,
    portfolioValue: 0,
    equity: 0,
    assetCount: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch current targets
      const { data: targetsData } = await supabase
        .from("holdings_targets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (targetsData) {
        setTargets(targetsData);
        setFormData({
          monthly_cashflow_target: targetsData.monthly_cashflow_target,
          portfolio_value_target: targetsData.portfolio_value_target,
          equity_target: targetsData.equity_target,
          timeline_months: targetsData.timeline_months,
        });
      }

      // Fetch current stats
      const { data: assets } = await supabase.from("holdings_assets").select("*").eq("status", "owned");

      const { data: loans } = await supabase.from("holdings_loans").select("*").eq("status", "active");

      const portfolioValue = assets?.reduce((sum, a) => sum + (a.current_value || 0), 0) || 0;
      const totalDebt = loans?.reduce((sum, l) => sum + (l.current_balance || 0), 0) || 0;

      // Get current month's cashflow
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data: expenses } = await supabase
        .from("holdings_expenses")
        .select("*")
        .gte("expense_date", thisMonthStart.toISOString().split("T")[0]);

      const { data: payments } = await supabase
        .from("holdings_payments")
        .select("*")
        .gte("received_date", thisMonthStart.toISOString().split("T")[0]);

      const income = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      const expensesTotal = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

      setCurrentStats({
        cashflow: income - expensesTotal,
        portfolioValue,
        equity: portfolioValue - totalDebt,
        assetCount: assets?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from("holdings_targets").insert([formData]);

      if (error) throw error;

      toast.success("Targets updated successfully");
      fetchData();
    } catch (error) {
      console.error("Error updating targets:", error);
      toast.error("Failed to update targets");
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

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Strategy & Targets</h1>
        <p className="text-muted-foreground">AI-powered portfolio growth strategy</p>
      </div>

      {/* AI Strategy Engine */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Real Estate CIO Strategy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold text-lg mb-3">Your Path to {formatCurrency(formData.monthly_cashflow_target)}/month:</h3>
            
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3 p-3 bg-background rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Keep {Math.ceil((formData.monthly_cashflow_target - currentStats.cashflow) / 2500)} more long-term rentals</div>
                  <div className="text-muted-foreground">Target markets: Atlanta, Nashville, Charlotte (average $2,500/mo cashflow each)</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-background rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Acquire {Math.ceil((formData.monthly_cashflow_target - currentStats.cashflow) / 8000)} new Airbnb units</div>
                  <div className="text-muted-foreground">High-demand vacation markets: Gatlinburg, Scottsdale, Miami Beach (average $8,000/mo net each)</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-background rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Maintain at least 8% average cap rate</div>
                  <div className="text-muted-foreground">Focus on value-add opportunities and emerging markets with strong fundamentals</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-background rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Refinance 3 properties with rates above 7%</div>
                  <div className="text-muted-foreground">Lock in lower rates to reduce debt service and improve cashflow by ~$5,000/mo</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-background rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Sell 2 underperforming assets</div>
                  <div className="text-muted-foreground">Properties with negative cashflow should be liquidated to fund better opportunities</div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h3 className="font-semibold mb-2">Timeline Analysis</h3>
            <p className="text-sm text-muted-foreground">
              At your current acquisition pace of {currentStats.assetCount} properties and average cashflow of{" "}
              {formatCurrency(currentStats.cashflow)}/month, you're projected to reach:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>• {formatCurrency(currentStats.cashflow * 2)}/month cashflow in 12 months</li>
              <li>• {formatCurrency(formData.monthly_cashflow_target / 2)}/month cashflow in {formData.timeline_months / 2} months</li>
              <li>• {formatCurrency(formData.monthly_cashflow_target)}/month cashflow in {formData.timeline_months} months</li>
            </ul>
            <p className="mt-3 text-sm font-medium text-primary">
              To hit {formatCurrency(formData.monthly_cashflow_target)}/month faster: Increase acquisition rate by 3x and optimize 30% of portfolio to Airbnb.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Set Targets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Set Portfolio Targets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="monthly_cashflow_target">Monthly Cashflow Target</Label>
                <Input
                  id="monthly_cashflow_target"
                  type="number"
                  value={formData.monthly_cashflow_target}
                  onChange={(e) =>
                    setFormData({ ...formData, monthly_cashflow_target: parseFloat(e.target.value) })
                  }
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Current: {formatCurrency(currentStats.cashflow)}/month
                </p>
              </div>

              <div>
                <Label htmlFor="portfolio_value_target">Portfolio Value Target</Label>
                <Input
                  id="portfolio_value_target"
                  type="number"
                  value={formData.portfolio_value_target}
                  onChange={(e) =>
                    setFormData({ ...formData, portfolio_value_target: parseFloat(e.target.value) })
                  }
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Current: {formatCurrency(currentStats.portfolioValue)}
                </p>
              </div>

              <div>
                <Label htmlFor="equity_target">Equity Target</Label>
                <Input
                  id="equity_target"
                  type="number"
                  value={formData.equity_target}
                  onChange={(e) => setFormData({ ...formData, equity_target: parseFloat(e.target.value) })}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Current: {formatCurrency(currentStats.equity)}
                </p>
              </div>

              <div>
                <Label htmlFor="timeline_months">Timeline (Months)</Label>
                <Input
                  id="timeline_months"
                  type="number"
                  value={formData.timeline_months}
                  onChange={(e) => setFormData({ ...formData, timeline_months: parseInt(e.target.value) })}
                  required
                />
              </div>
            </div>

            <Button type="submit">Update Targets</Button>
          </form>
        </CardContent>
      </Card>

      {/* Current Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Current Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{currentStats.assetCount}</div>
              <div className="text-sm text-muted-foreground">Properties Owned</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{formatCurrency(currentStats.portfolioValue)}</div>
              <div className="text-sm text-muted-foreground">Portfolio Value</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{formatCurrency(currentStats.equity)}</div>
              <div className="text-sm text-muted-foreground">Total Equity</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{formatCurrency(currentStats.cashflow)}</div>
              <div className="text-sm text-muted-foreground">Monthly Cashflow</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
