import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Props {
  selectedPrice: number | null;
  onSelectPrice: (price: number) => void;
}

export const LegacyPriceClusterList = ({ selectedPrice, onSelectPrice }: Props) => {
  const { data: clusters, isLoading } = useQuery({
    queryKey: ['legacy-price-clusters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_legacy_invoice_price_mapping_status')
        .select('*')
        .order('invoice_count', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Price Clusters</CardTitle>
        <p className="text-xs text-muted-foreground">
          {clusters?.length ?? 0} distinct price points
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Loading…</div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto divide-y divide-border">
            {clusters?.map((c) => {
              const price = Number(c.total);
              const mapped = c.mapping_present;
              return (
                <button
                  key={`${c.total}-${c.effective_from}`}
                  onClick={() => onSelectPrice(price)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-center justify-between gap-2',
                    selectedPrice === price && 'bg-muted'
                  )}
                >
                  <div className="min-w-0">
                    <div className="font-mono font-semibold text-sm">
                      ${price.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.invoice_count} invoices · {c.distinct_stores ?? 0} stores
                    </div>
                  </div>
                  <Badge
                    variant={mapped ? 'default' : 'destructive'}
                    className="shrink-0 text-[10px]"
                  >
                    {mapped ? '✅ Mapped' : '❌ Unmapped'}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
