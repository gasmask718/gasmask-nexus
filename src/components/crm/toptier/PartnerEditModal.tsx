/**
 * Partner Edit Modal - Edit partner details inline
 */
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TOPTIER_PARTNER_CATEGORIES, US_STATES } from '@/config/crmBlueprints';
import { useSimulationMode } from '@/contexts/SimulationModeContext';

const CONTRACT_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending Review' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
];

interface PartnerEditModalProps {
  partner: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function PartnerEditModal({ partner, open, onOpenChange, onSuccess }: PartnerEditModalProps) {
  const queryClient = useQueryClient();
  const { simulationMode } = useSimulationMode();
  
  const [formData, setFormData] = useState({
    company_name: '',
    partner_category: '',
    contact_name: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    commission_rate: 10,
    contract_status: 'active',
    pricing_range: '',
    booking_link: '',
    availability_rules: '',
    notes: ''
  });

  useEffect(() => {
    if (partner && open) {
      setFormData({
        company_name: partner.company_name || '',
        partner_category: partner.partner_category || '',
        contact_name: partner.contact_name || '',
        email: partner.email || '',
        phone: partner.phone || '',
        city: partner.city || '',
        state: partner.state || '',
        commission_rate: partner.commission_rate || 10,
        contract_status: partner.contract_status || 'active',
        pricing_range: partner.pricing_range || '',
        booking_link: partner.booking_link || '',
        availability_rules: partner.availability_rules || '',
        notes: partner.notes || ''
      });
    }
  }, [partner, open]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (simulationMode) {
        // Simulate update
        await new Promise(resolve => setTimeout(resolve, 500));
        return { ...partner, ...data };
      }
      
      const { data: result, error } = await supabase
        .from('crm_partners')
        .update(data)
        .eq('id', partner.id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success('Partner updated successfully');
      queryClient.invalidateQueries({ queryKey: ['crm_partner', partner.id] });
      queryClient.invalidateQueries({ queryKey: ['crm_partners'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update partner: ${error.message}`);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Partner</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select 
                value={formData.partner_category} 
                onValueChange={(v) => setFormData({ ...formData, partner_category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {TOPTIER_PARTNER_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Contract Status</Label>
              <Select 
                value={formData.contract_status} 
                onValueChange={(v) => setFormData({ ...formData, contract_status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>City *</Label>
              <Input
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>State *</Label>
              <Select 
                value={formData.state} 
                onValueChange={(v) => setFormData({ ...formData, state: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map(state => (
                    <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Commission Rate (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={formData.commission_rate}
                onChange={(e) => setFormData({ ...formData, commission_rate: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Pricing Range</Label>
              <Input
                value={formData.pricing_range}
                onChange={(e) => setFormData({ ...formData, pricing_range: e.target.value })}
                placeholder="e.g., $500-$2,000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Booking / Affiliate Link</Label>
            <Input
              value={formData.booking_link}
              onChange={(e) => setFormData({ ...formData, booking_link: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label>Availability Rules</Label>
            <Input
              value={formData.availability_rules}
              onChange={(e) => setFormData({ ...formData, availability_rules: e.target.value })}
              placeholder="e.g., Mon-Fri 9am-5pm"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
