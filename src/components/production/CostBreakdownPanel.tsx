/**
 * COST BREAKDOWN PANEL
 * Shows per-batch cost entry form + real-time margin preview.
 * Admin/Manager only — never shown to workers.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useBatchCost, useUpsertBatchCost, type BatchCost } from '@/hooks/useBatchCosts';
import { useTodayBatches } from '@/hooks/useProductionPortal';
import { DollarSign, TrendingUp, TrendingDown, Save, Info, Package, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CostBreakdownPanelProps {
  officeId: string;
}

const COST_FIELDS = [
  { key: 'material_tobacco_cost', label: 'Tobacco', icon: '🍂' },
  { key: 'material_tubes_cost', label: 'Tubes', icon: '🔧' },
  { key: 'material_stickers_cost', label: 'Stickers', icon: '🏷️' },
  { key: 'material_bags_cost', label: 'Bags', icon: '👜' },
  { key: 'material_boxes_cost', label: 'Boxes', icon: '📦' },
  { key: 'material_other_cost', label: 'Other', icon: '🔩' },
] as const;

type CostFieldKey = typeof COST_FIELDS[number]['key'];

export function CostBreakdownPanel({ officeId }: CostBreakdownPanelProps) {
  const { data: batches = [] } = useTodayBatches(officeId);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const { data: existingCost, isLoading: costLoading } = useBatchCost(selectedBatchId);
  const upsertCost = useUpsertBatchCost();

  const [form, setForm] = useState({
    material_tobacco_cost: 0,
    material_tubes_cost: 0,
    material_stickers_cost: 0,
    material_bags_cost: 0,
    material_boxes_cost: 0,
    material_other_cost: 0,
    labor_hours: 0,
    labor_rate_per_hour: 15,
    overhead_pct: 10,
    wholesale_price_per_box: 0,
    retail_price_per_box: 0,
  });

  // Load existing cost data when batch changes
  useEffect(() => {
    if (existingCost) {
      setForm({
        material_tobacco_cost: existingCost.material_tobacco_cost || 0,
        material_tubes_cost: existingCost.material_tubes_cost || 0,
        material_stickers_cost: existingCost.material_stickers_cost || 0,
        material_bags_cost: existingCost.material_bags_cost || 0,
        material_boxes_cost: existingCost.material_boxes_cost || 0,
        material_other_cost: existingCost.material_other_cost || 0,
        labor_hours: existingCost.labor_hours || 0,
        labor_rate_per_hour: existingCost.labor_rate_per_hour || 15,
        overhead_pct: existingCost.overhead_pct || 10,
        wholesale_price_per_box: existingCost.wholesale_price_per_box || 0,
        retail_price_per_box: existingCost.retail_price_per_box || 0,
      });
    } else if (selectedBatchId && !costLoading) {
      // Reset for new batch
      setForm(f => ({
        ...f,
        material_tobacco_cost: 0,
        material_tubes_cost: 0,
        material_stickers_cost: 0,
        material_bags_cost: 0,
        material_boxes_cost: 0,
        material_other_cost: 0,
        labor_hours: 0,
      }));
    }
  }, [existingCost, selectedBatchId, costLoading]);

  // Auto-select first batch
  useEffect(() => {
    if (batches.length > 0 && !selectedBatchId) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches, selectedBatchId]);

  const selectedBatch = batches.find(b => b.id === selectedBatchId);
  const boxesProduced = selectedBatch?.boxes_produced || 0;

  // Real-time computed values
  const totalMaterial = COST_FIELDS.reduce((sum, f) => sum + (form[f.key] || 0), 0);
  const laborCost = form.labor_hours * form.labor_rate_per_hour;
  const overheadCost = (totalMaterial + laborCost) * (form.overhead_pct / 100);
  const totalCost = totalMaterial + laborCost + overheadCost;
  const costPerBox = boxesProduced > 0 ? totalCost / boxesProduced : 0;
  const wholesaleMargin = form.wholesale_price_per_box > 0 && costPerBox > 0
    ? ((form.wholesale_price_per_box - costPerBox) / form.wholesale_price_per_box * 100)
    : null;
  const retailMargin = form.retail_price_per_box > 0 && costPerBox > 0
    ? ((form.retail_price_per_box - costPerBox) / form.retail_price_per_box * 100)
    : null;

  const handleSave = () => {
    if (!selectedBatchId) return;
    upsertCost.mutate({ batch_id: selectedBatchId, ...form });
  };

  const updateField = (key: string, value: number) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const getMarginBadge = (margin: number | null) => {
    if (margin === null) return null;
    const isHealthy = margin >= 20;
    return (
      <Badge className={cn(
        'text-xs font-mono',
        isHealthy 
          ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
          : 'bg-red-100 text-red-800 border-red-300'
      )}>
        {isHealthy ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
        {margin.toFixed(1)}%
      </Badge>
    );
  };

  if (batches.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-muted-foreground">No batches available. Create a batch first to track costs.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Batch Selector */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Batch Cost Breakdown
              </CardTitle>
              <CardDescription>Enter material, labor, and overhead costs per batch</CardDescription>
            </div>
            <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Select batch..." />
              </SelectTrigger>
              <SelectContent>
                {batches.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.brand} — {b.boxes_produced || 0} boxes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {costLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Material Costs */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  Raw Material Costs
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent>Cost of materials consumed for this batch</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {COST_FIELDS.map(field => (
                    <div key={field.key} className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <span>{field.icon}</span>
                        {field.label}
                      </Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2.5 text-xs text-muted-foreground">$</span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={form[field.key] || ''}
                          onChange={e => updateField(field.key, parseFloat(e.target.value) || 0)}
                          className="pl-6 text-sm h-9"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-right text-sm font-medium text-muted-foreground">
                  Material Total: <span className="text-foreground font-mono">${totalMaterial.toFixed(2)}</span>
                </div>
              </div>

              <Separator />

              {/* Labor */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Labor</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Hours Worked</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={form.labor_hours || ''}
                      onChange={e => updateField('labor_hours', parseFloat(e.target.value) || 0)}
                      className="text-sm h-9"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Rate ($/hr)</Label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2.5 text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        value={form.labor_rate_per_hour || ''}
                        onChange={e => updateField('labor_rate_per_hour', parseFloat(e.target.value) || 0)}
                        className="pl-6 text-sm h-9"
                        placeholder="15.00"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-right text-sm font-medium text-muted-foreground">
                  Labor Total: <span className="text-foreground font-mono">${laborCost.toFixed(2)}</span>
                </div>
              </div>

              <Separator />

              {/* Overhead */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  Overhead
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent>Applied as % of (Material + Labor)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </h4>
                <div className="flex items-center gap-3">
                  <div className="space-y-1 w-32">
                    <Label className="text-xs">Overhead %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={form.overhead_pct || ''}
                      onChange={e => updateField('overhead_pct', parseFloat(e.target.value) || 0)}
                      className="text-sm h-9"
                      placeholder="10"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground pt-5">
                    = <span className="text-foreground font-mono">${overheadCost.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Pricing */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Selling Prices (per box)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Wholesale Price</Label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2.5 text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        value={form.wholesale_price_per_box || ''}
                        onChange={e => updateField('wholesale_price_per_box', parseFloat(e.target.value) || 0)}
                        className="pl-6 text-sm h-9"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Retail Price</Label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2.5 text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        value={form.retail_price_per_box || ''}
                        onChange={e => updateField('retail_price_per_box', parseFloat(e.target.value) || 0)}
                        className="pl-6 text-sm h-9"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Summary */}
              <div className="bg-muted/40 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Batch Cost</span>
                  <span className="font-mono font-semibold">${totalCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Boxes Produced</span>
                  <span className="font-mono">{boxesProduced}</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between text-sm font-semibold">
                  <span>Cost Per Box</span>
                  <span className="font-mono text-primary">${costPerBox.toFixed(2)}</span>
                </div>
                {wholesaleMargin !== null && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Wholesale Margin</span>
                    {getMarginBadge(wholesaleMargin)}
                  </div>
                )}
                {retailMargin !== null && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Retail Margin</span>
                    {getMarginBadge(retailMargin)}
                  </div>
                )}
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSave}
                disabled={!selectedBatchId || upsertCost.isPending}
                className="w-full"
              >
                {upsertCost.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Cost Data
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
