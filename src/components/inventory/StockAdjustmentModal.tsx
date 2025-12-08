// ═══════════════════════════════════════════════════════════════════════════════
// STOCK ADJUSTMENT MODAL — Manual inventory adjustments
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProducts } from '@/services/inventory';
import { useWarehouses } from '@/services/warehouse';
import { applyInventoryMovement } from '@/lib/inventory/applyInventoryMovement';

interface StockAdjustmentModalProps {
  open: boolean;
  onClose: () => void;
}

export default function StockAdjustmentModal({ open, onClose }: StockAdjustmentModalProps) {
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  const { data: products, isLoading: loadingProducts } = useProducts();
  const { data: warehouses, isLoading: loadingWarehouses } = useWarehouses();

  const adjustmentMutation = useMutation({
    mutationFn: async () => {
      const qty = parseInt(quantity);
      if (!productId || !warehouseId || isNaN(qty) || qty <= 0) {
        throw new Error('Please fill in all required fields');
      }

      const quantityChange = adjustmentType === 'increase' ? qty : -qty;

      const result = await applyInventoryMovement({
        product_id: productId,
        warehouse_id: warehouseId,
        quantity_change: quantityChange,
        movement_type: 'ADJUSTMENT',
        reason: reason || `Manual ${adjustmentType}`,
        reference_type: 'manual',
        reference_id: null,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to apply adjustment');
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements-page'] });
      
      toast.success(
        `Stock adjusted: ${result.before_on_hand} → ${result.after_on_hand} units`
      );
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleClose = () => {
    setProductId('');
    setWarehouseId('');
    setAdjustmentType('increase');
    setQuantity('');
    setReason('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    adjustmentMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Stock Adjustment</DialogTitle>
          <DialogDescription>
            Manually adjust inventory levels for a product at a specific warehouse.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Product *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product..." />
                </SelectTrigger>
                <SelectContent>
                  {loadingProducts ? (
                    <div className="p-2 text-center text-muted-foreground">Loading...</div>
                  ) : (
                    products?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.sku ? `(${p.sku})` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Warehouse *</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse..." />
                </SelectTrigger>
                <SelectContent>
                  {loadingWarehouses ? (
                    <div className="p-2 text-center text-muted-foreground">Loading...</div>
                  ) : (
                    warehouses?.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} {w.code ? `(${w.code})` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Adjustment Type *</Label>
              <RadioGroup
                value={adjustmentType}
                onValueChange={(v) => setAdjustmentType(v as 'increase' | 'decrease')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="increase" id="increase" />
                  <Label htmlFor="increase" className="cursor-pointer">
                    Increase Stock
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="decrease" id="decrease" />
                  <Label htmlFor="decrease" className="cursor-pointer">
                    Decrease Stock
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Quantity *</Label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity..."
              />
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Initial stock load, Damage, Count correction..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={adjustmentMutation.isPending}>
              {adjustmentMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Apply Adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
