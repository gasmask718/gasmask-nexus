// Universal Action Modals for Grabba Skyscraper
// Provides consistent modal UIs for all common actions

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GRABBA_BRAND_IDS } from '@/config/grabbaSkyscraper';
import { Package, Truck, DollarSign, MessageSquare, Mail, Phone, MapPin, Users, Factory } from 'lucide-react';
import { format } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  selectedEntities?: any[];
  isLoading?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE ORDER MODAL
// ═══════════════════════════════════════════════════════════════════════════════

export function CreateOrderModal({ isOpen, onClose, onSubmit, initialData, isLoading }: ActionModalProps) {
  const [formData, setFormData] = useState({
    store_id: initialData?.store_id || '',
    company_id: initialData?.company_id || '',
    brand: initialData?.brand || 'grabba',
    boxes: '',
    notes: '',
  });

  const { data: stores } = useQuery({
    queryKey: ['stores-list'],
    queryFn: async () => {
      const { data } = await supabase.from('stores').select('id, name').limit(100);
      return data || [];
    },
    enabled: isOpen,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const boxes = parseInt(formData.boxes) || 0;
    await onSubmit({
      store_id: formData.store_id || undefined,
      company_id: formData.company_id || undefined,
      brand: formData.brand,
      boxes,
      tubes_total: boxes * 100,
      notes: formData.notes,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Create Order
          </DialogTitle>
          <DialogDescription>Create a new wholesale order</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Store</Label>
            <Select value={formData.store_id} onValueChange={(v) => setFormData(f => ({ ...f, store_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select store" />
              </SelectTrigger>
              <SelectContent>
                {stores?.map(store => (
                  <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Brand</Label>
            <Select value={formData.brand} onValueChange={(v) => setFormData(f => ({ ...f, brand: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRABBA_BRAND_IDS.map(brand => (
                  <SelectItem key={brand} value={brand} className="capitalize">{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Boxes</Label>
            <Input 
              type="number" 
              value={formData.boxes}
              onChange={(e) => setFormData(f => ({ ...f, boxes: e.target.value }))}
              placeholder="Number of boxes"
            />
            {formData.boxes && (
              <p className="text-xs text-muted-foreground">= {parseInt(formData.boxes) * 100} tubes</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea 
              value={formData.notes}
              onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))}
              placeholder="Order notes..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE INVOICE MODAL
// ═══════════════════════════════════════════════════════════════════════════════

export function CreateInvoiceModal({ isOpen, onClose, onSubmit, initialData, isLoading }: ActionModalProps) {
  const [formData, setFormData] = useState({
    company_id: initialData?.company_id || '',
    brand: initialData?.brand || 'grabba',
    total_amount: '',
    due_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
  });

  const { data: companies } = useQuery({
    queryKey: ['companies-list'],
    queryFn: async () => {
      const { data } = await supabase.from('companies').select('id, name').limit(100);
      return data || [];
    },
    enabled: isOpen,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      company_id: formData.company_id,
      brand: formData.brand,
      total_amount: parseFloat(formData.total_amount) || 0,
      due_date: formData.due_date,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Create Invoice
          </DialogTitle>
          <DialogDescription>Generate a new invoice</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Company</Label>
            <Select value={formData.company_id} onValueChange={(v) => setFormData(f => ({ ...f, company_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent>
                {companies?.map(company => (
                  <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Brand</Label>
            <Select value={formData.brand} onValueChange={(v) => setFormData(f => ({ ...f, brand: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRABBA_BRAND_IDS.map(brand => (
                  <SelectItem key={brand} value={brand} className="capitalize">{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Amount ($)</Label>
            <Input 
              type="number" 
              step="0.01"
              value={formData.total_amount}
              onChange={(e) => setFormData(f => ({ ...f, total_amount: e.target.value }))}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Input 
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData(f => ({ ...f, due_date: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEND TO ROUTE MODAL
// ═══════════════════════════════════════════════════════════════════════════════

export function SendToRouteModal({ isOpen, onClose, onSubmit, selectedEntities, isLoading }: ActionModalProps) {
  const [formData, setFormData] = useState({
    driver_id: '',
    route_date: format(new Date(), 'yyyy-MM-dd'),
  });

  const { data: drivers } = useQuery({
    queryKey: ['drivers-list'],
    queryFn: async () => {
      const { data } = await supabase.from('grabba_drivers').select('id, name').eq('active', true);
      return data || [];
    },
    enabled: isOpen,
  });

  const { data: existingRoutes } = useQuery({
    queryKey: ['today-routes', formData.route_date],
    queryFn: async () => {
      const { data } = await supabase
        .from('driver_routes')
        .select('id, driver_id, grabba_drivers(name)')
        .eq('route_date', formData.route_date);
      return data || [];
    },
    enabled: isOpen,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      driver_id: formData.driver_id,
      route_date: formData.route_date,
      stops: selectedEntities?.map(e => ({
        store_id: e.store_id || e.id,
        company_id: e.company_id,
        task_type: 'delivery',
        brand: e.brand || 'grabba',
      })),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Send to Route Planner
          </DialogTitle>
          <DialogDescription>Add {selectedEntities?.length || 0} stops to a route</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Selected Entities Preview */}
          {selectedEntities && selectedEntities.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Stops ({selectedEntities.length})</Label>
              <ScrollArea className="h-32 border rounded-md p-2">
                {selectedEntities.map((entity, idx) => (
                  <div key={idx} className="flex items-center gap-2 py-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{entity.name || entity.store_id || `Stop ${idx + 1}`}</span>
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}
          
          <div className="space-y-2">
            <Label>Route Date</Label>
            <Input 
              type="date"
              value={formData.route_date}
              onChange={(e) => setFormData(f => ({ ...f, route_date: e.target.value }))}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Assign Driver</Label>
            <Select value={formData.driver_id} onValueChange={(v) => setFormData(f => ({ ...f, driver_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers?.map(driver => (
                  <SelectItem key={driver.id} value={driver.id}>{driver.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {existingRoutes && existingRoutes.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Or add to existing route:</p>
              <div className="space-y-1">
                {existingRoutes.map((route: any) => (
                  <Button 
                    key={route.id} 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => onSubmit({ route_id: route.id, stops: selectedEntities })}
                  >
                    {(route.grabba_drivers as any)?.name || 'Driver'}'s Route
                  </Button>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading || !formData.driver_id}>
              {isLoading ? 'Creating...' : 'Create Route'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEND MESSAGE MODAL
// ═══════════════════════════════════════════════════════════════════════════════

export function SendMessageModal({ isOpen, onClose, onSubmit, initialData, isLoading }: ActionModalProps & { channel?: 'sms' | 'email' }) {
  const channel = initialData?.channel || 'sms';
  const [formData, setFormData] = useState({
    recipient: initialData?.recipient || '',
    message: '',
    template: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      channel,
      direction: 'outbound',
      [channel === 'sms' ? 'recipient_phone' : 'recipient_email']: formData.recipient,
      summary: formData.message,
      brand: initialData?.brand || 'grabba',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {channel === 'sms' ? <MessageSquare className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
            Send {channel === 'sms' ? 'Text Message' : 'Email'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{channel === 'sms' ? 'Phone Number' : 'Email Address'}</Label>
            <Input 
              type={channel === 'sms' ? 'tel' : 'email'}
              value={formData.recipient}
              onChange={(e) => setFormData(f => ({ ...f, recipient: e.target.value }))}
              placeholder={channel === 'sms' ? '555-555-5555' : 'email@example.com'}
            />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea 
              value={formData.message}
              onChange={(e) => setFormData(f => ({ ...f, message: e.target.value }))}
              placeholder="Type your message..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE PRODUCTION BATCH MODAL
// ═══════════════════════════════════════════════════════════════════════════════

export function CreateBatchModal({ isOpen, onClose, onSubmit, isLoading }: ActionModalProps) {
  const [formData, setFormData] = useState({
    office_id: '',
    brand: 'grabba',
    boxes_produced: '',
    produced_by: '',
    shift_label: '',
  });

  const { data: offices } = useQuery({
    queryKey: ['production-offices'],
    queryFn: async () => {
      const { data } = await supabase.from('production_offices').select('id, name').eq('active', true);
      return data || [];
    },
    enabled: isOpen,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      office_id: formData.office_id,
      brand: formData.brand,
      boxes_produced: parseInt(formData.boxes_produced) || 0,
      produced_by: formData.produced_by,
      shift_label: formData.shift_label,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Log Production Batch
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Office</Label>
            <Select value={formData.office_id} onValueChange={(v) => setFormData(f => ({ ...f, office_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select office" />
              </SelectTrigger>
              <SelectContent>
                {offices?.map(office => (
                  <SelectItem key={office.id} value={office.id}>{office.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Brand</Label>
            <Select value={formData.brand} onValueChange={(v) => setFormData(f => ({ ...f, brand: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRABBA_BRAND_IDS.map(brand => (
                  <SelectItem key={brand} value={brand} className="capitalize">{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Boxes Produced</Label>
            <Input 
              type="number"
              value={formData.boxes_produced}
              onChange={(e) => setFormData(f => ({ ...f, boxes_produced: e.target.value }))}
              placeholder="Number of boxes"
            />
            {formData.boxes_produced && (
              <p className="text-xs text-muted-foreground">= {parseInt(formData.boxes_produced) * 100} tubes</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Produced By</Label>
              <Input 
                value={formData.produced_by}
                onChange={(e) => setFormData(f => ({ ...f, produced_by: e.target.value }))}
                placeholder="Worker name"
              />
            </div>
            <div className="space-y-2">
              <Label>Shift</Label>
              <Select value={formData.shift_label} onValueChange={(v) => setFormData(f => ({ ...f, shift_label: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="afternoon">Afternoon</SelectItem>
                  <SelectItem value="night">Night</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading || !formData.office_id}>
              {isLoading ? 'Logging...' : 'Log Batch'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGN AMBASSADOR MODAL
// ═══════════════════════════════════════════════════════════════════════════════

export function AssignAmbassadorModal({ isOpen, onClose, onSubmit, initialData, isLoading }: ActionModalProps) {
  const [formData, setFormData] = useState({
    ambassador_id: '',
    company_id: initialData?.company_id || '',
    role_type: 'store_finder',
    commission_rate: '10',
  });

  const { data: ambassadors } = useQuery({
    queryKey: ['ambassadors-list'],
    queryFn: async () => {
      const { data } = await supabase.from('ambassadors').select('id, user_id, profiles(name)').eq('is_active', true);
      return data || [];
    },
    enabled: isOpen,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      ambassador_id: formData.ambassador_id,
      company_id: formData.company_id,
      role_type: formData.role_type,
      commission_rate: parseFloat(formData.commission_rate) || 10,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assign Ambassador
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Ambassador</Label>
            <Select value={formData.ambassador_id} onValueChange={(v) => setFormData(f => ({ ...f, ambassador_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select ambassador" />
              </SelectTrigger>
              <SelectContent>
                {ambassadors?.map((amb: any) => (
                  <SelectItem key={amb.id} value={amb.id}>{amb.profiles?.name || amb.user_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Role Type</Label>
            <Select value={formData.role_type} onValueChange={(v) => setFormData(f => ({ ...f, role_type: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="store_finder">Store Finder</SelectItem>
                <SelectItem value="wholesaler_finder">Wholesaler Finder</SelectItem>
                <SelectItem value="sales_rep">Sales Rep</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Commission Rate (%)</Label>
            <Input 
              type="number"
              step="0.5"
              value={formData.commission_rate}
              onChange={(e) => setFormData(f => ({ ...f, commission_rate: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading || !formData.ambassador_id}>
              {isLoading ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default {
  CreateOrderModal,
  CreateInvoiceModal,
  SendToRouteModal,
  SendMessageModal,
  CreateBatchModal,
  AssignAmbassadorModal,
};
