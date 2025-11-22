import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Award, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Leaderboard() {
  const { data: leaderboard } = useQuery({
    queryKey: ["driver-leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_rewards")
        .select("*, profiles!driver_rewards_driver_id_fkey(name, avatar_url)")
        .order("total_xp", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "diamond": return "text-blue-400";
      case "gold": return "text-yellow-400";
      case "silver": return "text-gray-400";
      default: return "text-orange-400";
    }
  };

  const getTierIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-400" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400" />;
    if (rank === 3) return <Award className="h-6 w-6 text-orange-400" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Driver Leaderboard</h1>
            <p className="text-muted-foreground">Top performers and rising stars</p>
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Time</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4 mt-6">
            {leaderboard?.map((driver, index) => (
              <Card key={driver.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="text-2xl font-bold text-muted-foreground w-8">
                        {index + 1}
                      </div>
                      {getTierIcon(index + 1)}
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={driver.profiles?.avatar_url} />
                        <AvatarFallback>
                          {driver.profiles?.name?.charAt(0) || "D"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-bold text-lg">{driver.profiles?.name}</div>
                        <Badge variant="outline" className={getTierColor(driver.calculated_tier)}>
                          {driver.calculated_tier.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">{driver.total_xp}</div>
                      <div className="text-sm text-muted-foreground">XP</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
