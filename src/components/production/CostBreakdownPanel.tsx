/**
 * COST BREAKDOWN PANEL
 * Shows per-batch cost entry form + real-time margin preview.
 * Supports multiple labor models: hourly, per_box, flat_day.
 * Admin/Manager only — never shown to workers.
 * 
 * FINANCIAL LOCK: When batch_state = 'approved', all cost fields are locked.
 * Owner override creates a NEW versioned ledger entry (append-only).
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { BilingualLabel } from '@/components/portal/BilingualLabel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useBatchCost, useUpsertBatchCost, type BatchCost } from '@/hooks/useBatchCosts';
import { useCreateCostSnapshot } from '@/hooks/useBatchCostHistory';
import { useTodayBatches } from '@/hooks/useProductionPortal';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingUp, TrendingDown, Save, Info, Package, Loader2, Users, Clock, Boxes, Calendar, ShieldAlert, Unlock } from 'lucide-react';
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
type LaborModel = 'hourly' | 'per_box' | 'flat_day';

const LABOR_MODEL_INFO: Record<LaborModel, { label: string; icon: React.ReactNode; desc: string }> = {
  hourly: { label: 'Hourly', icon: <Clock className="h-4 w-4" />, desc: 'Rate × hours × workers' },
  per_box: { label: 'Per Box', icon: <Boxes className="h-4 w-4" />, desc: 'Rate × boxes produced' },
  flat_day: { label: 'Flat Day', icon: <Calendar className="h-4 w-4" />, desc: 'Fixed rate × workers' },
};

export function CostBreakdownPanel({ officeId }: CostBreakdownPanelProps) {
  const { t } = useTranslation();
  const { data: batches = [] } = useTodayBatches(officeId);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const { data: existingCost, isLoading: costLoading } = useBatchCost(selectedBatchId);
  const upsertCost = useUpsertBatchCost();

  // Labor model state
  const [laborModel, setLaborModel] = useState<LaborModel>('hourly');
  const [workerCount, setWorkerCount] = useState(1);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [useSpecificWorkers, setUseSpecificWorkers] = useState(false);

  // Owner override state
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const createSnapshot = useCreateCostSnapshot();

  // Check if current user is owner (can override locked batches)
  const { data: isOwner = false } = useQuery({
    queryKey: ['user-is-owner'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.user.id)
        .in('role', ['owner'])
        .maybeSingle();
      return !!data;
    },
  });

  // Fetch workers for this office
  const { data: workers = [] } = useQuery({
    queryKey: ['production-workers-rates', officeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_workers')
        .select('id, full_name, role, status, hourly_rate, per_box_rate, flat_day_rate')
        .eq('office_id', officeId)
        .eq('status', 'active');
      if (error) throw error;
      return data || [];
    },
    enabled: !!officeId,
  });

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

  // Load batch labor model when batch changes
  useEffect(() => {
    if (!selectedBatchId) return;
    const batch = batches.find(b => b.id === selectedBatchId);
    if (batch) {
      const batchAny = batch as any;
      if (batchAny.labor_model) setLaborModel(batchAny.labor_model);
      if (batchAny.worker_count) setWorkerCount(batchAny.worker_count);
      if (batchAny.selected_worker_ids?.length > 0) {
        setSelectedWorkerIds(batchAny.selected_worker_ids);
        setUseSpecificWorkers(true);
      } else {
        setSelectedWorkerIds([]);
        setUseSpecificWorkers(false);
      }
    }
  }, [selectedBatchId, batches]);

  // Auto-select first batch
  useEffect(() => {
    if (batches.length > 0 && !selectedBatchId) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches, selectedBatchId]);

  const selectedBatch = batches.find(b => b.id === selectedBatchId);
  const boxesProduced = (selectedBatch as any)?.boxes_equivalent || selectedBatch?.boxes_produced || 0;
  const batchApproved = (selectedBatch as any)?.batch_state === 'approved' || (selectedBatch as any)?.is_locked === true;
  const batchLocked = batchApproved && !overrideMode;

  // Calculate weighted hourly rate from selected workers
  const weightedHourlyRate = useMemo(() => {
    if (!useSpecificWorkers || selectedWorkerIds.length === 0) return form.labor_rate_per_hour;
    const selected = workers.filter(w => selectedWorkerIds.includes(w.id));
    if (selected.length === 0) return form.labor_rate_per_hour;
    const total = selected.reduce((sum, w) => sum + ((w as any).hourly_rate || 15), 0);
    return total / selected.length;
  }, [useSpecificWorkers, selectedWorkerIds, workers, form.labor_rate_per_hour]);

  const weightedPerBoxRate = useMemo(() => {
    if (!useSpecificWorkers || selectedWorkerIds.length === 0) return 0;
    const selected = workers.filter(w => selectedWorkerIds.includes(w.id));
    if (selected.length === 0) return 0;
    return selected.reduce((sum, w) => sum + ((w as any).per_box_rate || 0), 0);
  }, [useSpecificWorkers, selectedWorkerIds, workers]);

  const weightedFlatDayRate = useMemo(() => {
    if (!useSpecificWorkers || selectedWorkerIds.length === 0) return 0;
    const selected = workers.filter(w => selectedWorkerIds.includes(w.id));
    if (selected.length === 0) return 0;
    return selected.reduce((sum, w) => sum + ((w as any).flat_day_rate || 0), 0);
  }, [useSpecificWorkers, selectedWorkerIds, workers]);

  // Real-time computed values
  const totalMaterial = COST_FIELDS.reduce((sum, f) => sum + (form[f.key] || 0), 0);
  
  // Labor cost by model
  const laborCost = useMemo(() => {
    const effectiveWorkerCount = useSpecificWorkers ? selectedWorkerIds.length : workerCount;
    switch (laborModel) {
      case 'hourly': {
        const rate = useSpecificWorkers ? weightedHourlyRate : form.labor_rate_per_hour;
        return form.labor_hours * rate * (useSpecificWorkers ? selectedWorkerIds.length : 1);
      }
      case 'per_box': {
        if (useSpecificWorkers) return boxesProduced * weightedPerBoxRate;
        return boxesProduced * form.labor_rate_per_hour; // Reuse rate field for per_box rate when generic
      }
      case 'flat_day': {
        if (useSpecificWorkers) return weightedFlatDayRate;
        return effectiveWorkerCount * form.labor_rate_per_hour; // Reuse rate field for flat rate when generic
      }
      default:
        return form.labor_hours * form.labor_rate_per_hour;
    }
  }, [laborModel, form, workerCount, selectedWorkerIds, useSpecificWorkers, weightedHourlyRate, weightedPerBoxRate, weightedFlatDayRate, boxesProduced]);

  const overheadCost = (totalMaterial + laborCost) * (form.overhead_pct / 100);
  const totalCost = totalMaterial + laborCost + overheadCost;
  const costPerBox = boxesProduced > 0 ? totalCost / boxesProduced : 0;
  const wholesaleMargin = form.wholesale_price_per_box > 0 && costPerBox > 0
    ? ((form.wholesale_price_per_box - costPerBox) / form.wholesale_price_per_box * 100)
    : null;
  const retailMargin = form.retail_price_per_box > 0 && costPerBox > 0
    ? ((form.retail_price_per_box - costPerBox) / form.retail_price_per_box * 100)
    : null;

  const laborPct = totalCost > 0 ? (laborCost / totalCost) * 100 : 0;

  const handleSave = async () => {
    if (!selectedBatchId) return;

    // Save cost data
    upsertCost.mutate({ batch_id: selectedBatchId, ...form });

    // Determine snapshot rates
    let hourlySnap: number | null = null;
    let perBoxSnap: number | null = null;
    let flatDaySnap: number | null = null;

    if (laborModel === 'hourly') hourlySnap = useSpecificWorkers ? weightedHourlyRate : form.labor_rate_per_hour;
    if (laborModel === 'per_box') perBoxSnap = useSpecificWorkers ? (weightedPerBoxRate / Math.max(selectedWorkerIds.length, 1)) : form.labor_rate_per_hour;
    if (laborModel === 'flat_day') flatDaySnap = useSpecificWorkers ? (weightedFlatDayRate / Math.max(selectedWorkerIds.length, 1)) : form.labor_rate_per_hour;

    // Calculate conversion snapshot (boxes per lb)
    const tobaccoLbs = (selectedBatch as any)?.tobacco_lbs || 0;
    const conversionBoxesPerLb = tobaccoLbs > 0 && boxesProduced > 0
      ? boxesProduced / tobaccoLbs : 0;

    // Update batch with labor model + snapshots + conversion/revenue snapshots
    await supabase
      .from('production_batches')
      .update({
        labor_model: laborModel,
        worker_count: useSpecificWorkers ? selectedWorkerIds.length : workerCount,
        selected_worker_ids: useSpecificWorkers ? selectedWorkerIds : null,
        labor_hourly_rate_snapshot: hourlySnap,
        labor_per_box_rate_snapshot: perBoxSnap,
        labor_flat_day_rate_snapshot: flatDaySnap,
        conversion_boxes_per_lb_snapshot: conversionBoxesPerLb > 0 ? conversionBoxesPerLb : null,
        wholesale_price_per_box_snapshot: form.wholesale_price_per_box > 0 ? form.wholesale_price_per_box : null,
      })
      .eq('id', selectedBatchId);
  };

  const updateField = (key: string, value: number) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const toggleWorker = (workerId: string) => {
    setSelectedWorkerIds(prev =>
      prev.includes(workerId)
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId]
    );
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

  const getLaborPctBadge = () => {
    let color = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (laborPct > 35) color = 'bg-red-100 text-red-800 border-red-300';
    else if (laborPct > 25) color = 'bg-amber-100 text-amber-800 border-amber-300';
    return (
      <Badge className={cn('text-xs font-mono', color)}>
        {laborPct.toFixed(0)}% {t("production.of_total")}
      </Badge>
    );
  };

  if (batches.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-muted-foreground">{t("production.no_batches_track_costs")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <BilingualLabel tKey="production.batch_cost_breakdown" en="Batch Cost Breakdown" />
              </CardTitle>
              <CardDescription>{t("production.batch_cost_breakdown_desc")}</CardDescription>
            </div>
            <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder={t("production.select_batch")} />
              </SelectTrigger>
              <SelectContent>
                {batches.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.brand} — {b.boxes_produced || 0} boxes
                    {(b as any).is_locked && ' 🔒'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {batchApproved && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-700">
                🔒 {overrideMode ? '<BilingualLabel tKey="production.owner_override_active" en="<BilingualLabel tKey="production.owner_override" en="Owner Override" inline /> Active" inline />' : '<BilingualLabel tKey="production.approved_locked" en="Approved — cost data locked" inline />'}
              </Badge>
              {isOwner && !overrideMode && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-destructive">
                      <Unlock className="h-3 w-3" /> <BilingualLabel tKey="production.owner_override" en="Owner Override" inline />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <ShieldAlert className="h-5 w-5 text-destructive" />
                        <BilingualLabel tKey="production.owner_override" en="Owner Override" inline /> — Cost Fields
                      </AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-3">
                          <p>{t("production.owner_override_desc")}</p>
                          <div className="space-y-1">
                            <Label className="text-xs"><BilingualLabel tKey="production.override_reason_req" en="Override Reason (required)" /></Label>
                            <Textarea
                              value={overrideReason}
                              onChange={(e) => setOverrideReason(e.target.value)}
                              placeholder={t("production.override_reason_placeholder")}
                              className="text-sm"
                              rows={3}
                            />
                          </div>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel><BilingualLabel tKey="production.cancel" en="Cancel" inline /></AlertDialogCancel>
                      <AlertDialogAction
                        disabled={overrideReason.trim().length < 5}
                        onClick={() => setOverrideMode(true)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        <Unlock className="h-4 w-4 mr-1" /> <BilingualLabel tKey="production.unlock_fields" en="Unlock Fields" inline />
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {overrideMode && (
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setOverrideMode(false); setOverrideReason(''); }}>
                  <BilingualLabel tKey="production.cancel_override" en="Cancel Override" inline />
                </Button>
              )}
            </div>
          )}
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
                  <BilingualLabel tKey="production.raw_material_costs" en="Raw Material Costs" />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent>{t("production.cost_materials_consumed_tooltip")}</TooltipContent>
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
                          disabled={batchLocked}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-right text-sm font-medium text-muted-foreground">
                  <BilingualLabel tKey="production.material_total" en="Material Total" inline />: <span className="text-foreground font-mono">${totalMaterial.toFixed(2)}</span>
                </div>
              </div>

              <Separator />

              {/* <BilingualLabel tKey="production.labor_model_label" en="Labor Model" /> Selection */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <BilingualLabel tKey="production.labor_cost_model" en="Labor Cost Model" />
                </h4>
                <RadioGroup
                  value={laborModel}
                  onValueChange={(v) => setLaborModel(v as LaborModel)}
                  className="grid grid-cols-3 gap-2 mb-4"
                  disabled={batchLocked}
                >
                  {(Object.entries(LABOR_MODEL_INFO) as [LaborModel, typeof LABOR_MODEL_INFO[LaborModel]][]).map(([key, info]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <RadioGroupItem value={key} id={`labor-${key}`} />
                      <Label htmlFor={`labor-${key}`} className="text-xs cursor-pointer flex items-center gap-1">
                        {info.icon}
                        <span>{info.label}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                <p className="text-xs text-muted-foreground mb-3">
                  {LABOR_MODEL_INFO[laborModel].desc}
                </p>

                {/* Worker Selection */}
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox
                      id="use-specific-workers"
                      checked={useSpecificWorkers}
                      onCheckedChange={(v) => {
                        setUseSpecificWorkers(v === true);
                        if (!v) setSelectedWorkerIds([]);
                      }}
                      disabled={batchLocked}
                    />
                    <Label htmlFor="use-specific-workers" className="text-xs cursor-pointer">
                      <BilingualLabel tKey="production.select_specific_workers" en="Select specific workers (pulls rates from worker profiles)" />
                    </Label>
                  </div>

                  {useSpecificWorkers ? (
                    <div className="border rounded-md p-2 max-h-[120px] overflow-y-auto space-y-1">
                      {workers.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-1">{t("production.no_active_workers")}</p>
                      ) : (
                        workers.map(w => {
                          const wAny = w as any;
                          const rateLabel = laborModel === 'hourly'
                            ? `$${(wAny.hourly_rate || 0).toFixed(2)}/hr`
                            : laborModel === 'per_box'
                            ? `$${(wAny.per_box_rate || 0).toFixed(2)}/box`
                            : `$${(wAny.flat_day_rate || 0).toFixed(2)}/day`;
                          return (
                            <div key={w.id} className="flex items-center gap-2">
                              <Checkbox
                                checked={selectedWorkerIds.includes(w.id)}
                                onCheckedChange={() => toggleWorker(w.id)}
                                disabled={batchLocked}
                              />
                              <span className="text-xs flex-1">{w.full_name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{rateLabel}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs"><BilingualLabel tKey="production.number_of_workers" en="Number of Workers" /></Label>
                      <Input
                        type="number"
                        min={1}
                        value={workerCount}
                        onChange={e => setWorkerCount(parseInt(e.target.value) || 1)}
                        className="text-sm h-9 w-24"
                        disabled={batchLocked}
                      />
                    </div>
                  )}
                </div>

                {/* Model-specific inputs */}
                <div className="grid grid-cols-2 gap-3">
                  {laborModel === 'hourly' && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs"><BilingualLabel tKey="production.hours_worked" en="Hours Worked" /></Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={form.labor_hours || ''}
                          onChange={e => updateField('labor_hours', parseFloat(e.target.value) || 0)}
                          className="text-sm h-9"
                          placeholder="0"
                          disabled={batchLocked}
                        />
                      </div>
                      {!useSpecificWorkers && (
                        <div className="space-y-1">
                          <Label className="text-xs"><BilingualLabel tKey="production.rate_hr" en="Rate ($/hr)" /></Label>
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
                              disabled={batchLocked}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {laborModel === 'per_box' && !useSpecificWorkers && (
                    <div className="space-y-1">
                      <Label className="text-xs"><BilingualLabel tKey="production.rate_box" en="Rate ($/box)" /></Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2.5 text-xs text-muted-foreground">$</span>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={form.labor_rate_per_hour || ''}
                          onChange={e => updateField('labor_rate_per_hour', parseFloat(e.target.value) || 0)}
                          className="pl-6 text-sm h-9"
                          placeholder="0.00"
                          disabled={batchLocked}
                        />
                      </div>
                    </div>
                  )}
                  {laborModel === 'flat_day' && !useSpecificWorkers && (
                    <div className="space-y-1">
                      <Label className="text-xs"><BilingualLabel tKey="production.rate_day_worker" en="Rate ($/day per worker)" /></Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2.5 text-xs text-muted-foreground">$</span>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={form.labor_rate_per_hour || ''}
                          onChange={e => updateField('labor_rate_per_hour', parseFloat(e.target.value) || 0)}
                          className="pl-6 text-sm h-9"
                          placeholder="0.00"
                          disabled={batchLocked}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-2 text-right text-sm font-medium text-muted-foreground flex items-center justify-end gap-2">
                  <BilingualLabel tKey="production.labor_total" en="Labor Total" inline />: <span className="text-foreground font-mono">${laborCost.toFixed(2)}</span>
                  {getLaborPctBadge()}
                </div>
              </div>

              <Separator />

              {/* <BilingualLabel tKey="production.overhead" en="Overhead" /> */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <BilingualLabel tKey="production.overhead" en="Overhead" />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent>{t("production.overhead_tooltip")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </h4>
                <div className="flex items-center gap-3">
                  <div className="space-y-1 w-32">
                    <Label className="text-xs"><BilingualLabel tKey="production.overhead" en="Overhead" /> %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={form.overhead_pct || ''}
                      onChange={e => updateField('overhead_pct', parseFloat(e.target.value) || 0)}
                      className="text-sm h-9"
                      placeholder="10"
                      disabled={batchLocked}
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
                <h4 className="text-sm font-semibold mb-3"><BilingualLabel tKey="production.selling_prices" en="Selling Prices (per box)" /></h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs"><BilingualLabel tKey="production.wholesale_price" en="Wholesale Price" /></Label>
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
                        disabled={batchLocked}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs"><BilingualLabel tKey="production.retail_price" en="Retail Price" /></Label>
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
                        disabled={batchLocked}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Summary */}
              <div className="bg-muted/40 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground"><BilingualLabel tKey="production.total_batch_cost" en="Total Batch Cost" /></span>
                  <span className="font-mono font-semibold">${totalCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground"><BilingualLabel tKey="production.boxes_produced_label" en="Boxes Produced" /></span>
                  <span className="font-mono">{typeof boxesProduced === 'number' ? boxesProduced.toFixed(2) : boxesProduced}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground"><BilingualLabel tKey="production.labor_model_label" en="Labor Model" /></span>
                  <Badge variant="outline" className="text-[10px]">{LABOR_MODEL_INFO[laborModel].label}</Badge>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between text-sm font-semibold">
                  <span><BilingualLabel tKey="production.cost_per_box" en="Cost Per Box" /></span>
                  <span className="font-mono text-primary">${costPerBox.toFixed(2)}</span>
                </div>
                {wholesaleMargin !== null && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground"><BilingualLabel tKey="production.wholesale_margin" en="Wholesale Margin" /></span>
                    {getMarginBadge(wholesaleMargin)}
                  </div>
                )}
                {retailMargin !== null && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground"><BilingualLabel tKey="production.retail_margin" en="Retail Margin" /></span>
                    {getMarginBadge(retailMargin)}
                  </div>
                )}
              </div>

              {/* Save Button */}
              {overrideMode ? (
                <Button
                  onClick={async () => {
                    if (!selectedBatchId) return;
                    // Save updated cost data first
                    upsertCost.mutate({ batch_id: selectedBatchId, ...form });
                    // Update batch with new labor model + snapshots (owner bypass trigger)
                    let hourlySnap: number | null = null;
                    let perBoxSnap: number | null = null;
                    let flatDaySnap: number | null = null;
                    if (laborModel === 'hourly') hourlySnap = useSpecificWorkers ? weightedHourlyRate : form.labor_rate_per_hour;
                    if (laborModel === 'per_box') perBoxSnap = useSpecificWorkers ? (weightedPerBoxRate / Math.max(selectedWorkerIds.length, 1)) : form.labor_rate_per_hour;
                    if (laborModel === 'flat_day') flatDaySnap = useSpecificWorkers ? (weightedFlatDayRate / Math.max(selectedWorkerIds.length, 1)) : form.labor_rate_per_hour;
                    await supabase
                      .from('production_batches')
                      .update({
                        labor_model: laborModel,
                        worker_count: useSpecificWorkers ? selectedWorkerIds.length : workerCount,
                        selected_worker_ids: useSpecificWorkers ? selectedWorkerIds : null,
                        labor_hourly_rate_snapshot: hourlySnap,
                        labor_per_box_rate_snapshot: perBoxSnap,
                        labor_flat_day_rate_snapshot: flatDaySnap,
                      })
                      .eq('id', selectedBatchId);
                    // Create NEW versioned ledger entry
                    const batch = batches.find(b => b.id === selectedBatchId);
                    const oid = (batch as any)?.office_id || officeId;
                    createSnapshot.mutate({ batchId: selectedBatchId, officeId: oid, overrideReason });
                    setOverrideMode(false);
                    setOverrideReason('');
                  }}
                  disabled={!selectedBatchId || upsertCost.isPending || createSnapshot.isPending}
                  className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {(upsertCost.isPending || createSnapshot.isPending) ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 mr-2" />
                  )}
                  <BilingualLabel tKey="production.save_override" en="Save Override (Creates Ledger v2+)" inline />
                </Button>
              ) : (
                <Button
                  onClick={handleSave}
                  disabled={!selectedBatchId || upsertCost.isPending || batchLocked}
                  className="w-full"
                >
                  {upsertCost.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {batchLocked ? 'Costs Locked (Approved)' : 'Save Cost Data'}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
