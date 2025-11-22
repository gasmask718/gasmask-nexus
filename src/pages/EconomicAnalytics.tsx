import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, DollarSign, Package, AlertTriangle, Brain, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useState } from "react";

export default function EconomicAnalytics() {
  const [scanResults, setScanResults] = useState<any>(null);
  const { data: orders } = useQuery({
    queryKey: ["orders-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_orders")
        .select("*, stores(name, address_city, address_state)")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;
      return data;
    },
  });

  const { data: inventory } = useQuery({
    queryKey: ["inventory-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_stores")
        .select("*, stores(name, address_city), products(name)");

      if (error) throw error;
      return data;
    },
  });

  const totalRevenue = orders?.reduce((sum, order) => sum + order.total_amount, 0) || 0;
  const avgOrderValue = totalRevenue / (orders?.length || 1);
  const criticalStockItems = inventory?.filter(i => i.quantity_current <= i.reorder_point).length || 0;

  // Group by city
  const cityStats = orders?.reduce((acc: any, order) => {
    const city = order.stores?.address_city || "Unknown";
    if (!acc[city]) {
      acc[city] = { orders: 0, revenue: 0 };
    }
    acc[city].orders += 1;
    acc[city].revenue += order.total_amount;
    return acc;
  }, {});

  const topCities = Object.entries(cityStats || {})
    .sort(([, a]: any, [, b]: any) => b.revenue - a.revenue)
    .slice(0, 5);

  const runEconomicScanMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("economic-scan");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Economic scan complete");
      setScanResults(data);
    },
    onError: (error: Error) => {
      toast.error("Scan failed", { description: error.message });
    },
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Economic Analytics</h1>
              <p className="text-muted-foreground">Financial insights and performance metrics</p>
            </div>
          </div>
          <Button
            onClick={() => runEconomicScanMutation.mutate()}
            disabled={runEconomicScanMutation.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${runEconomicScanMutation.isPending ? 'animate-spin' : ''}`} />
            Run Economic Scan
          </Button>
        </div>

        {/* AI Scan Results */}
        {scanResults?.analysis && (
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Economic Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-2">Economic Health Score</div>
                <div className="flex items-center gap-4">
                  <Progress value={scanResults.analysis.economicScore || 50} className="flex-1" />
                  <span className="text-2xl font-bold">
                    {scanResults.analysis.economicScore || 50}
                  </span>
                </div>
              </div>

              {scanResults.analysis.topRisks && scanResults.analysis.topRisks.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 text-red-500">Top Risks</h4>
                  <ul className="space-y-1">
                    {scanResults.analysis.topRisks.map((risk: string, i: number) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {scanResults.analysis.topOpportunities && scanResults.analysis.topOpportunities.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 text-green-500">Top Opportunities</h4>
                  <ul className="space-y-1">
                    {scanResults.analysis.topOpportunities.map((opp: string, i: number) => (
                      <li key={i} className="text-sm">• {opp}</li>
                    ))}
                  </ul>
                </div>
              )}

              {scanResults.analysis.actionItems && scanResults.analysis.actionItems.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Recommended Actions</h4>
                  <ul className="space-y-1">
                    {scanResults.analysis.actionItems.map((action: string, i: number) => (
                      <li key={i} className="text-sm">✓ {action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">30-Day Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {orders?.length || 0} orders
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${avgOrderValue.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Active Stores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(orders?.map(o => o.store_id)).size || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Critical Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{criticalStockItems}</div>
              <p className="text-xs text-muted-foreground mt-1">Items below reorder point</p>
            </CardContent>
          </Card>
        </div>

        {/* Top Cities */}
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Cities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topCities.map(([city, stats]: any, index) => (
                <div key={city} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{index + 1}</Badge>
                      <div>
                        <div className="font-semibold">{city}</div>
                        <div className="text-xs text-muted-foreground">
                          {stats.orders} orders
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">${stats.revenue.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">
                        ${(stats.revenue / stats.orders).toFixed(2)} avg
                      </div>
                    </div>
                  </div>
                  <Progress 
                    value={(stats.revenue / totalRevenue) * 100} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Inventory Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inventory
                ?.filter(i => i.quantity_current <= i.reorder_point)
                .slice(0, 10)
                .map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      <div>
                        <div className="font-medium">{item.products?.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.stores?.name} - {item.stores?.address_city}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="destructive">
                        {item.quantity_current} units
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        Reorder at {item.reorder_point}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
