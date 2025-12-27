import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Package, DollarSign, MessageSquare, Camera, Loader2, CheckCircle } from 'lucide-react';
import { VisitProductSelector, type SelectedProduct } from './visit/VisitProductSelector';
import { useCreateVisitProducts, useUpdateStoreTubeInventory, GRABBA_COMPANIES } from '@/hooks/useVisitProducts';
import { useQueryClient } from '@tanstack/react-query';

interface VisitLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  onSuccess?: () => void;
}

const VisitLogModal = ({ open, onOpenChange, storeId, storeName, onSuccess }: VisitLogModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [visitType, setVisitType] = useState<string>('delivery');
  const [cashCollected, setCashCollected] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [customerResponse, setCustomerResponse] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);

  const createVisitProducts = useCreateVisitProducts();
  const updateTubeInventory = useUpdateStoreTubeInventory();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // 1. Create visit log
      const productsDeliveredJson = selectedProducts.length > 0 
        ? selectedProducts.map(p => ({
            brand_id: p.brand_id,
            brand_name: p.brand_name,
            product_id: p.product_id,
            product_name: p.product_name,
            quantity: p.quantity,
            unit_type: p.unit_type,
          }))
        : null;

      const { data: visitData, error: visitError } = await supabase
        .from('visit_logs')
        .insert([{
          store_id: storeId,
          user_id: user.id,
          visit_type: visitType as any,
          cash_collected: cashCollected ? parseFloat(cashCollected) : null,
          payment_method: paymentMethod as any || null,
          customer_response: customerResponse || null,
          products_delivered: productsDeliveredJson as any,
        }])
        .select()
        .single();

      if (visitError) throw visitError;

      // 2. If products were given, save to visit_products table
      if (selectedProducts.length > 0 && visitData) {
        const visitProductsData = selectedProducts.map(p => ({
          visit_id: visitData.id,
          store_id: storeId,
          brand_id: p.brand_id,
          product_id: p.product_id,
          quantity: p.quantity,
          unit_type: p.unit_type,
        }));

        await createVisitProducts.mutateAsync(visitProductsData);

        // 3. Update store tube inventory
        // Aggregate by brand name (for store_tube_inventory which uses brand name)
        const brandQuantities = new Map<string, number>();
        for (const product of selectedProducts) {
          const current = brandQuantities.get(product.brand_name) || 0;
          brandQuantities.set(product.brand_name, current + product.quantity);
        }

        const brandUpdates = Array.from(brandQuantities.entries()).map(([brand, quantity]) => ({
          brand: brand.toLowerCase().replace(/\s+/g, ''),
          quantity,
        }));

        await updateTubeInventory.mutateAsync({
          storeId,
          brandUpdates,
        });
      }

      // 4. Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['visit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['store-interactions', storeId] });

      toast.success('Visit logged successfully!', {
        description: selectedProducts.length > 0 
          ? `${selectedProducts.length} product(s) added to inventory` 
          : undefined,
      });
      
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    } catch (error) {
      console.error('Error logging visit:', error);
      toast.error('Failed to log visit');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setVisitType('delivery');
    setCashCollected('');
    setPaymentMethod('');
    setCustomerResponse('');
    setSelectedProducts([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-card border-border/50">
        <DialogHeader>
          <DialogTitle className="text-2xl">Log Visit</DialogTitle>
          <DialogDescription>
            Record your visit to <span className="font-semibold text-foreground">{storeName}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Visit Type */}
          <div className="space-y-2">
            <Label htmlFor="visitType">Visit Type</Label>
            <Select value={visitType} onValueChange={setVisitType}>
              <SelectTrigger className="bg-secondary/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delivery">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Delivery
                  </div>
                </SelectItem>
                <SelectItem value="inventoryCheck">Inventory Check</SelectItem>
                <SelectItem value="coldLead">Cold Lead</SelectItem>
                <SelectItem value="followUp">Follow Up</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment Section */}
          {visitType === 'delivery' && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Payment Details</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cashCollected">Cash Collected ($)</Label>
                    <Input
                      id="cashCollected"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={cashCollected}
                      onChange={(e) => setCashCollected(e.target.value)}
                      className="bg-secondary/50 border-border/50"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="bg-secondary/50 border-border/50">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="zelle">Zelle</SelectItem>
                        <SelectItem value="cashapp">Cash App</SelectItem>
                        <SelectItem value="venmo">Venmo</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Products Given Section - NEW */}
          {(visitType === 'delivery' || visitType === 'inventoryCheck') && (
            <>
              <Separator />
              <VisitProductSelector
                selectedProducts={selectedProducts}
                onChange={setSelectedProducts}
              />
            </>
          )}

          {/* Customer Response */}
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <Label htmlFor="customerResponse">Customer Response / Notes</Label>
            </div>
            <Textarea
              id="customerResponse"
              placeholder="What did the customer say? Any special requests or concerns?"
              value={customerResponse}
              onChange={(e) => setCustomerResponse(e.target.value)}
              className="bg-secondary/50 border-border/50 min-h-24"
            />
          </div>

          {/* Photo Upload Placeholder */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              <Label>Photos</Label>
              <Badge variant="outline" className="ml-auto">Coming Soon</Badge>
            </div>
            <div className="border-2 border-dashed border-border/50 rounded-lg p-8 text-center">
              <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Photo upload coming soon</p>
            </div>
          </div>

          {/* Summary Before Submit */}
          {selectedProducts.length > 0 && (
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Visit Summary</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• {selectedProducts.length} product(s) will be delivered</li>
                <li>• Store inventory will be updated automatically</li>
                <li>• Products will be available in Create Invoice</li>
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-primary hover:bg-primary-hover"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Log Visit'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default VisitLogModal;
