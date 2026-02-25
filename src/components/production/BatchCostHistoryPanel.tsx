/**
 * BATCH COST HISTORY PANEL
 * Immutable cost ledger viewer with filtering.
 * Replaces the simple "Recent Batch Cost" card.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useBatchCostHistory, useBatchCostSummary, type BatchCostHistoryRecord } from '@/hooks/useBatchCostHistory';
import { History, Eye, DollarSign, TrendingUp, TrendingDown, Package, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BatchCostHistoryPanelProps {
  officeId: string;
}

const LABOR_MODEL_LABELS: Record<string, string> = {
  hourly: 'Hourly',
  per_box: 'Per Box',
  flat_day: 'Flat Day',
};

export function BatchCostHistoryPanel({ officeId }: BatchCostHistoryPanelProps) {
  const { data: history = [], isLoading } = useBatchCostHistory(officeId);
  const { data: summaries = [] } = useBatchCostSummary(officeId);
  const [productFilter, setProductFilter] = useState<string>('all');
  const [selectedRecord, setSelectedRecord] = useState<BatchCostHistoryRecord | null>(null);

  const filtered = productFilter === 'all'
    ? history
    : history.filter(h => h.product_type === productFilter);

  const productTypes = [...new Set(history.map(h => h.product_type))];

  const getLaborPctColor = (pct: number) => {
    if (pct > 35) return 'text-destructive';
    if (pct > 25) return 'text-amber-600';
    return 'text-emerald-600';
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Batch Cost Ledger
              </CardTitle>
              <CardDescription>Immutable cost records created on batch approval</CardDescription>
            </div>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {productTypes.map(pt => (
                  <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Cards */}
          {summaries.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {summaries.map(s => {
                const laborPct = s.labor_pct_of_total || 0;
                return (
                  <div key={`${s.office_id}-${s.product_type}`} className="rounded-lg border bg-muted/30 p-3 space-y-1">
                    <p className="text-xs text-muted-foreground capitalize">{s.product_type}</p>
                    <p className="text-lg font-mono font-semibold">${s.avg_cost_per_box?.toFixed(2) || '—'}<span className="text-xs text-muted-foreground">/box</span></p>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Labor:</span>
                      <span className={cn('text-[10px] font-medium', getLaborPctColor(laborPct))}>{laborPct.toFixed(0)}%</span>
                    </div>
                    {s.rolling_30d_avg_cost_per_box && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">30d avg:</span>
                        <span className="text-[10px] font-mono">${s.rolling_30d_avg_cost_per_box.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* History Table */}
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading cost history...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center">
              <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No cost records yet. Records are created when batches are approved.</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs text-right">Boxes</TableHead>
                    <TableHead className="text-xs">Labor Model</TableHead>
                    <TableHead className="text-xs text-right">Labor $</TableHead>
                    <TableHead className="text-xs text-right">Total $</TableHead>
                    <TableHead className="text-xs text-right">$/Box</TableHead>
                    <TableHead className="text-xs text-right">Labor %</TableHead>
                    <TableHead className="text-xs"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(record => {
                    const laborPct = record.total_batch_cost > 0
                      ? (record.labor_cost / record.total_batch_cost) * 100
                      : 0;
                    return (
                      <TableRow key={record.id}>
                        <TableCell className="text-xs font-mono">
                          {new Date(record.cost_snapshot_created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-xs capitalize">{record.product_type}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{record.boxes_produced?.toFixed(1)}</TableCell>
                        <TableCell className="text-xs">
                          {record.labor_model ? (
                            <Badge variant="outline" className="text-[10px]">
                              {LABOR_MODEL_LABELS[record.labor_model] || record.labor_model}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono">${record.labor_cost?.toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-right font-mono font-medium">${record.total_batch_cost?.toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-right font-mono font-semibold text-primary">${record.cost_per_box?.toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-right">
                          <span className={cn('font-medium', getLaborPctColor(laborPct))}>
                            {laborPct.toFixed(0)}%
                          </span>
                          {laborPct > 35 && <AlertTriangle className="h-3 w-3 text-destructive inline ml-1" />}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setSelectedRecord(record)}>
                            <Eye className="h-3 w-3" />
                          </Button>
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

      {/* Snapshot Detail Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Cost Snapshot
            </DialogTitle>
            <DialogDescription>
              Immutable record from {selectedRecord ? new Date(selectedRecord.cost_snapshot_created_at).toLocaleString() : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <span className="text-muted-foreground">Product Type</span>
                <span className="capitalize font-medium">{selectedRecord.product_type}</span>
                <span className="text-muted-foreground">Boxes Produced</span>
                <span className="font-mono">{selectedRecord.boxes_produced?.toFixed(2)}</span>
                <span className="text-muted-foreground">Labor Model</span>
                <span>{selectedRecord.labor_model ? LABOR_MODEL_LABELS[selectedRecord.labor_model] : 'Legacy (hourly)'}</span>
                <span className="text-muted-foreground">Worker Count</span>
                <span className="font-mono">{selectedRecord.worker_count}</span>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <span className="text-muted-foreground">Tobacco Cost</span>
                <span className="font-mono">${selectedRecord.tobacco_cost?.toFixed(2)}</span>
                <span className="text-muted-foreground">Packaging Cost</span>
                <span className="font-mono">${selectedRecord.packaging_cost?.toFixed(2)}</span>
                <span className="text-muted-foreground">Labor Cost</span>
                <span className="font-mono">${selectedRecord.labor_cost?.toFixed(2)}</span>
                <span className="text-muted-foreground">Overhead Cost</span>
                <span className="font-mono">${selectedRecord.overhead_cost?.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm font-semibold">
                <span>Total Batch Cost</span>
                <span className="font-mono">${selectedRecord.total_batch_cost?.toFixed(2)}</span>
                <span>Cost Per Box</span>
                <span className="font-mono text-primary">${selectedRecord.cost_per_box?.toFixed(2)}</span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">
                  {selectedRecord.is_immutable ? '🔒 Immutable' : '⚠️ Editable'}
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
