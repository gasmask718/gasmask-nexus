import { useState } from "react";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { MapPin, TrendingUp, Users, DollarSign, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Expansion() {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: expansionScores, refetch } = useQuery({
    queryKey: ["expansion-scores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expansion_scores")
        .select("*")
        .order("score", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("expansion-ai");
      
      if (error) throw error;

      toast({
        title: "Analysis complete",
        description: "Expansion opportunities have been updated",
      });
      
      refetch();
    } catch (error: any) {
      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const cities = expansionScores?.filter((s) => s.location_type === "city") || [];
  const zips = expansionScores?.filter((s) => s.location_type === "zip") || [];

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return "bg-red-500";
      case 2: return "bg-yellow-500";
      default: return "bg-green-500";
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 1: return "High Priority";
      case 2: return "Medium Priority";
      default: return "Low Priority";
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Territory Expansion AI</h1>
            <p className="text-muted-foreground">
              Identify the best markets for GasMask growth
            </p>
          </div>
          <Button onClick={runAnalysis} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <>
                <Zap className="mr-2 h-4 w-4 animate-pulse" />
                Analyzing...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Run Analysis
              </>
            )}
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Priority</p>
                <p className="text-2xl font-bold">
                  {expansionScores?.filter((s) => s.priority === 1).length || 0}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-red-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cities</p>
                <p className="text-2xl font-bold">{cities.length}</p>
              </div>
              <MapPin className="h-8 w-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ZIP Codes</p>
                <p className="text-2xl font-bold">{zips.length}</p>
              </div>
              <MapPin className="h-8 w-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg ROI</p>
                <p className="text-2xl font-bold">
                  ${(
                    expansionScores?.reduce((sum, s) => sum + (s.expected_roi || 0), 0) /
                    (expansionScores?.length || 1)
                  ).toFixed(0)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </Card>
        </div>

        {/* Expansion Opportunities */}
        <Tabs defaultValue="cities" className="w-full">
          <TabsList>
            <TabsTrigger value="cities">Cities</TabsTrigger>
            <TabsTrigger value="zips">ZIP Codes</TabsTrigger>
          </TabsList>

          <TabsContent value="cities" className="space-y-4">
            {cities.map((city) => (
              <Card key={city.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold">{city.location_name}</h3>
                      {city.state && (
                        <Badge variant="outline">{city.state}</Badge>
                      )}
                      <Badge className={getPriorityColor(city.priority || 3)}>
                        {getPriorityLabel(city.priority || 3)}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">{city.reasoning}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-primary">
                      {city.score}
                    </div>
                    <div className="text-sm text-muted-foreground">Score</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Expected ROI</div>
                    <div className="text-lg font-semibold">
                      ${city.expected_roi?.toFixed(0) || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Drivers Needed</div>
                    <div className="text-lg font-semibold">
                      {city.driver_capacity_needed || 0}
                    </div>
                  </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Timeline</div>
                      <div className="text-lg font-semibold">
                        {typeof city.recommendations === 'object' && city.recommendations !== null
                          ? (city.recommendations as any).launch_timeline?.replace("_", " ") || "TBD"
                          : "TBD"}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">New Stores</div>
                      <div className="text-lg font-semibold">
                        {typeof city.recommendations === 'object' && city.recommendations !== null
                          ? (city.recommendations as any).suggested_new_stores || 0
                          : 0}
                      </div>
                    </div>
                </div>

                <Button className="w-full">Deploy Mission Pack</Button>
              </Card>
            ))}

            {cities.length === 0 && (
              <Card className="p-12 text-center">
                <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">No city data yet</h3>
                <p className="text-muted-foreground">
                  Run the expansion analysis to see opportunities
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="zips" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {zips.map((zip) => (
                <Card key={zip.id} className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold">ZIP {zip.location_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {zip.state}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {zip.score}
                      </div>
                    </div>
                  </div>

                  <Badge className={`${getPriorityColor(zip.priority || 3)} mb-3`}>
                    {getPriorityLabel(zip.priority || 3)}
                  </Badge>

                  <p className="text-sm text-muted-foreground mb-4">
                    {zip.reasoning}
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Expected ROI</div>
                      <div className="font-semibold">
                        ${zip.expected_roi?.toFixed(0) || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">New Stores</div>
                      <div className="font-semibold">
                        {typeof zip.recommendations === 'object' && zip.recommendations !== null
                          ? (zip.recommendations as any).suggested_new_stores || 0
                          : 0}
                      </div>
                    </div>
                  </div>

                  {typeof zip.recommendations === 'object' && 
                   zip.recommendations !== null && 
                   (zip.recommendations as any).blitz_mission_pack && (
                    <Badge variant="secondary" className="w-full justify-center">
                      Blitz Mission Ready
                    </Badge>
                  )}
                </Card>
              ))}
            </div>

            {zips.length === 0 && (
              <Card className="p-12 text-center">
                <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">No ZIP data yet</h3>
                <p className="text-muted-foreground">
                  Run the expansion analysis to see opportunities
                </p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}