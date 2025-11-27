import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Package, TrendingUp, Clock, Zap, BarChart3 } from "lucide-react";

const TOBACCO_BRANDS = ["gasmask", "hotmama", "hotscolati", "grabba_r_us"];

interface TubeIntelligencePanelProps {
  companyId: string;
}

export function TubeIntelligencePanel({ companyId }: TubeIntelligencePanelProps) {
  const { data: tubeStats, isLoading } = useQuery({
    queryKey: ["tube-intelligence", companyId],
    queryFn: async () => {
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
        };
      }

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

      // Weekly consumption
      const firstOrder = new Date(orders[0].created_at);
      const lastOrder = new Date(orders[orders.length - 1].created_at);
      const weeksBetween = Math.max(1, Math.floor((lastOrder.getTime() - firstOrder.getTime()) / (1000 * 60 * 60 * 24 * 7)));
      const avgTubesPerWeek = Math.round(totalTubes / weeksBetween);

      // Estimate current inventory
      const lastOrderTubes = orders[orders.length - 1].tubes_total || (orders[orders.length - 1].boxes || 0) * 100;
      const daysSinceLastOrder = Math.floor((Date.now() - lastOrder.getTime()) / (1000 * 60 * 60 * 24));
      const estimatedConsumption = Math.round((avgTubesPerWeek / 7) * daysSinceLastOrder);
      const estimatedInventory = Math.max(0, lastOrderTubes - estimatedConsumption);

      // ETA prediction
      const tubesPerDay = avgTubesPerWeek / 7;
      const etaPrediction = tubesPerDay > 0 ? Math.round(estimatedInventory / tubesPerDay) : 0;

      return {
        totalTubesPurchased: totalTubes,
        totalBoxes,
        avgTubesPerOrder: Math.round(totalTubes / orders.length),
        avgDaysBetweenOrders,
        estimatedInventory,
        avgTubesPerWeek,
        etaPrediction,
      };
    },
    enabled: !!companyId,
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
        <CardContent className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-cyan-400">
          <Zap className="h-4 w-4" />
          TUBES IN MOTION
          <Badge variant="outline" className="ml-auto text-xs border-cyan-500/30 text-cyan-400">
            AI CALCULATED
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Package className="h-3 w-3" />
              Total Tubes
            </div>
            <p className="text-xl font-bold text-white">{tubeStats?.totalTubesPurchased?.toLocaleString() || 0}</p>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <BarChart3 className="h-3 w-3" />
              Total Boxes
            </div>
            <p className="text-xl font-bold text-white">{tubeStats?.totalBoxes || 0}</p>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <TrendingUp className="h-3 w-3" />
              Tubes/Week
            </div>
            <p className="text-xl font-bold text-emerald-400">{tubeStats?.avgTubesPerWeek || 0}</p>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Clock className="h-3 w-3" />
              Order Interval
            </div>
            <p className="text-xl font-bold text-white">{tubeStats?.avgDaysBetweenOrders || 0} <span className="text-xs text-slate-400">days</span></p>
          </div>
        </div>

        {/* Inventory Status */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Estimated Inventory</span>
            <span className="font-bold text-white">{tubeStats?.estimatedInventory?.toLocaleString() || 0} tubes</span>
          </div>
          <Progress 
            value={Math.min(((tubeStats?.estimatedInventory || 0) / Math.max(tubeStats?.avgTubesPerOrder || 100, 1)) * 100, 100)} 
            className="h-2 bg-slate-700"
          />
          <div className="flex items-center justify-between p-2 rounded bg-slate-900/50">
            <span className="text-sm text-slate-400">🔮 Next Order Prediction</span>
            <Badge 
              variant="outline" 
              className={
                tubeStats?.etaPrediction && tubeStats.etaPrediction < 3 ? "border-red-500 text-red-400" :
                tubeStats?.etaPrediction && tubeStats.etaPrediction < 7 ? "border-yellow-500 text-yellow-400" :
                "border-emerald-500 text-emerald-400"
              }
            >
              {tubeStats?.etaPrediction || 0} days
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
