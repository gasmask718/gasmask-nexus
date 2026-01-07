/**
 * KPIEditModal - Modal for editing custom KPI values
 */
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, RotateCcw, Save } from 'lucide-react';

interface KPIConfig {
  key: string;
  label: string;
  icon: string;
  entityType?: string;
  aggregation: 'count' | 'sum' | 'avg';
  field?: string;
  filter?: Record<string, any>;
  variant: string;
  clickable: boolean;
  detailsRoute?: string;
}

interface KPIEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  kpi: KPIConfig;
  businessId: string;
  calculatedValue: number;
  onSave?: () => void;
}

export function KPIEditModal({ 
  isOpen, 
  onClose, 
  kpi, 
  businessId, 
  calculatedValue,
  onSave 
}: KPIEditModalProps) {
  const [customValue, setCustomValue] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasCustomValue, setHasCustomValue] = useState(false);

  // Fetch existing override on open
  useEffect(() => {
    if (isOpen && businessId && kpi) {
      fetchOverride();
    }
  }, [isOpen, businessId, kpi?.key]);

  const fetchOverride = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('brand_kpi_overrides')
        .select('*')
        .eq('business_id', businessId)
        .eq('kpi_key', kpi.key)
        .single();

      if (data && !error) {
        setCustomValue(data.custom_value?.toString() || '');
        setNotes(data.notes || '');
        setHasCustomValue(true);
      } else {
        setCustomValue('');
        setNotes('');
        setHasCustomValue(false);
      }
    } catch {
      // No override exists
      setCustomValue('');
      setNotes('');
      setHasCustomValue(false);
    }
  };

  const handleSave = async () => {
    if (!customValue.trim()) {
      toast.error('Please enter a value');
      return;
    }

    setIsSaving(true);
    try {
      const numericValue = parseFloat(customValue);
      if (isNaN(numericValue)) {
        toast.error('Please enter a valid number');
        setIsSaving(false);
        return;
      }

      const { error } = await (supabase as any)
        .from('brand_kpi_overrides')
        .upsert({
          business_id: businessId,
          kpi_key: kpi.key,
          custom_value: numericValue,
          notes: notes.trim() || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'business_id,kpi_key' });

      if (error) throw error;

      toast.success(`${kpi.label} updated successfully!`);
      onSave?.();
      onClose();
    } catch (error: any) {
      console.error('Error saving KPI override:', error);
      toast.error('Failed to save KPI override');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToCalculated = async () => {
    setIsSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('brand_kpi_overrides')
        .delete()
        .eq('business_id', businessId)
        .eq('kpi_key', kpi.key);

      if (error) throw error;

      setCustomValue('');
      setNotes('');
      setHasCustomValue(false);
      toast.success('Reset to calculated value');
      onSave?.();
      onClose();
    } catch (error: any) {
      console.error('Error resetting KPI:', error);
      toast.error('Failed to reset KPI');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {kpi?.label || 'KPI'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">Calculated Value</span>
            <span className="font-semibold">{calculatedValue}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customValue">Custom Value</Label>
            <Input
              id="customValue"
              type="number"
              placeholder="Enter custom value"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Override the calculated value with a custom number
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add notes about this override..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {hasCustomValue && (
            <Button 
              variant="outline" 
              onClick={handleResetToCalculated}
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Calculated
            </Button>
          )}
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="ghost" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
