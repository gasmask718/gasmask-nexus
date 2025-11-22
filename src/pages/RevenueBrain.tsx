import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Store, Building2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function RevenueBrain() {
  const [storeMultiplier, setStoreMultiplier] = useState(0);
  const [hubMultiplier, setHubMultiplier] = useState(0);
  const [influencerMultiplier, setInfluencerMultiplier] = useState(0);

  const { data: forecast, isLoading } = useQuery({
    queryKey: ['forecast'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('forecasting', {
        body: { action: 'getCurrentForecast' }
      });
      if (error) throw error;
      return data;
    },
  });

  const { data: snapshots } = useQuery({
    queryKey: ['forecast-snapshots'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forecast_snapshots')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center">Loading revenue forecast...</div>;
  }

  const whatIfTotal = 
    (forecast?.predictedStoresRevenue || 0) * (1 + storeMultiplier / 10) +
    (forecast?.predictedWholesaleRevenue || 0) * (1 + hubMultiplier / 5) +
    (forecast?.predictedInfluencerRevenue || 0) * (1 + influencerMultiplier / 3);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-foreground">Revenue Brain</h1>
          <p className="text-muted-foreground">AI-powered revenue forecasting & what-if scenarios</p>
        </div>

        {/* Forecast Hero Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">This Month Forecast</h3>
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div className="text-3xl font-bold mb-2">
              ${(forecast?.predictedTotal || 0).toLocaleString()}
            </div>
            <Badge variant="outline" className="text-green-500 border-green-500/20">
              +12% vs last month
            </Badge>
          </Card>

          <Card className="p-6 border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">Active Stores</h3>
              <Store className="w-5 h-5 text-primary" />
            </div>
            <div className="text-3xl font-bold mb-2">{forecast?.activeStores || 0}</div>
            <div className="text-sm text-muted-foreground">
              ${Math.round(forecast?.avgPerStore || 0)}/store avg
            </div>
          </Card>

          <Card className="p-6 border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">Wholesale Share</h3>
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="text-3xl font-bold mb-2">
              {Math.round(((forecast?.predictedWholesaleRevenue || 0) / (forecast?.predictedTotal || 1)) * 100)}%
            </div>
            <div className="text-sm text-muted-foreground">
              {forecast?.activeHubs || 0} active hubs
            </div>
          </Card>
        </div>

        {/* What-If Scenario */}
        <Card className="p-8 mb-8 border-primary/20">
          <h2 className="text-2xl font-bold mb-6">What-If Scenario Builder</h2>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium">Active Stores: +{storeMultiplier}</label>
                <span className="text-sm text-muted-foreground">
                  Impact: +${Math.round((forecast?.predictedStoresRevenue || 0) * storeMultiplier / 10).toLocaleString()}
                </span>
              </div>
              <Slider
                value={[storeMultiplier]}
                onValueChange={(v) => setStoreMultiplier(v[0])}
                max={20}
                step={1}
                className="mb-2"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium">Wholesale Hubs: +{hubMultiplier}</label>
                <span className="text-sm text-muted-foreground">
                  Impact: +${Math.round((forecast?.predictedWholesaleRevenue || 0) * hubMultiplier / 5).toLocaleString()}
                </span>
              </div>
              <Slider
                value={[hubMultiplier]}
                onValueChange={(v) => setHubMultiplier(v[0])}
                max={10}
                step={1}
                className="mb-2"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium">Active Influencers: +{influencerMultiplier}</label>
                <span className="text-sm text-muted-foreground">
                  Impact: +${Math.round((forecast?.predictedInfluencerRevenue || 0) * influencerMultiplier / 3).toLocaleString()}
                </span>
              </div>
              <Slider
                value={[influencerMultiplier]}
                onValueChange={(v) => setInfluencerMultiplier(v[0])}
                max={15}
                step={1}
                className="mb-2"
              />
            </div>

            <Card className="p-6 bg-primary/5 border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">New Projected Revenue</div>
                  <div className="text-3xl font-bold">${whatIfTotal.toLocaleString()}</div>
                </div>
                <Badge variant="outline" className="text-primary border-primary/50">
                  +{Math.round(((whatIfTotal - (forecast?.predictedTotal || 0)) / (forecast?.predictedTotal || 1)) * 100)}%
                </Badge>
              </div>
            </Card>
          </div>
        </Card>

        {/* Historical Snapshots */}
        {snapshots && snapshots.length > 0 && (
          <Card className="p-8">
            <h2 className="text-2xl font-bold mb-6">Forecast History</h2>
            <div className="space-y-4">
              {snapshots.map((snap) => (
                <div key={snap.id} className="flex items-center justify-between p-4 border border-border/50 rounded">
                  <div>
                    <div className="font-medium">{snap.period_type.toUpperCase()}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(snap.period_start).toLocaleDateString()} - {new Date(snap.period_end).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">${snap.predicted_revenue_total.toLocaleString()}</div>
                    {snap.actual_revenue_total && (
                      <div className="text-sm text-muted-foreground">
                        Actual: ${snap.actual_revenue_total.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}