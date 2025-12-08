import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Flame, 
  AlertTriangle, 
  TrendingUp, 
  Calendar, 
  DollarSign,
  Phone,
  MessageSquare,
  UserCheck,
  RefreshCw,
  Send
} from "lucide-react";
import { useStoreRevenueScore, useStoreRevenueRecommendations, useRevenueEngineActions } from "@/hooks/useRevenueEngine";
import { format } from "date-fns";

interface StoreRevenueIntelligenceTabProps {
  storeId: string;
}

export function StoreRevenueIntelligenceTab({ storeId }: StoreRevenueIntelligenceTabProps) {
  const { data: score, isLoading: scoreLoading } = useStoreRevenueScore(storeId);
  const { data: recommendations, isLoading: recsLoading } = useStoreRevenueRecommendations(storeId);
  const { scoreStore, syncToFollowUp, isLoading: actionsLoading } = useRevenueEngineActions();

  const getHeatColor = (heat: number) => {
    if (heat >= 80) return 'text-red-500';
    if (heat >= 60) return 'text-orange-500';
    if (heat >= 40) return 'text-yellow-500';
    return 'text-muted-foreground';
  };

  const getChurnColor = (risk: number) => {
    if (risk >= 70) return 'text-red-500';
    if (risk >= 50) return 'text-orange-500';
    if (risk >= 30) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'ai_call': return <Phone className="h-4 w-4" />;
      case 'ai_text': return <MessageSquare className="h-4 w-4" />;
      case 'manual_call': return <UserCheck className="h-4 w-4" />;
      case 'manual_text': return <MessageSquare className="h-4 w-4" />;
      default: return <Phone className="h-4 w-4" />;
    }
  };

  const getPriorityBadge = (priority: number) => {
    if (priority === 1) return <Badge variant="destructive">P1 - Urgent</Badge>;
    if (priority === 2) return <Badge className="bg-orange-500">P2 - High</Badge>;
    if (priority === 3) return <Badge variant="secondary">P3 - Medium</Badge>;
    return <Badge variant="outline">P{priority}</Badge>;
  };

  if (scoreLoading || recsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Revenue Intelligence</h3>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => scoreStore.mutate(storeId)}
            disabled={actionsLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${scoreStore.isPending ? 'animate-spin' : ''}`} />
            Recalculate
          </Button>
          <Button 
            size="sm"
            onClick={() => syncToFollowUp.mutate(storeId)}
            disabled={actionsLoading || !recommendations?.some(r => !r.synced_to_followup)}
          >
            <Send className="h-4 w-4 mr-2" />
            Send to Follow-Up
          </Button>
        </div>
      </div>

      {score ? (
        <>
          {/* Score Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className={`h-5 w-5 ${getHeatColor(score.heat_score || 0)}`} />
                  <span className="text-sm text-muted-foreground">Heat Score</span>
                </div>
                <div className={`text-3xl font-bold ${getHeatColor(score.heat_score || 0)}`}>
                  {Math.round(score.heat_score || 0)}
                </div>
                <Progress value={score.heat_score || 0} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className={`h-5 w-5 ${getChurnColor(score.churn_risk || 0)}`} />
                  <span className="text-sm text-muted-foreground">Churn Risk</span>
                </div>
                <div className={`text-3xl font-bold ${getChurnColor(score.churn_risk || 0)}`}>
                  {Math.round(score.churn_risk || 0)}%
                </div>
                <Progress value={score.churn_risk || 0} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">7-Day Order Prob</span>
                </div>
                <div className="text-3xl font-bold text-primary">
                  {Math.round(score.order_prob_7d || 0)}%
                </div>
                <Progress value={score.order_prob_7d || 0} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-muted-foreground">Avg Order</span>
                </div>
                <div className="text-3xl font-bold text-green-500">
                  ${Math.round(score.avg_order_value || 0)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  ${Math.round(score.revenue_30d || 0)} last 30d
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Predictions & Tags */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Order Predictions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Order</span>
                  <span className="font-medium">
                    {score.last_order_at ? format(new Date(score.last_order_at), 'MMM d, yyyy') : 'Never'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Predicted Next</span>
                  <span className="font-medium">
                    {score.predicted_next_order_at ? format(new Date(score.predicted_next_order_at), 'MMM d, yyyy') : 'Unknown'}
                  </span>
                </div>
                {score.restock_window_start && score.restock_window_end && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Restock Window</span>
                    <span className="font-medium text-primary">
                      {format(new Date(score.restock_window_start), 'MMM d')} - {format(new Date(score.restock_window_end), 'MMM d')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Orders (30d / 90d)</span>
                  <span className="font-medium">
                    {score.order_count_30d || 0} / {score.order_count_90d || 0}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tags & Signals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(score.tags || []).map((tag, idx) => (
                    <Badge 
                      key={idx} 
                      variant={tag === 'hot' ? 'default' : tag === 'churn_risk' ? 'destructive' : 'secondary'}
                    >
                      {tag.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                  {(!score.tags || score.tags.length === 0) && (
                    <span className="text-sm text-muted-foreground">No tags</span>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Communication</span>
                    <span>{Math.round(score.communication_score || 0)}/100</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sentiment</span>
                    <span className={score.sentiment_score && score.sentiment_score < 0 ? 'text-red-500' : 'text-green-500'}>
                      {Math.round(score.sentiment_score || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Deal Activity</span>
                    <span>{Math.round(score.deal_activity_score || 0)}/100</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">AI Revenue Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              {recommendations && recommendations.length > 0 ? (
                <div className="space-y-3">
                  {recommendations.map((rec) => (
                    <div 
                      key={rec.id} 
                      className="flex items-start justify-between p-3 border rounded-lg bg-muted/30"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-primary/10">
                          {getActionIcon(rec.recommended_action || '')}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            {getPriorityBadge(rec.priority)}
                            <span className="text-sm font-medium capitalize">
                              {rec.recommended_action?.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{rec.notes}</p>
                          {rec.recommended_brand && (
                            <Badge variant="outline" className="mt-1">Brand: {rec.recommended_brand}</Badge>
                          )}
                        </div>
                      </div>
                      {rec.synced_to_followup ? (
                        <Badge variant="secondary" className="shrink-0">Synced</Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0">Pending</Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recommendations yet. Click "Recalculate" to generate.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">No revenue score available for this store.</p>
            <Button onClick={() => scoreStore.mutate(storeId)} disabled={actionsLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${scoreStore.isPending ? 'animate-spin' : ''}`} />
              Calculate Revenue Score
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
