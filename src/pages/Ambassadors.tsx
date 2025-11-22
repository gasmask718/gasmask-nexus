import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, DollarSign, TrendingUp, Award } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

export default function Ambassadors() {
  const { toast } = useToast();
  const { data: ambassadorData } = useQuery({
    queryKey: ["current-ambassador"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("ambassadors")
        .select(`
          *,
          profiles(name, email),
          ambassador_links(entity_type, entity_id),
          ambassador_commissions(amount, status, created_at, entity_type)
        `)
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const totalEarnings = ambassadorData?.total_earnings || 0;
  const pendingEarnings = ambassadorData?.ambassador_commissions
    ?.filter((c: any) => c.status === "pending")
    .reduce((sum: number, c: any) => sum + parseFloat(c.amount), 0) || 0;
  
  const storesEnrolled = ambassadorData?.ambassador_links
    ?.filter((l: any) => l.entity_type === "store").length || 0;
  
  const wholesalersEnrolled = ambassadorData?.ambassador_links
    ?.filter((l: any) => l.entity_type === "wholesaler").length || 0;

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "legendary": return "text-yellow-500";
      case "elite": return "text-purple-500";
      case "rising": return "text-blue-500";
      default: return "text-muted-foreground";
    }
  };

  const getTierProgress = (tier: string) => {
    switch (tier) {
      case "legendary": return 100;
      case "elite": return 75;
      case "rising": return 50;
      default: return 25;
    }
  };

  if (!ambassadorData) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Card className="p-12 text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Not an Ambassador Yet</h2>
            <p className="text-muted-foreground mb-6">
              Contact admin to become a GasMask Ambassador
            </p>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Ambassador Dashboard</h1>
          <p className="text-muted-foreground">
            Track your performance and earnings
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Earnings</p>
                <p className="text-2xl font-bold">${totalEarnings.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">${pendingEarnings.toFixed(2)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-yellow-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Stores Enrolled</p>
                <p className="text-2xl font-bold">{storesEnrolled}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Wholesalers</p>
                <p className="text-2xl font-bold">{wholesalersEnrolled}</p>
              </div>
              <Award className="h-8 w-8 text-purple-500" />
            </div>
          </Card>
        </div>

        {/* Tier Status */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Ambassador Tier</h3>
                <p className="text-sm text-muted-foreground">
                  Your current performance level
                </p>
              </div>
              <Badge className={`${getTierColor(ambassadorData.tier)} text-lg px-4 py-2`}>
                {ambassadorData.tier.toUpperCase()}
              </Badge>
            </div>
            <Progress value={getTierProgress(ambassadorData.tier)} className="h-2" />
            <p className="text-sm text-muted-foreground">
              Keep growing your network to reach the next tier!
            </p>
          </div>
        </Card>

        {/* Tracking Code */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Your Tracking Code</h3>
          <div className="flex gap-2">
            <Input 
              value={ambassadorData.tracking_code} 
              readOnly 
              className="font-mono"
            />
            <Button
              onClick={() => {
                navigator.clipboard.writeText(ambassadorData.tracking_code);
                toast({ title: "Copied to clipboard" });
              }}
            >
              Copy
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Share this code with stores and wholesalers to earn commissions
          </p>
        </Card>

        {/* Recent Commissions */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Commissions</h3>
          <div className="space-y-3">
            {ambassadorData.ambassador_commissions
              ?.slice(0, 10)
              .map((commission: any) => (
                <div
                  key={commission.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {commission.entity_type.replace("_", " ").toUpperCase()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(commission.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">
                      +${parseFloat(commission.amount).toFixed(2)}
                    </p>
                    <Badge variant={commission.status === "paid" ? "default" : "secondary"}>
                      {commission.status}
                    </Badge>
                  </div>
                </div>
              ))}
            {(!ambassadorData.ambassador_commissions || 
              ambassadorData.ambassador_commissions.length === 0) && (
              <p className="text-center text-muted-foreground py-8">
                No commissions yet. Start referring to earn!
              </p>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
}