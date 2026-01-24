import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldAlert, 
  Users, 
  Clock, 
  TrendingDown, 
  AlertCircle,
  CheckCircle2,
  Settings,
  Activity
} from "lucide-react";

interface BlockingReason {
  id: string;
  label: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  icon: React.ElementType;
}

interface WhyAIDidntAnswerExplainerProps {
  currentMode: string;
  confidenceScore: number;
  confidenceThreshold: number;
  hasCallableUsers: boolean;
  hasUnresolvedQueue: boolean;
  requireCallableFallback: boolean;
  requireResolvedQueue: boolean;
  consecutiveFailures: number;
  maxConsecutiveFailures: number;
}

export function WhyAIDidntAnswerExplainer({
  currentMode,
  confidenceScore,
  confidenceThreshold,
  hasCallableUsers,
  hasUnresolvedQueue,
  requireCallableFallback,
  requireResolvedQueue,
  consecutiveFailures,
  maxConsecutiveFailures,
}: WhyAIDidntAnswerExplainerProps) {
  const blockingReasons: BlockingReason[] = [];

  // Check each condition
  if (currentMode === 'shadow') {
    blockingReasons.push({
      id: 'shadow_mode',
      label: 'Shadow Mode Active',
      description: 'AI is in observation-only mode. It analyzes calls but does not answer or suggest.',
      severity: 'info',
      icon: Activity,
    });
  }

  if (currentMode === 'assisted') {
    blockingReasons.push({
      id: 'assisted_mode',
      label: 'Assisted Mode Active',
      description: 'AI provides suggestions to human operators but does not answer calls directly.',
      severity: 'info',
      icon: Settings,
    });
  }

  if (confidenceScore < confidenceThreshold) {
    blockingReasons.push({
      id: 'low_confidence',
      label: 'Confidence Below Threshold',
      description: `Current confidence (${confidenceScore}%) is below required threshold (${confidenceThreshold}%). AI needs more successful predictions.`,
      severity: 'warning',
      icon: TrendingDown,
    });
  }

  if (requireCallableFallback && !hasCallableUsers) {
    blockingReasons.push({
      id: 'no_callable',
      label: 'No Callable Users Available',
      description: 'AI requires at least one human fallback to be available before answering calls.',
      severity: 'critical',
      icon: Users,
    });
  }

  if (requireResolvedQueue && hasUnresolvedQueue) {
    blockingReasons.push({
      id: 'unresolved_queue',
      label: 'Unresolved Calls in Queue',
      description: 'There are unresolved missed calls or voicemails that must be addressed first.',
      severity: 'critical',
      icon: Clock,
    });
  }

  if (consecutiveFailures >= maxConsecutiveFailures) {
    blockingReasons.push({
      id: 'consecutive_failures',
      label: 'Too Many Consecutive Failures',
      description: `AI has failed ${consecutiveFailures} times in a row (max: ${maxConsecutiveFailures}). Manual review required.`,
      severity: 'critical',
      icon: AlertCircle,
    });
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-destructive bg-destructive/10 border-destructive/20';
      case 'warning': return 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20';
      default: return 'text-primary bg-primary/10 border-primary/20';
    }
  };

  const getSeverityBadge = (severity: string): "destructive" | "secondary" | "default" => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'warning': return 'secondary';
      default: return 'default';
    }
  };

  // If no blocking reasons, AI could answer
  if (blockingReasons.length === 0) {
    return (
      <Card className="border-green-500/20 bg-green-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            AI Ready to Answer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            All conditions are met. AI can answer calls when in Canary or Live mode.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          Why AI Isn't Answering Calls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {blockingReasons.map((reason) => (
          <div
            key={reason.id}
            className={`p-3 rounded-lg border ${getSeverityColor(reason.severity)}`}
          >
            <div className="flex items-start gap-3">
              <reason.icon className="h-5 w-5 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{reason.label}</span>
                  <Badge variant={getSeverityBadge(reason.severity)} className="text-xs">
                    {reason.severity}
                  </Badge>
                </div>
                <p className="text-xs mt-1 opacity-80">{reason.description}</p>
              </div>
            </div>
          </div>
        ))}

        <div className="pt-2 text-xs text-muted-foreground">
          Address these items to enable AI call answering in Canary or Live mode.
        </div>
      </CardContent>
    </Card>
  );
}
