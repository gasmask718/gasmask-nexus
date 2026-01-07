/**
 * Create Deal Modal - Quick deal creation from partner profile
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSimulationMode } from '@/contexts/SimulationModeContext';

interface CreateDealModalProps {
  partner: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function CreateDealModal({ partner, open, onOpenChange, onSuccess }: CreateDealModalProps) {
  const queryClient = useQueryClient();
  const { simulationMode } = useSimulationMode();
  
  const [formData, setFormData] = useState({
    booking_name: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    event_date: undefined as Date | undefined,
    total_amount: 0,
    status: 'pending',
    notes: ''
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (simulationMode) {
        // Simulate for simulation mode
        await new Promise(resolve => setTimeout(resolve, 300));
        return { id: `deal-sim-${Date.now()}` };
      }

      // Insert into database
      const { data: newDeal, error } = await supabase
        .from('crm_deals')
        .insert({
          business_slug: 'toptier-experience',
          customer_name: data.customer_name,
          customer_email: data.customer_email || null,
          customer_phone: data.customer_phone || null,
          partner_id: partner?.id || null,
          partner_name: partner?.company_name || null,
          category: partner?.partner_category || null,
          state: partner?.state || null,
          city: partner?.city || null,
          event_date: data.event_date?.toISOString() || null,
          booking_value: data.total_amount || 0,
          commission_rate: partner?.commission_rate || 10,
          status: data.status,
          notes: data.notes || null,
          is_simulation: false,
        })
        .select('id')
        .single();

      if (error) throw error;
      return newDeal;
    },
    onSuccess: () => {
      toast.success('Deal created successfully');
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['toptier-deals'] });
      queryClient.invalidateQueries({ queryKey: ['crm_deals'] });
      queryClient.invalidateQueries({ queryKey: ['partner-deals', partner?.id] });
      setFormData({
        booking_name: '',
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        event_date: undefined,
        total_amount: 0,
        status: 'pending',
        notes: ''
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create deal: ${error.message}`);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Deal</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Deal Name</Label>
            <Input
              value={formData.booking_name}
              onChange={(e) => setFormData({ ...formData, booking_name: e.target.value })}
              placeholder="e.g., VIP Package Booking"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Customer Name *</Label>
              <Input
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Customer Email</Label>
              <Input
                type="email"
                value={formData.customer_email}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Customer Phone</Label>
              <Input
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Event Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.event_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.event_date ? format(formData.event_date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.event_date}
                    onSelect={(date) => setFormData({ ...formData, event_date: date })}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Deal Value ($)</Label>
              <Input
                type="number"
                min={0}
                value={formData.total_amount}
                onChange={(e) => setFormData({ ...formData, total_amount: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">
              Linked Partner: <span className="font-medium text-foreground">{partner?.company_name}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Commission Rate: <span className="font-medium text-green-600">{partner?.commission_rate}%</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Deal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
