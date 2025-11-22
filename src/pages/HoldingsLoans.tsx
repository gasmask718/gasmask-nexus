import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, AlertCircle, TrendingDown, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function HoldingsLoans() {
  const [loans, setLoans] = useState<any[]>([]);
  const [totalDebt, setTotalDebt] = useState(0);
  const [avgInterestRate, setAvgInterestRate] = useState(0);
  const [maturingSoon, setMaturingSoon] = useState<any[]>([]);

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    try {
      const { data } = await supabase
        .from("holdings_loans")
        .select(`
          *,
          holdings_assets(name, address, city, state, current_value)
        `)
        .eq("status", "active")
        .order("maturity_date", { ascending: true });

      if (data) {
        setLoans(data);

        // Calculate totals
        const debt = data.reduce((sum, loan) => sum + (loan.current_balance || 0), 0);
        setTotalDebt(debt);

        // Calculate weighted average interest rate
        const totalWeighted = data.reduce(
          (sum, loan) => sum + (loan.current_balance * loan.interest_rate || 0),
          0
        );
        setAvgInterestRate(debt > 0 ? totalWeighted / debt : 0);

        // Find loans maturing within 90 days
        const ninetyDaysFromNow = new Date();
        ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

        const maturing = data.filter((loan) => {
          const maturityDate = new Date(loan.maturity_date);
          return maturityDate <= ninetyDaysFromNow;
        });
        setMaturingSoon(maturing);
      }
    } catch (error) {
      console.error("Error fetching loans:", error);
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

  const getLoanTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      hard_money: "destructive",
      dscr: "default",
      conventional: "secondary",
      private: "outline",
      portfolio: "default",
      heloc: "secondary",
    };
    return colors[type] || "default";
  };

  const calculateLTV = (loanBalance: number, propertyValue: number) => {
    if (propertyValue === 0) return 0;
    return (loanBalance / propertyValue) * 100;
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Loans & Lenders</h1>
        <p className="text-muted-foreground">Manage debt and financing</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Debt</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalDebt)}</div>
            <p className="text-xs text-muted-foreground">{loans.length} active loans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Interest Rate</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgInterestRate.toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground">Weighted average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Maturing Soon</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{maturingSoon.length}</div>
            <p className="text-xs text-muted-foreground">Within 90 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Maturing Loans Alert */}
      {maturingSoon.length > 0 && (
        <Card className="border-orange-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="h-5 w-5" />
              Loans Maturing Soon - Action Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {maturingSoon.map((loan) => (
                <div key={loan.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{loan.holdings_assets?.name}</div>
                    <div className="text-sm text-muted-foreground">{loan.lender_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-orange-600">Matures: {formatDate(loan.maturity_date)}</div>
                    <div className="text-sm text-muted-foreground">{formatCurrency(loan.current_balance)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Loans */}
      <Card>
        <CardHeader>
          <CardTitle>All Active Loans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loans.map((loan) => (
              <div key={loan.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{loan.holdings_assets?.name}</span>
                      <Badge variant={getLoanTypeColor(loan.loan_type) as any}>
                        {loan.loan_type.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {loan.holdings_assets?.city}, {loan.holdings_assets?.state}
                    </div>
                    <div className="text-sm font-medium mt-1">{loan.lender_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">{formatCurrency(loan.current_balance)}</div>
                    <div className="text-xs text-muted-foreground">Current Balance</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t text-sm">
                  <div>
                    <div className="text-muted-foreground">Original Balance</div>
                    <div className="font-medium">{formatCurrency(loan.original_balance)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Interest Rate</div>
                    <div className="font-medium">{loan.interest_rate.toFixed(2)}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Monthly Payment</div>
                    <div className="font-medium">{formatCurrency(loan.total_monthly_payment)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">LTV</div>
                    <div className="font-medium">
                      {calculateLTV(loan.current_balance, loan.holdings_assets?.current_value || 0).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Maturity Date</div>
                    <div className="font-medium">{formatDate(loan.maturity_date)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Amortization</div>
                    <div className="font-medium">{loan.amortization_years || "N/A"} years</div>
                  </div>
                  {loan.dscr_covenant && (
                    <div>
                      <div className="text-muted-foreground">DSCR Covenant</div>
                      <div className="font-medium">{loan.dscr_covenant}x minimum</div>
                    </div>
                  )}
                </div>

                {loan.interest_rate > 7 && (
                  <div className="pt-3 border-t">
                    <div className="flex items-center gap-2 text-sm text-orange-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>High interest rate - Consider refinancing to lock in better terms</span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loans.length === 0 && (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No active loans yet. Add loan details for your properties.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
