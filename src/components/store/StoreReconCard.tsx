/**
 * StoreReconCard — shows Dynasty Direct product-intelligence answers
 * captured via the GasMask field questionnaire.
 */
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  storeId: string;
}

export function StoreReconCard({ storeId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['store-recon', storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('store_questionnaire')
        .select('additional_items_wanted, top_selling_items, most_needed_items, last_verified_at')
        .eq('store_id', storeId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as {
        additional_items_wanted: string | null;
        top_selling_items: string | null;
        most_needed_items: string | null;
        last_verified_at: string | null;
      } | null;
    },
    enabled: !!storeId,
    staleTime: 60 * 1000,
  });

  const hasAny =
    data && (data.additional_items_wanted || data.top_selling_items || data.most_needed_items);

  return (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-amber-500" />
          Product Intelligence
          {data?.last_verified_at && (
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              Updated {formatDistanceToNow(new Date(data.last_verified_at), { addSuffix: true })}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !hasAny ? (
          <p className="text-sm text-muted-foreground">
            No recon answers captured yet. Field team can fill these in via the questionnaire.
          </p>
        ) : (
          <>
            <Row label="Additional items they would buy if offered" value={data?.additional_items_wanted} />
            <Row label="Items that sell a lot in their store" value={data?.top_selling_items} />
            <Row label="Items they are most in need of" value={data?.most_needed_items} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm whitespace-pre-wrap">
        {value?.trim() ? value : <span className="text-muted-foreground italic">— not answered —</span>}
      </p>
    </div>
  );
}
