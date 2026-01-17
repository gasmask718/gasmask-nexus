import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Loader2, X, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { WholesalerProductOrderSelector, type OrderLineItem } from './WholesalerProductOrderSelector';

// ============= CREATE ORDER MODAL (ENHANCED WITH MULTI-COMPANY PRODUCTS) =============
interface CreateOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wholesaler: any;
  onSubmit: (data: any) => Promise<void>;
}

export function CreateOrderModal({ open, onOpenChange, wholesaler, onSubmit }: CreateOrderModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderLineItem[]>([]);
  const [notes, setNotes] = useState('');

  const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

  const handleSubmit = async () => {
    if (orderItems.length === 0) {
      toast.error('Please add at least one product');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        wholesaler_id: wholesaler.id,
        items: orderItems.map(item => ({
          product_id: item.product_id,
          company_id: item.company_id,
          company_name: item.company_name,
          sku: item.sku,
          name: item.name,
          qty: item.qty,
          price: item.price,
          subtotal: item.subtotal,
        })),
        total_amount: totalAmount,
        notes,
        order_date: new Date().toISOString(),
      });
      onOpenChange(false);
      setOrderItems([]);
      setNotes('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setOrderItems([]);
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Create Order for {wholesaler?.name}
          </DialogTitle>
          <DialogDescription>
            Select products from any Grabba company. Prices auto-populate from the catalog.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          <WholesalerProductOrderSelector
            orderItems={orderItems}
            onItemsChange={setOrderItems}
          />

          {orderItems.length > 0 && (
            <>
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20">
                <span className="font-medium">Order Total</span>
                <span className="text-2xl font-bold text-green-400">
                  ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="space-y-2">
                <Label>Order Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special instructions, delivery notes..."
                  rows={2}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || orderItems.length === 0}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Order ({orderItems.length} items)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= SCHEDULE VISIT MODAL =============
interface ScheduleVisitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wholesaler: any;
  onSubmit: (data: any) => Promise<void>;
}

export function ScheduleVisitModal({ open, onOpenChange, wholesaler, onSubmit }: ScheduleVisitModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visitDate, setVisitDate] = useState<Date>();
  const [visitType, setVisitType] = useState('routine');
  const [duration, setDuration] = useState(30);
  const [purpose, setPurpose] = useState('');

  const handleSubmit = async () => {
    if (!visitDate) {
      toast.error('Please select a date');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        wholesaler_id: wholesaler.id,
        visit_date: visitDate.toISOString(),
        visit_type: visitType,
        duration_minutes: duration,
        observations: purpose,
      });
      onOpenChange(false);
      setVisitDate(undefined);
      setPurpose('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Visit to {wholesaler?.name}</DialogTitle>
          <DialogDescription>
            Plan a field visit to this wholesaler location.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Visit Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !visitDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {visitDate ? format(visitDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={visitDate}
                  onSelect={setVisitDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Visit Type</Label>
              <Select value={visitType} onValueChange={setVisitType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="audit">Audit</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="complaint">Complaint Resolution</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Estimated Duration</Label>
              <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Purpose / Agenda</Label>
            <Textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="What's the purpose of this visit?"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Schedule Visit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= ADJUST PRICING MODAL =============
interface AdjustPricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wholesaler: any;
  onSubmit: (data: any) => Promise<void>;
}

export function AdjustPricingModal({ open, onOpenChange, wholesaler, onSubmit }: AdjustPricingModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pricingTier, setPricingTier] = useState(wholesaler?.pricing_tier || 'standard');
  const [marginAgreement, setMarginAgreement] = useState(wholesaler?.margin_agreement || 0);
  const [paymentTerms, setPaymentTerms] = useState(wholesaler?.payment_terms || 'NET30');
  const [moq, setMoq] = useState(wholesaler?.moq || 1);
  const [reason, setReason] = useState('');

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        pricing_tier: pricingTier,
        margin_agreement: marginAgreement,
        payment_terms: paymentTerms,
        moq: moq,
        notes: reason,
      });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Pricing for {wholesaler?.name}</DialogTitle>
          <DialogDescription>
            Modify pricing tier, margins, and payment terms.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pricing Tier</Label>
              <Select value={pricingTier} onValueChange={setPricingTier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Payment Terms</Label>
              <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COD">COD</SelectItem>
                  <SelectItem value="NET15">NET 15</SelectItem>
                  <SelectItem value="NET30">NET 30</SelectItem>
                  <SelectItem value="NET45">NET 45</SelectItem>
                  <SelectItem value="NET60">NET 60</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Margin Agreement (%)</Label>
              <Input
                type="number"
                value={marginAgreement}
                onChange={(e) => setMarginAgreement(parseFloat(e.target.value) || 0)}
                min={0}
                max={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Minimum Order Quantity</Label>
              <Input
                type="number"
                value={moq}
                onChange={(e) => setMoq(parseInt(e.target.value) || 1)}
                min={1}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason for Change</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you adjusting pricing?"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= EDIT PROFILE MODAL =============
interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wholesaler: any;
  onSubmit: (data: any) => Promise<void>;
}

export function EditProfileModal({ open, onOpenChange, wholesaler, onSubmit }: EditProfileModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: wholesaler?.name || '',
    legal_business_name: wholesaler?.legal_business_name || '',
    dba_name: wholesaler?.dba_name || '',
    contact_name: wholesaler?.contact_name || '',
    phone: wholesaler?.phone || '',
    email: wholesaler?.email || '',
    backup_contact_name: wholesaler?.backup_contact_name || '',
    backup_contact_phone: wholesaler?.backup_contact_phone || '',
    status: wholesaler?.status || 'active',
    risk_level: wholesaler?.risk_level || 'low',
    tax_id: wholesaler?.tax_id || '',
    license_number: wholesaler?.license_number || '',
    // Location fields (schema-aligned)
    city: wholesaler?.city || '',
    state: wholesaler?.state || '',
    borough: wholesaler?.borough || null, // Nullable field
    neighborhoods: wholesaler?.neighborhoods || [], // Array type per schema
    location_notes: wholesaler?.location_notes || '',
    address: wholesaler?.address || '',
    zip_code: wholesaler?.zip_code || '',
  });

  React.useEffect(() => {
    if (wholesaler) {
      setFormData({
        name: wholesaler.name || '',
        legal_business_name: wholesaler.legal_business_name || '',
        dba_name: wholesaler.dba_name || '',
        contact_name: wholesaler.contact_name || '',
        phone: wholesaler.phone || '',
        email: wholesaler.email || '',
        backup_contact_name: wholesaler.backup_contact_name || '',
        backup_contact_phone: wholesaler.backup_contact_phone || '',
        status: wholesaler.status || 'active',
        risk_level: wholesaler.risk_level || 'low',
        tax_id: wholesaler.tax_id || '',
        license_number: wholesaler.license_number || '',
        // Location fields (schema-aligned)
        city: wholesaler.city || '',
        state: wholesaler.state || '',
        borough: wholesaler.borough || null,
        neighborhoods: wholesaler.neighborhoods || [],
        location_notes: wholesaler.location_notes || '',
        address: wholesaler.address || '',
        zip_code: wholesaler.zip_code || '',
      });
    }
  }, [wholesaler]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Wholesaler Profile</DialogTitle>
          <DialogDescription>
            Update core business information and contacts.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2">
          <div className="space-y-2 col-span-2">
            <Label>Business Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Legal Business Name</Label>
            <Input
              value={formData.legal_business_name}
              onChange={(e) => setFormData({ ...formData, legal_business_name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>DBA Name</Label>
            <Input
              value={formData.dba_name}
              onChange={(e) => setFormData({ ...formData, dba_name: e.target.value })}
            />
          </div>

          <div className="col-span-2 border-t pt-4 mt-2">
            <h4 className="font-medium mb-3">Primary Contact</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="col-span-2 border-t pt-4 mt-2">
            <h4 className="font-medium mb-3">Backup Contact</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input
                  value={formData.backup_contact_name}
                  onChange={(e) => setFormData({ ...formData, backup_contact_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.backup_contact_phone}
                  onChange={(e) => setFormData({ ...formData, backup_contact_phone: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Location Section */}
          <div className="col-span-2 border-t pt-4 mt-2">
            <h4 className="font-medium mb-3">📍 Location & Territory</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street address"
                />
              </div>
              <div className="space-y-2">
                <Label>City *</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="New York"
                />
              </div>
              <div className="space-y-2">
                <Label>State *</Label>
                <Select value={formData.state} onValueChange={(v) => setFormData({ ...formData, state: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NY">New York</SelectItem>
                    <SelectItem value="NJ">New Jersey</SelectItem>
                    <SelectItem value="CT">Connecticut</SelectItem>
                    <SelectItem value="PA">Pennsylvania</SelectItem>
                    <SelectItem value="MA">Massachusetts</SelectItem>
                    <SelectItem value="FL">Florida</SelectItem>
                    <SelectItem value="CA">California</SelectItem>
                    <SelectItem value="TX">Texas</SelectItem>
                    <SelectItem value="IL">Illinois</SelectItem>
                    <SelectItem value="GA">Georgia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Borough (optional)</Label>
                <Select 
                  value={formData.borough || ''} 
                  onValueChange={(v) => setFormData({ ...formData, borough: v === 'none' ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select borough (if applicable)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    <SelectItem value="Manhattan">Manhattan</SelectItem>
                    <SelectItem value="Brooklyn">Brooklyn</SelectItem>
                    <SelectItem value="Queens">Queens</SelectItem>
                    <SelectItem value="Bronx">Bronx</SelectItem>
                    <SelectItem value="Staten Island">Staten Island</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Neighborhoods (comma-separated)</Label>
                <Input
                  value={Array.isArray(formData.neighborhoods) ? formData.neighborhoods.join(', ') : ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    neighborhoods: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                  })}
                  placeholder="Harlem, Williamsburg, DUMBO..."
                />
              </div>
              <div className="space-y-2">
                <Label>ZIP Code</Label>
                <Input
                  value={formData.zip_code}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  placeholder="10001"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Location Notes</Label>
                <Input
                  value={formData.location_notes}
                  onChange={(e) => setFormData({ ...formData, location_notes: e.target.value })}
                  placeholder="Corner building, easy delivery access..."
                />
              </div>
            </div>
          </div>

          <div className="col-span-2 border-t pt-4 mt-2">
            <h4 className="font-medium mb-3">Status & Compliance</h4>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="at-risk">At Risk</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Risk Level</Label>
                <Select value={formData.risk_level} onValueChange={(v) => setFormData({ ...formData, risk_level: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tax ID</Label>
                <Input
                  value={formData.tax_id}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>License #</Label>
                <Input
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= CREATE TASK MODAL =============
interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wholesaler: any;
  onSubmit: (data: any) => Promise<void>;
}

export function CreateTaskModal({ open, onOpenChange, wholesaler, onSubmit }: CreateTaskModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState<Date>();

  const handleSubmit = async () => {
    if (!title) {
      toast.error('Please enter a task title');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        title,
        description,
        priority,
        due_date: dueDate?.toISOString(),
        related_entity_type: 'wholesaler',
        related_entity_id: wholesaler.id,
      });
      onOpenChange(false);
      setTitle('');
      setDescription('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            Create a task related to {wholesaler?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Task Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Follow up on pending invoice"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task details..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= ESCALATE MODAL =============
interface EscalateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wholesaler: any;
  onSubmit: (data: any) => Promise<void>;
}

export function EscalateModal({ open, onOpenChange, wholesaler, onSubmit }: EscalateModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [escalationType, setEscalationType] = useState('relationship');
  const [severity, setSeverity] = useState('high');
  const [description, setDescription] = useState('');

  const handleSubmit = async () => {
    if (!description) {
      toast.error('Please describe the escalation');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        escalation_type: escalationType,
        severity,
        description,
        wholesaler_id: wholesaler.id,
      });
      onOpenChange(false);
      setDescription('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-red-400">Escalate Issue</DialogTitle>
          <DialogDescription>
            Flag a critical issue with {wholesaler?.name} for management review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Escalation Type</Label>
              <Select value={escalationType} onValueChange={setEscalationType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relationship">Relationship Issue</SelectItem>
                  <SelectItem value="payment">Payment Issue</SelectItem>
                  <SelectItem value="quality">Quality Concern</SelectItem>
                  <SelectItem value="compliance">Compliance Issue</SelectItem>
                  <SelectItem value="fraud">Potential Fraud</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue and why it requires escalation..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Escalation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
