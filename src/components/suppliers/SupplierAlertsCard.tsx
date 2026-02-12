import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSupplierAlerts } from '@/hooks/useSupplierIntelligence';
import { AlertTriangle } from 'lucide-react';

export function SupplierAlertsCard() {
  const { data, isLoading } = useSupplierAlerts();

  const severityVariant = (s: string) =>
    s === 'critical' ? 'destructive' as const : s === 'warning' ? 'secondary' as const : 'outline' as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" />
          Supplier Price Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground">No supplier pricing alerts 🎉</p>
        ) : (
          <div className="space-y-2">
            {data.map((a: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium text-sm">{a.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.supplier_name} · {a.alert_type?.replace(/_/g, ' ')}
                  </p>
                </div>
                <Badge variant={severityVariant(a.severity)}>
                  {a.severity}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
