import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CreditCard, Loader2, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useClientPortal } from "./ClientPortalPage";

export default function ClientBilling() {
  const { client } = useClientPortal();
  const [loading, setLoading] = useState(false);

  const openPortal = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("brandaro-client-billing-portal", {
        body: { return_url: `${window.location.origin}/client-portal/billing` },
      });
      if (error) throw new Error(error.message);
      const url = (data as any)?.url;
      if (!url) throw new Error((data as any)?.error ?? "No billing portal URL returned");
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Could not open billing portal", { duration: 8000 });
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Billing</h2>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Current plan</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-8">
          <div>
            <p className="text-xs text-muted-foreground">Plan</p>
            <p className="text-lg font-semibold capitalize flex items-center gap-2">
              {client.plan}
              <Badge
                variant="outline"
                className={
                  client.status === "active"
                    ? "border-emerald-500/30 text-emerald-600"
                    : "border-amber-500/30 text-amber-600"
                }
              >
                {client.status}
              </Badge>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Monthly price</p>
            <p className="text-lg font-semibold">{formatCurrency(client.monthly_amount)}/mo</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Next billing date</p>
            <p className="text-lg font-semibold">
              {client.next_billing_date
                ? new Date(client.next_billing_date).toLocaleDateString()
                : "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            Update your card, download invoices, or cancel your plan in the secure Stripe billing portal.
          </p>
          <Button onClick={openPortal} disabled={loading || !client.stripe_customer_id}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="mr-2 h-4 w-4" />
            )}
            Manage Billing
            <ExternalLink className="ml-2 h-3 w-3" />
          </Button>
          {!client.stripe_customer_id && (
            <p className="text-xs text-muted-foreground">
              No billing account is linked yet — contact support if you've already paid.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
