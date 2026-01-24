import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Eye, 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Clock,
  Zap
} from "lucide-react";
import { useShadowPredictions, useTrustCalibration } from "@/hooks/useShadowMode";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ShadowModeDashboardProps {
  businessId: string | null;
}

export function ShadowModeDashboard({ businessId }: ShadowModeDashboardProps) {
  const { data: predictions, isLoading: predictionsLoading } = useShadowPredictions(businessId, 20);
  const { data: trustScore, isLoading: trustLoading } = useTrustCalibration(businessId);

  if (!businessId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Select a business to view Shadow Mode dashboard
        </CardContent>
      </Card>
    );
  }

  const isLoading = predictionsLoading || trustLoading;

  // Calculate stats from predictions
  const compared = predictions?.filter(p => p.would_have_matched !== null) || [];
  const matched = compared.filter(p => p.would_have_matched);
  const matchRate = compared.length > 0 ? (matched.length / compared.length) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Eye className="h-6 w-6 text-muted-foreground" />
        <div>
          <h2 className="text-2xl font-bold">Shadow Mode</h2>
          <p className="text-sm text-muted-foreground">
            AI observes and predicts without speaking
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          <Eye className="h-3 w-3 mr-1" />
          Observing
        </Badge>
      </div>

      {/* Trust Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Trust Score</p>
                <p className={cn(
                  "text-3xl font-bold",
                  (trustScore?.overall_trust_score || 0) >= 85 ? "text-green-500" :
                  (trustScore?.overall_trust_score || 0) >= 70 ? "text-amber-500" : "text-destructive"
                )}>
                  {trustScore?.overall_trust_score?.toFixed(1) || '—'}
                </p>
              </div>
              {trustScore?.score_trend === 'improving' && <TrendingUp className="h-8 w-8 text-green-500" />}
              {trustScore?.score_trend === 'declining' && <TrendingDown className="h-8 w-8 text-destructive" />}
              {trustScore?.score_trend === 'stable' && <Brain className="h-8 w-8 text-muted-foreground" />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Predictions</p>
              <p className="text-3xl font-bold">{predictions?.length || 0}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {compared.length} compared with human
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Match Rate</p>
              <p className="text-3xl font-bold">{matchRate.toFixed(1)}%</p>
            </div>
            <Progress value={matchRate} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Accuracy</p>
              <p className="text-3xl font-bold">
                {trustScore?.resolution_accuracy?.toFixed(1) || '—'}%
              </p>
            </div>
            <Progress value={trustScore?.resolution_accuracy || 0} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Trust Breakdown */}
      {trustScore && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Trust Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Resolution Accuracy</p>
                <Progress value={trustScore.resolution_accuracy} className="h-2" />
                <p className="text-sm font-medium mt-1">{trustScore.resolution_accuracy?.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Escalation Timing</p>
                <Progress value={trustScore.escalation_timing} className="h-2" />
                <p className="text-sm font-medium mt-1">{trustScore.escalation_timing?.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Compliance</p>
                <Progress value={trustScore.compliance_adherence} className="h-2" />
                <p className="text-sm font-medium mt-1">{trustScore.compliance_adherence?.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Efficiency</p>
                <Progress value={trustScore.efficiency_score} className="h-2" />
                <p className="text-sm font-medium mt-1">{trustScore.efficiency_score?.toFixed(1)}%</p>
              </div>
            </div>

            <div className="flex items-center gap-6 mt-6 pt-4 border-t">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  {trustScore.ai_would_have_matched} matched
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-500" />
                <span className="text-sm">
                  {trustScore.ai_would_have_been_better} AI better
                </span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-amber-500" />
                <span className="text-sm">
                  {trustScore.ai_would_have_been_worse} Human better
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm">
                  {trustScore.ai_would_have_violated_rules} violations
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Predictions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Shadow Predictions</CardTitle>
          <CardDescription>
            AI's silent predictions during human-handled calls
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : predictions && predictions.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {predictions.map((prediction) => (
                  <div 
                    key={prediction.id}
                    className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">
                            {prediction.predicted_intent}
                          </Badge>
                          <Badge 
                            variant={prediction.confidence_score >= 80 ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {prediction.confidence_score}% confident
                          </Badge>
                          {prediction.predicted_escalation && (
                            <Badge variant="destructive" className="text-xs">
                              Would Escalate
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm line-clamp-2 mb-2">
                          <span className="font-medium">AI would say: </span>
                          {prediction.predicted_response}
                        </p>

                        {prediction.human_actual_response && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            <span className="font-medium">Human said: </span>
                            {prediction.human_actual_response}
                          </p>
                        )}

                        {prediction.risk_flags && prediction.risk_flags.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                            {prediction.risk_flags.map((flag, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {flag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        {prediction.would_have_matched !== null && (
                          <div className="mb-2">
                            {prediction.would_have_matched ? (
                              <Badge className="bg-green-500/20 text-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Match
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <XCircle className="h-3 w-3 mr-1" />
                                Diff
                              </Badge>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(prediction.prediction_timestamp), { addSuffix: true })}
                        </div>
                        {prediction.processing_time_ms && (
                          <p className="text-xs text-muted-foreground">
                            {prediction.processing_time_ms}ms
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No shadow predictions yet. Predictions will appear when AI observes human calls.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
