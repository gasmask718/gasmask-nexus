import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gift, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { CANONICAL_TUBE_SKUS, brandDisplayName } from '@/lib/inventory/skuDisplay';

interface Row {
  brand: string | null;
  product_id: string | null;
  distinct_stores: number;
  total_units: number;
  event_count: number;
  last_given_at: string | null;
}

const productDisplay = (pid: string | null) =>
  CANONICAL_TUBE_SKUS.find((s) => s.product_id === pid)?.display ?? null;

export default function SamplesByBrandReport() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['samples-by-brand'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('samples_given_by_brand_v' as any)
        .select('*')
        .order('distinct_stores', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Row[];
    },
  });

  return (
    <div className="container max-w-4xl py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary" /> Samples Given — by Brand
        </h1>
        <p className="text-sm text-muted-foreground">
          Distinct stores that have received a physical sample of each product.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Per-brand rollup</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : data.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">No samples logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Product / Brand</th>
                    <th className="py-2 pr-3 text-right">Distinct stores</th>
                    <th className="py-2 pr-3 text-right">Total units</th>
                    <th className="py-2 pr-3 text-right">Events</th>
                    <th className="py-2 pr-3">Last given</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r, i) => {
                    const label = productDisplay(r.product_id) ?? brandDisplayName(r.brand);
                    return (
                      <tr key={`${r.product_id ?? r.brand ?? 'x'}-${i}`} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium">{label}</td>
                        <td className="py-2 pr-3 text-right">
                          <Badge variant="secondary">{r.distinct_stores}</Badge>
                        </td>
                        <td className="py-2 pr-3 text-right">{r.total_units ?? 0}</td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">{r.event_count}</td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">
                          {r.last_given_at
                            ? formatDistanceToNow(new Date(r.last_given_at), { addSuffix: true })
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
