import { AlertTriangle, Clock, MapPin, Package, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface Alert {
  id: string;
  type: 'inventory' | 'unvisited' | 'driver-idle' | 'prospect-cluster' | 'wholesale-opportunity';
  title: string;
  message: string;
  territory: string;
  lat: number;
  lng: number;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
}

interface AlertsPanelProps {
  alerts: Alert[];
  onAlertClick: (alert: Alert) => void;
}

export const AlertsPanel = ({ alerts, onAlertClick }: AlertsPanelProps) => {
  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'inventory': return Package;
      case 'unvisited': return MapPin;
      case 'driver-idle': return Clock;
      case 'prospect-cluster': return TrendingUp;
      case 'wholesale-opportunity': return Package;
    }
  };

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'high': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'medium': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'low': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    }
  };

  return (
    <Card className="bg-card/95 backdrop-blur border-border/50">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Active Alerts
          </h3>
          <Badge variant="secondary">{alerts.length}</Badge>
        </div>
      </div>
      
      <ScrollArea className="h-[400px]">
        <div className="p-4 space-y-3">
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No active alerts</p>
            </div>
          ) : (
            alerts.map((alert) => {
              const Icon = getAlertIcon(alert.type);
              return (
                <Card
                  key={alert.id}
                  className={cn(
                    "p-3 cursor-pointer transition-all duration-200 hover:scale-[1.02] border",
                    getSeverityColor(alert.severity)
                  )}
                  onClick={() => onAlertClick(alert)}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm mb-1">{alert.title}</h4>
                      <p className="text-xs text-muted-foreground mb-2">{alert.message}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="text-xs">
                          {alert.territory}
                        </Badge>
                        <span className="text-muted-foreground">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};
