import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
  Scale, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  User,
  Bot,
  ArrowRight,
  Clock,
  MessageSquare
} from "lucide-react";
import { useAIVsHumanDiffs } from "@/hooks/useShadowMode";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface AIVsHumanDiffViewerProps {
  businessId: string | null;
}

const VERDICT_CONFIG = {
  ai_correct: { 
    label: 'AI Correct', 
    icon: Bot, 
    color: 'bg-green-500/20 text-green-600',
    description: 'AI would have made a better decision'
  },
  human_correct: { 
    label: 'Human Correct', 
    icon: User, 
    color: 'bg-blue-500/20 text-blue-600',
    description: 'Human made the better decision'
  },
  both_valid: { 
    label: 'Both Valid', 
    icon: CheckCircle, 
    color: 'bg-emerald-500/20 text-emerald-600',
    description: 'Both approaches were acceptable'
  },
  ai_violation: { 
    label: 'AI Violation', 
    icon: AlertTriangle, 
    color: 'bg-destructive/20 text-destructive',
    description: 'AI would have violated rules'
  },
  inconclusive: { 
    label: 'Inconclusive', 
    icon: Scale, 
    color: 'bg-muted text-muted-foreground',
    description: 'Unable to determine winner'
  },
};

const SEVERITY_CONFIG = {
  none: { label: 'None', color: 'text-muted-foreground' },
  minor: { label: 'Minor', color: 'text-blue-500' },
  moderate: { label: 'Moderate', color: 'text-amber-500' },
  major: { label: 'Major', color: 'text-orange-500' },
  critical: { label: 'Critical', color: 'text-destructive' },
};

export function AIVsHumanDiffViewer({ businessId }: AIVsHumanDiffViewerProps) {
  const { data: diffs, isLoading } = useAIVsHumanDiffs(businessId, 50);

  if (!businessId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Select a business to view AI vs Human comparisons
        </CardContent>
      </Card>
    );
  }

  // Calculate verdict stats
  const verdictStats = diffs?.reduce((acc, diff) => {
    acc[diff.verdict] = (acc[diff.verdict] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Scale className="h-6 w-6 text-muted-foreground" />
        <div>
          <h2 className="text-2xl font-bold">AI vs Human Comparison</h2>
          <p className="text-sm text-muted-foreground">
            Detailed analysis of AI predictions vs human decisions
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(VERDICT_CONFIG).map(([key, config]) => {
          const VerdictIcon = config.icon;
          const count = verdictStats[key] || 0;
          return (
            <Card key={key}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <div className={cn("p-2 rounded-full", config.color)}>
                    <VerdictIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{config.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Diff List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Comparison Log</CardTitle>
          <CardDescription>
            Side-by-side comparison of AI predictions and human actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : diffs && diffs.length > 0 ? (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {diffs.map((diff) => {
                  const verdictConfig = VERDICT_CONFIG[diff.verdict];
                  const VerdictIcon = verdictConfig.icon;
                  const severityConfig = SEVERITY_CONFIG[diff.impact_severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.none;

                  return (
                    <div 
                      key={diff.id}
                      className="p-4 rounded-lg border bg-card"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Badge className={cn("gap-1", verdictConfig.color)}>
                            <VerdictIcon className="h-3 w-3" />
                            {verdictConfig.label}
                          </Badge>
                          <Badge variant="outline">
                            {diff.comparison_type}
                          </Badge>
                          {diff.impact_severity && diff.impact_severity !== 'none' && (
                            <Badge variant="outline" className={severityConfig.color}>
                              {severityConfig.label} Impact
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(diff.created_at), { addSuffix: true })}
                        </div>
                      </div>

                      {/* Comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* AI Side */}
                        <div className="p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2 mb-2">
                            <Bot className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm">AI Prediction</span>
                            {diff.ai_confidence && (
                              <Badge variant="secondary" className="text-xs ml-auto">
                                {diff.ai_confidence}% confident
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm">{diff.ai_decision}</p>
                          {diff.ai_reasoning && (
                            <p className="text-xs text-muted-foreground mt-2 italic">
                              "{diff.ai_reasoning}"
                            </p>
                          )}
                        </div>

                        {/* Human Side */}
                        <div className="p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 text-blue-500" />
                            <span className="font-medium text-sm">Human Action</span>
                          </div>
                          <p className="text-sm">{diff.human_decision}</p>
                          {diff.human_context && (
                            <p className="text-xs text-muted-foreground mt-2 italic">
                              "{diff.human_context}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Verdict Details */}
                      {diff.verdict_reason && (
                        <div className="mt-3 pt-3 border-t flex items-start gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <p className="text-sm text-muted-foreground">{diff.verdict_reason}</p>
                        </div>
                      )}

                      {/* Warning flags */}
                      {(diff.would_have_caused_escalation || diff.would_have_violated_compliance) && (
                        <div className="mt-3 pt-3 border-t flex items-center gap-3">
                          {diff.would_have_caused_escalation && (
                            <Badge variant="outline" className="text-amber-500">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Would have escalated
                            </Badge>
                          )}
                          {diff.would_have_violated_compliance && (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Compliance violation
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Review Status */}
                      {diff.reviewed_at && (
                        <div className="mt-3 pt-3 border-t">
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Reviewed {formatDistanceToNow(new Date(diff.reviewed_at), { addSuffix: true })}
                          </Badge>
                          {diff.reviewer_notes && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {diff.reviewer_notes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No comparisons yet. Comparisons appear when shadow predictions are matched with human actions.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
