import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Save, Check } from 'lucide-react';

interface Props {
  selectedPrice: number;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  total: number;
  created_at: string;
  store_name: string | null;
  unit_count: number | null;
  confidence_level: string | null;
  has_live_lines: boolean;
}

interface PendingEdit {
  unit_count: string;
  confidence_level: string;
}

export const LegacyInvoiceRepairTable = ({ selectedPrice }: Props) => {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, PendingEdit>>({});

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['legacy-invoices-by-price', selectedPrice],
    queryFn: async () => {
      // Get invoices at this price
      const { data: invData, error: invErr } = await supabase
        .from('invoices')
        .select('id, invoice_number, total, created_at, store_id, status')
        .eq('status', 'finalized')
        .eq('total', selectedPrice)
        .is('deleted_at', null)
        .order('created_at');
      if (invErr) throw invErr;

      // Get store names
      const storeIds = [...new Set(invData.filter(i => i.store_id).map(i => i.store_id!))];
      let storeMap: Record<string, string> = {};
      if (storeIds.length > 0) {
        const { data: stores } = await supabase
          .from('stores')
          .select('id, name')
          .in('id', storeIds);
        if (stores) {
          storeMap = Object.fromEntries(stores.map(s => [s.id, s.name]));
        }
      }

      // Get existing repairs
      const invoiceIds = invData.map(i => i.id);
      const { data: repairs } = await supabase
        .from('historical_invoice_line_repairs')
        .select('invoice_id, unit_count, confidence_level')
        .eq('attribution_method', 'manual_exact')
        .in('invoice_id', invoiceIds);
      const repairMap: Record<string, { unit_count: number | null; confidence_level: string | null }> = {};
      repairs?.forEach(r => {
        repairMap[r.invoice_id] = { unit_count: r.unit_count, confidence_level: r.confidence_level };
      });

      // Check which invoices have live line items
      const { data: liveLines } = await supabase
        .from('invoice_line_items')
        .select('invoice_id')
        .in('invoice_id', invoiceIds);
      const liveSet = new Set(liveLines?.map(l => l.invoice_id) ?? []);

      return invData.map(inv => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        total: inv.total ?? 0,
        created_at: inv.created_at,
        store_name: inv.store_id ? storeMap[inv.store_id] ?? null : null,
        unit_count: repairMap[inv.id]?.unit_count ?? null,
        confidence_level: repairMap[inv.id]?.confidence_level ?? null,
        has_live_lines: liveSet.has(inv.id),
      })) as InvoiceRow[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ invoiceId, unitCount, confidence }: { invoiceId: string; unitCount: number; confidence: string }) => {
      // We need a product_id. Use a placeholder since this is legacy repair.
      // First try to get an existing product or use a known one
      const { data: existingRepair } = await supabase
        .from('historical_invoice_line_repairs')
        .select('id')
        .eq('invoice_id', invoiceId)
        .eq('attribution_method', 'manual_exact')
        .maybeSingle();

      if (existingRepair) {
        // Update existing
        const { error } = await supabase
          .from('historical_invoice_line_repairs')
          .update({
            unit_count: unitCount,
            confidence_level: confidence,
          })
          .eq('id', existingRepair.id);
        if (error) throw error;
      } else {
        // Get first product as placeholder (required column)
        const { data: product } = await supabase
          .from('products')
          .select('id')
          .limit(1)
          .single();
        if (!product) throw new Error('No product found for placeholder');

        const { error } = await supabase
          .from('historical_invoice_line_repairs')
          .insert({
            invoice_id: invoiceId,
            unit_count: unitCount,
            unit_type: 'tubes',
            attribution_method: 'manual_exact',
            confidence_level: confidence,
            product_id: product.id,
            derived_quantity: unitCount,
            derived_units_total: unitCount,
          });
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      setEdits(prev => {
        const next = { ...prev };
        delete next[variables.invoiceId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['legacy-invoices-by-price', selectedPrice] });
      queryClient.invalidateQueries({ queryKey: ['legacy-repair-progress'] });
      queryClient.invalidateQueries({ queryKey: ['effective-tube-preview'] });
      toast({ title: 'Saved', description: 'Tube count attributed successfully.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const handleSave = (invoiceId: string) => {
    const edit = edits[invoiceId];
    if (!edit || !edit.unit_count) return;
    const count = parseInt(edit.unit_count, 10);
    if (isNaN(count) || count <= 0) {
      toast({ title: 'Invalid', description: 'Tube count must be a positive integer.', variant: 'destructive' });
      return;
    }
    saveMutation.mutate({
      invoiceId,
      unitCount: count,
      confidence: edit.confidence_level || 'high',
    });
  };

  const setEdit = (invoiceId: string, field: keyof PendingEdit, value: string) => {
    setEdits(prev => ({
      ...prev,
      [invoiceId]: {
        ...prev[invoiceId],
        [field]: value,
        confidence_level: prev[invoiceId]?.confidence_level || 'high',
      },
    }));
  };

  const repairedCount = invoices?.filter(i => i.unit_count !== null).length ?? 0;
  const totalCount = invoices?.length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Invoices at ${selectedPrice.toLocaleString()}</span>
          <Badge variant="outline" className="font-mono">
            {repairedCount}/{totalCount} attributed
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Loading…</div>
        ) : (
          <div className="overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Invoice #</TableHead>
                  <TableHead className="text-xs">Store</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                  <TableHead className="text-xs w-28">Tube Count</TableHead>
                  <TableHead className="text-xs w-28">Confidence</TableHead>
                  <TableHead className="text-xs w-16">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices?.map(inv => {
                  const isSaved = inv.unit_count !== null && !edits[inv.id];
                  const hasEdit = !!edits[inv.id]?.unit_count;
                  const disabled = inv.has_live_lines;

                  return (
                    <TableRow key={inv.id} className={disabled ? 'opacity-50' : ''}>
                      <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                      <TableCell className="text-xs truncate max-w-[120px]">{inv.store_name ?? '—'}</TableCell>
                      <TableCell className="text-xs">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">${inv.total}</TableCell>
                      <TableCell>
                        {disabled ? (
                          <span className="text-xs text-muted-foreground">Has lines</span>
                        ) : (
                          <Input
                            type="number"
                            min={1}
                            className="h-7 text-xs w-20"
                            placeholder="Count"
                            value={edits[inv.id]?.unit_count ?? inv.unit_count?.toString() ?? ''}
                            onChange={e => setEdit(inv.id, 'unit_count', e.target.value)}
                            disabled={disabled}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {disabled ? null : (
                          <Select
                            value={edits[inv.id]?.confidence_level ?? inv.confidence_level ?? 'high'}
                            onValueChange={v => setEdit(inv.id, 'confidence_level', v)}
                          >
                            <SelectTrigger className="h-7 text-xs w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {disabled ? (
                          <Badge variant="outline" className="text-[10px]">Skip</Badge>
                        ) : isSaved ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : hasEdit ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => handleSave(inv.id)}
                            disabled={saveMutation.isPending}
                          >
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
