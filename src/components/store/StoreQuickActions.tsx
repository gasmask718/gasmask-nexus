import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Phone, MapPin, FileText, MessageSquare, Mail, CalendarPlus, ClipboardPlus } from 'lucide-react';
import { UpdateInventoryModal } from './UpdateInventoryModal';
import { CreateStoreInvoiceModal } from './CreateStoreInvoiceModal';
import { UnifiedInteractionModal } from './UnifiedInteractionModal';
import { LogInteractionAfterCallModal } from './LogInteractionAfterCallModal';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useCall } from '@/components/communication/CallProvider';
import { useMessage } from '@/components/communication/MessageProvider';

interface StoreQuickActionsProps {
  storeId: string;
  storeName: string;
  storePhone?: string | null;
  onInventoryUpdated?: () => void;
  onInvoiceCreated?: (invoiceId: string) => void;
  onCreateInvoice?: () => void;
  onAddFollowUp?: () => void;
  onScheduleVisit?: () => void;
  onLogInteraction?: () => void;
  compact?: boolean;
}

export function StoreQuickActions({
  storeId,
  storeName,
  storePhone,
  onInventoryUpdated,
  onInvoiceCreated,
  onCreateInvoice,
  onAddFollowUp,
  onScheduleVisit,
  onLogInteraction,
  compact = false,
}: StoreQuickActionsProps) {
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [callLogModalOpen, setCallLogModalOpen] = useState(false);
  const [textLogModalOpen, setTextLogModalOpen] = useState(false);
  const [emailLogModalOpen, setEmailLogModalOpen] = useState(false);
  const [lastActionType, setLastActionType] = useState<'call' | 'text' | 'email' | null>(null);
  const [addingToRoute, setAddingToRoute] = useState(false);

  // Fetch store contacts with phone and email
  const { data: storeContacts } = useQuery({
    queryKey: ['store-contacts-for-quick-actions', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_contacts')
        .select('id, name, phone, email')
        .is('deleted_at', null)
        .eq('store_id', storeId)
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
  });

  // Get primary contact or first contact
  const primaryContact = storeContacts?.[0];
  const contactPhone = primaryContact?.phone || storePhone;
  const contactEmail = primaryContact?.email;

  const { initiateCall } = useCall();
  const { initiateMessage } = useMessage();

  const handleCallStore = () => {
    if (contactPhone) {
      // Use global call system instead of tel: link
      initiateCall({
        destinationPhone: contactPhone,
        entityType: 'store',
        entityId: storeId,
        entityName: primaryContact?.name || storeName,
      });
      // Open modal to log the interaction after call
      setLastActionType('call');
      setTimeout(() => {
        setCallLogModalOpen(true);
      }, 500);
    } else {
      toast.error('No phone number available for this store');
    }
  };

  const handleAddToRoute = async () => {
    setAddingToRoute(true);
    try {
      // Get today's route or create a new one
      const today = new Date().toISOString().split('T')[0];
      
      // Check for existing active route
      const { data: existingRoute } = await supabase
        .from('routes')
        .select('id')
        .eq('date', today)
        .eq('status', 'active')
        .single();

      let routeId = existingRoute?.id;

      if (!routeId) {
        // Create a new route for today
        const { data: newRoute, error } = await supabase
          .from('routes')
          .insert({
            date: today,
            type: 'delivery',
            status: 'active',
          })
          .select('id')
          .single();

        if (error) throw error;
        routeId = newRoute?.id;
      }

      // Get highest planned_order for this route
      const { data: lastStop } = await supabase
        .from('route_stops')
        .select('planned_order')
        .eq('route_id', routeId)
        .order('planned_order', { ascending: false })
        .limit(1)
        .single();

      const nextOrder = (lastStop?.planned_order || 0) + 1;

      // Add store to route stops
      const { error: stopError } = await supabase
        .from('route_stops')
        .insert({
          route_id: routeId,
          store_id: storeId,
          planned_order: nextOrder,
          status: 'pending',
        });

      if (stopError) {
        // Check if already in route
        if (stopError.code === '23505') {
          toast.info('Store is already on today\'s route');
        } else {
          throw stopError;
        }
      } else {
        toast.success(`${storeName} added to today's route`);
      }
    } catch (error: any) {
      toast.error(`Failed to add to route: ${error.message}`);
    } finally {
      setAddingToRoute(false);
    }
  };

  const handleSendText = () => {
    if (contactPhone) {
      // Use internal messaging system instead of native sms: link
      initiateMessage({
        destinationPhone: contactPhone,
        entityType: 'store',
        entityId: storeId,
        storeId: storeId,
        entityName: primaryContact?.name || storeName,
        channel: 'sms',
      });
      // Open modal to log the interaction after text
      setLastActionType('text');
      setTimeout(() => {
        setTextLogModalOpen(true);
      }, 500);
    } else {
      toast.error('No phone number available for this store');
    }
  };

  const handleSendEmail = () => {
    if (contactEmail) {
      // Open email client with contact email
      window.location.href = `mailto:${contactEmail}?subject=Regarding ${storeName}`;
      toast.success(`Opening email to ${primaryContact?.name || storeName}...`);
    } else {
      // Open email client without pre-filled recipient
      window.location.href = `mailto:?subject=Regarding ${storeName}`;
      toast.success('Opening email client...');
    }
    // Open modal to log the interaction after email
    setLastActionType('email');
    setTimeout(() => {
      setEmailLogModalOpen(true);
    }, 500);
  };

  return (
    <>
      <Card className="border-border/60">
        {!compact && <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>}
        <CardContent className={compact ? 'p-3' : 'space-y-2'}>
          <div className={compact ? 'flex gap-2 overflow-x-auto pb-1 sm:flex-wrap' : 'space-y-2'}>
          <Button
            variant="outline"
            className={compact ? 'shrink-0' : 'w-full justify-start'}
            onClick={() => setInventoryModalOpen(true)}
          >
            <Package className="h-4 w-4 mr-2" />
            Update Inventory
          </Button>

          <Button
            variant="outline"
            className={compact ? 'shrink-0' : 'w-full justify-start'}
            onClick={handleCallStore}
            disabled={!contactPhone}
          >
            <Phone className="h-4 w-4 mr-2" />
            Call Store
          </Button>

          <Button
            variant="outline"
            className={compact ? 'shrink-0' : 'w-full justify-start'}
            onClick={handleSendText}
            disabled={!contactPhone}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Send Text
          </Button>

          <Button
            variant="outline"
            className={compact ? 'shrink-0' : 'w-full justify-start'}
            onClick={handleSendEmail}
          >
            <Mail className="h-4 w-4 mr-2" />
            Send Email
          </Button>

          <Button
            variant="outline"
            className={compact ? 'shrink-0' : 'w-full justify-start'}
            onClick={onScheduleVisit || handleAddToRoute}
            disabled={addingToRoute}
          >
            <MapPin className="h-4 w-4 mr-2" />
            {addingToRoute ? 'Adding...' : compact ? 'Schedule Visit' : 'Add to Route'}
          </Button>

          <Button
            variant="outline"
            className={compact ? 'shrink-0' : 'w-full justify-start'}
            onClick={onCreateInvoice || (() => setInvoiceModalOpen(true))}
          >
            <FileText className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
          {onAddFollowUp && (
            <Button variant="outline" className={compact ? 'shrink-0' : 'w-full justify-start'} onClick={onAddFollowUp}>
              <CalendarPlus className="h-4 w-4 mr-2" />Add Follow-up
            </Button>
          )}
          {onLogInteraction && (
            <Button variant="outline" className={compact ? 'shrink-0' : 'w-full justify-start'} onClick={onLogInteraction}>
              <ClipboardPlus className="h-4 w-4 mr-2" />Log Interaction
            </Button>
          )}
          </div>
        </CardContent>
      </Card>

      <UpdateInventoryModal
        open={inventoryModalOpen}
        onOpenChange={setInventoryModalOpen}
        storeId={storeId}
        storeName={storeName}
        onSuccess={onInventoryUpdated}
      />

      <CreateStoreInvoiceModal
        open={invoiceModalOpen}
        onOpenChange={setInvoiceModalOpen}
        storeId={storeId}
        storeName={storeName}
        onSuccess={onInvoiceCreated}
      />

      <UnifiedInteractionModal
        open={textModalOpen}
        onOpenChange={setTextModalOpen}
        storeId={storeId}
        storeName={storeName}
        storeContacts={storeContacts || []}
        initialInteractionType="sms"
        onSuccess={() => {
          // Text sent successfully
        }}
      />

      {/* Log Interaction After Call */}
      <LogInteractionAfterCallModal
        open={callLogModalOpen}
        onOpenChange={setCallLogModalOpen}
        storeId={storeId}
        storeName={storeName}
        contactId={primaryContact?.id}
        contactName={primaryContact?.name}
        storeContacts={storeContacts || []}
        actionType="call"
        onSuccess={() => {
          setCallLogModalOpen(false);
          setLastActionType(null);
        }}
      />

      {/* Log Interaction After Text */}
      <LogInteractionAfterCallModal
        open={textLogModalOpen}
        onOpenChange={setTextLogModalOpen}
        storeId={storeId}
        storeName={storeName}
        contactId={primaryContact?.id}
        contactName={primaryContact?.name}
        storeContacts={storeContacts || []}
        actionType="text"
        onSuccess={() => {
          setTextLogModalOpen(false);
          setLastActionType(null);
        }}
      />

      {/* Log Interaction After Email */}
      <LogInteractionAfterCallModal
        open={emailLogModalOpen}
        onOpenChange={setEmailLogModalOpen}
        storeId={storeId}
        storeName={storeName}
        contactId={primaryContact?.id}
        contactName={primaryContact?.name}
        storeContacts={storeContacts || []}
        actionType="email"
        onSuccess={() => {
          setEmailLogModalOpen(false);
          setLastActionType(null);
        }}
      />
    </>
  );
}
