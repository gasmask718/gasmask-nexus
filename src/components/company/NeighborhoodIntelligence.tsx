import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapPin, TrendingUp, Store, Package, Zap, Leaf, Radio } from "lucide-react";

interface NeighborhoodIntelligenceProps {
  neighborhood?: string;
  boro?: string;
}

export function NeighborhoodIntelligence({ neighborhood, boro }: NeighborhoodIntelligenceProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["neighborhood-intelligence", neighborhood, boro],
    queryFn: async () => {
      const { data: companies } = await supabase
        .from("companies")
        .select("*");

      const filtered = (companies || []).filter((c: any) => 
        (neighborhood && c.neighborhood === neighborhood) || (boro && c.boro === boro)
      );

      if (filtered.length === 0) {
        return { totalStores: 0, totalTubes: 0, brandBreakdown: {}, topStores: [], slowStores: [], flowerStores: 0, rpaStores: 0, avgReliabilityScore: 0 };
      }

      const companyIds = filtered.map((c: any) => c.id);
      const { data: orders } = await supabase.from("wholesale_orders").select("*");
      const filteredOrders = (orders || []).filter((o: any) => companyIds.includes(o.company_id));

      const totalTubes = filteredOrders.reduce((sum: number, o: any) => sum + (o.tubes_total || (o.boxes || 0) * 100), 0);
      const brandBreakdown: Record<string, number> = {};
      filteredOrders.forEach((o: any) => {
        const brand = o.brand || "unknown";
        brandBreakdown[brand] = (brandBreakdown[brand] || 0) + (o.tubes_total || (o.boxes || 0) * 100);
      });

      const storeStats = new Map<string, { id: string; name: string; tubes: number; orders: number }>();
      filteredOrders.forEach((o: any) => {
        const company = filtered.find((c: any) => c.id === o.company_id);
        if (company) {
          const existing = storeStats.get(company.id) || { id: company.id, name: company.name, tubes: 0, orders: 0 };
          existing.tubes += o.tubes_total || (o.boxes || 0) * 100;
          existing.orders += 1;
          storeStats.set(company.id, existing);
        }
      });

      const sortedStores = Array.from(storeStats.values()).sort((a, b) => b.tubes - a.tubes);

      return {
        totalStores: filtered.length,
        totalTubes,
        brandBreakdown,
        topStores: sortedStores.slice(0, 5),
        slowStores: sortedStores.slice(-5).reverse(),
        flowerStores: filtered.filter((c: any) => c.sells_flowers).length,
        rpaStores: filtered.filter((c: any) => c.rpa_status === "rpa").length,
        avgReliabilityScore: Math.round(filtered.reduce((sum: number, c: any) => sum + (c.payment_reliability_score || 50), 0) / filtered.length),
      };
    },
    enabled: !!(neighborhood || boro),
  });

  const brandColors: Record<string, string> = { gasmask: "bg-red-500", hotmama: "bg-rose-400", hotscolati: "bg-red-700", grabba_r_us: "bg-purple-500", unknown: "bg-gray-500" };

  if (isLoading) return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-lg font-semibold"><MapPin className="h-5 w-5 text-primary" />{neighborhood || boro || "Select a Location"}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2 mb-2"><Store className="h-4 w-4 text-blue-500" /><span className="text-xs text-muted-foreground">Stores</span></div><p className="text-2xl font-bold">{stats?.totalStores || 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2 mb-2"><Package className="h-4 w-4 text-green-500" /><span className="text-xs text-muted-foreground">Total Tubes</span></div><p className="text-2xl font-bold">{stats?.totalTubes?.toLocaleString() || 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2 mb-2"><Leaf className="h-4 w-4 text-emerald-500" /><span className="text-xs text-muted-foreground">Flower Stores</span></div><p className="text-2xl font-bold">{stats?.flowerStores || 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2 mb-2"><Radio className="h-4 w-4 text-purple-500" /><span className="text-xs text-muted-foreground">RPA Stores</span></div><p className="text-2xl font-bold">{stats?.rpaStores || 0}</p></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle className="text-sm">Brand Distribution</CardTitle></CardHeader><CardContent><div className="space-y-3">{Object.entries(stats?.brandBreakdown || {}).map(([brand, tubes]) => (<div key={brand} className="flex items-center gap-3"><Badge className={brandColors[brand] || "bg-gray-500"} variant="secondary">{brand.replace("_", " ")}</Badge><div className="flex-1"><Progress value={((tubes as number) / (stats?.totalTubes || 1)) * 100} className="h-2" /></div><span className="text-sm font-medium w-24 text-right">{(tubes as number).toLocaleString()} tubes</span></div>))}</div></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-500" />Top Performers</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Store</TableHead><TableHead>Tubes</TableHead></TableRow></TableHeader><TableBody>{stats?.topStores?.map((store, i) => (<TableRow key={store.id}><TableCell><Badge variant={i < 3 ? "default" : "outline"}>#{i + 1}</Badge></TableCell><TableCell className="font-medium">{store.name}</TableCell><TableCell>{store.tubes.toLocaleString()}</TableCell></TableRow>))}{(!stats?.topStores || stats.topStores.length === 0) && <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No data</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
    </div>
  );
}
