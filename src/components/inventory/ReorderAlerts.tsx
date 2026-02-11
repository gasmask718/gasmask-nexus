import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface Alert {
  store_id: string;
  product_id: string;
  product_name: string;
  on_hand: number;
  min_quantity: number;
  reorder_quantity: number;
  alert_level: string;
}

function useReorderAlerts(type: 'tubes' | 'bags') {
  const view = type === 'tubes' ? 'v_tube_reorder_alerts' : 'v_bag_reorder_alerts';
  const countCol = type === 'tubes' ? 'tubes_on_hand' : 'bags_on_hand';

  return useQuery({
    queryKey: ['reorder-alerts', type],
    queryFn: async () => {
      const { data, error } = await supabase.from(view).select('*');
      if (error) throw error;
      return (data || []).map((r: any) => ({
        store_id: r.store_id,
        product_id: r.product_id,
        product_name: r.product_name || 'Unknown',
        on_hand: r[countCol] ?? 0,
        min_quantity: r.min_quantity,
        reorder_quantity: r.reorder_quantity,
        alert_level: r.alert_level,
      })) as Alert[];
    },
  });
}

export function ReorderAlerts({ type }: { type: 'tubes' | 'bags' }) {
  const { data, isLoading } = useReorderAlerts(type);
  const label = type === 'tubes' ? 'Tube' : 'Bag';

  if (isLoading) {
    return <Card><CardHeader><Skeleton className="h-5 w-48" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>;
  }

  return (
    <Card className={data && data.length > 0 ? 'border-destructive/30' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className={`h-5 w-5 ${data?.length ? 'text-destructive' : 'text-muted-foreground'}`} />
          {label} Reorder Alerts
          {data && data.length > 0 && (
            <Badge variant="destructive" className="ml-auto">{data.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {data.map((a) => (
              <div key={`${a.store_id}-${a.product_id}`} className={`p-3 rounded-lg border ${a.alert_level === 'critical' ? 'bg-destructive/10 border-destructive/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{a.product_name}</span>
                  <Badge variant={a.alert_level === 'critical' ? 'destructive' : 'secondary'} className="font-mono text-xs">
                    {a.on_hand} left — reorder {a.reorder_quantity}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No {label.toLowerCase()} reorder alerts</p>
        )}
      </CardContent>
    </Card>
  );
}
