import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Package, DollarSign, Zap, ShoppingCart, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function PODOverview() {
  const [stats, setStats] = useState({
    totalDesigns: 0,
    uploadsThisWeek: 0,
    monthlyRevenue: 0,
    profitThisWeek: 0,
    activeMarketplaces: 0,
    viralProducts: 0,
  });

  useEffect(() => {
    fetchOverviewStats();
  }, []);

  const fetchOverviewStats = async () => {
    try {
      const { data: designs } = await supabase
        .from("pod_designs")
        .select("*");

      const { data: accounts } = await supabase
        .from("pod_marketplace_accounts")
        .select("*")
        .eq("connection_status", "connected");

      const { data: sales } = await supabase
        .from("pod_sales")
        .select("*");

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const recentDesigns = designs?.filter(
        (d) => new Date(d.created_at) >= weekAgo
      ).length || 0;

      const monthlyRevenue = sales?.reduce((sum, s) => sum + (Number(s.sale_price) || 0), 0) || 0;
      const weekProfit = sales?.filter(s => new Date(s.order_date) >= weekAgo)
        .reduce((sum, s) => sum + (Number(s.profit) || 0), 0) || 0;

      const viralCount = designs?.filter(d => d.status === 'winning').length || 0;

      setStats({
        totalDesigns: designs?.length || 0,
        uploadsThisWeek: recentDesigns,
        monthlyRevenue,
        profitThisWeek: weekProfit,
        activeMarketplaces: accounts?.length || 0,
        viralProducts: viralCount,
      });
    } catch (error) {
      console.error("Error fetching POD stats:", error);
    }
  };

  const statCards = [
    {
      title: "Total Designs",
      value: stats.totalDesigns,
      icon: Package,
      color: "text-blue-600",
    },
    {
      title: "Uploads This Week",
      value: stats.uploadsThisWeek,
      icon: TrendingUp,
      color: "text-green-600",
    },
    {
      title: "Monthly Revenue",
      value: `$${stats.monthlyRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: "text-emerald-600",
    },
    {
      title: "Profit This Week",
      value: `$${stats.profitThisWeek.toFixed(2)}`,
      icon: Zap,
      color: "text-yellow-600",
    },
    {
      title: "Active Marketplaces",
      value: stats.activeMarketplaces,
      icon: ShoppingCart,
      color: "text-purple-600",
    },
    {
      title: "Viral Products",
      value: stats.viralProducts,
      icon: Target,
      color: "text-red-600",
    },
  ];

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">POD Department Overview</h1>
        <p className="text-muted-foreground">Print Lab Studio Control Center</p>
      </div>

      {/* AI Performance Summary */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            AI Performance Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Automation Status</span>
              <Badge variant="default">ACTIVE</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Design Generation Rate</span>
              <span className="font-semibold">{stats.uploadsThisWeek}/week</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Winner Detection</span>
              <span className="font-semibold">{stats.viralProducts} products scaling</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">On Track to $1M/month</span>
              <span className="font-semibold text-primary">
                {((stats.monthlyRevenue / 1000000) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="/pod/designs/generate" className="p-4 border rounded-lg hover:bg-muted/50 text-center">
            <Zap className="h-8 w-8 mx-auto mb-2 text-primary" />
            <div className="font-medium">Generate Designs</div>
          </a>
          <a href="/pod/designs" className="p-4 border rounded-lg hover:bg-muted/50 text-center">
            <Package className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <div className="font-medium">Design Library</div>
          </a>
          <a href="/pod/upload" className="p-4 border rounded-lg hover:bg-muted/50 text-center">
            <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <div className="font-medium">Upload Manager</div>
          </a>
          <a href="/pod/analytics" className="p-4 border rounded-lg hover:bg-muted/50 text-center">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-600" />
            <div className="font-medium">Analytics</div>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
