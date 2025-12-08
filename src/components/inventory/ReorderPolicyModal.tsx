import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ReorderPolicyModalProps {
  open: boolean;
  onClose: () => void;
  policyId?: string;
}

export function ReorderPolicyModal({ open, onClose, policyId }: ReorderPolicyModalProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [productId, setProductId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("all");
  const [minReorderQty, setMinReorderQty] = useState<string>("");
  const [maxReorderQty, setMaxReorderQty] = useState<string>("");
  const [reorderMultiple, setReorderMultiple] = useState<string>("");
  const [daysOfCover, setDaysOfCover] = useState<string>("");
  const [useAutoCalculation, setUseAutoCalculation] = useState(false);

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, sku')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  // Fetch warehouses
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const { data } = await supabase
        .from('warehouses')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  const resetForm = () => {
    setProductId("");
    setWarehouseId("all");
    setMinReorderQty("");
    setMaxReorderQty("");
    setReorderMultiple("");
    setDaysOfCover("");
    setUseAutoCalculation(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!productId) {
      toast.error("Please select a product");
      return;
    }

    setIsSubmitting(true);
    try {
      const policyData = {
        product_id: productId,
        warehouse_id: warehouseId === "all" ? null : warehouseId,
        min_reorder_qty: minReorderQty ? parseInt(minReorderQty) : null,
        max_reorder_qty: maxReorderQty ? parseInt(maxReorderQty) : null,
        reorder_multiple: reorderMultiple ? parseInt(reorderMultiple) : null,
        days_of_cover: daysOfCover ? parseInt(daysOfCover) : null,
        use_auto_calculation: useAutoCalculation,
      };

      const { error } = await supabase
        .from('reorder_policies')
        .insert(policyData);

      if (error) throw error;

      toast.success("Reorder policy created");
      queryClient.invalidateQueries({ queryKey: ['reorder-policies'] });
      handleClose();
    } catch (error) {
      console.error('Error creating policy:', error);
      toast.error("Failed to create policy");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Reorder Policy</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product">Product *</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products?.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.sku ? `(${p.sku})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="warehouse">Warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger>
                <SelectValue placeholder="All warehouses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Warehouses</SelectItem>
                {warehouses?.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min-qty">Min Reorder Qty</Label>
              <Input
                id="min-qty"
                type="number"
                min="0"
                value={minReorderQty}
                onChange={(e) => setMinReorderQty(e.target.value)}
                placeholder="e.g. 10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-qty">Max Reorder Qty</Label>
              <Input
                id="max-qty"
                type="number"
                min="0"
                value={maxReorderQty}
                onChange={(e) => setMaxReorderQty(e.target.value)}
                placeholder="e.g. 100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="multiple">Reorder Multiple</Label>
              <Input
                id="multiple"
                type="number"
                min="1"
                value={reorderMultiple}
                onChange={(e) => setReorderMultiple(e.target.value)}
                placeholder="e.g. 12 (case size)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="days">Days of Cover</Label>
              <Input
                id="days"
                type="number"
                min="1"
                value={daysOfCover}
                onChange={(e) => setDaysOfCover(e.target.value)}
                placeholder="e.g. 30"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="auto-calc">Use Auto Calculation (future AI)</Label>
            <Switch
              id="auto-calc"
              checked={useAutoCalculation}
              onCheckedChange={setUseAutoCalculation}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Policy"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
