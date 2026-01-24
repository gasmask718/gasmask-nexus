import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle2, 
  UserCheck, 
  XCircle, 
  Clock, 
  MessageSquare,
  TrendingDown,
  ChevronRight
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { CanaryCallLog } from "@/hooks/useCanaryMode";
import { cn } from "@/lib/utils";

interface CanaryCallHistoryProps {
  logs: CanaryCallLog[];
  isLoading?: boolean;
}

const OUTCOME_CONFIG: Record<string, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  success: { icon: CheckCircle2, color: 'text-green-500', bgColor: 'bg-green-500/10', label: 'Success' },
  handoff: { icon: UserCheck, color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'Handoff' },
  failure: { icon: XCircle, color: 'text-destructive', bgColor: 'bg-destructive/10', label: 'Failed' },
  timeout: { icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-500/10', label: 'Timeout' },
  caller_requested_human: { icon: MessageSquare, color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'Caller Request' },
  sentiment_drop: { icon: TrendingDown, color: 'text-orange-500', bgColor: 'bg-orange-500/10', label: 'Sentiment' },
};

export function CanaryCallHistory({ logs, isLoading }: CanaryCallHistoryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Canary Call History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const completedLogs = logs.filter(log => log.outcome);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          Canary Call History
          <Badge variant="secondary">{completedLogs.length} calls</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {completedLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No completed canary calls yet
          </p>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {completedLogs.map((log) => {
                const outcome = log.outcome || 'unknown';
                const config = OUTCOME_CONFIG[outcome] || {
                  icon: Clock,
                  color: 'text-muted-foreground',
                  bgColor: 'bg-muted',
                  label: outcome,
                };
                const Icon = config.icon;

                return (
                  <div
                    key={log.id}
                    className={cn(
                      "p-3 rounded-lg border",
                      config.bgColor
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-5 w-5", config.color)} />
                        <div>
                          <span className="font-medium text-sm">{config.label}</span>
                          {log.call_type && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {log.call_type}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          log.call_risk_level === 'high' && "border-destructive text-destructive",
                          log.call_risk_level === 'medium' && "border-amber-500 text-amber-600",
                          log.call_risk_level === 'low' && "border-green-500 text-green-600"
                        )}
                      >
                        {log.call_risk_level} risk
                      </Badge>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div>
                        <span className="block font-medium">Confidence</span>
                        <span>{log.entry_confidence}%</span>
                      </div>
                      <div>
                        <span className="block font-medium">Trust</span>
                        <span>{log.entry_trust_score}%</span>
                      </div>
                      <div>
                        <span className="block font-medium">Duration</span>
                        <span>{log.ai_active_duration_seconds || 0}s AI</span>
                      </div>
                    </div>

                    {log.outcome_reason && (
                      <p className="mt-2 text-xs text-muted-foreground truncate">
                        <ChevronRight className="h-3 w-3 inline" /> {log.outcome_reason}
                      </p>
                    )}

                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                      {log.handoff_latency_ms && (
                        <span>Handoff: {log.handoff_latency_ms}ms</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
