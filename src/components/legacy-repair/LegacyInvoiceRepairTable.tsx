import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { Save, Check, CheckSquare, AlertTriangle } from 'lucide-react';

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUnitCount, setBulkUnitCount] = useState('');
  const [bulkConfidence, setBulkConfidence] = useState('high');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['legacy-invoices-by-price', selectedPrice],
    queryFn: async () => {
      const { data: invData, error: invErr } = await supabase
        .from('invoices')
        .select('id, invoice_number, total, created_at, store_id, status')
        .eq('status', 'finalized')
        .eq('total', selectedPrice)
        .is('deleted_at', null)
        .order('created_at');
      if (invErr) throw invErr;

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

      const { data: liveLines } = await supabase
        .from('invoice_line_items')
        .select('invoice_id')
        .is('deleted_at', null)
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
      const { data: existingRepair } = await supabase
        .from('historical_invoice_line_repairs')
        .select('id')
        .eq('invoice_id', invoiceId)
        .eq('attribution_method', 'manual_exact')
        .maybeSingle();

      if (existingRepair) {
        const { error } = await supabase
          .from('historical_invoice_line_repairs')
          .update({
            unit_count: unitCount,
            confidence_level: confidence,
          })
          .eq('id', existingRepair.id);
        if (error) throw error;
      } else {
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
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // --- Individual row save ---
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

  // --- Bulk selection ---
  const unrepairedInvoices = invoices?.filter(i => !i.has_live_lines && i.unit_count === null) ?? [];
  const allRepaired = invoices ? unrepairedInvoices.length === 0 : false;

  const selectAllUnrepaired = () => {
    setSelectedIds(new Set(unrepairedInvoices.map(i => i.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  // --- Bulk preview & save ---
  const applyBulkPreview = () => {
    const count = parseInt(bulkUnitCount, 10);
    if (isNaN(count) || count <= 0) {
      toast({ title: 'Invalid', description: 'Enter a valid tube count.', variant: 'destructive' });
      return;
    }
    setPreviewOpen(true);
  };

  const confirmBulkSave = async () => {
    setBulkSaving(true);
    const count = parseInt(bulkUnitCount, 10);
    let saved = 0;
    let failed = 0;

    for (const invoiceId of selectedIds) {
      try {
        await saveMutation.mutateAsync({
          invoiceId,
          unitCount: count,
          confidence: bulkConfidence,
        });
        saved++;
      } catch {
        failed++;
      }
    }

    setBulkSaving(false);
    setPreviewOpen(false);
    setSelectedIds(new Set());
    setBulkUnitCount('');

    queryClient.invalidateQueries({ queryKey: ['legacy-invoices-by-price', selectedPrice] });
    queryClient.invalidateQueries({ queryKey: ['legacy-repair-progress'] });
    queryClient.invalidateQueries({ queryKey: ['effective-tube-preview'] });

    toast({
      title: 'Bulk attribution complete',
      description: `${saved} saved${failed > 0 ? `, ${failed} failed` : ''}`,
    });
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
      <CardContent className="space-y-3 p-4 pt-0">
        {/* Cluster complete banner */}
        {allRepaired && invoices && invoices.length > 0 && (
          <Alert className="border-green-500/30 bg-green-500/10">
            <Check className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-400">
              ✅ All invoices for this price point have been fully attributed.
            </AlertDescription>
          </Alert>
        )}

        {/* Bulk Action Bar */}
        {!allRepaired && (
          <div className="flex flex-wrap items-center gap-3 p-3 border rounded-md bg-muted/30">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllUnrepaired}
              disabled={unrepairedInvoices.length === 0}
            >
              <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
              Select All Unrepaired ({unrepairedInvoices.length})
            </Button>

            {selectedIds.size > 0 && (
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Clear ({selectedIds.size})
              </Button>
            )}

            <Input
              type="number"
              min={1}
              placeholder="Tube count (e.g. 100)"
              value={bulkUnitCount}
              onChange={e => setBulkUnitCount(e.target.value)}
              className="w-44 h-8 text-sm"
            />

            <Select value={bulkConfidence} onValueChange={setBulkConfidence}>
              <SelectTrigger className="w-32 h-8 text-sm">
                <SelectValue placeholder="Confidence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
              </SelectContent>
            </Select>

            <Button
              size="sm"
              onClick={applyBulkPreview}
              disabled={!bulkUnitCount || selectedIds.size === 0}
            >
              Apply to {selectedIds.size} Selected
            </Button>
          </div>
        )}

        {/* Invoice Table */}
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Loading…</div>
        ) : (
          <div className="overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-10"></TableHead>
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
                  const isSelectable = !disabled && inv.unit_count === null;

                  return (
                    <TableRow key={inv.id} className={disabled ? 'opacity-50' : ''}>
                      <TableCell className="pr-0">
                        <Checkbox
                          checked={selectedIds.has(inv.id)}
                          disabled={!isSelectable}
                          onCheckedChange={(checked) => toggleSelected(inv.id, !!checked)}
                        />
                      </TableCell>
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

      {/* Bulk Confirmation Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Tube Attribution</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">You are about to apply:</p>
          <ul className="text-sm list-disc ml-5 space-y-1">
            <li><strong>{bulkUnitCount}</strong> tubes per invoice</li>
            <li>Confidence: <strong>{bulkConfidence}</strong></li>
            <li>Invoices affected: <strong>{selectedIds.size}</strong></li>
            <li>Price cluster: <strong>${selectedPrice.toLocaleString()}</strong></li>
          </ul>
          <Alert className="border-amber-500/30 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-400 text-xs">
              This does NOT affect totals, payments, or inventory. This action is auditable and reversible.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={bulkSaving}>
              Cancel
            </Button>
            <Button onClick={confirmBulkSave} disabled={bulkSaving}>
              {bulkSaving ? 'Saving…' : `Confirm & Save (${selectedIds.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
