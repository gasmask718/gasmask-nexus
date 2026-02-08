/**
 * LEAD TIME CONFIGURATION
 * 
 * Manages supplier lead times per material type.
 * Used by the AI prediction engine to calculate reorder dates.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import {
  useSupplierLeadTimes,
  useCreateLeadTime,
  useUpdateLeadTime,
  useDeleteLeadTime,
  type SupplierLeadTimeInsert,
} from '@/hooks/useSupplyPredictions';
import { MATERIAL_TYPES } from '@/hooks/useRawMaterials';
import { Plus, Truck, Clock, Trash2, Edit, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  officeId: string;
}

const defaultForm: Partial<SupplierLeadTimeInsert> = {
  material_type: '',
  supplier_name: '',
  lead_time_days: 3,
  min_order_quantity: undefined,
  cost_per_unit: undefined,
  reliability_score: 80,
  notes: '',
};

export function LeadTimeConfig({ officeId }: Props) {
  const { data: leadTimes = [], isLoading } = useSupplierLeadTimes(officeId);
  const createLeadTime = useCreateLeadTime();
  const updateLeadTime = useUpdateLeadTime();
  const deleteLeadTime = useDeleteLeadTime();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<SupplierLeadTimeInsert>>(defaultForm);

  const resetForm = () => {
    setForm(defaultForm);
    setEditingId(null);
  };

  const handleEdit = (lt: typeof leadTimes[0]) => {
    setForm({
      material_type: lt.material_type,
      supplier_name: lt.supplier_name || '',
      lead_time_days: lt.lead_time_days,
      min_order_quantity: lt.min_order_quantity ?? undefined,
      cost_per_unit: lt.cost_per_unit ?? undefined,
      reliability_score: lt.reliability_score ?? 80,
      notes: lt.notes || '',
    });
    setEditingId(lt.id);
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!form.material_type) return;

    if (editingId) {
      await updateLeadTime.mutateAsync({
        id: editingId,
        officeId,
        ...form as SupplierLeadTimeInsert,
      });
    } else {
      await createLeadTime.mutateAsync({
        ...form as SupplierLeadTimeInsert,
        office_id: officeId,
      });
    }

    resetForm();
    setIsOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteLeadTime.mutateAsync({ id, officeId });
  };

  const reliabilityColor = (score: number | null) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 90) return 'text-emerald-600';
    if (score >= 70) return 'text-amber-600';
    return 'text-destructive';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Supplier Lead Times
            </CardTitle>
            <CardDescription>
              Configure delivery times per material to improve forecast accuracy
            </CardDescription>
          </div>
          <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? 'Edit Supplier Lead Time' : 'Add Supplier Lead Time'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Material Type</Label>
                  <Select
                    value={form.material_type}
                    onValueChange={(v) => setForm((f) => ({ ...f, material_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select material..." />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIAL_TYPES.map((mt) => (
                        <SelectItem key={mt.value} value={mt.value}>
                          {mt.icon} {mt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Supplier Name</Label>
                  <Input
                    value={form.supplier_name || ''}
                    onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))}
                    placeholder="e.g., Acme Tobacco Co."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Lead Time (days)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.lead_time_days || ''}
                      onChange={(e) => setForm((f) => ({ ...f, lead_time_days: parseInt(e.target.value) || 3 }))}
                    />
                  </div>
                  <div>
                    <Label>Reliability Score (0-100)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={form.reliability_score || ''}
                      onChange={(e) => setForm((f) => ({ ...f, reliability_score: parseInt(e.target.value) || 80 }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Min Order Qty</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.min_order_quantity || ''}
                      onChange={(e) => setForm((f) => ({ ...f, min_order_quantity: parseFloat(e.target.value) || undefined }))}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <Label>Cost Per Unit ($)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.cost_per_unit || ''}
                      onChange={(e) => setForm((f) => ({ ...f, cost_per_unit: parseFloat(e.target.value) || undefined }))}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div>
                  <Label>Notes</Label>
                  <Input
                    value={form.notes || ''}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Any delivery notes..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!form.material_type || createLeadTime.isPending || updateLeadTime.isPending}
                >
                  {editingId ? 'Update' : 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
        ) : leadTimes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Truck className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No supplier lead times configured</p>
            <p className="text-xs mt-1">Add suppliers to improve prediction accuracy</p>
          </div>
        ) : (
          <div className="space-y-2">
            {leadTimes.map((lt) => {
              const matConfig = MATERIAL_TYPES.find((m) => m.value === lt.material_type);
              return (
                <div
                  key={lt.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{matConfig?.icon || '📦'}</span>
                    <div>
                      <p className="font-medium text-sm capitalize">{lt.material_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {lt.supplier_name || 'No supplier name'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3" />
                      <span className="font-mono">{lt.lead_time_days}d</span>
                    </div>
                    <div className={cn('flex items-center gap-1 text-xs', reliabilityColor(lt.reliability_score))}>
                      <Star className="h-3 w-3" />
                      <span>{lt.reliability_score || 0}%</span>
                    </div>
                    {lt.cost_per_unit && (
                      <Badge variant="outline" className="text-xs">
                        ${Number(lt.cost_per_unit).toFixed(2)}/unit
                      </Badge>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(lt)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete(lt.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
