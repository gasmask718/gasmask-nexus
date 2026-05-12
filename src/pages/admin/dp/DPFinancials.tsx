import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { dp, fmtMoney, monthStartISO } from "@/lib/dpClient";
import { Download } from "lucide-react";

export default function DPFinancials() {
  const { data, isLoading } = useQuery({
    queryKey: ["dp-financials"],
    queryFn: async () => {
      const monthStart = monthStartISO(0);

      const [entry, mrr, addons, payAmb, payPart, csDyn] = await Promise.all([
        dp().from("partners").select("entry_fee_amount, entry_fee_paid_at").gte("entry_fee_paid_at", monthStart),
        dp().from("mrr_subscriptions").select("monthly_amount_cents, status").eq("status", "active"),
        dp().from("add_ons").select("amount_cents, purchased_at").gte("purchased_at", monthStart),
        dp().from("payouts").select("total_amount_cents, processed_at, recipient_type, status")
          .eq("recipient_type", "ambassador").eq("status", "completed").gte("processed_at", monthStart),
        dp().from("payouts").select("total_amount_cents, processed_at, recipient_type, status")
          .eq("recipient_type", "partner").eq("status", "completed").gte("processed_at", monthStart),
        dp().from("commission_splits").select("dynasty_share_cents, created_at").gte("created_at", monthStart),
      ]);

      const sum = (rows: any[] | null | undefined, key: string) =>
        (rows ?? []).reduce((s, r) => s + (r[key] ?? 0), 0);

      return {
        entryIn: sum(entry.data, "entry_fee_amount"),
        mrrIn: sum(mrr.data, "monthly_amount_cents"),
        addonIn: sum(addons.data, "amount_cents"),
        ambassadorOut: sum(payAmb.data, "total_amount_cents"),
        partnerOut: sum(payPart.data, "total_amount_cents"),
        dynastyNet: sum(csDyn.data, "dynasty_share_cents"),
      };
    },
  });

  if (isLoading) return <div>Loading…</div>;

  const totalIn = data!.entryIn + data!.mrrIn + data!.addonIn;
  const totalOut = data!.ambassadorOut + data!.partnerOut;

  const exportCsv = () => {
    const rows = [
      ["Metric", "Amount (USD)"],
      ["Entry fees", (data!.entryIn / 100).toFixed(2)],
      ["MRR collected (active)", (data!.mrrIn / 100).toFixed(2)],
      ["Add-ons", (data!.addonIn / 100).toFixed(2)],
      ["Total in", (totalIn / 100).toFixed(2)],
      ["Paid to ambassadors", (data!.ambassadorOut / 100).toFixed(2)],
      ["Paid to partners", (data!.partnerOut / 100).toFixed(2)],
      ["Total out", (totalOut / 100).toFixed(2)],
      ["Dynasty net (commission share)", (data!.dynastyNet / 100).toFixed(2)],
      ["Net to Dynasty (in - out)", ((totalIn - totalOut) / 100).toFixed(2)],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `dp-financials-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const block = (label: string, items: { name: string; cents: number }[], total: number) => (
    <Card>
      <CardHeader><CardTitle>{label}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.map((i) => (
          <div key={i.name} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{i.name}</span>
            <span className="font-mono">{fmtMoney(i.cents)}</span>
          </div>
        ))}
        <div className="border-t pt-2 flex justify-between font-semibold">
          <span>Total</span><span className="font-mono">{fmtMoney(total)}</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Financial Overview (this month)</h2>
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {block("Revenue in", [
          { name: "Entry fees", cents: data!.entryIn },
          { name: "MRR", cents: data!.mrrIn },
          { name: "Add-ons", cents: data!.addonIn },
        ], totalIn)}
        {block("Payouts out", [
          { name: "To ambassadors", cents: data!.ambassadorOut },
          { name: "To partners", cents: data!.partnerOut },
        ], totalOut)}
        <Card className="border-primary">
          <CardHeader><CardTitle>Net to Dynasty</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{fmtMoney(totalIn - totalOut)}</div>
            <div className="text-xs text-muted-foreground mt-2">Commission share booked: {fmtMoney(data!.dynastyNet)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Stripe Connect balance</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Live Stripe balance lookup is performed by the <code className="text-xs">stripe-balance</code> backend function — wire it via Lovable Cloud → Stripe Connect to display reserves and available balance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
