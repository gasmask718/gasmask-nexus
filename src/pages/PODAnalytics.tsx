import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, DollarSign, ShoppingCart, Target } from "lucide-react";

export default function PODAnalytics() {
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    totalProfit: 0,
    totalSales: 0,
    topPlatform: "N/A",
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const { data: sales } = await supabase.from("pod_sales").select("*");

      const totalRevenue = sales?.reduce((sum, s) => sum + (Number(s.sale_price) || 0), 0) || 0;
      const totalProfit = sales?.reduce((sum, s) => sum + (Number(s.profit) || 0), 0) || 0;
      const totalSales = sales?.length || 0;

      // Find top platform
      const platformCounts: Record<string, number> = {};
      sales?.forEach((s) => {
        platformCounts[s.platform] = (platformCounts[s.platform] || 0) + 1;
      });
      const topPlatform = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

      setAnalytics({
        totalRevenue,
        totalProfit,
        totalSales,
        topPlatform,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Sales Analytics & Revenue</h1>
        <p className="text-muted-foreground">Track performance across all platforms</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analytics.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">all time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analytics.totalProfit.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">net profit</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalSales}</div>
            <p className="text-xs text-muted-foreground mt-1">orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top Platform</CardTitle>
            <Target className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{analytics.topPlatform}</div>
            <p className="text-xs text-muted-foreground mt-1">best performing</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Platform</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No sales data yet. Start uploading designs!
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
