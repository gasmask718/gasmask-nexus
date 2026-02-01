/**
 * Ambassador Alerts Panel
 * Displays actionable alerts based on operational responsibility
 */
import { AlertTriangle, AlertCircle, XCircle, ChevronRight, Bell, BellOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AmbassadorAlertSummary, StoreAlert } from '@/lib/storeHealthRules';

interface AmbassadorAlertsPanelProps {
  alertSummary: AmbassadorAlertSummary;
  onAlertAction?: (alert: StoreAlert) => void;
  onViewStore?: (storeId: string) => void;
  collapsed?: boolean;
}

const severityConfig = {
  critical: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  error: {
    icon: AlertCircle,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
};

export function AmbassadorAlertsPanel({
  alertSummary,
  onAlertAction,
  onViewStore,
  collapsed = false,
}: AmbassadorAlertsPanelProps) {
  const { alerts, atRiskCount, dormantCount, totalAlertCount, hasUrgentAlerts } = alertSummary;

  if (totalAlertCount === 0) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-green-600">
            <div className="p-2 rounded-full bg-green-500/10">
              <BellOff className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">All Clear</p>
              <p className="text-sm text-muted-foreground">
                No alerts for managed stores
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (collapsed) {
    return (
      <div className={cn(
        'flex items-center gap-3 p-3 rounded-lg border',
        hasUrgentAlerts ? 'border-red-500/30 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5'
      )}>
        <Bell className={cn('h-5 w-5', hasUrgentAlerts ? 'text-red-500' : 'text-amber-500')} />
        <div className="flex-1">
          <span className="font-medium">{totalAlertCount} alerts</span>
          <span className="text-muted-foreground text-sm ml-2">
            ({dormantCount} dormant, {atRiskCount} at risk)
          </span>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn(
      'border',
      hasUrgentAlerts ? 'border-red-500/30' : 'border-amber-500/30'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className={cn('h-5 w-5', hasUrgentAlerts ? 'text-red-500' : 'text-amber-500')} />
            <CardTitle className="text-base">Store Alerts</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {dormantCount > 0 && (
              <Badge variant="destructive" className="bg-red-500/20 text-red-500 border-red-500/30">
                {dormantCount} dormant
              </Badge>
            )}
            {atRiskCount > 0 && (
              <Badge variant="outline" className="bg-amber-500/20 text-amber-500 border-amber-500/30">
                {atRiskCount} at risk
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          Stores requiring immediate attention based on health rules
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.slice(0, 5).map((alert) => {
          const config = severityConfig[alert.severity];
          const Icon = config.icon;
          
          return (
            <div
              key={alert.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                config.bgColor,
                config.borderColor,
                'hover:bg-muted/50 cursor-pointer'
              )}
              onClick={() => onViewStore?.(alert.storeId)}
            >
              <Icon className={cn('h-4 w-4 flex-shrink-0', config.color)} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{alert.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {alert.description}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAlertAction?.(alert);
                  }}
                >
                  {alert.actionLabel}
                </Button>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          );
        })}
        
        {alerts.length > 5 && (
          <div className="text-center pt-2">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              View all {alerts.length} alerts
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact alert badge for KPI cards
 */
export function AlertBadge({ count, hasUrgent }: { count: number; hasUrgent: boolean }) {
  if (count === 0) return null;
  
  return (
    <Badge 
      variant="destructive" 
      className={cn(
        'text-xs',
        hasUrgent 
          ? 'bg-red-500/20 text-red-500 border-red-500/30' 
          : 'bg-amber-500/20 text-amber-500 border-amber-500/30'
      )}
    >
      <AlertTriangle className="h-3 w-3 mr-1" />
      {count}
    </Badge>
  );
}
