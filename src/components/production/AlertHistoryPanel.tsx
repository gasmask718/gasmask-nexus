/**
 * Alert History Panel
 * 
 * Displays system_alerts with severity badges, type, brand, timestamp, resolved status.
 * Admin can mark alerts as resolved.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/hooks/useTranslation';
import { BilingualLabel } from '@/components/portal/BilingualLabel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProductionRBAC } from '@/hooks/useProductionRBAC';
import { Bell, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function AlertHistoryPanel() {
  const { t } = useTranslation();
  const { tier } = useProductionRBAC();
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['system-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_alerts' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  const resolveAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('system_alerts' as any)
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq('id', alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-alerts'] });
      toast.success('Alert resolved');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const severityConfig: Record<string, { color: string; icon: React.ReactNode }> = {
    critical: { color: 'bg-destructive text-destructive-foreground', icon: <XCircle className="h-3 w-3" /> },
    warning: { color: 'bg-amber-500 text-white', icon: <AlertTriangle className="h-3 w-3" /> },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5" />
          <BilingualLabel tKey="production.system_alerts" en="System Alerts" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t("production.no_alerts")}</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {alerts.map((alert: any) => {
              const sev = severityConfig[alert.severity] || severityConfig.warning;
              return (
                <div key={alert.id} className="p-3 border rounded-lg flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={sev.color + ' text-xs flex items-center gap-1'}>
                        {sev.icon} {alert.severity}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{alert.alert_type}</Badge>
                      {alert.brand && <Badge variant="secondary" className="text-xs">{alert.brand}</Badge>}
                      {alert.resolved && (
                        <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                          <CheckCircle className="h-3 w-3 mr-1" /> {t("production.resolved")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm">{alert.message}</p>
                    {alert.recommended_action && (
                      <p className="text-xs text-muted-foreground mt-1">→ {alert.recommended_action}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(alert.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  {!alert.resolved && tier === 'admin' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveAlert.mutate(alert.id)}
                      disabled={resolveAlert.isPending}
                    >
                      <BilingualLabel tKey="production.resolve" en="Resolve" inline />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
