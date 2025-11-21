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
import { Package, DollarSign, MessageSquare, Camera, Loader2 } from 'lucide-react';

interface VisitLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  onSuccess?: () => void;
}

const VisitLogModal = ({ open, onOpenChange, storeId, storeName, onSuccess }: VisitLogModalProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [visitType, setVisitType] = useState<string>('delivery');
  const [cashCollected, setCashCollected] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [customerResponse, setCustomerResponse] = useState('');
  const [inventoryLevels, setInventoryLevels] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('visit_logs').insert([{
        store_id: storeId,
        user_id: user.id,
        visit_type: visitType as any,
        cash_collected: cashCollected ? parseFloat(cashCollected) : null,
        payment_method: paymentMethod as any || null,
        customer_response: customerResponse || null,
        inventory_levels: Object.keys(inventoryLevels).length > 0 ? inventoryLevels as any : null,
      }]);

      if (error) throw error;

      toast.success('Visit logged successfully!');
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
    setInventoryLevels({});
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

          {/* Inventory Section */}
          {(visitType === 'inventoryCheck' || visitType === 'delivery') && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Inventory Levels</h3>
                  <Badge variant="outline" className="ml-auto">Optional</Badge>
                </div>
                
                <div className="grid gap-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="text-sm font-medium flex-1">GasMask Tubes</span>
                    <Select 
                      value={inventoryLevels['gasmask'] || ''} 
                      onValueChange={(v) => setInventoryLevels({...inventoryLevels, gasmask: v})}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs bg-background">
                        <SelectValue placeholder="Level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="empty">Empty</SelectItem>
                        <SelectItem value="quarter">25%</SelectItem>
                        <SelectItem value="half">50%</SelectItem>
                        <SelectItem value="threeQuarters">75%</SelectItem>
                        <SelectItem value="full">Full</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                    <div className="h-3 w-3 rounded-full bg-pink-500" />
                    <span className="text-sm font-medium flex-1">Hot Mama Tubes</span>
                    <Select 
                      value={inventoryLevels['hotmama'] || ''} 
                      onValueChange={(v) => setInventoryLevels({...inventoryLevels, hotmama: v})}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs bg-background">
                        <SelectValue placeholder="Level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="empty">Empty</SelectItem>
                        <SelectItem value="quarter">25%</SelectItem>
                        <SelectItem value="half">50%</SelectItem>
                        <SelectItem value="threeQuarters">75%</SelectItem>
                        <SelectItem value="full">Full</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
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
