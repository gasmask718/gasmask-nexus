import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Phone, MessageSquare, Star, User, Eye, Edit, Trash2, History, ChevronDown } from 'lucide-react';
import { DeleteConfirmModal } from '@/components/crud/DeleteConfirmModal';
import { toast } from 'sonner';
import { AddContactModal } from './AddContactModal';
import { EditStoreContactModal } from './EditStoreContactModal';
import { useCall } from '@/components/communication/CallProvider';
import { useMessage } from '@/components/communication/MessageProvider';
import { useStoreContactsWithResponsiveness } from '@/hooks/useContactResponsiveness';
import { ContactResponsivenessBadge } from '@/components/contact/ContactResponsivenessBadge';
import { ContactLastInteraction } from '@/components/contact/ContactLastInteraction';
import { ContactCommunicationTimeline } from './ContactCommunicationTimeline';
import { VerifyNumberButton } from './VerifyNumberButton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface StoreContact {
  id: string;
  store_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean | null;
  can_receive_sms: boolean | null;
  created_at: string;
  influence_level: string | null;
  notes: string | null;
  responsive_by_call: boolean | null;
  responsive_by_text: boolean | null;
  // New responsiveness fields
  total_calls_attempted?: number;
  total_calls_answered?: number;
  last_call_attempt_at?: string | null;
  last_call_answered_at?: string | null;
  total_texts_sent?: number;
  total_texts_received?: number;
  last_text_sent_at?: string | null;
  last_text_received_at?: string | null;
  responsiveness_status?: string | null;
  last_responded_at?: string | null;
  number_verification_status?: string | null;
  number_verification_sent_at?: string | null;
  number_verification_delivered_at?: string | null;
  number_verification_confirmed_at?: string | null;
  number_verification_error?: string | null;
}

interface StoreContactsSectionProps {
  storeId: string;
  storeName: string;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  WORKER: 'Worker',
  OWNER_SON: "Owner's Son",
  OWNER_BROTHER: "Owner's Brother",
  OWNER_COUSIN: "Owner's Cousin",
  OWNER_NEPHEW: "Owner's Nephew",
  OWNER_UNCLE: "Owner's Uncle",
  OTHER: 'Other',
};

