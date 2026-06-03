/**
 * BATCH STATE CONTROLS
 * Renders state transition buttons for a single production batch.
 * Enforces valid transitions, field validation, and conversion confirmation.
 * On approval: shows labor model details, requires confirmation, creates cost snapshot.
 */

import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { BilingualLabel } from '@/components/portal/BilingualLabel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ArrowRight, Lock, CheckCircle, ShieldCheck, RotateCcw } from 'lucide-react';
import {
  getNextStates,
  getStateConfig,
  useTransitionBatchState,
  type InventoryState,
} from '@/hooks/useInventoryState';
import { useCreateCostSnapshot } from '@/hooks/useBatchCostHistory';
import { cn } from '@/lib/utils';

const LABOR_MODEL_LABELS: Record<string, string> = {
  hourly: 'Hourly',
  per_box: 'Per Box (Piece Rate)',
  flat_day: 'Flat Day Rate',
};

interface BatchStateControlsProps {
  batchId: string;
  currentState: InventoryState;
  officeId: string;
  compact?: boolean;
  /** Batch data for displaying conversion summary before approval */
  batchData?: {
    tobacco_lbs?: number;
    boxes_produced?: number;
    waste_lbs?: number;
    product_type?: string;
    product_output_units?: number;
    production_time_minutes?: number;
    changeover_minutes?: number;
    labor_model?: string;
    worker_count?: number;
    selected_worker_ids?: string[];
    labor_hourly_rate_snapshot?: number;
    labor_per_box_rate_snapshot?: number;
    labor_flat_day_rate_snapshot?: number;
  };
}

