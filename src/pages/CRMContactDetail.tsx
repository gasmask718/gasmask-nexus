import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Phone, Mail, MessageSquare } from 'lucide-react';
import { CommunicationTimelineCRM } from '@/components/crm/CommunicationTimelineCRM';

const CRMContactDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: contact, isLoading } = useQuery({
    queryKey: ['crm-contact-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_contacts')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]">
      <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  if (!contact) {
    return <div className="text-center py-12">Contact not found</div>;
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = { active: 'default', warm: 'secondary', cold: 'outline', lost: 'destructive' };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/crm/contacts')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{contact.name}</h1>
          <p className="text-muted-foreground capitalize">{contact.type}</p>
        </div>
        {getStatusBadge(contact.relationship_status)}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Contact Details</h2>
          <div className="space-y-3">
            {contact.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <a href={`tel:${contact.phone}`} className="text-sm hover:underline">{contact.phone}</a>
              </div>
            )}
            {contact.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <a href={`mailto:${contact.email}`} className="text-sm hover:underline">{contact.email}</a>
              </div>
            )}
          </div>
          <div className="mt-6 space-y-2">
            <Button className="w-full" onClick={() => navigate('/communication/calls')}>
              <Phone className="mr-2 h-4 w-4" />Call
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate('/communication/texts')}>
              <MessageSquare className="mr-2 h-4 w-4" />Text
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate('/communication/email')}>
              <Mail className="mr-2 h-4 w-4" />Email
            </Button>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h2 className="font-semibold mb-4">Communication Timeline</h2>
          <CommunicationTimelineCRM contactId={id} />
        </Card>
      </div>
    </div>
  );
};

export default CRMContactDetail;