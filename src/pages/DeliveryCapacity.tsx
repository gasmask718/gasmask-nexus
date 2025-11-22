import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

const DeliveryCapacity = () => {
  const { data: capacityMetrics } = useQuery({
    queryKey: ['delivery-capacity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_capacity_metrics')
        .select('*')
        .order('utilization_rate', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const getUtilizationColor = (rate?: number) => {
    if (!rate) return 'text-muted-foreground';
    if (rate > 90) return 'text-red-500';
    if (rate > 70) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getUtilizationIcon = (rate?: number) => {
    if (!rate) return <Minus className="h-4 w-4" />;
    if (rate > 90) return <AlertTriangle className="h-4 w-4" />;
    if (rate > 70) return <TrendingUp className="h-4 w-4" />;
    return <TrendingDown className="h-4 w-4" />;
  };

  return (
    <Layout>
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">National Delivery Capacity</h1>
          <p className="text-muted-foreground">
            Monitor driver capacity and utilization across all cities
          </p>
        </div>

        <div className="grid gap-6">
          {capacityMetrics?.map(metric => {
            const utilizationRate = metric.utilization_rate || 0;
            const totalWorkers = (metric.driver_count || 0) + (metric.biker_count || 0);
            const remainingCapacity = (metric.daily_capacity || 0) - (metric.current_load || 0);

            return (
              <Card key={metric.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold">{metric.city}, {metric.state}</h3>
                    <div className="flex items-center gap-4 mt-2">
                      <Badge variant="outline">
                        {metric.driver_count} Drivers
                      </Badge>
                      <Badge variant="outline">
                        {metric.biker_count} Bikers
                      </Badge>
                      <Badge variant="secondary">
                        Total: {totalWorkers} Workers
                      </Badge>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 ${getUtilizationColor(utilizationRate)}`}>
                    {getUtilizationIcon(utilizationRate)}
                    <span className="text-2xl font-bold">{utilizationRate.toFixed(0)}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Daily Capacity</div>
                    <div className="text-2xl font-bold">{metric.daily_capacity}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Current Load</div>
                    <div className="text-2xl font-bold">{metric.current_load}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Remaining</div>
                    <div className="text-2xl font-bold text-primary">{remainingCapacity}</div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Capacity Utilization</span>
                    <span className={getUtilizationColor(utilizationRate)}>
                      {utilizationRate.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={utilizationRate} className="h-3" />
                </div>

                {metric.hiring_recommendation && (
                  <div className="mt-4 p-4 bg-primary/10 rounded-lg">
                    <div className="font-semibold mb-1">AI Recommendation</div>
                    <div className="text-sm">{metric.hiring_recommendation}</div>
                  </div>
                )}
              </Card>
            );
          })}

          {(!capacityMetrics || capacityMetrics.length === 0) && (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No capacity data available</p>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default DeliveryCapacity;