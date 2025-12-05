import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Phone, MessageSquare, Star, User, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { AddContactModal } from './AddContactModal';

interface StoreContact {
  id: string;
  store_id: string;
  name: string;
  role: string;
  phone: string;
  is_primary: boolean;
  can_receive_sms: boolean;
  created_at: string;
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
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['store-contacts', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_contacts')
        .select('*')
        .eq('store_id', storeId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as StoreContact[];
    },
  });

  const handleCall = (phone: string, name: string) => {
    if (!phone) {
      toast.error('No phone number available');
      return;
    }
    window.open(`tel:${phone}`);
    toast.info(`Calling ${name}...`);
  };

  const handleText = (phone: string, name: string) => {
    if (!phone) {
      toast.error('No phone number available');
      return;
    }
    window.open(`sms:${phone}`);
    toast.info(`Opening SMS to ${name}...`);
  };

  const handleContactAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['store-contacts', storeId] });
    setAddModalOpen(false);
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
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{contact.name}</span>
                        {contact.is_primary && (
                          <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                            <Star className="h-3 w-3 mr-1" />
                            Primary
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="secondary" className="text-xs">
                          {ROLE_LABELS[contact.role] || contact.role}
                        </Badge>
                        {contact.phone && <span>{contact.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCall(contact.phone, contact.name)}
                      disabled={!contact.phone}
                      title="Call"
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleText(contact.phone, contact.name)}
                      disabled={!contact.phone || !contact.can_receive_sms}
                      title="Text"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/crm/store-contact/${contact.id}`)}
                      title="View Profile"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
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
    </>
  );
}
