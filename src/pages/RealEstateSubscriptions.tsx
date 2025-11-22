import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Check, Crown, Star, Zap } from "lucide-react";
import { toast } from "sonner";

const TIERS = [
  {
    id: "standard",
    name: "Standard Tier",
    price: 497,
    icon: Check,
    features: [
      "Access to all wholesale deals",
      "Deal notifications within 24 hours",
      "Basic buy-box filtering",
      "Email support",
      "Up to 50 deals/month",
    ],
  },
  {
    id: "gold",
    name: "Gold Tier",
    price: 997,
    icon: Star,
    popular: true,
    features: [
      "Everything in Standard",
      "Priority access - notified within 1 hour",
      "Advanced buy-box filtering",
      "Dedicated account manager",
      "Up to 200 deals/month",
      "Exclusive off-market deals",
    ],
  },
  {
    id: "institutional_vip",
    name: "Institutional VIP",
    price: 2497,
    icon: Crown,
    features: [
      "Everything in Gold",
      "Instant deal notifications",
      "Custom AI negotiator for your preferences",
      "Unlimited deals",
      "First-look at premium deals",
      "White-glove concierge service",
      "Custom market analysis reports",
    ],
  },
];

export default function RealEstateSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const { data, error } = await supabase
        .from("investor_subscriptions")
        .select(`
          *,
          investor_buy_boxes(investor_name, contact_email)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSubscriptions(data || []);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      toast.error("Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("investor_subscriptions")
        .update({ active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success(`Subscription ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchSubscriptions();
    } catch (error) {
      console.error("Error updating subscription:", error);
      toast.error("Failed to update subscription");
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Hedge Fund Access Plans</h1>
        <p className="text-muted-foreground">
          Premium access tiers for institutional investors and hedge funds
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {TIERS.map((tier) => {
          const Icon = tier.icon;
          return (
            <Card key={tier.id} className={tier.popular ? "border-primary shadow-lg" : ""}>
              <CardHeader>
                {tier.popular && (
                  <Badge className="w-fit mb-2">Most Popular</Badge>
                )}
                <div className="flex items-center gap-2">
                  <Icon className="h-6 w-6 text-primary" />
                  <CardTitle>{tier.name}</CardTitle>
                </div>
                <div className="text-3xl font-bold mt-4">
                  ${tier.price}
                  <span className="text-lg font-normal text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant={tier.popular ? "default" : "outline"}>
                  Select Plan
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Subscriptions</CardTitle>
          <CardDescription>Manage investor subscriptions and access levels</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading subscriptions...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Investor</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Monthly Fee</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {sub.investor_buy_boxes?.investor_name || "Unknown"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {sub.investor_buy_boxes?.contact_email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {sub.tier.replace("_", " ").toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>${sub.monthly_fee.toLocaleString()}/mo</TableCell>
                    <TableCell>
                      {new Date(sub.started_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sub.active ? "default" : "secondary"}>
                        {sub.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleStatus(sub.id, sub.active)}
                      >
                        {sub.active ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
