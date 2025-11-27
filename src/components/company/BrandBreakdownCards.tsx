import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Calendar, Clock } from "lucide-react";

const TOBACCO_BRANDS = ["gasmask", "hotmama", "hotscolati", "grabba_r_us"];

const brandConfig: Record<string, { label: string; gradient: string; icon: string }> = {
  gasmask: { label: "GasMask", gradient: "from-red-600 to-red-900", icon: "🔴" },
  hotmama: { label: "HotMama", gradient: "from-rose-400 to-rose-600", icon: "🌹" },
  hotscolati: { label: "Hotscolati", gradient: "from-red-700 to-red-950", icon: "🍫" },
  grabba_r_us: { label: "Grabba R Us", gradient: "from-purple-500 to-pink-500", icon: "💜" },
};

interface BrandBreakdownCardsProps {
  companyId: string;
}

export function BrandBreakdownCards({ companyId }: BrandBreakdownCardsProps) {
  const { data: brandStats } = useQuery({
    queryKey: ["brand-breakdown", companyId],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("wholesale_orders")
        .select("*")
        .eq("company_id", companyId)
        .in("brand", TOBACCO_BRANDS)
        .order("created_at", { ascending: false });

      const stats: Record<string, { tubes: number; boxes: number; lastOrder: string | null; avgInterval: number }> = {};

      TOBACCO_BRANDS.forEach(brand => {
        const brandOrders = orders?.filter(o => o.brand === brand) || [];
        const tubes = brandOrders.reduce((sum, o) => sum + (o.tubes_total || (o.boxes || 0) * 100), 0);
        const boxes = brandOrders.reduce((sum, o) => sum + (o.boxes || 0), 0);
        const lastOrder = brandOrders.length > 0 ? brandOrders[0].created_at : null;

        // Calculate avg interval
        let avgInterval = 0;
        if (brandOrders.length > 1) {
          let totalDays = 0;
          for (let i = 1; i < brandOrders.length; i++) {
            const prev = new Date(brandOrders[i - 1].created_at);
            const curr = new Date(brandOrders[i].created_at);
            totalDays += Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
          }
          avgInterval = Math.round(totalDays / (brandOrders.length - 1));
        }

        stats[brand] = { tubes, boxes, lastOrder, avgInterval };
      });

      return stats;
    },
    enabled: !!companyId,
  });

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {TOBACCO_BRANDS.map(brand => {
        const config = brandConfig[brand];
        const stats = brandStats?.[brand] || { tubes: 0, boxes: 0, lastOrder: null, avgInterval: 0 };

        return (
          <Card key={brand} className={`overflow-hidden border-0 bg-gradient-to-br ${config.gradient}`}>
            <CardContent className="p-4 text-white">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{config.icon}</span>
                <span className="font-bold text-sm">{config.label}</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs opacity-80 flex items-center gap-1">
                    <Package className="h-3 w-3" /> Tubes
                  </span>
                  <span className="font-bold">{stats.tubes.toLocaleString()}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs opacity-80">Boxes</span>
                  <span className="font-semibold">{stats.boxes}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs opacity-80 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Last
                  </span>
                  <span className="text-xs">
                    {stats.lastOrder ? new Date(stats.lastOrder).toLocaleDateString() : "Never"}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs opacity-80 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Interval
                  </span>
                  <span className="text-xs">{stats.avgInterval || "—"} days</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
