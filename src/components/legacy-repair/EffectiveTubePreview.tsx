import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export const EffectiveTubePreview = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['effective-tube-preview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_invoice_effective_tubes')
        .select('*')
        .eq('source', 'historical_exact_repair')
        .order('invoice_date', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  if (!data?.length && !isLoading) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Recent Repair Attributions</CardTitle>
        <p className="text-xs text-muted-foreground">
          Read-only verification — last 20 repaired invoices from v_invoice_effective_tubes
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Loading…</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Invoice #</TableHead>
                <TableHead className="text-xs text-right">Total</TableHead>
                <TableHead className="text-xs text-right">Tubes</TableHead>
                <TableHead className="text-xs">Source</TableHead>
                <TableHead className="text-xs">Confidence</TableHead>
                <TableHead className="text-xs">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((row, i) => (
                <TableRow key={`${row.invoice_id}-${i}`}>
                  <TableCell className="font-mono text-xs">{row.invoice_number}</TableCell>
                  <TableCell className="text-xs text-right font-mono">${row.total}</TableCell>
                  <TableCell className="text-xs text-right font-mono font-semibold">{row.tube_count}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{row.source}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{row.confidence_level ?? '—'}</TableCell>
                  <TableCell className="text-xs">
                    {row.invoice_date ? new Date(row.invoice_date).toLocaleDateString() : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
