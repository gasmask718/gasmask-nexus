/**
 * Floor9Alerts - AI Safety & Trust Alerts
 * 
 * Part of Phase 9.1 — Shadow Mode governance
 * Alerts are immutable and never auto-resolved.
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShadowModeBanner } from "@/components/floor9";
import { AlertTriangle, ShieldCheck, Clock, TrendingDown, TrendingUp } from "lucide-react";
import { useDriftAlerts, useAcknowledgeDriftAlert } from "@/hooks/useDriftAlerts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Floor9Alerts() {
  const { data: alerts, isLoading } = useDriftAlerts({ status: 'open' });
  const acknowledgeMutation = useAcknowledgeDriftAlert();

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50 dark:bg-red-950/20';
      case 'warning': return 'border-amber-500 bg-amber-50 dark:bg-amber-950/20';
      default: return 'border-blue-500 bg-blue-50 dark:bg-blue-950/20';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'overconfident': return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'underconfident': return <TrendingDown className="h-4 w-4 text-amber-500" />;
      case 'rejection_spike': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <ShieldCheck className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <ShadowModeBanner />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                AI Alerts
              </CardTitle>
              <CardDescription>
                Safety, trust, and anomaly alerts — never auto-resolved
              </CardDescription>
            </div>
            {alerts && alerts.length > 0 && (
              <Badge variant="destructive" className="text-sm">
                {alerts.length} Open
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Immutable Log Notice */}
          <div className="bg-muted/50 border border-dashed rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              <span>
                All alerts are immutable and require explicit human acknowledgment. 
                No alert can be auto-resolved or deleted.
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse text-muted-foreground">Loading alerts…</div>
            </div>
          ) : alerts && alerts.length > 0 ? (
            <div className="space-y-4">
              {alerts.map(alert => (
                <Card 
                  key={alert.id} 
                  className={`border-l-4 ${getSeverityColor(alert.severity)}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {getAlertIcon(alert.alert_type)}
                        {alert.message}
                      </CardTitle>
                      <Badge 
                        variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">AI Confidence:</span>
                        <span className="ml-2 font-medium">
                          {alert.confidence_at_alert?.toFixed(1) || 'N/A'}%
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Human Rate:</span>
                        <span className="ml-2 font-medium">
                          {alert.human_rate_at_alert?.toFixed(1) || 'N/A'}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(alert.created_at).toLocaleString()}
                      </div>
                    </div>
                    
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => acknowledgeMutation.mutate({ alertId: alert.id })}
                        disabled={acknowledgeMutation.isPending}
                      >
                        Acknowledge Alert
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <ShieldCheck className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="font-semibold text-lg">No Active Alerts</h3>
              <p className="text-muted-foreground">
                All systems operating within trust thresholds
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
