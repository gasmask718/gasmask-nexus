import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { UserCheck, DollarSign, AlertTriangle, Plus, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export interface FieldOutcome {
  contact_id: string | null;
  contact_name: string;
  is_new_contact: boolean;
  new_contact_role?: string;
  outcome_type: string;
  payment_collected: boolean;
  payment_amount: number | null;
  payment_method: string | null;
  notes: string;
  captured_at: string;
}

const OUTCOME_TYPES = [
  { value: 'order_placed', label: 'Order Placed', icon: '📦' },
  { value: 'payment_collected', label: 'Payment Collected', icon: '💰' },
  { value: 'payment_refused', label: 'Payment Refused', icon: '🚫' },
  { value: 'not_available', label: 'Not Available', icon: '🔒' },
  { value: 'issue_conflict', label: 'Issue / Conflict', icon: '⚠️' },
  { value: 'routine_visit', label: 'Routine Visit (No Action)', icon: '✅' },
] as const;

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'other', label: 'Other' },
];

const CONTACT_ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'staff', label: 'Staff' },
];

interface FieldOutcomeCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName?: string;
  onSubmit: (outcome: FieldOutcome) => void;
  isSubmitting?: boolean;
}

export function FieldOutcomeCaptureModal({
  open,
  onOpenChange,
  storeId,
  storeName,
  onSubmit,
  isSubmitting,
}: FieldOutcomeCaptureModalProps) {
  const [contactId, setContactId] = useState<string>('');
  const [isNewContact, setIsNewContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactRole, setNewContactRole] = useState('');
  const [outcomeType, setOutcomeType] = useState('');
  const [paymentCollected, setPaymentCollected] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch store contacts
  const { data: contacts = [] } = useQuery({
    queryKey: ['store-contacts-for-capture', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_contacts')
        .select('id, name, role, is_primary')
        .is('deleted_at', null)
        .eq('store_id', storeId)
        .order('is_primary', { ascending: false })
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!storeId,
  });

  // Reset form on open
  useEffect(() => {
    if (open) {
      setContactId('');
      setIsNewContact(false);
      setNewContactName('');
      setNewContactRole('');
      setOutcomeType('');
      setPaymentCollected(false);
      setPaymentAmount('');
      setPaymentMethod('');
      setNotes('');
    }
  }, [open]);

  // Auto-set payment_collected when outcome is payment_collected
  useEffect(() => {
    if (outcomeType === 'payment_collected') {
      setPaymentCollected(true);
    }
  }, [outcomeType]);

  const hasContact = isNewContact ? newContactName.trim().length > 0 : contactId.length > 0;
  const hasOutcome = outcomeType.length > 0;
  const paymentValid = !paymentCollected || (
    parseFloat(paymentAmount) > 0 && paymentMethod.length > 0
  );
  const notesRequired = ['issue_conflict', 'payment_refused'].includes(outcomeType);
  const notesValid = !notesRequired || notes.trim().length > 0;

  const canSubmit = hasContact && hasOutcome && paymentValid && notesValid && !isSubmitting;

  const selectedContact = contacts.find(c => c.id === contactId);

  const handleSubmit = () => {
    if (!canSubmit) return;

    const outcome: FieldOutcome = {
      contact_id: isNewContact ? null : contactId,
      contact_name: isNewContact ? newContactName.trim() : (selectedContact?.name || 'Unknown'),
      is_new_contact: isNewContact,
      new_contact_role: isNewContact ? newContactRole : undefined,
      outcome_type: outcomeType,
      payment_collected: paymentCollected,
      payment_amount: paymentCollected ? parseFloat(paymentAmount) : null,
      payment_method: paymentCollected ? paymentMethod : null,
      notes: notes.trim(),
      captured_at: new Date().toISOString(),
    };

    onSubmit(outcome);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Field Outcome Capture
          </DialogTitle>
          <DialogDescription>
            {storeName ? `Record what happened at ${storeName}` : 'Record what happened on-site'}
            . This is required to complete the visit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* 1. WHO DID YOU SPEAK TO */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5" />
              Who did you speak to? *
            </Label>

            {!isNewContact ? (
              <div className="space-y-2">
                <Select value={contactId} onValueChange={setContactId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a contact..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          {c.name}
                          {c.role && (
                            <Badge variant="outline" className="text-[9px]">{c.role}</Badge>
                          )}
                          {c.is_primary && (
                            <Badge className="text-[9px] bg-primary/20 text-primary">Primary</Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setIsNewContact(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New contact not on file
                </Button>
              </div>
            ) : (
              <div className="space-y-2 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                <Input
                  placeholder="Contact name *"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="h-9"
                />
                <Select value={newContactRole} onValueChange={setNewContactRole}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Role (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => { setIsNewContact(false); setNewContactName(''); setNewContactRole(''); }}
                >
                  ← Back to existing contacts
                </Button>
              </div>
            )}
          </div>

          {/* 2. WHAT HAPPENED */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider">
              What happened? *
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {OUTCOME_TYPES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setOutcomeType(o.value)}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs font-medium transition-all',
                    outcomeType === o.value
                      ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                      : 'border-border hover:border-primary/40 hover:bg-muted/50'
                  )}
                >
                  <span className="text-base">{o.icon}</span>
                  <span>{o.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. PAYMENT */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                Payment collected?
              </Label>
              <Switch
                checked={paymentCollected}
                onCheckedChange={setPaymentCollected}
              />
            </div>

            {paymentCollected && (
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Amount *</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="h-9"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Method *</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* 4. NOTES */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              {notesRequired && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
              Notes {notesRequired ? '(Required for this outcome) *' : '(Optional)'}
            </Label>
            <Textarea
              placeholder={notesRequired
                ? 'Describe what happened — this is required...'
                : 'Any additional context for the next visit...'
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="text-sm"
            />
          </div>

          {/* SUBMIT */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!canSubmit}
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4 mr-2" />
                Submit & Complete Visit
              </>
            )}
          </Button>

          {!canSubmit && (
            <p className="text-[10px] text-muted-foreground text-center">
              {!hasContact && 'Select or add a contact. '}
              {!hasOutcome && 'Select an outcome. '}
              {!paymentValid && 'Enter payment amount & method. '}
              {!notesValid && 'Notes required for this outcome.'}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
