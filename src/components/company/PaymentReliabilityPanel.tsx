import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Star, TrendingUp, TrendingDown, DollarSign, Clock, AlertTriangle, CheckCircle } from "lucide-react";

interface PaymentReliabilityPanelProps {
  companyId: string;
}

export function PaymentReliabilityPanel({ companyId }: PaymentReliabilityPanelProps) {
  const { data: paymentStats } = useQuery({
    queryKey: ["payment-reliability", companyId],
    queryFn: async () => {
      // Get all invoices for this company
      const { data: invoices } = await supabase
        .from("invoices")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      // Get all payments for this company
      const { data: payments } = await supabase
        .from("store_payments")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (!invoices || invoices.length === 0) {
        return {
          score: 50,
          tier: "middle",
          totalInvoices: 0,
          paidOnTime: 0,
          paidLate: 0,
          unpaid: 0,
          partial: 0,
          avgDaysToPayment: 0,
          totalOwed: 0,
          totalPaid: 0,
          paymentMethods: {},
        };
      }

      // Calculate metrics
      const paidOnTime = invoices.filter(inv => 
        inv.payment_status === "paid" && 
        inv.paid_at && 
        new Date(inv.paid_at) <= new Date(inv.due_date)
      ).length;

      const paidLate = invoices.filter(inv => 
        inv.payment_status === "paid" && 
        inv.paid_at && 
        new Date(inv.paid_at) > new Date(inv.due_date)
      ).length;

      const unpaid = invoices.filter(inv => inv.payment_status === "unpaid" || inv.payment_status === "overdue").length;
      const partial = invoices.filter(inv => inv.payment_status === "partial").length;

      // Calculate average days to payment
      const paidInvoices = invoices.filter(inv => inv.paid_at);
      let totalDaysToPayment = 0;
      paidInvoices.forEach(inv => {
        const created = new Date(inv.created_at);
        const paid = new Date(inv.paid_at!);
        totalDaysToPayment += Math.floor((paid.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      });
      const avgDaysToPayment = paidInvoices.length > 0 ? Math.round(totalDaysToPayment / paidInvoices.length) : 0;

      // Calculate totals
      const totalOwed = invoices
        .filter(inv => inv.payment_status !== "paid")
        .reduce((sum, inv) => sum + Number(inv.total || inv.total_amount || 0), 0);

      const totalPaid = invoices
        .filter(inv => inv.payment_status === "paid")
        .reduce((sum, inv) => sum + Number(inv.total || inv.total_amount || 0), 0);

      // Payment methods breakdown
      const paymentMethods: Record<string, number> = {};
      payments?.forEach(p => {
        const method = p.payment_method || "unknown";
        paymentMethods[method] = (paymentMethods[method] || 0) + Number(p.paid_amount || 0);
      });

      // Calculate score (0-100)
      const totalInvoices = invoices.length;
      let score = 50; // Base score

      if (totalInvoices > 0) {
        // On-time payments boost score
        score += (paidOnTime / totalInvoices) * 30;
        // Late payments reduce score
        score -= (paidLate / totalInvoices) * 15;
        // Unpaid significantly reduces score
        score -= (unpaid / totalInvoices) * 25;
        // Partial payments slightly reduce score
        score -= (partial / totalInvoices) * 10;
      }

      score = Math.max(0, Math.min(100, Math.round(score)));

      // Determine tier
      let tier = "middle";
      if (score >= 85) tier = "elite";
      else if (score >= 70) tier = "solid";
      else if (score >= 50) tier = "middle";
      else if (score >= 30) tier = "concerning";
      else tier = "danger";

      return {
        score,
        tier,
        totalInvoices,
        paidOnTime,
        paidLate,
        unpaid,
        partial,
        avgDaysToPayment,
        totalOwed,
        totalPaid,
        paymentMethods,
      };
    },
    enabled: !!companyId,
  });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "elite": return "text-yellow-500";
      case "solid": return "text-green-500";
      case "middle": return "text-gray-400";
      case "concerning": return "text-orange-500";
      case "danger": return "text-red-500";
      default: return "text-gray-400";
    }
  };

  const getTierStars = (tier: string) => {
    switch (tier) {
      case "elite": return 5;
      case "solid": return 4;
      case "middle": return 3;
      case "concerning": return 2;
      case "danger": return 1;
      default: return 3;
    }
  };

  const stars = getTierStars(paymentStats?.tier || "middle");
  const tierColor = getTierColor(paymentStats?.tier || "middle");

  return (
    <div className="space-y-4">
      {/* Score Overview */}
      <Card className="border-2" style={{ borderColor: `hsl(var(--${paymentStats?.score && paymentStats.score >= 70 ? 'green' : paymentStats?.score && paymentStats.score >= 50 ? 'yellow' : 'red'}-500))` }}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Payment Reliability Score</p>
              <div className="flex items-center gap-2 mt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-6 w-6 ${i < stars ? tierColor + " fill-current" : "text-muted"}`}
                  />
                ))}
              </div>
            </div>
            <div className="text-right">
              <p className={`text-4xl font-bold ${tierColor}`}>{paymentStats?.score || 50}</p>
              <Badge variant="outline" className={tierColor}>
                {paymentStats?.tier?.toUpperCase() || "MIDDLE"}
              </Badge>
            </div>
          </div>
          <Progress value={paymentStats?.score || 50} className="h-2" />
        </CardContent>
      </Card>

      {/* Payment Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">On-Time</span>
            </div>
            <p className="text-xl font-bold text-green-500">{paymentStats?.paidOnTime || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Late</span>
            </div>
            <p className="text-xl font-bold text-yellow-500">{paymentStats?.paidLate || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Unpaid</span>
            </div>
            <p className="text-xl font-bold text-red-500">{paymentStats?.unpaid || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Partial</span>
            </div>
            <p className="text-xl font-bold text-orange-500">{paymentStats?.partial || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Financial Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Paid</span>
            <span className="font-bold text-green-500">${paymentStats?.totalPaid?.toLocaleString() || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Outstanding</span>
            <span className="font-bold text-red-500">${paymentStats?.totalOwed?.toLocaleString() || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Avg Days to Payment</span>
            <span className="font-bold">{paymentStats?.avgDaysToPayment || 0} days</span>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Payment Methods</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(paymentStats?.paymentMethods || {}).map(([method, amount]) => (
              <div key={method} className="flex items-center justify-between">
                <Badge variant="outline" className="capitalize">{method}</Badge>
                <span className="font-medium">${(amount as number).toLocaleString()}</span>
              </div>
            ))}
            {Object.keys(paymentStats?.paymentMethods || {}).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No payment history</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
