import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Play, TrendingUp, MapPin } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function ExpansionRegions() {
  const queryClient = useQueryClient();

  const { data: regions, isLoading } = useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const runAnalysisMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('territory-ai');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success('Territory analysis complete');
      queryClient.invalidateQueries({ queryKey: ['regions'] });
      console.log('Analysis results:', data);
    },
    onError: (error) => {
      toast.error('Analysis failed: ' + (error as Error).message);
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'planning': return 'bg-blue-500';
      case 'paused': return 'bg-yellow-500';
      case 'retired': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <MapPin className="h-8 w-8" />
              Territory Regions
            </h1>
            <p className="text-muted-foreground mt-2">
              Multi-state expansion and performance overview
            </p>
          </div>
          <Button
            onClick={() => runAnalysisMutation.mutate()}
            disabled={runAnalysisMutation.isPending}
          >
            {runAnalysisMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Analysis...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Expansion AI
              </>
            )}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : regions && regions.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {regions.map((region: any) => (
              <Card key={region.id} className="hover:bg-accent/50 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{region.name}</CardTitle>
                      <CardDescription>
                        {region.primary_city}, {region.state}
                      </CardDescription>
                    </div>
                    <Badge className={getStatusColor(region.status)}>
                      {region.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {region.target_store_count && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Store Target Progress</span>
                        <span className="font-medium">0 / {region.target_store_count}</span>
                      </div>
                      <Progress value={0} />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Code</p>
                      <p className="font-medium">{region.code || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Launch Date</p>
                      <p className="font-medium">
                        {region.launch_date
                          ? new Date(region.launch_date).toLocaleDateString()
                          : '-'}
                      </p>
                    </div>
                  </div>

                  {region.city_cluster && region.city_cluster.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">City Cluster</p>
                      <div className="flex flex-wrap gap-1">
                        {region.city_cluster.map((city: string, idx: number) => (
                          <Badge key={idx} variant="outline">
                            {city}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {region.notes && (
                    <p className="text-sm text-muted-foreground">{region.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12">
              <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Regions Yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first territory region to start tracking multi-state expansion
              </p>
              <Button onClick={() => runAnalysisMutation.mutate()}>
                <Play className="mr-2 h-4 w-4" />
                Run Initial Analysis
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}