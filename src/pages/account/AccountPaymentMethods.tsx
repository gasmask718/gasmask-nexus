import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAccount } from "@/hooks/useCustomerAccount";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Trash2, Star } from "lucide-react";

interface PaymentMethodRow {
  id: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean | null;
  stripe_customer_id: string | null;
}

export default function AccountPaymentMethods() {
  const { profile, loading: profileLoading } = useCustomerAccount();
  const [methods, setMethods] = useState<PaymentMethodRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!profile?.stripe_customer_id) {
      setMethods([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("customer_payment_methods" as any)
      .select("*")
      .eq("stripe_customer_id", profile.stripe_customer_id)
      .order("is_default", { ascending: false });
    if (error) {
      toast.error(`Failed to load payment methods: ${error.message}`);
    } else {
      setMethods((data || []) as any as PaymentMethodRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (profileLoading) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading, profile?.stripe_customer_id]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("customer_payment_methods" as any).delete().eq("id", id);
    if (error) {
      toast.error(`Failed to remove card: ${error.message}`);
      return;
    }
    toast.success("Card removed");
    load();
  };

  const handleSetDefault = async (id: string) => {
    if (!profile?.stripe_customer_id) return;
    const { error: clearError } = await supabase
      .from("customer_payment_methods" as any)
      .update({ is_default: false })
      .eq("stripe_customer_id", profile.stripe_customer_id);
    if (clearError) {
      toast.error(`Failed to update defaults: ${clearError.message}`);
      return;
    }
    const { error } = await supabase.from("customer_payment_methods" as any).update({ is_default: true }).eq("id", id);
    if (error) {
      toast.error(`Failed to set default card: ${error.message}`);
      return;
    }
    toast.success("Default card updated");
    load();
  };

  if (profileLoading || loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Payment Methods</h1>

      {!profile?.stripe_customer_id || methods.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground max-w-sm mx-auto">
              You don't have any saved cards yet. Cards are saved automatically when you opt in to
              "save this card" during checkout with Stripe.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {methods.map((m) => (
            <Card key={m.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base capitalize">{m.brand || "Card"} •••• {m.last4}</CardTitle>
                  {m.is_default && <Badge>Default</Badge>}
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Expires {String(m.exp_month).padStart(2, "0")}/{m.exp_year}
              </CardContent>
              <CardFooter className="flex gap-2">
                {!m.is_default && (
                  <Button variant="outline" size="sm" onClick={() => handleSetDefault(m.id)}>
                    <Star className="h-3.5 w-3.5 mr-1" />
                    Set default
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => handleDelete(m.id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1 text-destructive" />
                  Remove
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
