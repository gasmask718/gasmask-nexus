import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSupplierDecisionMatrix } from '@/hooks/useSupplierIntelligence';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';

const actionIcons = {
  1: <AlertCircle className="h-4 w-4 text-red-500" />,
  2: <Clock className="h-4 w-4 text-orange-500" />,
  3: <CheckCircle2 className="h-4 w-4 text-yellow-500" />,
};

const actionLabels = {
  seek_alternative: 'Seek Alternative',
  renegotiate: 'Renegotiate',
  monitor_closely: 'Monitor Closely',
  preferred_supplier: 'Preferred',
};

export function SupplierActionQueue() {
  const { data, isLoading } = useSupplierDecisionMatrix();

  if (isLoading) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">Loading action queue…</CardContent></Card>;
  }

  if (!data?.length) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">No urgent actions. All suppliers are in healthy state.</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Daily Action Queue</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">What to focus on today (priority ≤ 3)</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((item: any, idx: number) => (
          <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
            <div className="mt-0.5">
              {actionIcons[item.action_priority as keyof typeof actionIcons] || <AlertCircle className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <p className="font-semibold text-sm">{item.supplier_name}</p>
                <p className="text-xs text-muted-foreground">{item.product_name}</p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Risk: {Number(item.risk_score || 0).toFixed(1)} · {item.risk_band}
              </p>
              <Badge className={`text-xs ${item.recommended_action === 'seek_alternative' ? 'bg-red-100 text-red-800' : item.recommended_action === 'renegotiate' ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {item.recommended_action?.replace(/_/g, ' ')}
              </Badge>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-semibold text-muted-foreground">P{item.action_priority}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
