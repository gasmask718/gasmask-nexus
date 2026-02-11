import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface RatioRow {
  store_id: string;
  total_tubes_sold: number;
  total_bags_sold: number;
  bags_to_tubes_ratio_percent: number;
}

function useTubeBagRatio() {
  return useQuery({
    queryKey: ['tube-bag-ratio'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_tube_bag_ratio_per_store')
        .select('store_id, total_tubes_sold, total_bags_sold, bags_to_tubes_ratio_percent');
      if (error) throw error;
      return (data || []) as RatioRow[];
    },
  });
}

export function TubeBagRatioCard() {
  const { data, isLoading } = useTubeBagRatio();

  if (isLoading) {
    return <Card><CardHeader><Skeleton className="h-5 w-48" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-primary" />
          Tube ↔ Bag Ratio (Shrinkage Detection)
        </CardTitle>
      </CardHeader>
       <CardContent>
         {data && data.length > 0 ? (
           <div className="space-y-2">
             {data.map((row) => {
               const isAnomaly = row.bags_to_tubes_ratio_percent > 50 || row.bags_to_tubes_ratio_percent < 1;
               return (
                 <div key={row.store_id} className={`p-3 rounded-lg border ${isAnomaly ? 'bg-amber-500/10 border-amber-500/30' : 'bg-secondary/30'}`}>
                   <div className="flex items-center justify-between">
                     <div className="text-sm space-x-3">
                       <span className="font-mono">{row.total_tubes_sold} tubes</span>
                       <span className="text-muted-foreground">·</span>
                       <span className="font-mono">{row.total_bags_sold} bags</span>
                     </div>
                     <Badge variant={isAnomaly ? 'destructive' : 'outline'} className="font-mono">
                       {row.bags_to_tubes_ratio_percent.toFixed(1)}%
                     </Badge>
                   </div>
                   {isAnomaly && (
                     <p className="text-xs text-amber-600 mt-1">⚠ Unusual ratio — investigate possible shrinkage</p>
                   )}
                 </div>
               );
             })}
           </div>
         ) : (
           <p className="text-sm text-muted-foreground text-center py-4">No ratio data yet — finalize invoices to populate</p>
         )}
       </CardContent>
    </Card>
  );
}
