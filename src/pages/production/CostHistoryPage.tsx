/**
 * FULL BATCH COST LEDGER PAGE
 * /production/cost-history
 * Complete financial audit view with filters and CSV export.
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ExportButton } from '@/components/crud/ExportButton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, Filter, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Layout from '@/components/Layout';
import type { BatchCostHistoryRecord } from '@/hooks/useBatchCostHistory';

const LABOR_MODEL_LABELS: Record<string, string> = {
  hourly: 'Hourly',
  per_box: 'Per Box',
  flat_day: 'Flat Day',
};

function useCostLedger() {
  return useQuery({
    queryKey: ['cost-ledger-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_batch_cost_history_latest')
        .select('*')
        .order('cost_snapshot_created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as BatchCostHistoryRecord[];
    },
  });
}

export default function CostHistoryPage() {
  const { data: records = [], isLoading } = useCostLedger();

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [officeFilter, setOfficeFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [tubeFilter, setTubeFilter] = useState('all');
  const [laborFilter, setLaborFilter] = useState('all');

  const offices = useMemo(() => [...new Set(records.map(r => r.office_id).filter(Boolean))], [records]);
  const productTypes = useMemo(() => [...new Set(records.map(r => r.product_type))], [records]);
  const tubeSizes = useMemo(() => [...new Set(records.map(r => r.tube_size).filter(Boolean))], [records]);
  const laborModels = useMemo(() => [...new Set(records.map(r => r.labor_model).filter(Boolean))], [records]);

  const filtered = useMemo(() => {
    let result = records;
    if (dateFrom) result = result.filter(r => r.cost_snapshot_created_at >= dateFrom);
    if (dateTo) result = result.filter(r => r.cost_snapshot_created_at <= dateTo + 'T23:59:59');
    if (officeFilter !== 'all') result = result.filter(r => r.office_id === officeFilter);
    if (productFilter !== 'all') result = result.filter(r => r.product_type === productFilter);
    if (tubeFilter !== 'all') result = result.filter(r => r.tube_size === tubeFilter);
    if (laborFilter !== 'all') result = result.filter(r => r.labor_model === laborFilter);
    return result;
  }, [records, dateFrom, dateTo, officeFilter, productFilter, tubeFilter, laborFilter]);

  const exportColumns = [
    { key: 'batch_id', label: 'Batch ID' },
    { key: 'office_id', label: 'Office' },
    { key: 'product_type', label: 'Product Type' },
    { key: 'tube_size', label: 'Tube Size' },
    { key: 'bag_weight_grams', label: 'Bag Weight (g)' },
    { key: 'boxes_produced', label: 'Boxes Produced' },
    { key: 'labor_model', label: 'Labor Model' },
    { key: 'total_batch_cost', label: 'Total Batch Cost' },
    { key: 'cost_per_box', label: 'Cost/Box' },
    { key: 'cost_per_lb', label: 'Cost/LB' },
    { key: 'revenue_per_lb', label: 'Revenue/LB' },
    { key: 'profit_per_lb', label: 'Profit/LB' },
    { key: 'margin_pct', label: 'Margin %' },
    { key: 'version', label: 'Version' },
    { key: 'override_reason', label: 'Override Reason' },
    { key: 'cost_snapshot_created_at', label: 'Approved Date' },
  ];

  const getLaborPctColor = (record: BatchCostHistoryRecord) => {
    const pct = record.total_batch_cost > 0 ? (record.labor_cost / record.total_batch_cost) * 100 : 0;
    if (pct > 35) return 'text-destructive';
    if (pct > 25) return 'text-amber-600';
    return 'text-emerald-600';
  };

  return (
    <Layout>
      <div className="space-y-6 p-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Full Batch Cost Ledger
                </CardTitle>
                <CardDescription>
                  Financial audit layer — latest version per batch, all offices
                </CardDescription>
              </div>
              <ExportButton
                data={filtered as unknown as Record<string, unknown>[]}
                filename="batch-cost-ledger"
                columns={exportColumns}
              />
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3 mb-4 p-3 rounded-lg border bg-muted/20">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <div className="grid gap-1">
                <span className="text-[10px] text-muted-foreground">From</span>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 w-[140px] text-xs" />
              </div>
              <div className="grid gap-1">
                <span className="text-[10px] text-muted-foreground">To</span>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 w-[140px] text-xs" />
              </div>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="Product" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {productTypes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              {tubeSizes.length > 0 && (
                <Select value={tubeFilter} onValueChange={setTubeFilter}>
                  <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="Tube Size" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sizes</SelectItem>
                    {tubeSizes.map(t => <SelectItem key={t!} value={t!}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Select value={laborFilter} onValueChange={setLaborFilter}>
                <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="Labor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Models</SelectItem>
                  {laborModels.map(l => <SelectItem key={l!} value={l!}>{LABOR_MODEL_LABELS[l!] || l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="text-[10px] h-8 flex items-center">
                {filtered.length} records
              </Badge>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground">Loading cost ledger...</div>
            ) : records.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <DollarSign className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="font-medium">No costed batches yet</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Cost records appear here automatically when a batch is completed and its costs
                  are approved on the production floor (Manufacturing OS → Insight → Costs).
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No records match filters.</div>
            ) : (
              <div className="overflow-auto max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Date</TableHead>
                      <TableHead className="text-[10px]">Product</TableHead>
                      <TableHead className="text-[10px]">Size</TableHead>
                      <TableHead className="text-[10px] text-right">Boxes</TableHead>
                      <TableHead className="text-[10px]">Labor</TableHead>
                      <TableHead className="text-[10px] text-right">Total $</TableHead>
                      <TableHead className="text-[10px] text-right">$/Box</TableHead>
                      <TableHead className="text-[10px] text-right">$/LB</TableHead>
                      <TableHead className="text-[10px] text-right">Rev/LB</TableHead>
                      <TableHead className="text-[10px] text-right">Profit/LB</TableHead>
                      <TableHead className="text-[10px] text-right">Margin</TableHead>
                      <TableHead className="text-[10px]">Ver</TableHead>
                      <TableHead className="text-[10px]">Override</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(r => {
                      const laborPct = r.total_batch_cost > 0 ? (r.labor_cost / r.total_batch_cost) * 100 : 0;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-[10px] font-mono">{new Date(r.cost_snapshot_created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-[10px] capitalize">{r.product_type}</TableCell>
                          <TableCell className="text-[10px]">{r.tube_size || (r.bag_weight_grams ? `${r.bag_weight_grams}g` : '—')}</TableCell>
                          <TableCell className="text-[10px] text-right font-mono">{r.boxes_produced?.toFixed(1)}</TableCell>
                          <TableCell className="text-[10px]">
                            <Badge variant="outline" className="text-[9px]">{LABOR_MODEL_LABELS[r.labor_model || ''] || '—'}</Badge>
                          </TableCell>
                          <TableCell className="text-[10px] text-right font-mono">${r.total_batch_cost?.toFixed(2)}</TableCell>
                          <TableCell className="text-[10px] text-right font-mono font-medium">${r.cost_per_box?.toFixed(2)}</TableCell>
                          <TableCell className="text-[10px] text-right font-mono">${r.cost_per_lb?.toFixed(2)}</TableCell>
                          <TableCell className="text-[10px] text-right font-mono">${r.revenue_per_lb?.toFixed(2)}</TableCell>
                          <TableCell className={cn('text-[10px] text-right font-mono font-semibold', (r.profit_per_lb || 0) > 0 ? 'text-emerald-600' : 'text-destructive')}>
                            ${r.profit_per_lb?.toFixed(2)}
                          </TableCell>
                          <TableCell className={cn('text-[10px] text-right font-mono font-semibold', (r.margin_pct || 0) >= 20 ? 'text-emerald-600' : 'text-destructive')}>
                            {r.margin_pct?.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-[10px] font-mono">{r.version > 1 ? `v${r.version}` : 'v1'}</TableCell>
                          <TableCell className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                            {r.override_reason || '—'}
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
      </div>
    </Layout>
  );
}
