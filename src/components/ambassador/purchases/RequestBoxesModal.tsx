/**
 * RequestBoxesModal — ambassador asks for boxes of a product.
 * Creates a pending ambassador_box_requests row for admin review.
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Package } from 'lucide-react';
import { useCreateBoxRequest } from '@/hooks/useAmbassadorBoxRequests';

interface RequestBoxesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequestBoxesModal({ open, onOpenChange }: RequestBoxesModalProps) {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  const createRequest = useCreateBoxRequest();

  useEffect(() => {
    if (open) {
      setProductId('');
      setQuantity(1);
      setNote('');
    }
  }, [open]);

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products-for-box-request'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, wholesale_price, store_price')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const selected = products.find(p => p.id === productId);
  const unitPrice = Number(selected?.wholesale_price ?? selected?.store_price ?? 0);

  const handleSubmit = async () => {
    if (!selected) return;
    await createRequest.mutateAsync({
      product_id: selected.id,
      product_name: selected.name,
      quantity,
      note: note.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Request Boxes
          </DialogTitle>
          <DialogDescription>
            Ask for stock. An admin reviews every request before anything is released.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder={productsLoading ? 'Loading products…' : 'Select a product'} />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.wholesale_price != null && (
                      <span className="text-muted-foreground"> — ${Number(p.wholesale_price).toFixed(2)}/box</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quantity (boxes)</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={e => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
            {selected && unitPrice > 0 && (
              <p className="text-xs text-muted-foreground">
                Estimated value: ${(unitPrice * quantity).toFixed(2)} ({quantity} × ${unitPrice.toFixed(2)})
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Anything the admin should know — timing, stores waiting, etc."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!selected || createRequest.isPending}>
            {createRequest.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RequestBoxesModal;
