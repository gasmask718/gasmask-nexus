import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, User, Phone, MessageSquare, Mail, Store, Star, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { InteractionTimeline } from '@/components/crm/InteractionTimeline';
import { LogInteractionModal } from '@/components/crm/LogInteractionModal';

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

export default function ContactProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showLogModal, setShowLogModal] = useState(false);

  // Fetch contact with all linked stores
  const { data: contactData, isLoading } = useQuery({
    queryKey: ['contact-profile', id],
    queryFn: async () => {
      // Get contact details from store_contacts
      const { data: contact, error } = await supabase
        .from('store_contacts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Get store info
      const { data: store } = await supabase
        .from('store_master')
        .select('id, store_name, address, city, state')
        .eq('id', contact.store_id)
        .single();

      // Also check stores table
      let storeFromStores = null;
      if (!store) {
        const { data } = await supabase
          .from('stores')
          .select('id, name, address_street, address_city, address_state')
          .eq('id', contact.store_id)
          .single();
        storeFromStores = data;
      }

      return {
        ...contact,
        store: store || storeFromStores,
      };
    },
    enabled: !!id,
  });

  const handleCall = () => {
    if (!contactData?.phone) {
      toast.error('No phone number available');
      return;
    }
    window.open(`tel:${contactData.phone}`);
    toast.info(`Calling ${contactData.name}...`);
  };

  const handleText = () => {
    if (!contactData?.phone) {
      toast.error('No phone number available');
      return;
    }
    window.open(`sms:${contactData.phone}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!contactData) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground mb-4">Contact not found</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const storeName = contactData.store?.store_name || contactData.store?.name || 'Unknown Store';
  const storeAddress = contactData.store?.address || contactData.store?.address_street || '';

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-7 w-7 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{contactData.name}</h1>
                {contactData.is_primary && (
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                    <Star className="h-3 w-3 mr-1" />
                    Primary Contact
                  </Badge>
                )}
              </div>
              <Badge variant="secondary">{ROLE_LABELS[contactData.role] || contactData.role}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contact Information */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contactData.phone && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{contactData.phone}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleCall}>
                    <Phone className="h-4 w-4 mr-1" /> Call
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleText}
                    disabled={!contactData.can_receive_sms}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" /> Text
                  </Button>
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <div className="text-sm text-muted-foreground mb-2">Permissions</div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={contactData.can_receive_sms ? 'default' : 'secondary'}>
                  {contactData.can_receive_sms ? '✓' : '✗'} Can Receive SMS
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Linked Store */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Store Connection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="p-4 rounded-lg bg-muted/30 border border-border/30 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/stores/${contactData.store_id}`)}
            >
              <div className="flex items-center gap-3">
                <Store className="h-8 w-8 text-green-500" />
                <div>
                  <div className="font-medium">{storeName}</div>
                  {storeAddress && (
                    <div className="text-sm text-muted-foreground">{storeAddress}</div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Badge variant="secondary">
                  {ROLE_LABELS[contactData.role] || contactData.role}
                </Badge>
                <Button size="sm" variant="outline">View Store</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interaction Timeline */}
      <InteractionTimeline
        contactId={id}
        storeId={contactData.store_id}
        onLogInteraction={() => setShowLogModal(true)}
      />

      {/* Log Interaction Modal */}
      <LogInteractionModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        contactId={id}
        contactName={contactData.name}
        storeMasterId={contactData.store_id}
        storeName={storeName}
      />
    </div>
  );
}
