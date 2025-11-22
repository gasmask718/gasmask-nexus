import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users } from "lucide-react";

export default function AmbassadorRegions() {
  const { data: ambassadorRegions, isLoading } = useQuery({
    queryKey: ['ambassador-regions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_regions')
        .select(`
          *,
          ambassador:profiles!ambassador_regions_ambassador_id_fkey(id, name, email),
          region:regions(id, name, state, primary_city)
        `);
      
      if (error) throw error;
      return data;
    }
  });

  // Group by ambassador
  const groupedByAmbassador = ambassadorRegions?.reduce((acc: any, ar: any) => {
    const ambassadorId = ar.ambassador.id;
    if (!acc[ambassadorId]) {
      acc[ambassadorId] = {
        ambassador: ar.ambassador,
        regions: [],
        totalCommission: 0,
        activeCount: 0
      };
    }
    acc[ambassadorId].regions.push({
      ...ar.region,
      role: ar.role,
      commissionRate: ar.commission_rate,
      active: ar.active,
      stats: ar.stats
    });
    if (ar.active) acc[ambassadorId].activeCount++;
    acc[ambassadorId].totalCommission += ar.commission_rate || 0;
    return acc;
  }, {});

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Regional Ambassadors
          </h1>
          <p className="text-muted-foreground mt-2">
            Ambassador assignments and performance by region
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : groupedByAmbassador && Object.keys(groupedByAmbassador).length > 0 ? (
          <div className="grid gap-6">
            {Object.values(groupedByAmbassador).map((data: any) => (
              <Card key={data.ambassador.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{data.ambassador.name}</CardTitle>
                      <CardDescription>{data.ambassador.email}</CardDescription>
                    </div>
                    <Badge variant="secondary">
                      {data.activeCount} Active Region{data.activeCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.regions.map((region: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant={region.active ? 'default' : 'outline'}>
                            {region.name}
                          </Badge>
                          <div>
                            <p className="font-medium">{region.primary_city}, {region.state}</p>
                            <p className="text-sm text-muted-foreground capitalize">{region.role}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {region.commissionRate && (
                            <p className="font-semibold">{region.commissionRate}%</p>
                          )}
                          {region.stats?.stores_signed && (
                            <p className="text-sm text-muted-foreground">
                              {region.stats.stores_signed} stores signed
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Regional Ambassadors</h3>
              <p className="text-muted-foreground text-center">
                Assign ambassadors to regions to track their performance
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}