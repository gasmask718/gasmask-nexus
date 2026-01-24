import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, 
  ShieldOff, 
  UserX, 
  Clock, 
  TrendingDown,
  CheckCircle2,
  HelpCircle
} from "lucide-react";
import { AICallAgentConfig, AITrustScore } from "@/hooks/useAICallAgent";
import { cn } from "@/lib/utils";

interface WhyAIDidntAnswerProps {
  config: AICallAgentConfig | null;
  trustScore: AITrustScore | null;
  hasCallableUsers: boolean;
  hasUnresolvedCalls: boolean;
  lastCallConfidence?: number;
}

interface BlockReason {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  isBlocking: boolean;
  severity: 'error' | 'warning' | 'info';
}

export function WhyAIDidntAnswer({ 
  config, 
  trustScore, 
  hasCallableUsers, 
  hasUnresolvedCalls,
  lastCallConfidence 
}: WhyAIDidntAnswerProps) {
  const mode = config?.mode || 'off';
  const enabled = config?.enabled || false;
  const confidenceThreshold = config?.confidence_threshold || 85;

  const reasons: BlockReason[] = [];

  // Check each potential blocker
  if (!enabled) {
    reasons.push({
      id: 'disabled',
      label: 'AI Agent Disabled',
      description: 'The AI agent is turned off for this business',
      icon: ShieldOff,
      isBlocking: true,
      severity: 'error',
    });
  }

  if (mode === 'off') {
    reasons.push({
      id: 'mode-off',
      label: 'Mode is Off',
      description: 'AI agent mode is set to "off"',
      icon: ShieldOff,
      isBlocking: true,
      severity: 'error',
    });
  } else if (mode === 'shadow') {
    reasons.push({
      id: 'shadow-mode',
      label: 'Shadow Mode Active',
      description: 'AI is observing and learning, not answering',
      icon: HelpCircle,
      isBlocking: true,
      severity: 'info',
    });
  } else if (mode === 'assisted') {
    reasons.push({
      id: 'assisted-mode',
      label: 'Assisted Mode Active',
      description: 'AI suggests responses but humans answer',
      icon: HelpCircle,
      isBlocking: true,
      severity: 'info',
    });
  }

  if (config?.require_callable_fallback && !hasCallableUsers) {
    reasons.push({
      id: 'no-fallback',
      label: 'No Callable Fallback',
      description: 'No human agents are available as backup',
      icon: UserX,
      isBlocking: true,
      severity: 'error',
    });
  }

  if (config?.require_resolved_queue && hasUnresolvedCalls) {
    reasons.push({
      id: 'unresolved-queue',
      label: 'Unresolved Calls Exist',
      description: 'Clear the resolution queue before AI can answer',
      icon: Clock,
      isBlocking: true,
      severity: 'warning',
    });
  }

  if (lastCallConfidence !== undefined && lastCallConfidence < confidenceThreshold) {
    reasons.push({
      id: 'low-confidence',
      label: 'Low Confidence Score',
      description: `Last prediction was ${lastCallConfidence}%, threshold is ${confidenceThreshold}%`,
      icon: TrendingDown,
      isBlocking: mode === 'canary',
      severity: 'warning',
    });
  }

  if (trustScore && trustScore.consecutive_failures >= (config?.max_consecutive_failures || 3)) {
    reasons.push({
      id: 'failures',
      label: 'Too Many Failures',
      description: `${trustScore.consecutive_failures} consecutive failures detected`,
      icon: AlertCircle,
      isBlocking: true,
      severity: 'error',
    });
  }

  // If no blocking reasons and mode allows answering
  const canAnswer = enabled && (mode === 'canary' || mode === 'live') && 
    reasons.filter(r => r.isBlocking).length === 0;

  if (canAnswer) {
    reasons.unshift({
      id: 'ready',
      label: 'AI Ready to Answer',
      description: 'All safety checks passed',
      icon: CheckCircle2,
      isBlocking: false,
      severity: 'info',
    });
  }

  const getSeverityStyles = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'warning':
        return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
      case 'info':
        return 'bg-muted text-muted-foreground border-muted';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          Why AI Didn't Answer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {reasons.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recent call data available
          </p>
        ) : (
          reasons.map((reason) => {
            const Icon = reason.icon;
            return (
              <div
                key={reason.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border",
                  getSeverityStyles(reason.severity)
                )}
              >
                <Icon className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{reason.label}</span>
                    {reason.isBlocking && reason.severity !== 'info' && (
                      <Badge variant="outline" className="text-xs">Blocking</Badge>
                    )}
                  </div>
                  <p className="text-xs opacity-80 mt-0.5">{reason.description}</p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