export function StoreContactsSection({ storeId, storeName }: StoreContactsSectionProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<StoreContact | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingContact, setDeletingContact] = useState<StoreContact | null>(null);
  const [openTimelines, setOpenTimelines] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: contacts, isLoading } = useStoreContactsWithResponsiveness(storeId);

  const { initiateCall } = useCall();
  const { initiateMessage } = useMessage();

  const handleCall = (phone: string, name: string) => {
    if (!phone) {
      toast.error('No phone number available');
      return;
    }
    initiateCall({
      destinationPhone: phone,
      entityType: 'customer',
      entityName: name,
    });
  };

  const handleText = (phone: string, name: string, contactId?: string) => {
    if (!phone) {
      toast.error('No phone number available');
      return;
    }
    initiateMessage({
      destinationPhone: phone,
      entityType: 'customer',
      entityId: contactId,
      storeId: storeId,
      entityName: name,
      channel: 'sms',
    });
  };

  const handleContactAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['store-contacts-responsiveness', storeId] });
    setAddModalOpen(false);
  };

  const handleEditContact = (contact: StoreContact) => {
    setEditingContact(contact);
    setEditModalOpen(true);
  };

  const handleContactUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['store-contacts-responsiveness', storeId] });
    queryClient.invalidateQueries({ queryKey: ['store-owner', storeId] });
    setEditingContact(null);
  };

  const handleDeleteContact = (contact: StoreContact) => {
    setDeletingContact(contact);
    setDeleteModalOpen(true);
  };

  const confirmDeleteContact = async () => {
    if (!deletingContact) return;
    
    const { error } = await supabase
      .from('store_contacts')
      .delete()
      .eq('id', deletingContact.id);

    if (error) {
      toast.error('Failed to delete contact');
      throw error;
    }

    queryClient.invalidateQueries({ queryKey: ['store-contacts-responsiveness', storeId] });
    queryClient.invalidateQueries({ queryKey: ['store-owner', storeId] });
    toast.success(`${deletingContact.name} deleted`);
    setDeletingContact(null);
  };

  if (isLoading) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Store Contacts
          </CardTitle>
          <Button size="sm" onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Contact
          </Button>
        </CardHeader>
        <CardContent>
          {!contacts || contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No contacts added yet</p>
              <p className="text-sm mt-1">Add people associated with this store</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contacts.map((contact) => {
                const isOpen = !!openTimelines[contact.id];
                return (
                <Collapsible
                  key={contact.id}
                  open={isOpen}
                  onOpenChange={(v) => setOpenTimelines((s) => ({ ...s, [contact.id]: v }))}
                  className="flex flex-col p-3 rounded-lg bg-muted/30 border border-border/30 gap-3"
                >
                  {/* Top row: Name, badges, actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{contact.name}</span>
                          {contact.is_primary && (
                            <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                              <Star className="h-3 w-3 mr-1" />
                              Primary
                            </Badge>
                          )}
                          <ContactResponsivenessBadge
                            responsiveness_status={(contact.responsiveness_status as 'responsive' | 'unresponsive' | 'unknown') || 'unknown'}
                            responsive_by_call={contact.responsive_by_call}
                            responsive_by_text={contact.responsive_by_text}
                            last_call_attempt_at={contact.last_call_attempt_at}
                            last_call_answered_at={contact.last_call_answered_at}
                            last_text_sent_at={contact.last_text_sent_at}
                            last_text_received_at={contact.last_text_received_at}
                            total_calls_attempted={contact.total_calls_attempted}
                            total_calls_answered={contact.total_calls_answered}
                            total_texts_sent={contact.total_texts_sent}
                            total_texts_received={contact.total_texts_received}
                          />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                          {contact.role && (
                            <Badge variant="secondary" className="text-xs">
                              {ROLE_LABELS[contact.role] || contact.role}
                            </Badge>
                          )}
                          {contact.phone && <span>{contact.phone}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <CollapsibleTrigger asChild>
                        <Button size="sm" variant="outline" title="Communication Timeline">
                          <History className="h-4 w-4" />
                          <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </Button>
                      </CollapsibleTrigger>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCall(contact.phone || '', contact.name)}
                        disabled={!contact.phone}
                        title="Call"
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleText(contact.phone || '', contact.name, contact.id)}
                        disabled={!contact.phone || !contact.can_receive_sms}
                        title="Text"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditContact(contact)}
                        title="Edit Contact"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/crm/store-contact/${contact.id}`)}
                        title="View Profile"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteContact(contact)}
                        title="Delete Contact"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Bottom row: Last interaction dates */}
                  <ContactLastInteraction
                    last_call_attempt_at={contact.last_call_attempt_at}
                    last_call_answered_at={contact.last_call_answered_at}
                    last_text_sent_at={contact.last_text_sent_at}
                    last_text_received_at={contact.last_text_received_at}
                    className="ml-13 pl-13"
                  />

                  {/* Number verification push button */}
                  <div className="pl-13 ml-13">
                    <VerifyNumberButton
                      contactId={contact.id}
                      storeId={storeId}
                      contactName={contact.name}
                      contactPhone={contact.phone}
                      status={contact.number_verification_status}
                      sentAt={contact.number_verification_sent_at}
                      deliveredAt={contact.number_verification_delivered_at}
                      confirmedAt={contact.number_verification_confirmed_at}
                      error={contact.number_verification_error}
                      onChanged={() => queryClient.invalidateQueries({ queryKey: ['store-contacts-responsiveness', storeId] })}
                    />
                  </div>

                  <CollapsibleContent>
                    <div className="pt-3 mt-1 border-t border-border/30">
                      <ContactCommunicationTimeline
                        storeId={storeId}
                        contactId={contact.id}
                        contactName={contact.name}
                        contactPhone={contact.phone}
                        canReceiveSms={contact.can_receive_sms}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AddContactModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        storeId={storeId}
        storeName={storeName}
        onSuccess={handleContactAdded}
      />

      <EditStoreContactModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        contact={editingContact}
        onSuccess={handleContactUpdated}
      />

      <DeleteConfirmModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Delete Contact"
        itemName={deletingContact?.name}
        onConfirm={confirmDeleteContact}
      />
    </>
  );
}
