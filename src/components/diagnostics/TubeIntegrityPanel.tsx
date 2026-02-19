import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

interface IntegrityRow {
  invoice_id: string;
  invoice_number: string | null;
  status: string;
  product_name: string | null;
  line_qty: number;
  ledger_qty: number;
  delta: number;
  integrity_status: string;
}

export function TubeIntegrityPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['tube-integrity-check'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_tube_integrity_check' as any)
        .select('*')
        .limit(200);
      if (error) throw error;
      return (data as unknown as IntegrityRow[]) ?? [];
    },
    staleTime: 60_000,
  });

  const mismatches = data?.filter(r => r.integrity_status !== 'OK') ?? [];
  const total = data?.length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {mismatches.length > 0 ? (
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          ) : (
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          )}
          Tube Inventory Integrity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">Failed to load integrity data.</p>
        ) : mismatches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            ✓ All {total} invoice line items match their ledger entries.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-amber-600 font-medium">
              {mismatches.length} mismatches found across {total} checked items
            </p>
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {mismatches.map((row) => (
                <div
                  key={`${row.invoice_id}-${row.product_name}`}
                  className="flex items-center justify-between p-2 rounded bg-muted/40 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-xs">{row.invoice_number ?? row.invoice_id.slice(0, 8)}</span>
                    <span className="text-muted-foreground ml-2">{row.product_name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs">Line: {row.line_qty} / Ledger: {row.ledger_qty}</span>
                    <Badge
                      variant="outline"
                      className={
                        row.integrity_status === 'FINALIZED_MISMATCH'
                          ? 'text-red-600 border-red-300'
                          : 'text-amber-600 border-amber-300'
                      }
                    >
                      {row.integrity_status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
