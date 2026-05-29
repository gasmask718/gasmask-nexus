import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  Package, 
  DollarSign, 
  MessageSquare, 
  Camera, 
  Loader2, 
  CheckCircle,
  Phone,
  Mail,
  Users,
  FileText,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { VisitProductSelector, type SelectedProduct } from '../visit/VisitProductSelector';
import { useCreateVisitProducts, useUpdateStoreTubeInventory, GRABBA_COMPANIES } from '@/hooks/useVisitProducts';
import { useStoreMasterResolver } from '@/hooks/useStoreMasterResolver';
import { format } from 'date-fns';
import { PhotoUploadMultiple } from './PhotoUploadMultiple';
import { extractOpportunitiesFromNote, extractOpportunitiesFromInteraction } from '@/services/opportunityExtractionService';
import { DatePicker, TimePicker } from '@/components/ui/datetime-picker';

const INTERACTION_TYPES = [
  { value: 'delivery', label: 'Delivery', icon: Package, requiresProducts: true },
  { value: 'inventoryCheck', label: 'Inventory Check', icon: Package, requiresProducts: true },
  { value: 'followUp', label: 'Follow-up', icon: MessageSquare, requiresProducts: false },
  { value: 'order', label: 'Order', icon: Package, requiresProducts: false },
  { value: 'call', label: 'Phone Call', icon: Phone, requiresProducts: false },
  { value: 'sms', label: 'SMS Text', icon: MessageSquare, requiresProducts: false },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, requiresProducts: false },
  { value: 'email', label: 'Email', icon: Mail, requiresProducts: false },
  { value: 'inPerson', label: 'In Person', icon: Users, requiresProducts: false },
  { value: 'note', label: 'Note Only', icon: FileText, requiresProducts: false },
] as const;

const CHANNELS = [
  { value: 'CALL', label: 'Phone Call', icon: Phone },
  { value: 'SMS', label: 'SMS Text', icon: MessageSquare },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: MessageSquare },
  { value: 'IN_PERSON', label: 'In Person', icon: Users },
  { value: 'EMAIL', label: 'Email', icon: Mail },
  { value: 'OTHER', label: 'Other', icon: MessageSquare },
];

const DIRECTIONS = [
  { value: 'OUTBOUND', label: 'Outbound (We contacted them)', icon: ArrowUpRight },
  { value: 'INBOUND', label: 'Inbound (They contacted us)', icon: ArrowDownLeft },
];

const OUTCOMES = [
  { value: 'SUCCESS', label: 'Success' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'NO_ANSWER', label: 'No Answer' },
  { value: 'FOLLOW_UP_NEEDED', label: 'Follow-up Needed' },
  { value: 'ESCALATED', label: 'Escalated' },
];

const SENTIMENTS = [
  { value: 'POSITIVE', label: '😊 Positive' },
  { value: 'NEUTRAL', label: '😐 Neutral' },
  { value: 'NEGATIVE', label: '😞 Negative' },
];

interface UnifiedInteractionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  contactId?: string;
  contactName?: string;
  storeContacts?: Array<{ id: string; name: string }>;
  initialInteractionType?: string;
  onSuccess?: () => void;
}

