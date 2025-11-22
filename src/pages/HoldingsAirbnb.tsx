import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Building2, TrendingUp, DollarSign, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function HoldingsAirbnb() {
  const [airbnbAssets, setAirbnbAssets] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState({ conservative: 0, base: 0, aggressive: 0 });

  useEffect(() => {
    fetchAirbnbData();
  }, []);

  const fetchAirbnbData = async () => {
    try {
      const { data: assets } = await supabase
        .from("holdings_assets")
        .select(`
          *,
          holdings_airbnb_units(*)
        `)
        .in("hold_strategy", ["airbnb", "hybrid"]);

      if (assets) {
        setAirbnbAssets(assets);

        // Calculate total revenue
        let conservative = 0;
        let base = 0;
        let aggressive = 0;

        assets.forEach((asset: any) => {
          asset.holdings_airbnb_units?.forEach((unit: any) => {
            conservative += unit.estimated_monthly_revenue_conservative || 0;
            base += unit.estimated_monthly_revenue_base || 0;
            aggressive += unit.estimated_monthly_revenue_aggressive || 0;
          });
        });

        setTotalRevenue({ conservative, base, aggressive });
      }
    } catch (error) {
      console.error("Error fetching Airbnb data:", error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Airbnb & STR Engine</h1>
        <p className="text-muted-foreground">Short-term rental portfolio management</p>
      </div>

      {/* AI Strategy Block */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            AI STR Strategy Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Long-term to STR Conversion Opportunities</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• 3 properties in high-demand vacation areas should convert to STR (40% revenue increase)</li>
              <li>• 2 properties near downtown could benefit from hybrid strategy (corporate + leisure)</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Expansion Markets</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Gatlinburg, TN - High occupancy, strong seasonal demand</li>
              <li>• Scottsdale, AZ - Year-round appeal, premium nightly rates</li>
              <li>• Miami Beach, FL - International appeal, high revenue potential</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conservative Estimate</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue.conservative)}</div>
            <p className="text-xs text-muted-foreground">Monthly gross revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Base Case</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(totalRevenue.base)}</div>
            <p className="text-xs text-muted-foreground">Monthly gross revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Aggressive Target</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue.aggressive)}</div>
            <p className="text-xs text-muted-foreground">Monthly gross revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Airbnb Assets */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Active STR Properties</h2>
        {airbnbAssets.map((asset) => (
          <Card key={asset.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle>{asset.name}</CardTitle>
                </div>
                <Badge>{asset.hold_strategy}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {asset.city}, {asset.state}
              </p>
            </CardHeader>
            <CardContent>
              {asset.holdings_airbnb_units?.map((unit: any) => (
                <div key={unit.id} className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Platform</div>
                      <div className="font-medium capitalize">{unit.platform}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Occupancy Target</div>
                      <div className="font-medium">{unit.occupancy_target_percent}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Cleaning Fee</div>
                      <div className="font-medium">{formatCurrency(unit.cleaning_fee)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Management Fee</div>
                      <div className="font-medium">{unit.management_fee_percent}%</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="text-sm font-semibold mb-2">Nightly Rate Targets</div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">Low Season</div>
                        <div className="font-bold">{formatCurrency(unit.nightly_rate_target_low)}</div>
                      </div>
                      <div className="text-center p-3 bg-primary/10 rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">Mid Season</div>
                        <div className="font-bold">{formatCurrency(unit.nightly_rate_target_mid)}</div>
                      </div>
                      <div className="text-center p-3 bg-green-500/10 rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">High Season</div>
                        <div className="font-bold">{formatCurrency(unit.nightly_rate_target_high)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="text-sm font-semibold mb-2">Monthly Revenue Projections</div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Conservative</div>
                        <div className="font-bold">{formatCurrency(unit.estimated_monthly_revenue_conservative)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Base Case</div>
                        <div className="font-bold text-primary">
                          {formatCurrency(unit.estimated_monthly_revenue_base)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Aggressive</div>
                        <div className="font-bold text-green-600">
                          {formatCurrency(unit.estimated_monthly_revenue_aggressive)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {(!asset.holdings_airbnb_units || asset.holdings_airbnb_units.length === 0) && (
                <p className="text-muted-foreground text-sm">No STR unit configuration yet. Add listing details.</p>
              )}
            </CardContent>
          </Card>
        ))}

        {airbnbAssets.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No Airbnb properties yet. Convert assets to STR strategy.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
