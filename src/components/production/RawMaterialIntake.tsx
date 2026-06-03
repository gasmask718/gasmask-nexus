/**
 * RAW MATERIAL INTAKE FORM
 * Records inbound material receipts with supplier and cost data.
 */

import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { BilingualLabel } from '@/components/portal/BilingualLabel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Package, DollarSign } from 'lucide-react';
import { useRawMaterials, useRawMaterialLevels, useCreateRawMaterial, useDeleteRawMaterial, MATERIAL_TYPES } from '@/hooks/useRawMaterials';
import { format } from 'date-fns';

interface RawMaterialIntakeProps {
  officeId: string;
}

export function RawMaterialIntake({ officeId }: RawMaterialIntakeProps) {
  const { t } = useTranslation();
  const { data: materials = [], isLoading } = useRawMaterials(officeId);
  const { data: levels = [] } = useRawMaterialLevels(officeId);
  const createMaterial = useCreateRawMaterial();
  const deleteMaterial = useDeleteRawMaterial();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    material_type: '',
    quantity: '',
    unit: 'lbs',
    cost_per_unit: '',
    supplier_name: '',
    batch_number: '',
    notes: '',
  });

  const handleSubmit = async () => {
    if (!form.material_type || !form.quantity) return;

    const qty = parseFloat(form.quantity);
    const cpu = parseFloat(form.cost_per_unit) || 0;

    await createMaterial.mutateAsync({
      office_id: officeId,
      material_type: form.material_type,
      quantity: qty,
      unit: form.unit,
      cost_per_unit: cpu,
      total_cost: qty * cpu,
      supplier_name: form.supplier_name || null,
      supplier_id: null,
      received_by: null,
      received_at: new Date().toISOString(),
      batch_number: form.batch_number || null,
      expiry_date: null,
      notes: form.notes || null,
    });

    setForm({
      material_type: '',
      quantity: '',
      unit: 'lbs',
      cost_per_unit: '',
      supplier_name: '',
      batch_number: '',
      notes: '',
    });
    setShowForm(false);
  };

  const selectedType = MATERIAL_TYPES.find(t => t.value === form.material_type);

  return (
    <div className="space-y-4">
      {/* Material Level Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {MATERIAL_TYPES.map(type => {
          const level = levels.find(l => l.material_type === type.value);
          return (
            <Card key={type.value} className="text-center">
              <CardContent className="p-3">
                <div className="text-2xl mb-1">{type.icon}</div>
                <p className="text-xs text-muted-foreground">{type.label}</p>
                <p className="text-lg font-bold">
                  {level ? level.total_qty.toLocaleString() : '0'}
                </p>
                <p className="text-xs text-muted-foreground">{level?.unit || type.unit}</p>
                {level && level.total_cost > 0 && (
                  <p className="text-xs text-emerald-600 mt-1">
                    ${level.total_cost.toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Intake Form Toggle */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Raw Material Intake
              </CardTitle>
              <CardDescription>
                <BilingualLabel tKey="production.raw_material_intake_desc" en="Record incoming materials from suppliers" />
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setShowForm(!showForm)}
              variant={showForm ? 'outline' : 'default'}
            >
              <Plus className="h-4 w-4 mr-1" />
              {showForm ? <BilingualLabel tKey="production.cancel" en="Cancel" inline /> : <BilingualLabel tKey="production.record_receipt" en="Record Receipt" inline />}
            </Button>
          </div>
        </CardHeader>

        {showForm && (
          <CardContent className="space-y-4 border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label><BilingualLabel tKey="production.material_type_req" en="Material Type *" /></Label>
                <Select
                  value={form.material_type}
                  onValueChange={(val) => {
                    const mt = MATERIAL_TYPES.find(t => t.value === val);
                    setForm(f => ({ ...f, material_type: val, unit: mt?.unit || 'units' }));
                  }}
                >
                  <SelectTrigger><SelectValue placeholder={t("production.select_type")} /></SelectTrigger>
                  <SelectContent>
                    {MATERIAL_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.icon} {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label><BilingualLabel tKey="production.quantity_req" en="Quantity *" /> ({selectedType?.unit || form.unit})</Label>
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  placeholder="0"
                />
              </div>

              <div>
                <Label className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  <BilingualLabel tKey="production.cost_per_unit" en="Cost per" /> {selectedType?.unit || 'unit'}
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.cost_per_unit}
                  onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label><BilingualLabel tKey="production.supplier_name" en="Supplier Name" /></Label>
                <Input
                  value={form.supplier_name}
                  onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))}
                  placeholder={t("production.supplier_name_placeholder")}
                />
              </div>
              <div>
                <Label><BilingualLabel tKey="production.supplier_batch_lot" en="Supplier Batch/Lot #" /></Label>
                <Input
                  value={form.batch_number}
                  onChange={e => setForm(f => ({ ...f, batch_number: e.target.value }))}
                  placeholder="LOT-001"
                />
              </div>
            </div>

            <div>
              <Label><BilingualLabel tKey="production.notes" en="Notes" /></Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder={t("production.additional_details_placeholder")}
                className="whitespace-pre-wrap"
              />
            </div>

            {form.quantity && form.cost_per_unit && (
              <div className="p-3 bg-muted/50 rounded-md text-sm">
                <strong><BilingualLabel tKey="production.total_cost" en="Total Cost" inline />:</strong> $
                {(parseFloat(form.quantity) * parseFloat(form.cost_per_unit)).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!form.material_type || !form.quantity || createMaterial.isPending}
            >
              {createMaterial.isPending ? t("production.recording") : t("production.record_material_receipt")}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Recent Receipts Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base"><BilingualLabel tKey="production.recent_receipts" en="Recent Receipts" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("production.loading")}</p>
          ) : materials.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("production.no_materials_recorded")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium"><BilingualLabel tKey="production.type" en="Type" /></th>
                    <th className="pb-2 font-medium"><BilingualLabel tKey="production.qty" en="Qty" /></th>
                    <th className="pb-2 font-medium"><BilingualLabel tKey="production.cost" en="Cost" /></th>
                    <th className="pb-2 font-medium"><BilingualLabel tKey="production.supplier" en="Supplier" /></th>
                    <th className="pb-2 font-medium"><BilingualLabel tKey="production.received" en="Received" /></th>
                    <th className="pb-2 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {materials.slice(0, 20).map(m => {
                    const typeConfig = MATERIAL_TYPES.find(t => t.value === m.material_type);
                    return (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="py-2">
                          <Badge variant="outline" className="text-xs">
                            {typeConfig?.icon} {typeConfig?.label || m.material_type}
                          </Badge>
                        </td>
                        <td className="py-2 font-mono">
                          {Number(m.quantity).toLocaleString()} {m.unit}
                        </td>
                        <td className="py-2 font-mono">
                          {m.total_cost ? `$${Number(m.total_cost).toLocaleString()}` : '—'}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {m.supplier_name || '—'}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {format(new Date(m.received_at), 'MMM d, yyyy, h:mm a')}
                        </td>
                        <td className="py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => deleteMaterial.mutate({ id: m.id, officeId })}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
