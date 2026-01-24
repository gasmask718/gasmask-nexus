import { useBusinessStore } from "@/stores/businessStore";
import { 
  useAICallAgentConfig, 
  useAITrustScore, 
  useAIPredictions,
  useRealtimeTrustScore 
} from "@/hooks/useAICallAgent";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AITrustMeter } from "@/components/communication/ai-agent/AITrustMeter";
import { AISuggestedResponsePanel } from "@/components/communication/ai-agent/AISuggestedResponsePanel";
import { AIAgentConfigPanel } from "@/components/communication/ai-agent/AIAgentConfigPanel";
import { WhyAIDidntAnswer } from "@/components/communication/ai-agent/WhyAIDidntAnswer";
import { CanaryModePanelWrapper } from "@/components/communication/ai-agent/CanaryModePanelWrapper";
import { LiveModeBannerWrapper } from "@/components/communication/ai-agent/LiveModeBannerWrapper";
import { LiveModePanel } from "@/components/communication/ai-agent/LiveModePanel";
import { GovernancePanel } from "@/components/communication/ai-agent/GovernancePanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Activity, Target, Zap, Shield } from "lucide-react";

export default function AICallAgentDashboardPage() {
  const { selectedBusiness } = useBusinessStore();
  const businessId = selectedBusiness?.id;

  const { data: config, isLoading: configLoading } = useAICallAgentConfig(businessId || null);
  const { data: trustScore, isLoading: trustLoading } = useAITrustScore(businessId || null);
  const { data: predictions, isLoading: predictionsLoading } = useAIPredictions(businessId || null, 20);
  
  // Subscribe to realtime updates
  useRealtimeTrustScore(businessId || null);

  // Check for callable users
  const { data: callableUsers } = useQuery({
    queryKey: ['callable-users-check', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('is_callable', true)
        .not('phone', 'is', null)
        .limit(1);
      return data || [];
    },
    enabled: !!businessId,
  });

  // Check for unresolved calls
  const { data: unresolvedCalls } = useQuery({
    queryKey: ['unresolved-calls-check', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data } = await supabase
        .from('call_outcomes')
        .select('id')
        .eq('business_id', businessId)
        .in('resolution_status', ['pending', 'in_progress'])
        .limit(1);
      return data || [];
    },
    enabled: !!businessId,
  });

  const hasCallableUsers = (callableUsers?.length || 0) > 0;
  const hasUnresolvedCalls = (unresolvedCalls?.length || 0) > 0;
  const lastPrediction = predictions?.[0];

  if (!businessId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Select a business to view AI Call Agent settings</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            AI Call Agent
          </h1>
          <p className="text-muted-foreground">
            Shadow mode learning, trust scoring, and gradual rollout
          </p>
        </div>
        <div className="flex items-center gap-2">
          {config?.enabled ? (
            <Badge className="bg-green-500/20 text-green-600 gap-1">
              <Activity className="h-3 w-3" />
              Active
            </Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{trustScore?.accuracy_rate?.toFixed(1) || 0}%</p>
                <p className="text-xs text-muted-foreground">Accuracy Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Activity className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{trustScore?.total_predictions || 0}</p>
                <p className="text-xs text-muted-foreground">Total Predictions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Zap className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{trustScore?.consecutive_successes || 0}</p>
                <p className="text-xs text-muted-foreground">Success Streak</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Bot className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{trustScore?.human_override_count || 0}</p>
                <p className="text-xs text-muted-foreground">Human Overrides</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Mode Banner */}
      {config?.mode === 'live' && (
        <LiveModeBannerWrapper businessId={businessId} />
      )}

      {/* Mode Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="canary">Canary Mode</TabsTrigger>
          <TabsTrigger value="live">Live Mode</TabsTrigger>
          <TabsTrigger value="governance" className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Governance
          </TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column - Trust & Config */}
            <div className="space-y-6">
              <AITrustMeter 
                trustScore={trustScore || null} 
                config={config || null}
                isLoading={configLoading || trustLoading}
              />
              <WhyAIDidntAnswer
                config={config || null}
                trustScore={trustScore || null}
                hasCallableUsers={hasCallableUsers}
                hasUnresolvedCalls={hasUnresolvedCalls}
                lastCallConfidence={lastPrediction?.confidence_score || undefined}
              />
            </div>

            {/* Middle Column - Suggestions */}
            <div className="lg:col-span-1">
              <AISuggestedResponsePanel 
                predictions={predictions || []}
                isLoading={predictionsLoading}
              />
            </div>

            {/* Right Column - Configuration */}
            <div>
              <AIAgentConfigPanel
                config={config || null}
                businessId={businessId}
                isLoading={configLoading}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="canary">
          <CanaryModePanelWrapper businessId={businessId} />
        </TabsContent>

        <TabsContent value="live">
          <LiveModePanel businessId={businessId} />
        </TabsContent>

        <TabsContent value="governance">
          <GovernancePanel businessId={businessId} />
        </TabsContent>

        <TabsContent value="config">
          <div className="max-w-2xl">
            <AIAgentConfigPanel
              config={config || null}
              businessId={businessId}
              isLoading={configLoading}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
