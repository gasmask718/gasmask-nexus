/**
 * StoreAccountSummaryCard — preformatted account brief from v_store_summary.
 * Renders the canonical `summary` text at the top of the store profile.
 * Lines containing OWES render red, LAPSED render amber.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollText } from 'lucide-react';
import { useStoreMasterResolver } from '@/hooks/useStoreMasterResolver';

interface StoreSummaryRow {
  summary: string | null;
  owed: number | null;
  open_invoices: number | null;
  days_since_last_order: number | null;
}

export function StoreAccountSummaryCard({ storeId }: { storeId: string }) {
  const { storeMasterId } = useStoreMasterResolver(storeId);

  const { data } = useQuery({
    queryKey: ['store-summary', storeMasterId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_store_summary')
        .select('summary, owed, open_invoices, days_since_last_order')
        .eq('store_id', storeMasterId)
        .maybeSingle();
      if (error) throw error;
      return data as StoreSummaryRow | null;
    },
    enabled: !!storeMasterId,
  });

  if (!data?.summary) return null;

  const lines = data.summary.split('\n');

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-muted-foreground" />
          Account Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="whitespace-pre-wrap text-sm leading-relaxed font-mono">
          {lines.map((line, i) => {
            const upper = line.toUpperCase();
            const cls = upper.includes('OWES')
              ? 'text-red-500 font-semibold'
              : upper.includes('LAPSED')
                ? 'text-amber-500 font-semibold'
                : '';
            return (
              <div key={i} className={cls || undefined}>
                {line || ' '}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
