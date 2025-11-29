import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, Package, DollarSign, Truck, Users, MessageSquare, 
  Factory, ChevronRight, Zap, CheckCircle2
} from "lucide-react";
import { useGrabbaIntelligence } from "@/hooks/useGrabbaIntelligence";
import type { SmartAlert } from "@/engine/GrabbaIntelligenceCore";

const alertIcons: Record<string, React.ElementType> = {
  inventory: Package,
  payment: DollarSign,
  delivery: Truck,
  ambassador: Users,
  communication: MessageSquare,
  production: Factory,
};

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/10 border-red-500/30 text-red-500',
  warning: 'bg-amber-500/10 border-amber-500/30 text-amber-500',
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-500',
};

export function AIAlertsFeed({ limit = 10 }: { limit?: number }) {
  const { data, isLoading } = useGrabbaIntelligence();
  const alerts = data?.alerts.slice(0, limit) || [];

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-red-500/5 to-orange-500/5 border-red-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-red-500" />
            AI Alerts Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted/30 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-red-500/5 to-orange-500/5 border-red-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-red-500" />
              AI Alerts Feed
            </CardTitle>
            <CardDescription>Real-time system intelligence</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="animate-pulse">
              {data?.metrics?.criticalAlerts || 0} Critical
            </Badge>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
              {data?.metrics?.warningAlerts || 0} Warnings
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
            <p className="text-lg font-medium text-green-600">All Systems Operational</p>
            <p className="text-sm text-muted-foreground">No active alerts at this time</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {alerts.map((alert) => {
                const Icon = alertIcons[alert.type] || AlertTriangle;
                return (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border transition-all hover:shadow-md ${severityColors[alert.severity]}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg bg-background/50`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-foreground truncate">{alert.title}</span>
                          <Badge 
                            variant="outline" 
                            className={`text-xs capitalize ${
                              alert.severity === 'critical' ? 'border-red-500 text-red-500' :
                              alert.severity === 'warning' ? 'border-amber-500 text-amber-500' :
                              'border-blue-500 text-blue-500'
                            }`}
                          >
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{alert.message}</p>
                        {alert.suggestedAction && (
                          <div className="mt-2 flex items-center gap-2">
                            <Button variant="ghost" size="sm" className="h-7 text-xs">
                              {alert.suggestedAction.substring(0, 40)}...
                              <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
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
