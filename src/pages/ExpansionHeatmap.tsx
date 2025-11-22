import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Map } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export default function ExpansionHeatmap() {
  const [metric, setMetric] = useState<'penetration' | 'density' | 'store_count' | 'potential'>('penetration');

  const { data: regions, isLoading } = useQuery({
    queryKey: ['regions-heatmap'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regions')
        .select('*')
        .order('state');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: stores } = useQuery({
    queryKey: ['stores-by-state'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('state, city, region_id, store_health_score');
      
      if (error) throw error;
      return data;
    }
  });

  // Group data by state
  const stateData = stores?.reduce((acc: any, store: any) => {
    const state = store.state || 'Unknown';
    if (!acc[state]) {
      acc[state] = { count: 0, avgHealth: 0, cities: new Set() };
    }
    acc[state].count++;
    acc[state].avgHealth += store.store_health_score || 50;
    acc[state].cities.add(store.city);
    return acc;
  }, {});

  // Calculate averages
  Object.keys(stateData || {}).forEach(state => {
    const data = stateData[state];
    data.avgHealth = data.count > 0 ? Math.round(data.avgHealth / data.count) : 0;
    data.cities = Array.from(data.cities).length;
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Map className="h-8 w-8" />
            Territory Heatmap
          </h1>
          <p className="text-muted-foreground mt-2">
            Visual territory penetration and density analysis
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Metric Selection</CardTitle>
                <CardDescription>Choose the metric to visualize</CardDescription>
              </div>
              <Select value={metric} onValueChange={(v: any) => setMetric(v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="penetration">Penetration Score</SelectItem>
                  <SelectItem value="density">Density Score</SelectItem>
                  <SelectItem value="store_count">Store Count</SelectItem>
                  <SelectItem value="potential">Growth Potential</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>State Overview</CardTitle>
                <CardDescription>Performance by state</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(stateData || {}).map(([state, data]: [string, any]) => (
                    <div key={state} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <Badge className={getScoreColor(data.avgHealth)}>
                          {state}
                        </Badge>
                        <div>
                          <p className="font-medium">{data.count} stores</p>
                          <p className="text-sm text-muted-foreground">{data.cities} cities</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{data.avgHealth}</p>
                        <p className="text-sm text-muted-foreground">Health Score</p>
                      </div>
                    </div>
                  ))}
                  {(!stateData || Object.keys(stateData).length === 0) && (
                    <p className="text-center text-muted-foreground py-8">
                      No state data available
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {regions && regions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Regional Breakdown</CardTitle>
                  <CardDescription>Configured territory regions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {regions.map((region: any) => (
                      <div key={region.id} className="p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold">{region.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {region.primary_city}, {region.state}
                            </p>
                          </div>
                          <Badge>{region.status}</Badge>
                        </div>
                        {region.city_cluster && region.city_cluster.length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            {region.city_cluster.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}