/**
 * TopTier Contact Detail Page
 * Full view of a partner contact
 */
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, Edit, User, Phone, Mail, 
  Building2, Briefcase, Calendar
} from 'lucide-react';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { useResolvedData } from '@/hooks/useResolvedData';
import { format } from 'date-fns';

export default function TopTierContactDetail() {
  const navigate = useNavigate();
  const { partnerId, contactId } = useParams<{ partnerId: string; contactId: string }>();
  
  const { simulationMode } = useSimulationMode();
  const { getEntityData } = useCRMSimulation('toptier-experience');
  
  // Generate simulated contacts
  const simulatedContacts = useMemo(() => [
    { id: 'con1', partner_id: partnerId, name: 'Michael Rodriguez', role: 'Owner', email: 'michael@example.com', phone: '(305) 555-1234', is_primary: true, created_at: new Date().toISOString() },
    { id: 'con2', partner_id: partnerId, name: 'Sarah Chen', role: 'Operations Manager', email: 'sarah@example.com', phone: '(305) 555-5678', is_primary: false, created_at: new Date().toISOString() },
    { id: 'con3', partner_id: partnerId, name: 'David Kim', role: 'Sales Director', email: 'david@example.com', phone: '(305) 555-9012', is_primary: false, created_at: new Date().toISOString() },
  ], [partnerId]);

  const { data: contacts, isSimulated } = useResolvedData([], simulatedContacts);

  const contact = useMemo(() => {
    return contacts.find((c: any) => c.id === contactId);
  }, [contacts, contactId]);

  if (!contact) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card className="p-8 text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">Contact not found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            The contact you're looking for doesn't exist.
          </p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{contact.name}</h1>
                {isSimulated && <SimulationBadge />}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{contact.role}</Badge>
                {contact.is_primary && (
                  <Badge className="bg-blue-500/10 text-blue-500">Primary Contact</Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/crm/toptier-experience/partners/profile/${partnerId}/contacts/${contactId}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Contact
            </Button>
            {contact.phone && (
              <Button variant="outline" asChild>
                <a href={`tel:${contact.phone}`}>
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </a>
              </Button>
            )}
            {contact.email && (
              <Button variant="outline" asChild>
                <a href={`mailto:${contact.email}`}>
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <a href={`tel:${contact.phone}`} className="font-medium text-primary hover:underline">
                  {contact.phone || 'Not provided'}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <a href={`mailto:${contact.email}`} className="font-medium text-primary hover:underline">
                  {contact.email || 'Not provided'}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Role / Title</p>
                <p className="font-medium">{contact.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Added On</p>
                <p className="font-medium">{format(new Date(contact.created_at), 'MMMM d, yyyy')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Partner Link */}
        <Card>
          <CardHeader>
            <CardTitle>Associated Partner</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
              onClick={() => navigate(`/crm/toptier-experience/partners/profile/${partnerId}`)}
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">View Partner Profile</p>
                <p className="text-sm text-muted-foreground">Click to open</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
