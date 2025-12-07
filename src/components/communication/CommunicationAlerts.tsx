import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, Clock, MessageSquare, Phone, 
  CheckCircle2, XCircle, Bell, TrendingDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Alert {
  id: string;
  business_id: string | null;
  store_id: string | null;
  alert_type: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  is_resolved: boolean;
  created_at: string;
}

interface CommunicationAlertsProps {
  alerts: Alert[];
  onResolve: (alertId: string) => void;
  onViewDetails: (alert: Alert) => void;
}

const ALERT_TYPES = {
  no_contact_7d: { icon: Clock, label: "7+ Days No Contact" },
  no_contact_14d: { icon: Clock, label: "14+ Days No Contact" },
  no_contact_30d: { icon: AlertTriangle, label: "30+ Days No Contact" },
  missed_call: { icon: Phone, label: "Missed Call" },
  negative_sentiment: { icon: TrendingDown, label: "Negative Sentiment" },
  high_priority: { icon: Bell, label: "High Priority" },
  failed_message: { icon: XCircle, label: "Failed Message" },
};

const SEVERITY_STYLES = {
  low: "bg-blue-100 text-blue-800 border-blue-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  critical: "bg-red-100 text-red-800 border-red-200",
};

export function CommunicationAlerts({ alerts, onResolve, onViewDetails }: CommunicationAlertsProps) {
  const criticalAlerts = alerts.filter(a => a.severity === "critical");
  const highAlerts = alerts.filter(a => a.severity === "high");
  const otherAlerts = alerts.filter(a => a.severity !== "critical" && a.severity !== "high");

  const sortedAlerts = [...criticalAlerts, ...highAlerts, ...otherAlerts];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Communication Alerts
          </CardTitle>
          <div className="flex gap-2">
            {criticalAlerts.length > 0 && (
              <Badge variant="destructive">{criticalAlerts.length} Critical</Badge>
            )}
            {highAlerts.length > 0 && (
              <Badge className="bg-orange-500">{highAlerts.length} High</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sortedAlerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
            <p className="text-muted-foreground">No active alerts</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {sortedAlerts.map((alert) => {
                const alertType = ALERT_TYPES[alert.alert_type as keyof typeof ALERT_TYPES] || {
                  icon: AlertTriangle,
                  label: alert.alert_type,
                };
                const Icon = alertType.icon;

                return (
                  <div
                    key={alert.id}
                    className={cn(
                      "p-4 rounded-lg border",
                      SEVERITY_STYLES[alert.severity]
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{alertType.label}</span>
                          <Badge variant="outline" className="text-xs">
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-sm">{alert.message}</p>
                        <p className="text-xs mt-1 opacity-70">
                          {format(new Date(alert.created_at), "MMM d, h:mm a")}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onViewDetails(alert)}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onResolve(alert.id)}
                        >
                          Resolve
                        </Button>
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
