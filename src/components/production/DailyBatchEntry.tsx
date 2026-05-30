/**
 * DAILY BATCH ENTRY COMPONENT
 * 
 * Create and manage production batches.
 * Track inputs (tobacco, tubes, stickers) and outputs (boxes by brand).
 * Includes defect category guardrails with warnings.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  useTodayBatches, 
  useCreateBatch, 
  useUpdateBatch,
  useBatchOutputs,
  useRecordOutput,
  useProductionWorkers,
  ProductionBatch 
} from '@/hooks/useProductionPortal';
import { useDeviationGate } from '@/hooks/useDeviationGate';
import { useAllocationCheck } from '@/hooks/useMaterialAllocations';
import { supabase } from '@/integrations/supabase/client';
import { Boxes, Plus, Play, CheckCircle, XCircle, ChevronRight, Scale, Package, AlertTriangle, User, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { BilingualLabel } from '@/components/portal/BilingualLabel';


interface DailyBatchEntryProps {
  officeId: string;
}

const BRANDS = [
  { id: 'gasmask', label: 'Gasmask', color: 'bg-emerald-500' },
  { id: 'hotmama', label: 'HotMama', color: 'bg-pink-500' },
  { id: 'hotscolati', label: 'Hotscolatti', color: 'bg-amber-500' },
  { id: 'grabba-rus', label: 'GrabbaRus', color: 'bg-purple-500' },
];

const STATUS_CONFIG: Record<string, { tKey: string; en: string; color: string; icon: React.ReactNode }> = {
  open: { tKey: 'production.status.open', en: 'Open', color: 'bg-blue-100 text-blue-800', icon: <Package className="h-4 w-4" /> },
  in_progress: { tKey: 'production.status.in_progress', en: 'In Progress', color: 'bg-amber-100 text-amber-800', icon: <Play className="h-4 w-4" /> },
  completed: { tKey: 'production.status.completed', en: 'Completed', color: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle className="h-4 w-4" /> },
  cancelled: { tKey: 'production.status.cancelled', en: 'Cancelled', color: 'bg-red-100 text-red-800', icon: <XCircle className="h-4 w-4" /> },
};

const DEFECT_CATEGORIES = [
  { value: 'underfilled', tKey: 'production.defect.underfilled', en: 'Underfilled' },
  { value: 'overfilled', tKey: 'production.defect.overfilled', en: 'Overfilled' },
  { value: 'loose_sticker', tKey: 'production.defect.loose_sticker', en: 'Loose Sticker' },
  { value: 'torn_tube', tKey: 'production.defect.torn_tube', en: 'Torn Tube' },
  { value: 'moisture', tKey: 'production.defect.moisture', en: 'Moisture Damage' },
  { value: 'contamination', tKey: 'production.defect.contamination', en: 'Contamination' },
  { value: 'label_misaligned', tKey: 'production.defect.label_misaligned', en: 'Label Misaligned' },
  { value: 'packaging_damage', tKey: 'production.defect.packaging_damage', en: 'Packaging Damage' },
  { value: 'other', tKey: 'production.defect.other', en: 'Other' },
];


export function DailyBatchEntry({ officeId }: DailyBatchEntryProps) {
  const { data: batches = [], isLoading } = useTodayBatches(officeId);
  const { data: workers = [] } = useProductionWorkers(officeId);
  const createBatch = useCreateBatch();
  const updateBatch = useUpdateBatch();
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<ProductionBatch | null>(null);
  const [formData, setFormData] = useState({
    brand: 'gasmask',
    shift_label: 'Morning',
    tobacco_lbs: '',
    tubes_total: '',
    product_type: 'tubes' as 'tubes' | 'bags',
    product_output_units: '',
    stickers_issued: {} as Record<string, number>,
    empty_boxes_issued: {} as Record<string, number>,
    workers_present: [] as string[],
    notes: '',
  });

  // Deviation gate state
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideAcknowledged, setOverrideAcknowledged] = useState(false);

  const proposedLbs = parseFloat(formData.tobacco_lbs) || 0;
  const gate = useDeviationGate(formData.brand, proposedLbs);
  const allocationCheck = useAllocationCheck(officeId);
  const allocationResult = allocationCheck.canAllocateLbs(proposedLbs);

  const handleCreateBatch = async () => {
    // Check allocation enforcement
    if (!allocationResult.allowed && proposedLbs > 0) {
      toast.error(allocationResult.message);
      return;
    }

    // Check deviation gate
    if (gate.requiresOverride && !showOverrideModal) {
      setShowOverrideModal(true);
      return;
    }

    const productUnits = parseInt(formData.product_output_units) || 0;
    const batchData = {
      office_id: officeId,
      brand: formData.brand,
      shift_label: formData.shift_label,
      tobacco_lbs: proposedLbs,
      tubes_total: formData.product_type === 'tubes' ? (parseInt(formData.tubes_total) || 0) : 0,
      stickers_issued: formData.stickers_issued,
      empty_boxes_issued: formData.empty_boxes_issued,
      workers_present: formData.workers_present,
      notes: formData.notes,
      status: 'open',
      product_type: formData.product_type,
      product_output_units: productUnits,
    };

    const result = await createBatch.mutateAsync(batchData);

    // If override was required, log it
    if (gate.requiresOverride && overrideReason) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from('production_demand_overrides')
        .insert({
          brand: formData.brand,
          recommended_lbs: gate.recommended,
          actual_lbs: proposedLbs,
          deviation_pct: gate.deviationPct,
          override_reason: overrideReason,
          acknowledged_by: user?.id || null,
          is_high_override: gate.isHighOverride,
          batch_id: (result as any)?.id || null,
        } as any);
      toast.info(`Override logged: ${gate.deviationPct}% deviation from recommendation`);
    }

    setIsCreateModalOpen(false);
    setShowOverrideModal(false);
    setOverrideReason('');
    setOverrideAcknowledged(false);
    setFormData({
      brand: 'gasmask',
      shift_label: 'Morning',
      tobacco_lbs: '',
      tubes_total: '',
      product_type: 'tubes',
      product_output_units: '',
      stickers_issued: {},
      empty_boxes_issued: {},
      workers_present: [],
      notes: '',
    });
  };

  const handleOverrideConfirm = () => {
    if (overrideReason.length < 20 || !overrideAcknowledged) return;
    handleCreateBatch();
  };

  const updateStickersIssued = (brand: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      stickers_issued: {
        ...prev.stickers_issued,
        [brand]: parseInt(value) || 0,
      },
    }));
  };

  const updateBoxesIssued = (brand: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      empty_boxes_issued: {
        ...prev.empty_boxes_issued,
        [brand]: parseInt(value) || 0,
      },
    }));
  };

  const handleStartBatch = async (batch: ProductionBatch) => {
    await updateBatch.mutateAsync({
      id: batch.id,
      status: 'in_progress',
    });
  };

  const handleCompleteBatch = async (batch: ProductionBatch) => {
    await updateBatch.mutateAsync({
      id: batch.id,
      status: 'completed',
      completed_at: new Date().toISOString(),
    });
  };

  const toggleWorker = (workerId: string) => {
    setFormData(prev => ({
      ...prev,
      workers_present: prev.workers_present.includes(workerId)
        ? prev.workers_present.filter(id => id !== workerId)
        : [...prev.workers_present, workerId],
    }));
  };

  const activeWorkers = workers.filter(w => w.status === 'active');

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Boxes className="h-5 w-5" />
            Today's Batches ({batches.length})
          </CardTitle>
          <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Batch
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Boxes className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No batches created today.</p>
              <Button variant="link" onClick={() => setIsCreateModalOpen(true)}>
                Start your first batch
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {batches.map(batch => {
                const statusConfig = STATUS_CONFIG[batch.status || 'open'];
                const brandConfig = BRANDS.find(b => b.id === batch.brand);
                
                return (
                  <div 
                    key={batch.id}
                    className="p-4 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors cursor-pointer"
                    onClick={() => setSelectedBatch(batch)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-3 h-3 rounded-full', brandConfig?.color)} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{brandConfig?.label}</span>
                            <Badge variant="outline" className="text-xs">
                              {batch.shift_label}
                            </Badge>
                            <Badge className={cn('text-xs', statusConfig?.color)}>
                              {statusConfig?.label}
                            </Badge>
                            {(batch as any).generated_by_system && (
                              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                <Bot className="h-3 w-3" /> System Draft
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs capitalize">
                              {(batch as any).product_type || 'tubes'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Scale className="h-3 w-3" />
                              {batch.tobacco_lbs ?? 0} lbs
                            </span>
                            <span>
                              {(batch as any).product_output_units || 0} {(batch as any).product_type === 'bags' ? 'bags' : 'tubes'}
                            </span>
                            <span className="text-primary font-medium">
                              {(batch as any).boxes_full || batch.boxes_produced || 0} boxes
                              {((batch as any).units_remainder || 0) > 0 && (
                                <span className="text-muted-foreground text-xs ml-1">+{(batch as any).units_remainder}</span>
                              )}
                            </span>
                            {(batch.total_defects || 0) > 0 && (
                              <span className="text-destructive flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {batch.total_defects} defects
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {batch.status === 'open' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); handleStartBatch(batch); }}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Start
                          </Button>
                        )}
                        {batch.status === 'in_progress' && (
                          <Button 
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleCompleteBatch(batch); }}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        )}
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Batch Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Batch</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Brand *</Label>
                <Select
                  value={formData.brand}
                  onValueChange={(value) => setFormData({ ...formData, brand: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANDS.map(brand => (
                      <SelectItem key={brand.id} value={brand.id}>
                        <div className="flex items-center gap-2">
                          <div className={cn('w-2 h-2 rounded-full', brand.color)} />
                          {brand.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Shift</Label>
                <Select
                  value={formData.shift_label}
                  onValueChange={(value) => setFormData({ ...formData, shift_label: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Morning">Morning</SelectItem>
                    <SelectItem value="Afternoon">Afternoon</SelectItem>
                    <SelectItem value="Evening">Evening</SelectItem>
                    <SelectItem value="Night">Night</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Product Type Selection */}
            <div className="grid gap-2">
              <Label>Product Type *</Label>
              <Select
                value={formData.product_type}
                onValueChange={(value) => setFormData({ ...formData, product_type: value as 'tubes' | 'bags' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tubes">🚬 Tubes (Boxed Units)</SelectItem>
                  <SelectItem value="bags">🛍️ Bags</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Materials Issued Section */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Materials Issued to Office
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                Enter what materials are being issued for this batch. These values are locked after creation.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="tobacco">Tobacco (lbs) *</Label>
                  <Input
                    id="tobacco"
                    type="number"
                    step="0.1"
                    value={formData.tobacco_lbs}
                    onChange={(e) => setFormData({ ...formData, tobacco_lbs: e.target.value })}
                    placeholder="0.0"
                  />
                  {!allocationResult.allowed && proposedLbs > 0 && (
                    <p className="text-xs text-destructive mt-1">
                      ⚠ Exceeds unallocated inventory ({Number(allocationCheck.overview?.unallocated_lbs || 0).toFixed(1)} lbs available)
                    </p>
                  )}
                </div>

                {formData.product_type === 'tubes' && (
                  <div className="grid gap-2">
                    <Label htmlFor="tubes">Tubes Issued (qty)</Label>
                    <Input
                      id="tubes"
                      type="number"
                      value={formData.tubes_total}
                      onChange={(e) => setFormData({ ...formData, tubes_total: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                )}
              </div>

              {/* Product Units Produced + Auto Boxes */}
              <div className="border rounded-lg p-4 bg-primary/5">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Boxes className="h-4 w-4" />
                  Output — {formData.product_type === 'bags' ? 'Bags' : 'Tubes'} Produced
                </h4>
                <p className="text-xs text-muted-foreground mb-3">
                  100 {formData.product_type === 'bags' ? 'bags' : 'tubes'} = 1 box. Boxes auto-calculated. Remainder tracked separately.
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="product_units">{formData.product_type === 'bags' ? 'Bags' : 'Tubes'} Produced *</Label>
                    <Input
                      id="product_units"
                      type="number"
                      value={formData.product_output_units}
                      onChange={(e) => setFormData({ ...formData, product_output_units: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Full Boxes</Label>
                    <div className="flex items-center h-10 px-3 rounded-md border bg-muted text-foreground font-mono font-bold">
                      {Math.floor((parseInt(formData.product_output_units) || 0) / 100)}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Remainder</Label>
                    <div className="flex items-center h-10 px-3 rounded-md border bg-muted text-muted-foreground font-mono">
                      {(parseInt(formData.product_output_units) || 0) % 100} units
                    </div>
                  </div>
                </div>
                {/* Real-time conversion display using boxes_equivalent */}
                {proposedLbs > 0 && parseInt(formData.product_output_units) > 0 && (() => {
                  const units = parseInt(formData.product_output_units);
                  const boxesEquiv = units / 100.0;
                  return (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2 rounded bg-muted/50 border">
                        <span className="text-muted-foreground">Units/LB</span>
                        <p className="font-mono font-bold">{(units / proposedLbs).toFixed(2)}</p>
                      </div>
                      <div className="p-2 rounded bg-muted/50 border">
                        <span className="text-muted-foreground">Boxes(eq)/LB</span>
                        <p className="font-mono font-bold">{(boxesEquiv / proposedLbs).toFixed(3)}</p>
                      </div>
                      <div className="p-2 rounded bg-muted/50 border">
                        <span className="text-muted-foreground">LBS/Unit</span>
                        <p className="font-mono font-bold">{(proposedLbs / units).toFixed(4)}</p>
                      </div>
                      <div className="p-2 rounded bg-muted/50 border">
                        <span className="text-muted-foreground">LBS/Box(eq)</span>
                        <p className="font-mono font-bold">{(proposedLbs / boxesEquiv).toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Per-brand issued materials */}
              <div className="mt-4 space-y-3">
                <Label className="text-sm">Stickers & Boxes by Brand</Label>
                <div className="grid gap-3">
                  {BRANDS.map(brand => (
                    <div key={brand.id} className="flex items-center gap-3 p-2 bg-background rounded border">
                      <div className={cn('w-3 h-3 rounded-full flex-shrink-0', brand.color)} />
                      <span className="text-sm font-medium w-24">{brand.label}</span>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <Input
                            type="number"
                            placeholder="Stickers"
                            className="h-8 text-sm"
                            value={formData.stickers_issued[brand.id] || ''}
                            onChange={(e) => updateStickersIssued(brand.id, e.target.value)}
                          />
                        </div>
                        <div>
                          <Input
                            type="number"
                            placeholder="Empty Boxes"
                            className="h-8 text-sm"
                            value={formData.empty_boxes_issued[brand.id] || ''}
                            onChange={(e) => updateBoxesIssued(brand.id, e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {activeWorkers.length > 0 && (
              <div className="grid gap-2">
                <Label>Workers Present</Label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border rounded-md">
                  {activeWorkers.map(worker => (
                    <div key={worker.id} className="flex items-center gap-2">
                      <Checkbox
                        id={worker.id}
                        checked={formData.workers_present.includes(worker.id)}
                        onCheckedChange={() => toggleWorker(worker.id)}
                      />
                      <label htmlFor={worker.id} className="text-sm cursor-pointer">
                        {worker.full_name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateBatch}
              disabled={createBatch.isPending}
            >
              Create Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override Gate Modal */}
      <AlertDialog open={showOverrideModal} onOpenChange={setShowOverrideModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Production Override Required
            </AlertDialogTitle>
            <AlertDialogDescription>
              Production quantity deviates <strong>{gate.deviationPct}%</strong> from the demand-based recommendation of <strong>{gate.recommended} lbs</strong>.
              {gate.isHighOverride && (
                <span className="block mt-1 text-destructive font-medium">
                  ⚠️ HIGH OVERRIDE — This will be flagged for executive review.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="override-reason">Override Reason (min 20 characters) *</Label>
              <Textarea
                id="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why this override is necessary..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">{overrideReason.length}/20 characters minimum</p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="override-ack"
                checked={overrideAcknowledged}
                onCheckedChange={(checked) => setOverrideAcknowledged(checked === true)}
              />
              <label htmlFor="override-ack" className="text-sm cursor-pointer">
                I understand this overrides demand intelligence.
              </label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowOverrideModal(false); setOverrideReason(''); setOverrideAcknowledged(false); }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleOverrideConfirm}
              disabled={overrideReason.length < 20 || !overrideAcknowledged || createBatch.isPending}
            >
              Confirm Override & Create Batch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Detail Modal */}
      {selectedBatch && (
        <BatchDetailModal 
          batch={selectedBatch} 
          officeId={officeId}
          onClose={() => setSelectedBatch(null)} 
        />
      )}
    </>
  );
}

// ============================================================
// BATCH DETAIL MODAL WITH DEFECT GUARDRAILS
// ============================================================

interface BatchDetailModalProps {
  batch: ProductionBatch;
  officeId: string;
  onClose: () => void;
}

function BatchDetailModal({ batch, officeId, onClose }: BatchDetailModalProps) {
  const { data: outputs = [], isLoading } = useBatchOutputs(batch.id);
  const { data: workers = [] } = useProductionWorkers(officeId);
  const recordOutput = useRecordOutput();
  
  const [outputForm, setOutputForm] = useState({
    brand: 'gasmask' as const,
    boxes_completed: '',
    tubes_used: '',
    stickers_used: '',
    empty_boxes_used: '',
    defects_count: '',
    defect_category: '',
    defect_reason: '',
    worker_id: '',
    tube_fill_seconds: '',
    sticker_apply_seconds: '',
    notes: '',
  });

  const [showDefectWarning, setShowDefectWarning] = useState(false);

  const availableWorkers = workers.filter(w => 
    w.status === 'active' && 
    (batch.workers_present?.includes(w.id) || true)
  );

  const defectsEntered = parseInt(outputForm.defects_count) > 0;
  const categoryMissing = defectsEntered && !outputForm.defect_category;

  const handleRecordOutput = async () => {
    // Show warning if defects without category, but don't block
    if (categoryMissing) {
      setShowDefectWarning(true);
    }
    
    const stickersIssued = (batch.stickers_issued as Record<string, number>)?.[outputForm.brand] || 0;
    const boxesIssued = (batch.empty_boxes_issued as Record<string, number>)?.[outputForm.brand] || 0;
    
    await recordOutput.mutateAsync({
      batch_id: batch.id,
      brand: outputForm.brand,
      boxes_completed: parseInt(outputForm.boxes_completed) || 0,
      tubes_used: parseInt(outputForm.tubes_used) || 0,
      stickers_used: parseInt(outputForm.stickers_used) || 0,
      empty_boxes_used: parseInt(outputForm.empty_boxes_used) || 0,
      defects_count: parseInt(outputForm.defects_count) || 0,
      defect_category: outputForm.defect_category || null,
      defect_reason: outputForm.defect_reason || null,
      worker_id: outputForm.worker_id || null,
      tube_fill_seconds: parseFloat(outputForm.tube_fill_seconds) || null,
      sticker_apply_seconds: parseFloat(outputForm.sticker_apply_seconds) || null,
      notes: outputForm.notes || null,
      stickers_issued: stickersIssued,
      empty_boxes_issued: boxesIssued,
    });
    
    setOutputForm({
      brand: 'gasmask',
      boxes_completed: '',
      tubes_used: '',
      stickers_used: '',
      empty_boxes_used: '',
      defects_count: '',
      defect_category: '',
      defect_reason: '',
      worker_id: '',
      tube_fill_seconds: '',
      sticker_apply_seconds: '',
      notes: '',
    });
    setShowDefectWarning(false);
  };

  // Calculate totals from outputs
  const totalBoxes = outputs.reduce((sum, o) => sum + o.boxes_completed, 0);
  const totalTubes = outputs.reduce((sum, o) => sum + o.tubes_used, 0);
  const totalStickersUsed = outputs.reduce((sum, o) => sum + o.stickers_used, 0);
  const totalEmptyBoxesUsed = outputs.reduce((sum, o) => sum + o.empty_boxes_used, 0);
  const totalDefects = outputs.reduce((sum, o) => sum + o.defects_count, 0);

  // Calculate totals from issued materials
  const totalStickersIssued = Object.values((batch.stickers_issued as Record<string, number>) || {}).reduce((a, b) => a + b, 0);
  const totalEmptyBoxesIssued = Object.values((batch.empty_boxes_issued as Record<string, number>) || {}).reduce((a, b) => a + b, 0);

  const workerMap = new Map(workers.map(w => [w.id, w.full_name]));

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Batch Details
            <Badge className={cn(STATUS_CONFIG[batch.status || 'open'].color)}>
              {STATUS_CONFIG[batch.status || 'open'].label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Issued vs Used - Material Reconciliation */}
          <div className="grid grid-cols-2 gap-4">
            {/* Issued Column */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Issued to Office
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tobacco</span>
                  <span className="font-medium">{batch.tobacco_lbs ?? 0} lbs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tubes</span>
                  <span className="font-medium">{(batch.tubes_total || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stickers</span>
                  <span className="font-medium">{totalStickersIssued.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Empty Boxes</span>
                  <span className="font-medium">{totalEmptyBoxesIssued.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Used Column */}
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <h4 className="font-medium text-emerald-800 dark:text-emerald-200 mb-3 flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Used in Production
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Boxes Completed</span>
                  <span className="font-medium text-primary">{totalBoxes.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tubes Used</span>
                  <span className="font-medium">{totalTubes.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stickers Used</span>
                  <span className="font-medium">{totalStickersUsed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Empty Boxes Used</span>
                  <span className="font-medium">{totalEmptyBoxesUsed.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Variance Summary */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2 text-sm">Variance</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className={cn(
                  "text-lg font-bold",
                  (batch.tubes_total || 0) - totalTubes === 0 ? "text-emerald-600" : "text-amber-600"
                )}>
                  {((batch.tubes_total || 0) - totalTubes) >= 0 ? '+' : ''}{(batch.tubes_total || 0) - totalTubes}
                </p>
                <p className="text-xs text-muted-foreground">Tubes</p>
              </div>
              <div>
                <p className={cn(
                  "text-lg font-bold",
                  totalStickersIssued - totalStickersUsed === 0 ? "text-emerald-600" : "text-amber-600"
                )}>
                  {(totalStickersIssued - totalStickersUsed) >= 0 ? '+' : ''}{totalStickersIssued - totalStickersUsed}
                </p>
                <p className="text-xs text-muted-foreground">Stickers</p>
              </div>
              <div>
                <p className={cn(
                  "text-lg font-bold",
                  totalEmptyBoxesIssued - totalEmptyBoxesUsed === 0 ? "text-emerald-600" : "text-amber-600"
                )}>
                  {(totalEmptyBoxesIssued - totalEmptyBoxesUsed) >= 0 ? '+' : ''}{totalEmptyBoxesIssued - totalEmptyBoxesUsed}
                </p>
                <p className="text-xs text-muted-foreground">Empty Boxes</p>
              </div>
            </div>
          </div>

          {/* Defects Summary */}
          {totalDefects > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              <h4 className="font-medium text-red-800 dark:text-red-200 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Defects: {totalDefects}
              </h4>
              <div className="space-y-1">
                {outputs.filter(o => o.defects_count > 0).map(o => (
                  <div key={o.id} className="text-sm flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">{o.defects_count}</Badge>
                    {o.defect_category ? (
                      <Badge variant="outline" className="text-xs">{o.defect_category}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                        No Category
                      </Badge>
                    )}
                    <span className="text-muted-foreground">{o.brand}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recorded Outputs */}
          <div>
            <h4 className="font-medium mb-2">Recorded Outputs by Brand</h4>
            {outputs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outputs recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {outputs.map(output => {
                  const brandConfig = BRANDS.find(b => b.id === output.brand);
                  const workerName = output.worker_id ? workerMap.get(output.worker_id) : null;
                  return (
                    <div key={output.id} className="p-3 bg-muted/50 rounded border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={cn('w-2 h-2 rounded-full', brandConfig?.color)} />
                          <span className="font-medium">{brandConfig?.label}</span>
                          {workerName && (
                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {workerName}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-primary font-medium">{output.boxes_completed} boxes</span>
                          {output.defects_count > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {output.defects_count} defects
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                        <span>{output.tubes_used} tubes</span>
                        <span>{output.stickers_used} stickers</span>
                        <span>{output.empty_boxes_used} boxes</span>
                        {output.defect_category && (
                          <span className="text-destructive">{output.defect_category}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Record New Output */}
          {batch.status !== 'completed' && batch.status !== 'cancelled' && (
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Record Output</h4>
              
              {/* Defect Category Warning */}
              {showDefectWarning && (
                <Alert variant="default" className="mb-3 border-amber-200 bg-amber-50 dark:bg-amber-950/30">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    Recording defects without a category. For better analytics, select a defect category.
                  </AlertDescription>
                </Alert>
              )}

              {/* Worker Selection (Required for attribution) */}
              {availableWorkers.length > 0 && (
                <div className="mb-3">
                  <Label className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Worker (Required for tracking)
                  </Label>
                  <Select
                    value={outputForm.worker_id}
                    onValueChange={(value) => setOutputForm({ ...outputForm, worker_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select worker..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableWorkers.map(worker => (
                        <SelectItem key={worker.id} value={worker.id}>
                          {worker.full_name} ({worker.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Brand</Label>
                  <Select
                    value={outputForm.brand}
                    onValueChange={(value: any) => setOutputForm({ ...outputForm, brand: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BRANDS.map(brand => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Boxes Completed</Label>
                  <Input
                    type="number"
                    value={outputForm.boxes_completed}
                    onChange={(e) => setOutputForm({ ...outputForm, boxes_completed: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Tubes Used</Label>
                  <Input
                    type="number"
                    value={outputForm.tubes_used}
                    onChange={(e) => setOutputForm({ ...outputForm, tubes_used: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div>
                  <Label>Stickers Used</Label>
                  <Input
                    type="number"
                    value={outputForm.stickers_used}
                    onChange={(e) => setOutputForm({ ...outputForm, stickers_used: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Empty Boxes Used</Label>
                  <Input
                    type="number"
                    value={outputForm.empty_boxes_used}
                    onChange={(e) => setOutputForm({ ...outputForm, empty_boxes_used: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Defects</Label>
                  <Input
                    type="number"
                    value={outputForm.defects_count}
                    onChange={(e) => {
                      setOutputForm({ ...outputForm, defects_count: e.target.value });
                      setShowDefectWarning(false);
                    }}
                    placeholder="0"
                  />
                </div>
              </div>
              
              {/* Time & Motion (Optional) */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <Label>Avg Tube Fill (seconds)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={outputForm.tube_fill_seconds}
                    onChange={(e) => setOutputForm({ ...outputForm, tube_fill_seconds: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label>Avg Sticker Apply (seconds)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={outputForm.sticker_apply_seconds}
                    onChange={(e) => setOutputForm({ ...outputForm, sticker_apply_seconds: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>
              
              {/* Defect Details - REQUIRED when defects > 0 */}
              {defectsEntered && (
                <div className={cn(
                  "grid grid-cols-2 gap-3 mt-3 p-3 rounded-lg border",
                  categoryMissing 
                    ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30" 
                    : "border-muted"
                )}>
                  <div>
                    <Label className="flex items-center gap-1">
                      Defect Category
                      {categoryMissing && (
                        <AlertTriangle className="h-3 w-3 text-amber-600" />
                      )}
                    </Label>
                    <Select
                      value={outputForm.defect_category}
                      onValueChange={(value) => {
                        setOutputForm({ ...outputForm, defect_category: value });
                        setShowDefectWarning(false);
                      }}
                    >
                      <SelectTrigger className={categoryMissing ? "border-amber-400" : ""}>
                        <SelectValue placeholder="Select category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {DEFECT_CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {categoryMissing && (
                      <p className="text-xs text-amber-600 mt-1">
                        Recommended for defect analytics
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Defect Notes</Label>
                    <Input
                      value={outputForm.defect_reason}
                      onChange={(e) => setOutputForm({ ...outputForm, defect_reason: e.target.value })}
                      placeholder="Additional details..."
                    />
                  </div>
                </div>
              )}
              
              <Button 
                className="mt-3" 
                onClick={handleRecordOutput}
                disabled={!outputForm.boxes_completed || recordOutput.isPending}
              >
                Record Output
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
