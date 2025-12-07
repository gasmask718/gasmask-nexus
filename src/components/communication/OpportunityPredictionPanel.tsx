import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Star, Package, Zap, Store, Sparkles } from "lucide-react";
import { usePredictiveIntelligence } from "@/hooks/usePredictiveIntelligence";

interface OpportunityPredictionPanelProps {
  businessId?: string;
}

export function OpportunityPredictionPanel({ businessId }: OpportunityPredictionPanelProps) {
  const { opportunityScores, opportunityLoading, triggerUpsell, stats } = usePredictiveIntelligence(businessId);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-blue-500";
    return "text-muted-foreground";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-500">Hot Lead</Badge>;
    if (score >= 60) return <Badge className="bg-blue-500">Warm</Badge>;
    return <Badge variant="secondary">Monitor</Badge>;
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-blue-500";
    return "bg-muted";
  };

  if (opportunityLoading) {
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
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Star className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hot Opportunities</p>
                <p className="text-2xl font-bold text-green-500">{stats.highOpportunityCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Growth Potential</p>
                <p className="text-2xl font-bold text-blue-500">
                  {opportunityScores.length > 0
                    ? Math.round(opportunityScores.reduce((sum, s) => sum + s.opportunity_score, 0) / opportunityScores.length)
                    : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Product Interest</p>
                <p className="text-2xl font-bold">{opportunityScores.filter(s => s.predicted_product_interest).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Opportunity List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Upsell & Reactivation Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          {opportunityScores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No opportunities detected yet</p>
              <p className="text-sm">AI will identify growth patterns</p>
            </div>
          ) : (
            <div className="space-y-4">
              {opportunityScores.map((score) => (
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
                        {getScoreBadge(score.opportunity_score)}
                      </div>

                      <div className="flex items-center gap-4 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Opportunity Score</span>
                            <span className={`font-bold ${getScoreColor(score.opportunity_score)}`}>
                              {score.opportunity_score}%
                            </span>
                          </div>
                          <Progress
                            value={score.opportunity_score}
                            className={`h-2 [&>div]:${getProgressColor(score.opportunity_score)}`}
                          />
                        </div>
                      </div>

                      {score.predicted_product_interest && (
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            Interested in: <strong>{score.predicted_product_interest}</strong>
                          </span>
                        </div>
                      )}

                      {score.opportunity_factors && (score.opportunity_factors as string[]).length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {(score.opportunity_factors as string[]).slice(0, 3).map((factor, i) => (
                            <Badge key={i} variant="outline" className="text-xs bg-green-500/10">
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
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => triggerUpsell(score.store_id!)}
                      disabled={!score.store_id}
                    >
                      <Zap className="h-4 w-4 mr-1" />
                      Upsell
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
