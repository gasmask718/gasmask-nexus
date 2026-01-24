import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  Shield, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Target,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Info
} from "lucide-react";
import { useTrustCalibration, useGraduationThresholds } from "@/hooks/useShadowMode";
import { useAICallAgentConfig } from "@/hooks/useAICallAgent";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TrustScorecardProps {
  businessId: string | null;
}

const MODE_REQUIREMENTS = {
  shadow: {
    next: 'assisted',
    requirements: ['min_predictions', 'min_accuracy', 'max_violations', 'min_days'],
  },
  assisted: {
    next: 'canary',
    requirements: ['min_suggestions', 'min_acceptance_rate', 'min_trust_score', 'min_days'],
  },
  canary: {
    next: 'live',
    requirements: ['min_calls', 'min_success_rate', 'min_trust_score', 'min_days'],
  },
  live: {
    next: null,
    requirements: [],
  },
};

export function TrustScorecard({ businessId }: TrustScorecardProps) {
  const { data: trustScore, isLoading: trustLoading } = useTrustCalibration(businessId);
  const { data: thresholds } = useGraduationThresholds(businessId);
  const { data: config } = useAICallAgentConfig(businessId);

  const currentMode = config?.mode || 'off';
  const modeInfo = MODE_REQUIREMENTS[currentMode as keyof typeof MODE_REQUIREMENTS];

  if (!businessId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Select a business to view Trust Scorecard
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 80) return 'text-emerald-500';
    if (score >= 70) return 'text-amber-500';
    if (score >= 60) return 'text-orange-500';
    return 'text-destructive';
  };

  const getProgressColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 70) return 'bg-amber-500';
    if (score >= 60) return 'bg-orange-500';
    return 'bg-destructive';
  };

  const TrendIcon = trustScore?.score_trend === 'improving' ? TrendingUp :
                   trustScore?.score_trend === 'declining' ? TrendingDown : Minus;
  const trendColor = trustScore?.score_trend === 'improving' ? 'text-green-500' :
                    trustScore?.score_trend === 'declining' ? 'text-destructive' : 'text-muted-foreground';

  return (
    <div className="space-y-6">
      {/* Main Trust Score */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Trust Scorecard</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <TrendIcon className={cn("h-5 w-5", trendColor)} />
              <Badge variant="secondary">
                {trustScore?.score_trend || 'No trend'}
              </Badge>
            </div>
          </div>
          <CardDescription>
            AI reliability measured against human decisions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <div className="relative">
              <svg className="w-40 h-40 transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="12"
                  className="text-muted"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="12"
                  strokeDasharray={440}
                  strokeDashoffset={440 - (440 * (trustScore?.overall_trust_score || 0)) / 100}
                  className={getScoreColor(trustScore?.overall_trust_score || 0)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-4xl font-bold", getScoreColor(trustScore?.overall_trust_score || 0))}>
                  {trustScore?.overall_trust_score?.toFixed(1) || '—'}
                </span>
                <span className="text-sm text-muted-foreground">Trust Score</span>
              </div>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <TooltipProvider>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      Resolution Accuracy
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Would AI have resolved calls correctly?
                        </TooltipContent>
                      </Tooltip>
                    </span>
                    <span className={cn("text-sm font-medium", getScoreColor(trustScore?.resolution_accuracy || 0))}>
                      {trustScore?.resolution_accuracy?.toFixed(1) || '0'}%
                    </span>
                  </div>
                  <Progress value={trustScore?.resolution_accuracy || 0} className="h-2" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      Escalation Timing
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Would AI have escalated at the right time?
                        </TooltipContent>
                      </Tooltip>
                    </span>
                    <span className={cn("text-sm font-medium", getScoreColor(trustScore?.escalation_timing || 0))}>
                      {trustScore?.escalation_timing?.toFixed(1) || '0'}%
                    </span>
                  </div>
                  <Progress value={trustScore?.escalation_timing || 0} className="h-2" />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      Compliance
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Would AI have followed rules?
                        </TooltipContent>
                      </Tooltip>
                    </span>
                    <span className={cn("text-sm font-medium", getScoreColor(trustScore?.compliance_adherence || 0))}>
                      {trustScore?.compliance_adherence?.toFixed(1) || '0'}%
                    </span>
                  </div>
                  <Progress value={trustScore?.compliance_adherence || 0} className="h-2" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      Efficiency
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Would AI have been faster/better?
                        </TooltipContent>
                      </Tooltip>
                    </span>
                    <span className={cn("text-sm font-medium", getScoreColor(trustScore?.efficiency_score || 0))}>
                      {trustScore?.efficiency_score?.toFixed(1) || '0'}%
                    </span>
                  </div>
                  <Progress value={trustScore?.efficiency_score || 0} className="h-2" />
                </div>
              </div>
            </TooltipProvider>
          </div>

          {/* Comparison Stats */}
          <div className="grid grid-cols-4 gap-2 mt-6 pt-4 border-t">
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-xl font-bold">{trustScore?.total_comparisons || 0}</p>
              <p className="text-xs text-muted-foreground">Comparisons</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-green-500/10">
              <p className="text-xl font-bold text-green-600">{trustScore?.ai_would_have_matched || 0}</p>
              <p className="text-xs text-muted-foreground">Matched</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-blue-500/10">
              <p className="text-xl font-bold text-blue-600">{trustScore?.ai_would_have_been_better || 0}</p>
              <p className="text-xs text-muted-foreground">AI Better</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-destructive/10">
              <p className="text-xl font-bold text-destructive">{trustScore?.ai_would_have_violated_rules || 0}</p>
              <p className="text-xs text-muted-foreground">Violations</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Demotion Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Demotion Triggers
          </CardTitle>
          <CardDescription>
            Conditions that will cause automatic demotion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Consecutive Failures</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {trustScore?.consecutive_bad_predictions || 0} / {thresholds?.demotion_consecutive_failures || 3}
                </span>
                {(trustScore?.consecutive_bad_predictions || 0) >= (thresholds?.demotion_consecutive_failures || 3) ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Trust Score Floor</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {trustScore?.overall_trust_score?.toFixed(1) || '—'} / {thresholds?.demotion_trust_score_floor || 70}
                </span>
                {(trustScore?.overall_trust_score || 0) < (thresholds?.demotion_trust_score_floor || 70) ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Compliance Violations</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {trustScore?.ai_would_have_violated_rules || 0} / {thresholds?.demotion_violation_threshold || 1}
                </span>
                {(trustScore?.ai_would_have_violated_rules || 0) >= (thresholds?.demotion_violation_threshold || 1) ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calibration Info */}
      {trustScore && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
          <span>Last calibrated: {new Date(trustScore.last_calibrated_at).toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
