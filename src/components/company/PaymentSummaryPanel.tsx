import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, FileText, AlertTriangle, CheckCircle, CreditCard, Banknote, Smartphone } from "lucide-react";

interface PaymentSummaryPanelProps {
  companyId: string;
}

const methodIcons: Record<string, React.ReactNode> = {
  cash: <Banknote className="h-4 w-4" />,
  zelle: <Smartphone className="h-4 w-4" />,
  cashapp: <Smartphone className="h-4 w-4" />,
  check: <FileText className="h-4 w-4" />,
  card: <CreditCard className="h-4 w-4" />,
};

export function PaymentSummaryPanel({ companyId }: PaymentSummaryPanelProps) {
  const { data: summaryStats } = useQuery({
    queryKey: ["payment-summary", companyId],
    queryFn: async () => {
      const [{ data: invoices }, { data: payments }] = await Promise.all([
        supabase.from("invoices").select("*").eq("company_id", companyId),
        supabase.from("store_payments").select("*").eq("company_id", companyId),
      ]);

      const totalOutstanding = invoices
        ?.filter(inv => inv.payment_status !== "paid")
        .reduce((sum, inv) => sum + Number(inv.total || inv.total_amount || 0), 0) || 0;

      const totalPaid = invoices
        ?.filter(inv => inv.payment_status === "paid")
        .reduce((sum, inv) => sum + Number(inv.total || inv.total_amount || 0), 0) || 0;

      const openInvoices = invoices?.filter(inv => inv.payment_status !== "paid").length || 0;
      
      const latePayments = invoices?.filter(inv => 
        inv.payment_status === "paid" && inv.paid_at && new Date(inv.paid_at) > new Date(inv.due_date)
      ).length || 0;
      
      const partialPayments = invoices?.filter(inv => inv.payment_status === "partial").length || 0;

      // Payment methods breakdown
      const methodBreakdown: Record<string, number> = {};
      payments?.forEach(p => {
        const method = p.payment_method || "unknown";
        methodBreakdown[method] = (methodBreakdown[method] || 0) + Number(p.paid_amount || 0);
      });

      return {
        totalOutstanding,
        totalPaid,
        openInvoices,
        latePayments,
        partialPayments,
        methodBreakdown,
      };
    },
    enabled: !!companyId,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Payment Status Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Financial Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-muted-foreground mb-1">Total Outstanding</p>
            <p className="text-xl font-bold text-red-400">${summaryStats?.totalOutstanding?.toLocaleString() || 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-xs text-muted-foreground mb-1">Total Paid (Lifetime)</p>
            <p className="text-xl font-bold text-emerald-400">${summaryStats?.totalPaid?.toLocaleString() || 0}</p>
          </div>
        </div>

        {/* Invoice Status */}
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            Open Invoices
          </span>
          <Badge variant="outline" className="border-orange-500/30 text-orange-400">
            {summaryStats?.openInvoices || 0}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Late Payments
          </span>
          <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
            {summaryStats?.latePayments || 0}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle className="h-4 w-4" />
            Partial Payments
          </span>
          <Badge variant="outline" className="border-blue-500/30 text-blue-400">
            {summaryStats?.partialPayments || 0}
          </Badge>
        </div>

        {/* Payment Methods */}
        {Object.keys(summaryStats?.methodBreakdown || {}).length > 0 && (
          <div className="pt-3 border-t space-y-2">
            <p className="text-xs text-muted-foreground mb-2">Payment Method Breakdown</p>
            {Object.entries(summaryStats?.methodBreakdown || {}).map(([method, amount]) => (
              <div key={method} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 capitalize">
                  {methodIcons[method] || <DollarSign className="h-4 w-4" />}
                  {method}
                </span>
                <span className="font-medium">${(amount as number).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
