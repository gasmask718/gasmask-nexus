import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

function useInvoiceRepairStatus() {
  return useQuery({
    queryKey: ['invoice-repair-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, status, repair_status, repair_notes, repaired_at, repaired_by')
        .neq('repair_status', 'none')
        .order('repaired_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });
}

export function InvoiceRepairStatus() {
  const { data, isLoading } = useInvoiceRepairStatus();

  if (isLoading) {
    return <Card><CardHeader><Skeleton className="h-5 w-48" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wrench className="h-5 w-5 text-primary" />
          Invoice Repair Log
          {data && data.length > 0 && (
            <Badge variant="secondary" className="ml-auto">{data.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {data.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div>
                  <span className="font-medium text-sm">{inv.invoice_number || inv.id.slice(0, 8)}</span>
                  {inv.repair_notes && <p className="text-xs text-muted-foreground mt-0.5">{inv.repair_notes}</p>}
                </div>
                <Badge variant={inv.repair_status === 'repaired' ? 'default' : 'secondary'}>
                  {inv.repair_status}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No repaired invoices yet</p>
        )}
      </CardContent>
    </Card>
  );
}
