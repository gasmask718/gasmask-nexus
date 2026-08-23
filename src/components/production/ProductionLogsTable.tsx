/**
 * PRODUCTION LOGS TABLE
 * The full batch ledger for one office — batch #, brand, boxes, tubes,
 * producer, date. Migrated from the retired /grabba/production page,
 * which was the only place this data rendered correctly.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Box } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from '@/hooks/useTranslation';

export function ProductionLogsTable({ officeId }: { officeId: string }) {
  const { t } = useTranslation();
  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['production-logs', officeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_batches')
        .select('id, batch_number, brand, boxes_produced, tubes_total, produced_by, shift_label, batch_date, created_at, status')
        .eq('office_id', officeId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!officeId,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Box className="h-5 w-5 text-primary" />
          {t('production.production_logs')}
        </CardTitle>
        <CardDescription>{batches.length} {t('production.batches').toLowerCase()}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('production.loading')}</p>
        ) : batches.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Box className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="font-medium">{t('production.no_active_batch')}</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Batches logged on the Today screen appear here with their brand, output, and producer.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch #</TableHead>
                <TableHead>{t('production.brand')}</TableHead>
                <TableHead className="text-right">{t('production.boxes')}</TableHead>
                <TableHead className="text-right">{t('production.tubes_used')}</TableHead>
                <TableHead>{t('production.shift')}</TableHead>
                <TableHead>{t('production.status')}</TableHead>
                <TableHead>{t('production.date')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.batch_number || b.id.slice(0, 8)}</TableCell>
                  <TableCell><Badge variant="outline">{b.brand}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{b.boxes_produced || 0}</TableCell>
                  <TableCell className="text-right font-mono">{b.tubes_total || (b.boxes_produced || 0) * 100}</TableCell>
                  <TableCell className="text-muted-foreground">{b.shift_label || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={b.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">
                      {b.status || 'open'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {b.created_at ? format(new Date(b.created_at), 'MMM d, yyyy, h:mm a') : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default ProductionLogsTable;
