/**
 * TopTier Request Detail - Full view of a customer request
 */
import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, ArrowRight, Phone, Mail, MapPin, Calendar, 
  DollarSign, Users, Edit, Building2, MessageSquare, Clock,
  CheckCircle, AlertCircle, Inbox, UserPlus, FileText, Plus
} from 'lucide-react';
import { TOPTIER_PARTNER_CATEGORIES, US_STATES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { useResolvedData } from '@/hooks/useResolvedData';
import { format } from 'date-fns';

export default function TopTierRequestDetail() {
  const navigate = useNavigate();
  const { requestId } = useParams<{ requestId: string }>();
  const [newNote, setNewNote] = useState('');
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);

  const { simulationMode } = useSimulationMode();
  const { getEntityData } = useCRMSimulation('toptier-experience');
  
  const simulatedPartners = getEntityData('partner');
  const { data: partners } = useResolvedData([], simulatedPartners);

  // Simulated request data
  const request = useMemo(() => {
    if (!simulationMode) return null;
    
    return {
      id: requestId,
      customer_name: 'Jessica Williams',
      customer_email: 'jessica.williams@email.com',
      customer_phone: '(305) 555-1234',
      requested_category: 'yacht',
      requested_state: 'FL',
      requested_city: 'Miami',
      budget_min: 5000,
      budget_max: 15000,
      requested_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      event_details: 'Looking for a luxury yacht experience for a 30th birthday celebration. Will have approximately 20 guests. Interested in sunset cruise with catering options.',
      status: 'new' as const,
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      assigned_to: undefined,
      notes: [
        { id: 'n1', text: 'High priority client - referred by existing customer', author: 'Admin', createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
        { id: 'n2', text: 'Called to confirm details, awaiting callback', author: 'Sales Team', createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
      ],
      interactions: [
        { id: 'i1', type: 'inquiry', description: 'Initial inquiry via website form', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
        { id: 'i2', type: 'call', description: 'Outbound call - left voicemail', createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
      ],
    };
  }, [simulationMode, requestId]);

  // Get matching partners for the requested category
  const matchingPartners = useMemo(() => {
    if (!request) return [];
    return partners.filter((p: any) => 
      p.partner_category === request.requested_category &&
      (p.state === request.requested_state || p.service_area?.includes(request.requested_state))
    );
  }, [partners, request]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge className="bg-blue-500/10 text-blue-500"><Inbox className="h-3 w-3 mr-1" />New</Badge>;
      case 'contacted':
        return <Badge className="bg-yellow-500/10 text-yellow-500"><Phone className="h-3 w-3 mr-1" />Contacted</Badge>;
      case 'quoted':
        return <Badge className="bg-purple-500/10 text-purple-500"><DollarSign className="h-3 w-3 mr-1" />Quoted</Badge>;
      case 'converted':
        return <Badge className="bg-green-500/10 text-green-500"><CheckCircle className="h-3 w-3 mr-1" />Converted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleConvertToDeal = () => {
    navigate(`/crm/toptier-experience/deals/new?requestId=${requestId}&partners=${selectedPartners.join(',')}`);
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    console.log('Adding note:', newNote);
    setNewNote('');
  };

  if (!request) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card className="p-8 text-center">
          <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">Request not found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Enable Simulation Mode to view demo data
          </p>
          <Button onClick={() => navigate('/crm/toptier-experience/requests')}>
            View All Requests
          </Button>
        </Card>
      </div>
    );
  }

  const categoryInfo = TOPTIER_PARTNER_CATEGORIES.find(c => c.value === request.requested_category);
  const stateInfo = US_STATES.find(s => s.value === request.requested_state);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-fit"
          onClick={() => navigate('/crm/toptier-experience/requests')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Requests
        </Button>
        
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{request.customer_name}</h1>
                {simulationMode && <SimulationBadge />}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(request.status)}
                <Badge variant="outline">{categoryInfo?.label}</Badge>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {request.requested_city}, {stateInfo?.label}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(request.requested_date), 'MMM d, yyyy')}
                </span>
              </div>
            </div>
          </div>
          
          {/* Header Actions */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">
              <Phone className="h-4 w-4 mr-2" />
              Call
            </Button>
            <Button variant="outline">
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
            <Button onClick={handleConvertToDeal}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Convert to Deal
            </Button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Request Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Request Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Requested Category</p>
                  <p className="font-medium">{categoryInfo?.label}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Event Date</p>
                  <p className="font-medium">{format(new Date(request.requested_date), 'MMMM d, yyyy')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">{request.requested_city}, {stateInfo?.label}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Budget Range</p>
                  <p className="font-medium text-green-600">
                    ${request.budget_min.toLocaleString()} - ${request.budget_max.toLocaleString()}
                  </p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Event Details</p>
                <p className="text-sm">{request.event_details}</p>
              </div>
            </CardContent>
          </Card>

          {/* Matching Partners */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Matching Partners ({matchingPartners.length})</CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate('/crm/toptier-experience/partners')}>
                <Building2 className="h-4 w-4 mr-2" />
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {matchingPartners.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No matching partners found in {stateInfo?.label}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matchingPartners.slice(0, 5).map((partner: any) => (
                    <div 
                      key={partner.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/crm/toptier-experience/partners/profile/${partner.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{partner.company_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {partner.city}, {partner.state} • {partner.commission_rate}% commission
                          </p>
                        </div>
                      </div>
                      <input 
                        type="checkbox"
                        checked={selectedPartners.includes(partner.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (e.target.checked) {
                            setSelectedPartners([...selectedPartners, partner.id]);
                          } else {
                            setSelectedPartners(selectedPartners.filter(id => id !== partner.id));
                          }
                        }}
                        className="h-4 w-4"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAddNote}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-3">
                {request.notes.map((note: any) => (
                  <div key={note.id} className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm">{note.text}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {note.author} • {format(new Date(note.createdAt), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${request.customer_phone}`} className="text-primary hover:underline">
                  {request.customer_phone}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${request.customer_email}`} className="text-primary hover:underline">
                  {request.customer_email}
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {request.interactions.map((interaction: any, index: number) => (
                  <div key={interaction.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        {interaction.type === 'call' ? (
                          <Phone className="h-4 w-4 text-primary" />
                        ) : (
                          <MessageSquare className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      {index < request.interactions.length - 1 && (
                        <div className="w-px h-full bg-border mt-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium">{interaction.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(interaction.createdAt), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <UserPlus className="h-4 w-4 mr-2" />
                Assign Owner
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Clock className="h-4 w-4 mr-2" />
                Schedule Follow-up
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Create Quote
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
