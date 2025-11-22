import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star, Award, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function Rewards() {
  const { data: storeRewards } = useQuery({
    queryKey: ["store-rewards-leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_rewards")
        .select("*, stores(name, address_city, status)")
        .order("total_points", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "diamond": return "text-blue-400 border-blue-400";
      case "gold": return "text-yellow-400 border-yellow-400";
      case "silver": return "text-gray-400 border-gray-400";
      default: return "text-orange-400 border-orange-400";
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "diamond": return <Trophy className="h-5 w-5" />;
      case "gold": return <Award className="h-5 w-5" />;
      case "silver": return <Star className="h-5 w-5" />;
      default: return <TrendingUp className="h-5 w-5" />;
    }
  };

  const getTierBenefits = (tier: string) => {
    switch (tier) {
      case "diamond":
        return [
          "10% wholesale discount",
          "Priority delivery",
          "Exclusive products",
          "Featured marketplace placement",
          "Dedicated account manager",
        ];
      case "gold":
        return [
          "7% wholesale discount",
          "Fast delivery",
          "Early access to new products",
          "Featured in search",
        ];
      case "silver":
        return [
          "5% wholesale discount",
          "Standard delivery",
          "Access to promotions",
        ];
      default:
        return [
          "3% wholesale discount",
          "Standard delivery",
        ];
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Store Rewards & Rankings</h1>
          <p className="text-muted-foreground">
            Earn points and climb the tiers for exclusive benefits
          </p>
        </div>

        {/* Tier Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {["bronze", "silver", "gold", "diamond"].map((tier) => (
            <Card key={tier} className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className={getTierColor(tier)}>
                  {getTierIcon(tier)}
                </div>
                <h3 className={`font-bold text-lg ${getTierColor(tier)}`}>
                  {tier.toUpperCase()}
                </h3>
              </div>
              <ul className="space-y-2 text-sm">
                {getTierBenefits(tier).map((benefit, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        {/* Leaderboard */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-6">Top Stores</h2>
          <div className="space-y-3">
            {storeRewards?.map((reward, index) => (
              <div
                key={reward.id}
                className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                {/* Rank */}
                <div className="flex-shrink-0 w-12 text-center">
                  {index < 3 ? (
                    <div className="text-2xl">
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                    </div>
                  ) : (
                    <div className="text-xl font-bold text-muted-foreground">
                      #{index + 1}
                    </div>
                  )}
                </div>

                {/* Store Info */}
                <div className="flex-1">
                  <h3 className="font-semibold">{reward.stores?.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {reward.stores?.address_city}
                  </p>
                </div>

                {/* Tier Badge */}
                <Badge className={getTierColor(reward.tier)}>
                  <div className="flex items-center gap-1">
                    {getTierIcon(reward.tier)}
                    {reward.tier.toUpperCase()}
                  </div>
                </Badge>

                {/* Points */}
                <div className="text-right min-w-[100px]">
                  <div className="text-2xl font-bold text-primary">
                    {reward.total_points}
                  </div>
                  <div className="text-xs text-muted-foreground">points</div>
                </div>
              </div>
            ))}

            {!storeRewards || storeRewards.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No rewards data yet</p>
              </div>
            )}
          </div>
        </Card>

        {/* How to Earn Points */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">How to Earn Points</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">Place Orders</h4>
                <p className="text-sm text-muted-foreground">
                  Earn 10 points per $100 spent
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Star className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">Pay On Time</h4>
                <p className="text-sm text-muted-foreground">
                  Bonus 50 points for on-time payments
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Award className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">Complete Missions</h4>
                <p className="text-sm text-muted-foreground">
                  Up to 200 points per mission
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">High Communication Score</h4>
                <p className="text-sm text-muted-foreground">
                  100 points for consistent engagement
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}