import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  UserCheck, 
  MessageSquare, 
  Clock, 
  TrendingDown, 
  AlertTriangle,
  ShieldAlert,
  AlertCircle,
  ChevronRight
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { CanaryEscapeEvent } from "@/hooks/useCanaryMode";
import { cn } from "@/lib/utils";

interface CanaryEscapeLogProps {
  events: CanaryEscapeEvent[];
  isLoading?: boolean;
}

const ESCAPE_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  human_takeover: { icon: UserCheck, color: 'text-green-500', label: 'Human Takeover' },
  caller_keyword: { icon: MessageSquare, color: 'text-blue-500', label: 'Caller Request' },
  timeout: { icon: Clock, color: 'text-amber-500', label: 'Timeout' },
  sentiment_drop: { icon: TrendingDown, color: 'text-orange-500', label: 'Sentiment Drop' },
  confidence_drop: { icon: AlertTriangle, color: 'text-amber-600', label: 'Confidence Drop' },
  admin_kill_switch: { icon: ShieldAlert, color: 'text-destructive', label: 'Kill Switch' },
  system_error: { icon: AlertCircle, color: 'text-destructive', label: 'System Error' },
};

export function CanaryEscapeLog({ events, isLoading }: CanaryEscapeLogProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Escape Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          Escape Events
          <Badge variant="secondary">{events.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No escape events recorded yet
          </p>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {events.map((event) => {
                const config = ESCAPE_TYPE_CONFIG[event.escape_type] || {
                  icon: AlertCircle,
                  color: 'text-muted-foreground',
                  label: event.escape_type,
                };
                const Icon = config.icon;

                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className={cn("mt-0.5", config.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{config.label}</span>
                        {event.was_successful ? (
                          <Badge variant="outline" className="text-xs text-green-600">
                            Success
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            Failed
                          </Badge>
                        )}
                      </div>
                      {event.escape_trigger && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {event.escape_trigger}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>
                          {formatDistanceToNow(new Date(event.triggered_at), { addSuffix: true })}
                        </span>
                        {event.resolution_latency_ms && (
                          <span className="flex items-center gap-1">
                            <ChevronRight className="h-3 w-3" />
                            {event.resolution_latency_ms}ms handoff
                          </span>
                        )}
                      </div>
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
