import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Bot, 
  TrendingUp, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  Zap
} from "lucide-react";
import { CanaryStats } from "@/hooks/useCanaryMode";
import { AICallAgentConfig, AITrustScore } from "@/hooks/useAICallAgent";
import { cn } from "@/lib/utils";

interface CanaryModePanelProps {
  config: AICallAgentConfig | null;
  trustScore: AITrustScore | null;
  stats: CanaryStats | null;
  hasCallableUsers: boolean;
  callableUsersCount: number;
  unresolvedCallsCount: number;
}

export function CanaryModePanel({
  config,
  trustScore,
  stats,
  hasCallableUsers,
  callableUsersCount,
  unresolvedCallsCount,
}: CanaryModePanelProps) {
  const mode = config?.mode || 'off';
  const isCanary = mode === 'canary';
  const confidenceThreshold = config?.confidence_threshold || 85;
  const currentTrustScore = trustScore?.trust_score || 0;
  const accuracyRate = trustScore?.accuracy_rate || 0;
  const maxConcurrent = config?.canary_max_concurrent || 3;

  // Check entry conditions
  const conditions = [
    {
      id: 'mode',
      label: 'Canary Mode Enabled',
      passed: isCanary,
      detail: isCanary ? 'Active' : `Mode is ${mode}`,
    },
    {
      id: 'enabled',
      label: 'AI Agent Enabled',
      passed: config?.enabled || false,
      detail: config?.enabled ? 'Enabled' : 'Disabled',
    },
    {
      id: 'trust',
      label: `Trust Score ≥ ${confidenceThreshold}%`,
      passed: currentTrustScore >= confidenceThreshold,
      detail: `${currentTrustScore}%`,
    },
    {
      id: 'accuracy',
      label: 'Accuracy Rate ≥ 80%',
      passed: accuracyRate >= 80,
      detail: `${accuracyRate.toFixed(1)}%`,
    },
    {
      id: 'callable',
      label: 'Callable Human Available',
      passed: hasCallableUsers,
      detail: `${callableUsersCount} user${callableUsersCount !== 1 ? 's' : ''}`,
    },
    {
      id: 'resolved',
      label: 'No Unresolved Calls',
      passed: !config?.require_resolved_queue || unresolvedCallsCount === 0,
      detail: unresolvedCallsCount > 0 ? `${unresolvedCallsCount} pending` : 'Clear',
    },
    {
      id: 'kill-switch',
      label: 'Kill Switch Inactive',
      passed: !config?.canary_kill_switch,
      detail: config?.canary_kill_switch ? 'ACTIVE' : 'Off',
    },
  ];

  const allConditionsPassed = conditions.every(c => c.passed);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-amber-500" />
            Canary Mode Status
          </div>
          <Badge 
            variant={allConditionsPassed ? "default" : "secondary"}
            className={cn(allConditionsPassed && "bg-amber-500")}
          >
            {allConditionsPassed ? "Ready to Answer" : "Not Ready"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-2 rounded bg-muted">
              <div className="text-2xl font-bold">{stats.activeCanaryCalls}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
            <div className="text-center p-2 rounded bg-muted">
              <div className="text-2xl font-bold">{stats.totalCanarycalls}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center p-2 rounded bg-muted">
              <div className="text-2xl font-bold text-green-500">{stats.successRate}%</div>
              <div className="text-xs text-muted-foreground">Success</div>
            </div>
            <div className="text-center p-2 rounded bg-muted">
              <div className="text-2xl font-bold">{stats.avgHandoffLatency}ms</div>
              <div className="text-xs text-muted-foreground">Avg Handoff</div>
            </div>
          </div>
        )}

        {/* Concurrent Calls Meter */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              Concurrent Canary Calls
            </span>
            <span className="font-medium">
              {stats?.activeCanaryCalls || 0} / {maxConcurrent}
            </span>
          </div>
          <Progress 
            value={((stats?.activeCanaryCalls || 0) / maxConcurrent) * 100} 
            className="h-2"
          />
        </div>

        {/* Entry Conditions Checklist */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-1">
            <Zap className="h-4 w-4" />
            Entry Conditions
          </h4>
          <div className="space-y-1">
            {conditions.map((condition) => (
              <div
                key={condition.id}
                className={cn(
                  "flex items-center justify-between p-2 rounded text-sm",
                  condition.passed 
                    ? "bg-green-500/10 text-green-700" 
                    : "bg-destructive/10 text-destructive"
                )}
              >
                <div className="flex items-center gap-2">
                  {condition.passed ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <span>{condition.label}</span>
                </div>
                <span className="text-xs font-mono">{condition.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Warning if not ready */}
        {!allConditionsPassed && (
          <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-700 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>AI will not answer calls until all conditions are met</span>
          </div>
        )}

        {/* Ready indicator */}
        {allConditionsPassed && (
          <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/20 text-green-700 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>AI is authorized to answer low-risk calls with human fallback ready</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
