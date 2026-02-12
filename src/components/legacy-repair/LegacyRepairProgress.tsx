import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export const LegacyRepairProgress = () => {
  const { data } = useQuery({
    queryKey: ['legacy-repair-progress'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_historical_invoice_audit')
        .select('has_historical_repair, bucket')
        .in('bucket', ['PRICE_ONLY', 'EMPTY_FINALIZED']);
      if (error) throw error;
      const repaired = data.filter(r => r.has_historical_repair).length;
      return { repaired, total: data.length };
    },
  });

  const pct = data ? Math.round((data.repaired / Math.max(data.total, 1)) * 100) : 0;

  return (
    <Card>
      <CardContent className="py-4 flex items-center gap-4">
        <div className="text-sm font-medium whitespace-nowrap">
          {data?.repaired ?? 0} / {data?.total ?? 0} legacy invoices repaired
        </div>
        <Progress value={pct} className="flex-1 h-2" />
        <span className="text-xs text-muted-foreground font-mono">{pct}%</span>
      </CardContent>
    </Card>
  );
};
