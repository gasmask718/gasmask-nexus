import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Calendar, Clock, ShoppingBag } from "lucide-react";

// Consistent brand configuration matching tube inventory colors from store details page
// Colors match EditableTubeInventoryCard.tsx: #EF4444 (red-500), #3B82F6 (blue-500), #EC4899 (pink-500), #A855F7 (purple-500), #FBBF24 (amber-400), #92400E (amber-800)
const brandConfig: Record<string, { 
  label: string; 
  gradient: string; 
  icon: string;
  textColor: string;
  variants?: { id: string; label: string; kpiLabel: string }[];
}> = {
  gasmask: { 
    label: "GasMask", 
    gradient: "from-red-500 to-red-600", // #EF4444 red-500 for GasMask Bags
    icon: "🔴",
    textColor: "text-white",
    variants: [
      { id: "bags", label: "Bags", kpiLabel: "Bags" },
      { id: "tubes", label: "Tubes", kpiLabel: "Tubes" }
    ]
  },
  hotmama: { 
    label: "HotMama", 
    gradient: "from-pink-500 to-pink-600", // #EC4899 pink-500
    icon: "💖",
    textColor: "text-white"
  },
  hotscolati: { 
    label: "Hotscolati", 
    gradient: "from-amber-400 to-amber-500", // Light: #FBBF24 amber-400, Dark: #92400E amber-800
    icon: "🟠",
    textColor: "text-white",
    variants: [
      { id: "light", label: "Light", kpiLabel: "Light" }, // amber-400 (yellow)
      { id: "dark", label: "Dark", kpiLabel: "Dark" } // amber-800 (dark orange)
    ]
  },
  grabba_r_us: { 
    label: "Grabba R Us", 
    gradient: "from-purple-500 to-purple-600", // #A855F7 purple-500
    icon: "🟪",
    textColor: "text-white"
  },
};

const TOBACCO_BRANDS = ["gasmask", "hotmama", "hotscolati", "grabba_r_us"];

interface BrandBreakdownCardsProps {
  companyId: string;
}

export function BrandBreakdownCards({ companyId }: BrandBreakdownCardsProps) {
  const { data: brandStats } = useQuery({
    queryKey: ["brand-breakdown", companyId],
    queryFn: async () => {
      // Fetch orders
      const { data: orders } = await supabase
        .from("wholesale_orders")
        .select("*")
        .eq("company_id", companyId)
        .in("brand", TOBACCO_BRANDS)
        .order("created_at", { ascending: false });

      // Fetch stores for this company first
      const { data: stores } = await supabase
        .from("stores")
        .select("id")
        .eq("company_id", companyId)
        .eq('approval_status', 'approved'); // Phase 7: exclude pending captures
      
      const storeIds = stores?.map(s => s.id) || [];

      // Fetch inventory for variant tracking
      let inventory: { brand: string; current_tubes_left: number }[] | null = null;
      if (storeIds.length > 0) {
        const { data: invData } = await supabase
          .from("store_tube_inventory")
          .select("brand, current_tubes_left")
          .in("store_id", storeIds);
        inventory = invData;
      }

      const stats: Record<string, { 
        tubes: number; 
        boxes: number; 
        lastOrder: string | null; 
        avgInterval: number;
        bags?: number;
        light?: number;
        dark?: number;
      }> = {};

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

        // Get variant counts from inventory
        let bags = 0;
        let light = 0;
        let dark = 0;

        if (inventory) {
          // GasMask bags (gasmask brand in inventory)
          if (brand === "gasmask") {
            bags = inventory
              .filter(inv => inv.brand === "gasmask")
              .reduce((sum, inv) => sum + (inv.current_tubes_left || 0), 0);
          }

          // Hotscolati variants
          if (brand === "hotscolati") {
            light = inventory
              .filter(inv => inv.brand === "hotscolatti-light" || inv.brand === "hotscolati-light")
              .reduce((sum, inv) => sum + (inv.current_tubes_left || 0), 0);
            dark = inventory
              .filter(inv => inv.brand === "hotscolatti-dark" || inv.brand === "hotscolati-dark")
              .reduce((sum, inv) => sum + (inv.current_tubes_left || 0), 0);
          }
        }

        stats[brand] = { tubes, boxes, lastOrder, avgInterval, bags, light, dark };
      });

      return stats;
    },
    enabled: !!companyId,
  });

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {TOBACCO_BRANDS.map(brand => {
        const config = brandConfig[brand];
        const stats = brandStats?.[brand] || { 
          tubes: 0, 
          boxes: 0, 
          lastOrder: null, 
          avgInterval: 0,
          bags: 0,
          light: 0,
          dark: 0
        };

        return (
          <Card key={brand} className={`overflow-hidden border-0 bg-gradient-to-br ${config.gradient}`}>
            <CardContent className={`p-4 ${config.textColor}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{config.icon}</span>
                <span className="font-bold text-sm">{config.label}</span>
              </div>
              
              <div className="space-y-2">
                {/* Tubes - always shown */}
                <div className="flex items-center justify-between">
                  <span className="text-xs opacity-80 flex items-center gap-1">
                    <Package className="h-3 w-3" /> Tubes
                  </span>
                  <span className="font-bold">{stats.tubes.toLocaleString()}</span>
                </div>
                
                {/* GasMask Bags KPI */}
                {brand === "gasmask" && stats.bags !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs opacity-80 flex items-center gap-1">
                      <ShoppingBag className="h-3 w-3" /> Bags
                    </span>
                    <span className="font-semibold">{stats.bags.toLocaleString()}</span>
                  </div>
                )}
                
                {/* Hotscolati Light/Dark KPIs */}
                {brand === "hotscolati" && (
                  <>
                    {stats.light !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs opacity-80 flex items-center gap-1">
                          <Package className="h-3 w-3" /> Light
                        </span>
                        <span className="font-semibold">{stats.light.toLocaleString()}</span>
                      </div>
                    )}
                    {stats.dark !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs opacity-80 flex items-center gap-1">
                          <Package className="h-3 w-3" /> Dark
                        </span>
                        <span className="font-semibold">{stats.dark.toLocaleString()}</span>
                      </div>
                    )}
                  </>
                )}
                
                {/* Boxes */}
                <div className="flex items-center justify-between">
                  <span className="text-xs opacity-80">Boxes</span>
                  <span className="font-semibold">{stats.boxes}</span>
                </div>
                
                {/* Last Order */}
                <div className="flex items-center justify-between">
                  <span className="text-xs opacity-80 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Last
                  </span>
                  <span className="text-xs">
                    {stats.lastOrder ? new Date(stats.lastOrder).toLocaleDateString() : "Never"}
                  </span>
                </div>
                
                {/* Interval */}
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
