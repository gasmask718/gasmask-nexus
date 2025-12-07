import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, TrendingDown, Clock, Zap, Store } from "lucide-react";
import { usePredictiveIntelligence } from "@/hooks/usePredictiveIntelligence";

interface ChurnPredictionPanelProps {
  businessId?: string;
}

export function ChurnPredictionPanel({ businessId }: ChurnPredictionPanelProps) {
  const { riskScores, riskLoading, triggerRecovery, stats } = usePredictiveIntelligence(businessId);

  const getRiskColor = (risk: number) => {
    if (risk >= 75) return "text-destructive";
    if (risk >= 50) return "text-yellow-500";
    return "text-green-500";
  };

  const getRiskBadge = (risk: number) => {
    if (risk >= 75) return <Badge variant="destructive">Critical</Badge>;
    if (risk >= 50) return <Badge className="bg-yellow-500">At Risk</Badge>;
    return <Badge variant="secondary">Stable</Badge>;
  };

  const getProgressColor = (risk: number) => {
    if (risk >= 75) return "bg-destructive";
    if (risk >= 50) return "bg-yellow-500";
    return "bg-green-500";
  };

  if (riskLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Critical Risk</p>
                <p className="text-2xl font-bold text-destructive">{stats.highRiskCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <TrendingDown className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">At Risk</p>
                <p className="text-2xl font-bold text-yellow-500">{stats.mediumRiskCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Timeframe</p>
                <p className="text-2xl font-bold">14 days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Churn Risk Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {riskScores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No churn predictions available</p>
              <p className="text-sm">AI will analyze store communication patterns</p>
            </div>
          ) : (
            <div className="space-y-4">
              {riskScores.map((score) => (
                <div
                  key={score.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {score.store?.store_name || "Unknown Store"}
                        </span>
                        {getRiskBadge(score.churn_risk)}
                      </div>

                      <div className="flex items-center gap-4 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Churn Risk</span>
                            <span className={`font-bold ${getRiskColor(score.churn_risk)}`}>
                              {score.churn_risk}%
                            </span>
                          </div>
                          <Progress
                            value={score.churn_risk}
                            className={`h-2 [&>div]:${getProgressColor(score.churn_risk)}`}
                          />
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {score.predicted_timeframe || "30 days"}
                        </div>
                      </div>

                      {score.risk_factors && score.risk_factors.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {(score.risk_factors as string[]).slice(0, 3).map((factor, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {factor}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {score.ai_summary && (
                        <p className="text-sm text-muted-foreground">{score.ai_summary}</p>
                      )}
                    </div>

                    <Button
                      size="sm"
                      onClick={() => triggerRecovery(score.store_id!)}
                      disabled={!score.store_id}
                    >
                      <Zap className="h-4 w-4 mr-1" />
                      Recover
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
