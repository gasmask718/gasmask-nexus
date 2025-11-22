import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, MessageSquare, AlertCircle, Sparkles } from "lucide-react";
import { useState } from "react";
import { AIRecommendedScriptsModal } from "./AIRecommendedScriptsModal";

interface AIRelationshipHealthProps {
  entityType: 'store' | 'wholesaler' | 'influencer';
  entityId: string;
}

export const AIRelationshipHealth = ({ entityType, entityId }: AIRelationshipHealthProps) => {
  const [showScriptsModal, setShowScriptsModal] = useState(false);

  const { data: aiData, isLoading, refetch } = useQuery({
    queryKey: ['ai-relationship-health', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('communication-brain', {
        body: { entityType, entityId }
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Relationship Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Analyzing relationship data...</div>
        </CardContent>
      </Card>
    );
  }

  if (!aiData) return null;

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getUrgencyBadge = (color: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      green: { variant: 'default', label: 'Healthy' },
      yellow: { variant: 'secondary', label: 'Needs Attention' },
      red: { variant: 'destructive', label: 'Critical' }
    };
    const config = variants[color] || variants.green;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getChannelIcon = (channel: string) => {
    return <MessageSquare className="h-4 w-4" />;
  };

  return (
    <>
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Relationship Health
            </div>
            {getUrgencyBadge(aiData.urgency_color)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Health Score */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Health Score</div>
              <div className={`text-4xl font-bold ${getScoreColor(aiData.health_score)}`}>
                {aiData.health_score}
                <span className="text-lg">/100</span>
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-sm text-muted-foreground">Last Contact</div>
              <div className="text-lg font-semibold">
                {aiData.days_since_last_contact} days ago
              </div>
              <div className="text-xs text-muted-foreground">
                Response Rate: {aiData.response_rate}%
              </div>
            </div>
          </div>

          {/* Best Channel */}
          <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
            {getChannelIcon(aiData.next_best_channel)}
            <div>
              <div className="text-sm font-medium">Recommended Channel</div>
              <div className="text-xs text-muted-foreground capitalize">
                {aiData.next_best_channel} (best response rate)
              </div>
            </div>
          </div>

          {/* AI Recommendations */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Recommendations
            </div>
            {aiData.recommended_actions.map((action: string, idx: number) => (
              <div key={idx} className="flex items-start gap-2 text-sm p-2 bg-muted/50 rounded">
                <AlertCircle className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>{action}</span>
              </div>
            ))}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-secondary/30 rounded">
              <div className="text-xs text-muted-foreground">30-Day Activity</div>
              <div className="text-lg font-semibold">{aiData.total_communications_30d}</div>
            </div>
            <div className="p-3 bg-secondary/30 rounded">
              <div className="text-xs text-muted-foreground">Avg Frequency</div>
              <div className="text-lg font-semibold">{aiData.contact_frequency_days}d</div>
            </div>
          </div>

          {/* Action Button */}
          <Button 
            onClick={() => setShowScriptsModal(true)}
            className="w-full"
            variant="outline"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Generate AI Scripts
          </Button>
        </CardContent>
      </Card>

      <AIRecommendedScriptsModal
        open={showScriptsModal}
        onOpenChange={setShowScriptsModal}
        scripts={aiData.scripts}
        entityType={entityType}
      />
    </>
  );
};