export function UnifiedInteractionModal({
  open,
  onOpenChange,
  storeId,
  storeName,
  contactId,
  contactName,
  storeContacts,
  initialInteractionType = 'delivery',
  onSuccess,
}: UnifiedInteractionModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  
  // Interaction type
  const [interactionType, setInteractionType] = useState<string>(initialInteractionType);
  
  // Visit/Product fields
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [cashCollected, setCashCollected] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  
  // Communication fields
  const [selectedContactId, setSelectedContactId] = useState(contactId || '');
  const [channel, setChannel] = useState('CALL');
  const [direction, setDirection] = useState('OUTBOUND');
  const [subject, setSubject] = useState('');
  const [summary, setSummary] = useState('');
  const [outcome, setOutcome] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [followUpAt, setFollowUpAt] = useState<Date | undefined>(undefined);
  const [followUpTime, setFollowUpTime] = useState<string>('');
  
  // Note field
  const [noteText, setNoteText] = useState('');
  
  // Photos
  const [photos, setPhotos] = useState<string[]>([]);
  
  // Resolve storeId to store_master.id
  const {
    storeMasterId,
    isLoading: resolving,
    needsCreation,
    legacyStore,
    createStoreMaster,
    isCreating,
  } = useStoreMasterResolver(storeId);

  const createVisitProducts = useCreateVisitProducts();
  const updateTubeInventory = useUpdateStoreTubeInventory();

  const selectedType = INTERACTION_TYPES.find(t => t.value === interactionType);
  const requiresProducts = selectedType?.requiresProducts || false;
  const isVisitType = ['delivery', 'inventoryCheck', 'order'].includes(interactionType);
  const isCommunicationType = ['call', 'sms', 'whatsapp', 'email', 'inPerson', 'followUp'].includes(interactionType);
  const isNoteOnly = interactionType === 'note';
  const isFollowUpType = interactionType === 'followUp';

  // Auto-set channel based on interaction type
  const getChannelFromType = (type: string): string => {
    const mapping: Record<string, string> = {
      'call': 'CALL',
      'sms': 'SMS',
      'whatsapp': 'WHATSAPP',
      'email': 'EMAIL',
      'inPerson': 'IN_PERSON',
      'followUp': 'CALL',
    };
    return mapping[type] || 'CALL';
  };

  // Auto-set subject based on interaction type
  const getDefaultSubject = (type: string): string => {
    const mapping: Record<string, string> = {
      'delivery': 'Product Delivery',
      'inventoryCheck': 'Inventory Check',
      'followUp': 'Follow-up',
      'order': 'Order Placed',
      'call': 'Phone Call',
      'sms': 'SMS Text',
      'whatsapp': 'WhatsApp Message',
      'email': 'Email',
      'inPerson': 'In Person Visit',
    };
    return mapping[type] || 'Interaction';
  };

  // Sync interactionType when modal opens or initialInteractionType changes
  useEffect(() => {
    if (open) {
      setInteractionType(initialInteractionType);
    }
  }, [open, initialInteractionType]);

  // Update channel when interaction type changes
  useEffect(() => {
    if (isCommunicationType) {
      setChannel(getChannelFromType(interactionType));
      if (!subject) {
        setSubject(getDefaultSubject(interactionType));
      }
    }
  }, [interactionType, isCommunicationType, subject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation
    if (isNoteOnly && !noteText.trim()) {
      toast.error('Please enter a note');
      return;
    }

    if (isCommunicationType && !subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }

    if (isFollowUpType && !followUpAt) {
      toast.error('Please set a follow-up date');
      return;
    }
    
    // Combine date and time for follow-up
    let followUpDateTime: string | null = null;
    if (followUpAt) {
      const date = followUpAt instanceof Date ? followUpAt : new Date(followUpAt);
      if (followUpTime) {
        const [hours, minutes] = followUpTime.split(':');
        date.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      }
      followUpDateTime = date.toISOString();
    }

    // Contact is required for communication types EXCEPT follow-ups
    if (isCommunicationType && !isFollowUpType && !selectedContactId && !contactId) {
      toast.error('Please select a contact');
      return;
    }

    // Resolve store master if needed
    let resolvedStoreMasterId = storeMasterId;
    if (!resolvedStoreMasterId && needsCreation) {
      try {
        const created = await createStoreMaster();
        resolvedStoreMasterId = created.id;
      } catch (error: any) {
        toast.error('Failed to create store master: ' + error.message);
        return;
      }
    }

    if (!resolvedStoreMasterId) {
      toast.error('Store not linked to store master. Please try again.');
      return;
    }

    setLoading(true);
    try {
      const now = new Date();

      // 1. Create visit log if it's a visit type
      let visitLogId: string | null = null;
      if (isVisitType) {
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

        const visitTypeMap: Record<string, string> = {
          'delivery': 'delivery',
          'inventoryCheck': 'inventoryCheck',
          'order': 'order',
        };

        // For orders, determine cash_collected based on payment status
        let finalCashCollected: number | null = null;
        if (interactionType === 'order') {
          if (isPaid) {
            // If marked as paid, use the cash collected amount (or 0 if not specified)
            finalCashCollected = cashCollected ? parseFloat(cashCollected) : 0;
          } else {
            // If marked as unpaid, set to 0 or null
            finalCashCollected = null;
          }
        } else {
          // For other visit types, use cash collected as entered
          finalCashCollected = cashCollected ? parseFloat(cashCollected) : null;
        }

        const { data: visitData, error: visitError } = await supabase
          .from('visit_logs')
          .insert([{
            store_id: storeId,
            user_id: user.id,
            visit_type: visitTypeMap[interactionType] as any,
            cash_collected: finalCashCollected,
            payment_method: paymentMethod as any || null,
            customer_response: summary || noteText || null,
            products_delivered: productsDeliveredJson as any,
            photos: photos.length > 0 ? photos : null,
          }])
          .select()
          .single();

        if (visitError) throw visitError;
        visitLogId = visitData.id;

        // Save products if any
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

          // Update tube inventory
          const brandNameToTubeId: Record<string, string> = {
            'GasMask': 'gasmask',
            'HotMama': 'hotmama',
            'Hotscolatti': 'hotscolatti',
          };

          const brandQuantities = new Map<string, number>();
          for (const product of selectedProducts) {
            const tubeId = brandNameToTubeId[product.brand_name];
            if (tubeId) {
              const current = brandQuantities.get(tubeId) || 0;
              brandQuantities.set(tubeId, current + product.quantity);
            }
          }

          if (brandQuantities.size > 0) {
            const brandUpdates = Array.from(brandQuantities.entries()).map(([brand, quantity]) => ({
              brand,
              quantity,
            }));

            await updateTubeInventory.mutateAsync({
              storeId,
              brandUpdates,
            });
          }
        }
      }

      // 2. Create contact interaction if it's a communication type
      let interactionId: string | undefined;
      if (isCommunicationType) {
        const { data: interactionData, error: interactionError } = await supabase
          .from('contact_interactions')
          .insert({
            contact_id: selectedContactId || contactId,
            store_id: resolvedStoreMasterId,
            channel,
            direction,
            subject,
            summary: summary || null,
            outcome: outcome || null,
            sentiment: sentiment || null,
            next_action: nextAction || null,
            follow_up_at: followUpDateTime,
          })
          .select('id')
          .single();

        if (interactionError) throw interactionError;
        interactionId = interactionData?.id;

        // Create follow-up queue entry if follow-up date is set
        if (followUpDateTime && resolvedStoreMasterId) {
          const actionMap: Record<string, string> = {
            'CALL': 'manual_call',
            'SMS': 'manual_text',
            'WHATSAPP': 'manual_text',
            'EMAIL': 'manual_text',
            'IN_PERSON': 'manual_call',
          };
          
          const { error: followUpError } = await supabase
            .from('follow_up_queue')
            .insert({
              store_id: resolvedStoreMasterId,
              reason: subject || 'Follow-up scheduled',
              recommended_action: actionMap[channel] || 'manual_call',
              priority: 3,
              due_at: followUpDateTime,
              status: 'pending',
              context: {
                interaction_id: interactionId,
                notes: summary || '',
                contact_id: selectedContactId || contactId,
              },
            });

          if (followUpError) {
            console.error('Error creating follow-up queue entry:', followUpError);
          }
        }

        // Extract opportunities from interaction (async, don't block)
        if (interactionId) {
          const interactionText = `${subject}${summary ? '. ' + summary : ''}`;
          extractOpportunitiesFromInteraction(resolvedStoreMasterId, interactionId, interactionText, storeName)
            .then((result) => {
              if (result.saved > 0) {
                queryClient.invalidateQueries({ queryKey: ['store-opportunities'] });
              }
            })
            .catch((err) => {
              console.error('Error extracting opportunities from interaction:', err);
            });
        }
      }

      // 3. Create note if note text is provided (or if note-only type)
      let noteId: string | undefined;
      if (noteText.trim() || isNoteOnly) {
        const { data: noteData, error: noteError } = await supabase
          .from('store_notes')
          .insert({
            store_id: resolvedStoreMasterId,
            note_text: noteText.trim(),
            created_by: user.id,
          })
          .select('id')
          .single();

        if (noteError) throw noteError;
        noteId = noteData?.id;

        // Extract opportunities from note (async, don't block)
        if (noteId) {
          extractOpportunitiesFromNote(resolvedStoreMasterId, noteId, noteText.trim(), storeName)
            .then((result) => {
              if (result.saved > 0) {
                queryClient.invalidateQueries({ queryKey: ['store-opportunities'] });
                toast.success(`Found ${result.saved} opportunity${result.saved > 1 ? 'ies' : ''}`, {
                  description: 'Opportunities have been added automatically',
                });
              }
            })
            .catch((err) => {
              console.error('Error extracting opportunities from note:', err);
            });
        }
      }

      // 4. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['visit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['store-visit-logs-for-interactions'] });
      queryClient.invalidateQueries({ queryKey: ['store-interactions'] });
      queryClient.invalidateQueries({ queryKey: ['store-notes-for-interactions'] });
      queryClient.invalidateQueries({ queryKey: ['contact-interactions'] });
      queryClient.invalidateQueries({ queryKey: ['store-visit-products'] });
      queryClient.invalidateQueries({ queryKey: ['store-visit-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['store-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['follow-up-queue'] });
      queryClient.invalidateQueries({ queryKey: ['store-orders-history', storeId] });

      const formattedDateTime = format(now, 'MMM d, yyyy h:mm a');
      toast.success(`Interaction logged at ${formattedDateTime}`, {
        description: 'Your interaction has been saved',
      });

      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error logging interaction:', error);
      toast.error('Failed to log interaction: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setInteractionType(initialInteractionType);
    setSelectedProducts([]);
    setCashCollected('');
    setPaymentMethod('');
    setIsPaid(false);
    setSelectedContactId(contactId || '');
    setChannel('CALL');
    setDirection('OUTBOUND');
    setSubject('');
    setSummary('');
    setOutcome('');
    setSentiment('');
    setNextAction('');
    setFollowUpAt(undefined);
    setFollowUpTime('');
    setNoteText('');
    setPhotos([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-card border-border/50">
        <DialogHeader>
          <DialogTitle className="text-2xl">Log Interaction</DialogTitle>
          <DialogDescription>
            Record interaction with <span className="font-semibold text-foreground">{storeName}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Interaction Type Selector */}
          <div className="space-y-2">
            <Label>Interaction Type *</Label>
            <Select value={interactionType} onValueChange={setInteractionType}>
              <SelectTrigger className="bg-secondary/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERACTION_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Contact Selector (for communication types) */}
          {isCommunicationType && !contactId && (
            <div className="space-y-2">
              <Label>Contact {!isFollowUpType && '*'}</Label>
              {storeContacts && storeContacts.length > 0 ? (
                <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue placeholder="Select contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {storeContacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  No contacts available for this store. {!isFollowUpType && 'Add a contact first.'}
                </p>
              )}
            </div>
          )}

          {/* Channel & Direction (for communication types) */}
          {isCommunicationType && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Channel *</Label>
                  <Select value={channel} onValueChange={setChannel}>
                    <SelectTrigger className="bg-secondary/50 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          <span className="flex items-center gap-2">
                            <c.icon className="h-4 w-4" /> {c.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Direction *</Label>
                  <Select value={direction} onValueChange={setDirection}>
                    <SelectTrigger className="bg-secondary/50 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIRECTIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          <span className="flex items-center gap-2">
                            <d.icon className="h-4 w-4" /> {d.value === 'OUTBOUND' ? 'Outbound' : 'Inbound'}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label>Subject *</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Restock Hot Mama, Payment follow-up"
                  className="bg-secondary/50 border-border/50"
                />
              </div>
            </>
          )}

          {/* Payment Section (for delivery/order) */}
          {isVisitType && interactionType !== 'inventoryCheck' && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Payment Details</h3>
                </div>
                
                {/* Payment Status Toggle (for orders) */}
                {interactionType === 'order' && (
                  <div className="flex items-center space-x-2 p-3 rounded-lg bg-secondary/30 border">
                    <Checkbox
                      id="isPaid"
                      checked={isPaid}
                      onCheckedChange={(checked) => setIsPaid(checked === true)}
                    />
                    <Label 
                      htmlFor="isPaid" 
                      className="text-sm font-medium cursor-pointer flex-1"
                    >
                      Order is Paid
                    </Label>
                    <Badge variant={isPaid ? "default" : "outline"} className={isPaid ? "bg-green-500" : ""}>
                      {isPaid ? "Paid" : "Unpaid"}
                    </Badge>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cashCollected">
                      Cash Collected ($)
                      {interactionType === 'order' && !isPaid && (
                        <span className="text-xs text-muted-foreground ml-2">(optional for unpaid orders)</span>
                      )}
                    </Label>
                    <Input
                      id="cashCollected"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={cashCollected}
                      onChange={(e) => setCashCollected(e.target.value)}
                      className="bg-secondary/50 border-border/50"
                      disabled={interactionType === 'order' && !isPaid}
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

          {/* Products Section */}
          {requiresProducts && (
            <>
              <Separator />
              <VisitProductSelector
                selectedProducts={selectedProducts}
                onChange={setSelectedProducts}
              />
            </>
          )}

          {/* Summary/Notes Section */}
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <Label htmlFor="summary">
                {isNoteOnly ? 'Note *' : isCommunicationType ? 'Summary' : 'Notes'}
              </Label>
            </div>
            <Textarea
              id="summary"
              placeholder={
                isNoteOnly 
                  ? "Enter your note here..."
                  : isCommunicationType
                  ? "Notes about what happened..."
                  : "What did the customer say? Any special requests or concerns?"
              }
              value={isNoteOnly ? noteText : summary}
              onChange={(e) => {
                if (isNoteOnly) {
                  setNoteText(e.target.value);
                } else {
                  setSummary(e.target.value);
                }
              }}
              className="bg-secondary/50 border-border/50 min-h-24"
              rows={5}
            />
          </div>

          {/* Additional Note Field (for non-note-only types) */}
          {!isNoteOnly && (
            <div className="space-y-2">
              <Label htmlFor="noteText">Additional Note</Label>
              <Textarea
                id="noteText"
                placeholder="Optional additional note..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="bg-secondary/50 border-border/50 min-h-20"
                rows={3}
              />
            </div>
          )}

          {/* Outcome & Sentiment (for communication types) */}
          {isCommunicationType && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Outcome</Label>
                <Select value={outcome} onValueChange={setOutcome}>
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    {OUTCOMES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sentiment</Label>
                <Select value={sentiment} onValueChange={setSentiment}>
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue placeholder="Select sentiment" />
                  </SelectTrigger>
                  <SelectContent>
                    {SENTIMENTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Next Action & Follow-up (for communication types) */}
          {isCommunicationType && (
            <>
              <div className="space-y-2">
                <Label>Next Action</Label>
                <Input
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="What should we do next?"
                  className="bg-secondary/50 border-border/50"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Follow-up Date
                  {isFollowUpType && <span className="text-destructive">*</span>}
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <DatePicker
                    value={followUpAt}
                    onChange={setFollowUpAt}
                    placeholder="Pick a date"
                    className={isFollowUpType && !followUpAt ? 'border-primary ring-1 ring-primary/30' : ''}
                  />
                  <TimePicker
                    value={followUpTime}
                    onChange={setFollowUpTime}
                    placeholder="Select time"
                  />
                </div>
                {isFollowUpType && !followUpAt && (
                  <p className="text-xs text-muted-foreground">
                    Set when this follow-up should occur
                  </p>
                )}
              </div>
            </>
          )}

          {/* Photo Upload */}
          {(isVisitType || isNoteOnly) && (
            <>
              <Separator />
              <PhotoUploadMultiple
                photos={photos}
                onChange={setPhotos}
                maxPhotos={10}
                folder={`visit-photos/${storeId}`}
              />
            </>
          )}

          {/* Summary Before Submit */}
          {/* {selectedProducts.length > 0 && (
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Summary</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• {selectedProducts.length} product(s) will be delivered</li>
                <li>• Store inventory will be updated automatically</li>
                <li>• Interaction will appear in Recent Interactions</li>
              </ul>
            </div>
          )} */}

          {/* Actions */}
          <DialogFooter className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={loading || resolving || isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-primary hover:bg-primary-hover"
              disabled={loading || resolving || isCreating}
            >
              {loading || resolving || isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {resolving ? 'Resolving...' : isCreating ? 'Creating...' : 'Saving...'}
                </>
              ) : (
                'Log Interaction'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

