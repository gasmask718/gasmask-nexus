import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSupplierAlerts } from '@/hooks/useSupplierIntelligence';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

const severityVariants = {
  critical: 'bg-red-100 text-red-800',
  warning: 'bg-orange-100 text-orange-800',
  info: 'bg-blue-100 text-blue-800',
};

const alertTypeIcons = {
  high_drift: <TrendingUp className="h-4 w-4" />,
  high_volatility: <TrendingDown className="h-4 w-4" />,
  default: <AlertTriangle className="h-4 w-4" />,
};

export function SupplierPriceAlertsPanel() {
  const { data, isLoading } = useSupplierAlerts();

  if (isLoading) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">Loading alerts…</CardContent></Card>;
  }

  if (!data?.length) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">No price alerts. All suppliers stable.</CardContent></Card>;
  }

  // Group by alert type
  const grouped = data.reduce((acc: any, alert: any) => {
    const key = alert.alert_type || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(alert);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" />
          Price Alerts by Type
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(grouped).map(([alertType, alerts]: [string, any]) => (
          <div key={alertType}>
            <h4 className="text-sm font-semibold mb-3 capitalize">
              {alertType.replace(/_/g, ' ')}
            </h4>
            <div className="space-y-2">
              {alerts.map((alert: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3 p-2 rounded border bg-muted/30">
                  <div className="mt-0.5">
                    {alertTypeIcons[alertType as keyof typeof alertTypeIcons] || alertTypeIcons.default}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <p className="text-sm font-medium">{alert.product_name}</p>
                      <p className="text-xs text-muted-foreground">{alert.supplier_name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {alert.pct_change ? `${Number(alert.pct_change).toFixed(2)}% change` : ''}
                      {alert.volatility_pct ? ` · ${Number(alert.volatility_pct).toFixed(2)}% volatility` : ''}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <Badge className={severityVariants[alert.severity as keyof typeof severityVariants] || 'bg-slate-100'}>
                      {alert.severity}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