export function BatchStateControls({
  batchId,
  currentState,
  officeId,
  compact = false,
  batchData,
}: BatchStateControlsProps) {
  const transition = useTransitionBatchState();
  const createSnapshot = useCreateCostSnapshot();
  const config = getStateConfig(currentState);
  const nextStates = getNextStates(currentState);
  const [confirmed, setConfirmed] = useState(false);
  const [laborConfirmed, setLaborConfirmed] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  const handleTransition = async (toState: InventoryState, reason?: string) => {
    transition.mutate({
      batchId,
      fromState: currentState,
      toState,
      officeId,
      reason,
      conversionConfirmed: toState === 'approved' ? confirmed : undefined,
    }, {
      onSuccess: () => {
        if (toState === 'approved') {
          createSnapshot.mutate({ batchId, officeId });
        }
        setReopenReason('');
      },
    });
  };

  // Compute two-layer conversion preview for approval dialog
  const lbs = batchData?.tobacco_lbs || 0;
  const outputUnits = batchData?.product_output_units || 0;
  const boxesFull = Math.floor(outputUnits / 100);
  const unitsRemainder = outputUnits % 100;
  const boxesEquiv = outputUnits / 100.0;
  const productType = batchData?.product_type || 'tubes';
  const unitLabel = productType === 'bags' ? 'bags' : 'tubes';
  const changeover = batchData?.changeover_minutes || 0;
  const grossTime = batchData?.production_time_minutes || 0;
  const netTime = Math.max(grossTime - changeover, 0);

  const lbsPerUnit = outputUnits > 0 ? (lbs / outputUnits).toFixed(4) : '—';
  const unitsPerLb = lbs > 0 ? (outputUnits / lbs).toFixed(2) : '—';
  const lbsPerBox = boxesEquiv > 0 ? (lbs / boxesEquiv).toFixed(2) : '—';
  const boxesPerLb = lbs > 0 ? (boxesEquiv / lbs).toFixed(4) : '—';
  const wastePct = lbs > 0 && batchData?.waste_lbs ? ((batchData.waste_lbs / lbs) * 100).toFixed(1) : null;
  const timePerUnit = netTime > 0 && outputUnits > 0 ? (netTime / outputUnits).toFixed(3) : null;
  const timePerBox = netTime > 0 && boxesEquiv > 0 ? (netTime / boxesEquiv).toFixed(1) : null;

  // Labor model info for approval display
  const laborModel = batchData?.labor_model;
  const workerCount = batchData?.worker_count || 1;
  const selectedWorkers = batchData?.selected_worker_ids || [];

  const renderApprovalDialog = (ns: InventoryState) => {
    const nsConfig = getStateConfig(ns);
    const bothConfirmed = confirmed && (laborModel ? laborConfirmed : true);
    return (
      <AlertDialog key={ns}>
        <AlertDialogTrigger asChild>
          <Button
            size={compact ? 'sm' : 'sm'}
            variant={compact ? 'outline' : 'default'}
            className={compact ? 'h-6 text-xs' : ''}
            disabled={transition.isPending}
          >
            {compact ? <ArrowRight className="h-3 w-3 mr-1" /> : <ArrowRight className="h-4 w-4 mr-1" />}
            {compact ? nsConfig.label : t("production.move_to", { label: nsConfig.label })}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <BilingualLabel tKey="production.approve_distribution_title" en="Approve for Distribution?" />
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>{t("production.approve_distribution_desc")}</p>

                {/* <BilingualLabel tKey="production.conversion_summary" en="Conversion Summary" inline /> */}
                 <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
                   <p className="font-semibold text-foreground"><BilingualLabel tKey="production.conversion_summary" en="Conversion Summary" inline /> <span className="capitalize text-xs text-muted-foreground">({productType})</span></p>
                   <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
                     <span className="text-muted-foreground"><BilingualLabel tKey="production.material_input" en="Material Input:" inline /></span>
                     <span className="font-medium text-foreground">{lbs} lbs</span>
                     <span className="text-muted-foreground">{unitLabel} <BilingualLabel tKey="production.produced" en="produced:" inline /></span>
                     <span className="font-medium text-foreground">{outputUnits.toLocaleString()}</span>
                     <span className="text-muted-foreground"><BilingualLabel tKey="production.full_boxes_remainder" en="Full Boxes / Remainder:" inline /></span>
                     <span className="font-medium text-foreground">{boxesFull} boxes + {unitsRemainder} units</span>
                     <span className="text-muted-foreground"><BilingualLabel tKey="production.boxes_equivalent_label" en="Boxes (equivalent):" inline /></span>
                     <span className="font-medium text-foreground">{boxesEquiv.toFixed(2)}</span>
                     <span className="text-muted-foreground"><BilingualLabel tKey="production.lbs_per" en="LBS /" inline /> {unitLabel.slice(0, -1)}:</span>
                     <span className="font-medium text-foreground">{lbsPerUnit}</span>
                     <span className="text-muted-foreground">{unitLabel} / <BilingualLabel tKey="production.lbs" en="LB" inline />:</span>
                     <span className="font-medium text-foreground">{unitsPerLb}</span>
                     <span className="text-muted-foreground"><BilingualLabel tKey="production.lbs_per" en="LBS /" inline /> box:</span>
                     <span className="font-medium text-foreground">{lbsPerBox}</span>
                     <span className="text-muted-foreground"><BilingualLabel tKey="production.boxes" en="Boxes" inline /> / LB:</span>
                     <span className="font-medium text-foreground">{boxesPerLb}</span>
                     {changeover > 0 && (
                       <>
                         <span className="text-muted-foreground"><BilingualLabel tKey="production.changeover" en="Changeover:" inline /></span>
                         <span className="font-medium text-foreground">{changeover} min</span>
                         <span className="text-muted-foreground"><BilingualLabel tKey="production.gross_time" en="Gross Time:" inline /></span>
                         <span className="font-medium text-foreground">{grossTime} min</span>
                         <span className="text-muted-foreground"><BilingualLabel tKey="production.net_time" en="Net Time:" inline /></span>
                         <span className="font-medium text-foreground">{netTime} min</span>
                       </>
                     )}
                     {timePerUnit && (
                       <>
                         <span className="text-muted-foreground"><BilingualLabel tKey="production.net_time" en="Net Time" inline /> / {unitLabel.slice(0, -1)}:</span>
                         <span className="font-medium text-foreground">{timePerUnit} min</span>
                       </>
                     )}
                     {timePerBox && (
                       <>
                         <span className="text-muted-foreground"><BilingualLabel tKey="production.net_time" en="Net Time" inline /> / box:</span>
                         <span className="font-medium text-foreground">{timePerBox} min</span>
                       </>
                     )}
                     {wastePct && (
                       <>
                         <span className="text-muted-foreground"><BilingualLabel tKey="production.waste" en="Waste:" inline /></span>
                         <span className={cn('font-medium', parseFloat(wastePct) > 5 ? 'text-destructive' : 'text-foreground')}>
                           {wastePct}%
                         </span>
                       </>
                     )}
                   </div>
                 </div>

                {/* <BilingualLabel tKey="production.labor_cost_summary" en="Labor Cost Summary" /> */}
                {laborModel && (
                  <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
                    <p className="font-semibold text-foreground"><BilingualLabel tKey="production.labor_cost_summary" en="Labor Cost Summary" /></p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
                      <span className="text-muted-foreground"><BilingualLabel tKey="production.labor_model" en="Labor Model:" inline /></span>
                      <span className="font-medium text-foreground">{LABOR_MODEL_LABELS[laborModel] || laborModel}</span>
                      <span className="text-muted-foreground"><BilingualLabel tKey="production.worker_count" en="Worker Count:" inline /></span>
                      <span className="font-medium text-foreground">{workerCount}</span>
                      <span className="text-muted-foreground"><BilingualLabel tKey="production.selected_workers" en="Selected Workers:" inline /></span>
                      <span className="font-medium text-foreground">{selectedWorkers.length > 0 ? `${selectedWorkers.length} specific` : 'Generic'}</span>
                      {laborModel === 'hourly' && batchData?.labor_hourly_rate_snapshot && (
                        <>
                          <span className="text-muted-foreground"><BilingualLabel tKey="production.rate_snapshot" en="Rate Snapshot:" inline /></span>
                          <span className="font-medium text-foreground">${batchData.labor_hourly_rate_snapshot.toFixed(2)}/hr</span>
                        </>
                      )}
                      {laborModel === 'per_box' && batchData?.labor_per_box_rate_snapshot && (
                        <>
                          <span className="text-muted-foreground"><BilingualLabel tKey="production.rate_snapshot" en="Rate Snapshot:" inline /></span>
                          <span className="font-medium text-foreground">${batchData.labor_per_box_rate_snapshot.toFixed(2)}/box</span>
                        </>
                      )}
                      {laborModel === 'flat_day' && batchData?.labor_flat_day_rate_snapshot && (
                        <>
                          <span className="text-muted-foreground"><BilingualLabel tKey="production.rate_snapshot" en="Rate Snapshot:" inline /></span>
                          <span className="font-medium text-foreground">${batchData.labor_flat_day_rate_snapshot.toFixed(2)}/day</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Manager Confirmation Checkboxes */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="confirm-conversion"
                      checked={confirmed}
                      onCheckedChange={(v) => setConfirmed(v === true)}
                    />
                    <label htmlFor="confirm-conversion" className="text-xs leading-tight cursor-pointer text-foreground">
                      {t("production.confirm_conversion_lock")}
                    </label>
                  </div>
                  {laborModel && (
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="confirm-labor"
                        checked={laborConfirmed}
                        onCheckedChange={(v) => setLaborConfirmed(v === true)}
                      />
                      <label htmlFor="confirm-labor" className="text-xs leading-tight cursor-pointer text-foreground">
                        {t("production.confirm_labor_correct")}
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setConfirmed(false); setLaborConfirmed(false); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleTransition(ns)}
              disabled={!bothConfirmed}
              className={cn(!bothConfirmed && 'opacity-50 cursor-not-allowed')}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              <BilingualLabel tKey="production.confirm_approval" en="Confirm Approval" inline />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  const renderReopenDialog = (ns: InventoryState) => {
    return (
      <AlertDialog key={ns}>
        <AlertDialogTrigger asChild>
          <Button
            size={compact ? 'sm' : 'sm'}
            variant="outline"
            className={compact ? 'h-6 text-xs border-amber-300 text-amber-700' : 'border-amber-300 text-amber-700'}
            disabled={transition.isPending}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            <BilingualLabel tKey="production.reopen_batch" en="Reopen Batch" inline />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-600" />
              <BilingualLabel tKey="production.reopen_batch_title" en="Reopen Completed Batch?" />
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>{t("production.reopen_batch_desc")}</p>
                <div className="grid gap-2">
                  <Label className="text-xs"><BilingualLabel tKey="production.reopen_reason_req" en="Reason for reopening *" /></Label>
                  <Input
                    value={reopenReason}
                    onChange={e => setReopenReason(e.target.value)}
                    placeholder="e.g., Incorrect output count needs correction"
                    className="text-foreground"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReopenReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleTransition(ns, reopenReason)}
              disabled={reopenReason.length < 5}
              className={cn(reopenReason.length < 5 && 'opacity-50 cursor-not-allowed')}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              <BilingualLabel tKey="production.confirm_reopen" en="Confirm Reopen" inline />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  const renderButton = (ns: InventoryState) => {
    if (ns === 'approved') return renderApprovalDialog(ns);
    // Reopen flow: completed → in_production
    if (currentState === 'completed' && ns === 'in_production') return renderReopenDialog(ns);
    const nsConfig = getStateConfig(ns);
    return (
      <Button
        key={ns}
        size="sm"
        variant={compact ? 'outline' : 'default'}
        className={compact ? 'h-6 text-xs' : ''}
        onClick={() => handleTransition(ns)}
        disabled={transition.isPending}
      >
        {compact ? <ArrowRight className="h-3 w-3 mr-1" /> : <ArrowRight className="h-4 w-4 mr-1" />}
        {compact ? nsConfig.label : t("production.move_to", { label: nsConfig.label })}
      </Button>
    );
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Badge className={cn('text-xs border', config.color)}>
          {config.icon} {config.label}
        </Badge>
        {nextStates.length > 0 && nextStates.map(renderButton)}
        {nextStates.length === 0 && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" />
            <BilingualLabel tKey="production.final_state" en="Final state" inline />
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground"><BilingualLabel tKey="production.state" en="State:" inline /></span>
        <Badge className={cn('border', config.color)}>
          {config.icon} {config.label}
        </Badge>
      </div>
      {nextStates.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground"><BilingualLabel tKey="production.next" en="Next:" inline /></span>
          {nextStates.map(renderButton)}
        </div>
      )}
      {nextStates.length === 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Lock className="h-3 w-3" />
          {t("production.final_state_desc")}
        </p>
      )}
    </div>
  );
}
