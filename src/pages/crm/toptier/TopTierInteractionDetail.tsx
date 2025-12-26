/**
 * TopTier Interaction Detail Page
 * Full view of a logged interaction
 */
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, Edit, MessageSquare, Phone, Mail, 
  Calendar, User, Building2, Clock
} from 'lucide-react';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { useResolvedData } from '@/hooks/useResolvedData';
import { format } from 'date-fns';

export default function TopTierInteractionDetail() {
  const navigate = useNavigate();
  const { partnerId, interactionId } = useParams<{ partnerId: string; interactionId: string }>();
  
  const { simulationMode } = useSimulationMode();
  const { getEntityData } = useCRMSimulation('toptier-experience');
  
  // Generate simulated interactions
  const simulatedInteractions = useMemo(() => [
    { id: 'int1', partner_id: partnerId, type: 'call', subject: 'Initial Partnership Discussion', notes: 'Discussed potential partnership terms and commission rates. Very interested in working together.', created_at: new Date().toISOString(), created_by: 'John Smith', duration: '15 min' },
    { id: 'int2', partner_id: partnerId, type: 'email', subject: 'Contract Review', notes: 'Sent over partnership agreement for review. Awaiting signature.', created_at: new Date(Date.now() - 86400000).toISOString(), created_by: 'Jane Doe' },
    { id: 'int3', partner_id: partnerId, type: 'meeting', subject: 'Onboarding Call', notes: 'Completed onboarding walkthrough. Partner is ready to start receiving bookings.', created_at: new Date(Date.now() - 172800000).toISOString(), created_by: 'John Smith', duration: '30 min' },
  ], [partnerId]);

  const { data: interactions, isSimulated } = useResolvedData([], simulatedInteractions);

  const interaction = useMemo(() => {
    return interactions.find((i: any) => i.id === interactionId);
  }, [interactions, interactionId]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="h-5 w-5" />;
      case 'email': return <Mail className="h-5 w-5" />;
      case 'meeting': return <Calendar className="h-5 w-5" />;
      default: return <MessageSquare className="h-5 w-5" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'call':
        return <Badge className="bg-blue-500/10 text-blue-500">Call</Badge>;
      case 'email':
        return <Badge className="bg-purple-500/10 text-purple-500">Email</Badge>;
      case 'meeting':
        return <Badge className="bg-green-500/10 text-green-500">Meeting</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (!interaction) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card className="p-8 text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">Interaction not found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            The interaction you're looking for doesn't exist.
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
            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
              {getTypeIcon(interaction.type)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{interaction.subject}</h1>
                {isSimulated && <SimulationBadge />}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {getTypeBadge(interaction.type)}
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/crm/toptier-experience/partners/profile/${partnerId}/interactions/${interactionId}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Interaction
            </Button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Interaction Details */}
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Date & Time</p>
                <p className="font-medium">{format(new Date(interaction.created_at), 'MMMM d, yyyy h:mm a')}</p>
              </div>
            </div>
            {interaction.duration && (
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">{interaction.duration}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Logged By</p>
                <p className="font-medium">{interaction.created_by}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Partner Link */}
        <Card>
          <CardHeader>
            <CardTitle>Related Partner</CardTitle>
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

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{interaction.notes || 'No notes recorded.'}</p>
        </CardContent>
      </Card>
    </div>
  );
}
