import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Package, TrendingUp, Clock, BarChart3, Zap } from "lucide-react";

const TOBACCO_BRANDS = ["gasmask", "hotmama", "hotscolati", "grabba_r_us"];

interface TubeMathEngineProps {
  companyId: string;
}

const brandColors: Record<string, string> = {
  gasmask: "bg-red-600",
  hotmama: "bg-rose-400",
  hotscolati: "bg-red-700",
  grabba_r_us: "bg-purple-500",
};

export function TubeMathEngine({ companyId }: TubeMathEngineProps) {
  const { data: tubeStats, isLoading } = useQuery({
    queryKey: ["tube-math", companyId],
    queryFn: async () => {
      // Get all orders for this company - filter to tobacco brands only
      const { data: orders } = await supabase
        .from("wholesale_orders")
        .select("*")
        .eq("company_id", companyId)
        .in("brand", TOBACCO_BRANDS)
        .order("created_at", { ascending: true });

      if (!orders || orders.length === 0) {
        return {
          totalTubesPurchased: 0,
          totalBoxes: 0,
          avgTubesPerOrder: 0,
          avgDaysBetweenOrders: 0,
          estimatedInventory: 0,
          avgTubesPerWeek: 0,
          etaPrediction: 0,
          brandBreakdown: {} as Record<string, number>,
        };
      }

      // Calculate totals
      const totalTubes = orders.reduce((sum, o) => sum + (o.tubes_total || (o.boxes || 0) * 100), 0);
      const totalBoxes = orders.reduce((sum, o) => sum + (o.boxes || 0), 0);

      // Calculate time between orders
      let totalDaysBetween = 0;
      for (let i = 1; i < orders.length; i++) {
        const prev = new Date(orders[i - 1].created_at);
        const curr = new Date(orders[i].created_at);
        totalDaysBetween += Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      }
      const avgDaysBetweenOrders = orders.length > 1 ? Math.round(totalDaysBetween / (orders.length - 1)) : 30;

      // Estimate weekly consumption
      const firstOrder = new Date(orders[0].created_at);
      const lastOrder = new Date(orders[orders.length - 1].created_at);
      const weeksBetween = Math.max(1, Math.floor((lastOrder.getTime() - firstOrder.getTime()) / (1000 * 60 * 60 * 24 * 7)));
      const avgTubesPerWeek = Math.round(totalTubes / weeksBetween);

      // Estimate current inventory (last order tubes - estimated consumption)
      const lastOrderTubes = orders[orders.length - 1].tubes_total || (orders[orders.length - 1].boxes || 0) * 100;
      const daysSinceLastOrder = Math.floor((Date.now() - lastOrder.getTime()) / (1000 * 60 * 60 * 24));
      const estimatedConsumption = Math.round((avgTubesPerWeek / 7) * daysSinceLastOrder);
      const estimatedInventory = Math.max(0, lastOrderTubes - estimatedConsumption);

      // ETA prediction (days until next order needed)
      const tubesPerDay = avgTubesPerWeek / 7;
      const etaPrediction = tubesPerDay > 0 ? Math.round(estimatedInventory / tubesPerDay) : 0;

      // Brand breakdown
      const brandBreakdown: Record<string, number> = {};
      orders.forEach((o) => {
        const brand = o.brand || "unknown";
        if (TOBACCO_BRANDS.includes(brand)) {
          brandBreakdown[brand] = (brandBreakdown[brand] || 0) + (o.tubes_total || (o.boxes || 0) * 100);
        }
      });

      return {
        totalTubesPurchased: totalTubes,
        totalBoxes,
        avgTubesPerOrder: Math.round(totalTubes / orders.length),
        avgDaysBetweenOrders,
        estimatedInventory,
        avgTubesPerWeek,
        etaPrediction,
        brandBreakdown,
      };
    },
    enabled: !!companyId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total Tubes</span>
            </div>
            <p className="text-2xl font-bold">{tubeStats?.totalTubesPurchased?.toLocaleString() || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Total Boxes</span>
            </div>
            <p className="text-2xl font-bold">{tubeStats?.totalBoxes || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Tubes/Week</span>
            </div>
            <p className="text-2xl font-bold">{tubeStats?.avgTubesPerWeek || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Avg Order Interval</span>
            </div>
            <p className="text-2xl font-bold">{tubeStats?.avgDaysBetweenOrders || 0} days</p>
          </CardContent>
        </Card>
      </div>

      {/* Inventory & ETA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Inventory Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Estimated Inventory</span>
            <span className="font-bold">{tubeStats?.estimatedInventory?.toLocaleString() || 0} tubes</span>
          </div>
          <Progress 
            value={Math.min(((tubeStats?.estimatedInventory || 0) / (tubeStats?.avgTubesPerOrder || 100)) * 100, 100)} 
            className="h-2"
          />
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-sm">Next Order Prediction</span>
            <Badge variant={tubeStats?.etaPrediction && tubeStats.etaPrediction < 7 ? "destructive" : "secondary"}>
              {tubeStats?.etaPrediction || 0} days
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Brand Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Brand Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(tubeStats?.brandBreakdown || {}).map(([brand, tubes]) => (
              <div key={brand} className="flex items-center gap-3">
                <Badge className={brandColors[brand] || "bg-gray-500"}>
                  {brand.replace("_", " ")}
                </Badge>
                <div className="flex-1">
                  <Progress 
                    value={(tubes / (tubeStats?.totalTubesPurchased || 1)) * 100} 
                    className="h-2"
                  />
                </div>
                <span className="text-sm font-medium w-20 text-right">
                  {tubes.toLocaleString()}
                </span>
              </div>
            ))}
            {Object.keys(tubeStats?.brandBreakdown || {}).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No order history</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}