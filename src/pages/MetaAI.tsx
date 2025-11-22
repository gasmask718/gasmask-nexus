import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, 
  AlertTriangle, 
  TrendingUp, 
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  Lightbulb,
  Target,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function MetaAI() {
  const [expandedReasoning, setExpandedReasoning] = useState<string | null>(null);

  const { data: systemHealth, refetch: refetchHealth } = useQuery({
    queryKey: ["ai-system-health"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_system_health")
        .select("*")
        .order("snapshot_time", { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: recommendations, refetch: refetchRecs } = useQuery({
    queryKey: ["ai-recommendations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_recommendations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const runScanMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-ai-supervisor");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("System scan complete");
      refetchHealth();
      refetchRecs();
    },
    onError: (error: Error) => {
      toast.error("Scan failed", { description: error.message });
    },
  });

  const updateRecommendationMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("ai_recommendations")
        .update({ status, actioned_at: new Date().toISOString(), actioned_by: (await supabase.auth.getUser()).data.user?.id })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recommendation updated");
      refetchRecs();
    },
  });

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "outline";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "alert": return AlertTriangle;
      case "opportunity": return Lightbulb;
      case "warning": return AlertTriangle;
      case "action": return Target;
      case "mission": return Target;
      default: return Activity;
    }
  };

  const pendingRecs = recommendations?.filter(r => r.status === "pending") || [];
  const actionedRecs = recommendations?.filter(r => r.status === "actioned") || [];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Meta-AI Supervisor</h1>
              <p className="text-muted-foreground">Real-time system intelligence & recommendations</p>
            </div>
          </div>
          <Button 
            onClick={() => runScanMutation.mutate()} 
            disabled={runScanMutation.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${runScanMutation.isPending ? 'animate-spin' : ''}`} />
            Run Full Scan
          </Button>
        </div>

        {/* System Health Dashboard */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${getHealthColor(systemHealth?.overall_health_score || 50)}`}>
                {systemHealth?.overall_health_score || 50}
              </div>
              <Progress value={systemHealth?.overall_health_score || 50} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Stores Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${getHealthColor(systemHealth?.stores_health_avg || 50)}`}>
                {systemHealth?.stores_health_avg || 50}
              </div>
              <Progress value={systemHealth?.stores_health_avg || 50} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Driver Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${getHealthColor(systemHealth?.drivers_health_avg || 50)}`}>
                {systemHealth?.drivers_health_avg || 50}
              </div>
              <Progress value={systemHealth?.drivers_health_avg || 50} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Route Efficiency</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${getHealthColor(systemHealth?.routes_efficiency_score || 50)}`}>
                {systemHealth?.routes_efficiency_score || 50}
              </div>
              <Progress value={systemHealth?.routes_efficiency_score || 50} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Additional Metrics */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Communication Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${getHealthColor(systemHealth?.communication_health_score || 50)}`}>
                {systemHealth?.communication_health_score || 50}
              </div>
              <Progress value={systemHealth?.communication_health_score || 50} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Inventory Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${getHealthColor(systemHealth?.inventory_health_score || 50)}`}>
                {systemHealth?.inventory_health_score || 50}
              </div>
              <Progress value={systemHealth?.inventory_health_score || 50} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* AI Recommendations Feed */}
        <Card>
          <CardHeader>
            <CardTitle>AI Recommendations ({pendingRecs.length} Pending)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingRecs.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No pending recommendations. Run a system scan to generate insights.
                </p>
              )}
              
              {pendingRecs.map((rec) => {
                const Icon = getCategoryIcon(rec.category);
                return (
                  <Collapsible key={rec.id}>
                    <Card className="border-2">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <Icon className="h-5 w-5 mt-1 text-primary" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold">{rec.title}</h4>
                                <Badge variant={getSeverityVariant(rec.severity)}>
                                  {rec.severity}
                                </Badge>
                                <Badge variant="outline">
                                  {rec.category}
                                </Badge>
                                {rec.confidence_score && (
                                  <Badge variant="secondary">
                                    {rec.confidence_score}% confidence
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">
                                {rec.description}
                              </p>
                              
                              {rec.reasoning && (
                                <CollapsibleTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => setExpandedReasoning(
                                      expandedReasoning === rec.id ? null : rec.id
                                    )}
                                  >
                                    {expandedReasoning === rec.id ? (
                                      <ChevronUp className="mr-2 h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="mr-2 h-4 w-4" />
                                    )}
                                    Explain Why
                                  </Button>
                                </CollapsibleTrigger>
                              )}
                              
                              <CollapsibleContent>
                                <div className="mt-3 p-3 bg-muted rounded-lg">
                                  <p className="text-sm">{rec.reasoning}</p>
                                </div>
                              </CollapsibleContent>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateRecommendationMutation.mutate({ 
                                id: rec.id, 
                                status: "actioned" 
                              })}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Action
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateRecommendationMutation.mutate({ 
                                id: rec.id, 
                                status: "dismissed" 
                              })}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>

            {actionedRecs.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3 text-muted-foreground">
                  Recently Actioned ({actionedRecs.length})
                </h3>
                <div className="space-y-2">
                  {actionedRecs.slice(0, 5).map((rec) => (
                    <div key={rec.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm flex-1">{rec.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {new Date(rec.actioned_at!).toLocaleDateString()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
