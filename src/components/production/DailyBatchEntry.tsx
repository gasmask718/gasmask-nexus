/**
 * DAILY BATCH ENTRY COMPONENT
 * 
 * Create and manage production batches.
 * Track inputs (tobacco, tubes, stickers) and outputs (boxes by brand).
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
import { Checkbox } from '@/components/ui/checkbox';
import { 
  useTodayBatches, 
  useCreateBatch, 
  useUpdateBatch,
  useBatchOutputs,
  useRecordOutput,
  useProductionWorkers,
  ProductionBatch 
} from '@/hooks/useProductionPortal';
import { Boxes, Plus, Play, CheckCircle, XCircle, ChevronRight, Scale, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface DailyBatchEntryProps {
  officeId: string;
}

const BRANDS = [
  { id: 'gasmask', label: 'Gasmask', color: 'bg-emerald-500' },
  { id: 'hotmama', label: 'HotMama', color: 'bg-pink-500' },
  { id: 'hotscolati', label: 'HotScolati', color: 'bg-amber-500' },
  { id: 'grabba-rus', label: 'GrabbaRus', color: 'bg-purple-500' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-800', icon: <Package className="h-4 w-4" /> },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-800', icon: <Play className="h-4 w-4" /> },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle className="h-4 w-4" /> },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: <XCircle className="h-4 w-4" /> },
};

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
    workers_present: [] as string[],
    notes: '',
  });

  const handleCreateBatch = async () => {
    await createBatch.mutateAsync({
      office_id: officeId,
      brand: formData.brand,
      shift_label: formData.shift_label,
      tobacco_lbs: parseFloat(formData.tobacco_lbs) || 0,
      tubes_total: parseInt(formData.tubes_total) || 0,
      workers_present: formData.workers_present,
      notes: formData.notes,
      status: 'open',
    });
    setIsCreateModalOpen(false);
    setFormData({
      brand: 'gasmask',
      shift_label: 'Morning',
      tobacco_lbs: '',
      tubes_total: '',
      workers_present: [],
      notes: '',
    });
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
                const statusConfig = STATUS_CONFIG[batch.status];
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
                            <Badge className={cn('text-xs', statusConfig.color)}>
                              {statusConfig.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Scale className="h-3 w-3" />
                              {batch.tobacco_lbs} lbs
                            </span>
                            <span>{batch.tubes_total?.toLocaleString() || 0} tubes</span>
                            <span>{batch.boxes_produced || 0} boxes</span>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Batch</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tobacco">Tobacco (lbs)</Label>
                <Input
                  id="tobacco"
                  type="number"
                  step="0.1"
                  value={formData.tobacco_lbs}
                  onChange={(e) => setFormData({ ...formData, tobacco_lbs: e.target.value })}
                  placeholder="0.0"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tubes">Tubes (qty)</Label>
                <Input
                  id="tubes"
                  type="number"
                  value={formData.tubes_total}
                  onChange={(e) => setFormData({ ...formData, tubes_total: e.target.value })}
                  placeholder="0"
                />
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

      {/* Batch Detail Modal */}
      {selectedBatch && (
        <BatchDetailModal 
          batch={selectedBatch} 
          onClose={() => setSelectedBatch(null)} 
        />
      )}
    </>
  );
}

// ============================================================
// BATCH DETAIL MODAL
// ============================================================

interface BatchDetailModalProps {
  batch: ProductionBatch;
  onClose: () => void;
}

function BatchDetailModal({ batch, onClose }: BatchDetailModalProps) {
  const { data: outputs = [], isLoading } = useBatchOutputs(batch.id);
  const recordOutput = useRecordOutput();
  
  const [outputForm, setOutputForm] = useState({
    brand: 'gasmask' as const,
    boxes_completed: '',
    tubes_used: '',
    stickers_used: '',
    empty_boxes_used: '',
    defects_count: '',
    notes: '',
  });

  const handleRecordOutput = async () => {
    await recordOutput.mutateAsync({
      batch_id: batch.id,
      brand: outputForm.brand,
      boxes_completed: parseInt(outputForm.boxes_completed) || 0,
      tubes_used: parseInt(outputForm.tubes_used) || 0,
      stickers_used: parseInt(outputForm.stickers_used) || 0,
      empty_boxes_used: parseInt(outputForm.empty_boxes_used) || 0,
      defects_count: parseInt(outputForm.defects_count) || 0,
      notes: outputForm.notes || null,
    });
    
    setOutputForm({
      brand: 'gasmask',
      boxes_completed: '',
      tubes_used: '',
      stickers_used: '',
      empty_boxes_used: '',
      defects_count: '',
      notes: '',
    });
  };

  const totalBoxes = outputs.reduce((sum, o) => sum + o.boxes_completed, 0);
  const totalTubes = outputs.reduce((sum, o) => sum + o.tubes_used, 0);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Batch Details
            <Badge className={cn(STATUS_CONFIG[batch.status].color)}>
              {STATUS_CONFIG[batch.status].label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Batch Summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{batch.tobacco_lbs}</p>
              <p className="text-xs text-muted-foreground">lbs tobacco</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{batch.tubes_total?.toLocaleString() || 0}</p>
              <p className="text-xs text-muted-foreground">tubes input</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-primary">{totalBoxes.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">boxes output</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{batch.efficiency_pct || '—'}%</p>
              <p className="text-xs text-muted-foreground">efficiency</p>
            </div>
          </div>

          {/* Recorded Outputs */}
          <div>
            <h4 className="font-medium mb-2">Recorded Outputs</h4>
            {outputs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outputs recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {outputs.map(output => {
                  const brandConfig = BRANDS.find(b => b.id === output.brand);
                  return (
                    <div key={output.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full', brandConfig?.color)} />
                        <span className="font-medium">{brandConfig?.label}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span>{output.boxes_completed} boxes</span>
                        <span>{output.tubes_used} tubes</span>
                        {output.defects_count > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {output.defects_count} defects
                          </Badge>
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
                    onChange={(e) => setOutputForm({ ...outputForm, defects_count: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
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
