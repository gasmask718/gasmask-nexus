/**
 * Partner Interactions Tab - Timeline view with logging
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Plus, Filter, PhoneCall, Mail, MessageCircle, Video, 
  StickyNote, Calendar, Clock, User, Edit, Eye
} from 'lucide-react';
import { SimulationBadge, EmptyStateWithGuidance } from '@/contexts/SimulationModeContext';
import { format } from 'date-fns';

interface PartnerInteractionsTabProps {
  partner: any;
  isSimulated: boolean;
}

export default function PartnerInteractionsTab({ partner, isSimulated }: PartnerInteractionsTabProps) {
  const navigate = useNavigate();
  const { partnerId } = useParams();
  const [typeFilter, setTypeFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newInteraction, setNewInteraction] = useState({
    type: 'call',
    direction: 'outbound',
    message: '',
    followUpDate: ''
  });

  // Simulated interactions
  const [interactions, setInteractions] = useState([
    { id: '1', type: 'call', direction: 'outbound', message: 'Discussed Q2 pricing updates and new package options', date: new Date(Date.now() - 86400000 * 2), user: 'Admin', duration: '12 min' },
    { id: '2', type: 'email', direction: 'outbound', message: 'Sent contract renewal notice with updated terms', date: new Date(Date.now() - 86400000 * 5), user: 'Admin' },
    { id: '3', type: 'text', direction: 'inbound', message: 'Partner confirmed availability for spring season bookings', date: new Date(Date.now() - 86400000 * 8), user: 'Partner' },
    { id: '4', type: 'meeting', direction: 'in-person', message: 'On-site visit to review facilities and services', date: new Date(Date.now() - 86400000 * 15), user: 'Admin', duration: '45 min' },
    { id: '5', type: 'call', direction: 'inbound', message: 'Partner inquired about commission structure changes', date: new Date(Date.now() - 86400000 * 20), user: 'Partner', duration: '8 min' },
    { id: '6', type: 'note', direction: null, message: 'Internal note: Partner has been very responsive, consider for featured promotion', date: new Date(Date.now() - 86400000 * 25), user: 'Admin' },
  ]);

  const filteredInteractions = useMemo(() => {
    if (typeFilter === 'all') return interactions;
    return interactions.filter(i => i.type === typeFilter);
  }, [interactions, typeFilter]);

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'call': return <PhoneCall className="h-5 w-5" />;
      case 'email': return <Mail className="h-5 w-5" />;
      case 'text': return <MessageCircle className="h-5 w-5" />;
      case 'meeting': return <Video className="h-5 w-5" />;
      case 'note': return <StickyNote className="h-5 w-5" />;
      default: return <MessageCircle className="h-5 w-5" />;
    }
  };

  const getInteractionColor = (type: string) => {
    switch (type) {
      case 'call': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'email': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'text': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'meeting': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'note': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const handleAddInteraction = () => {
    if (!newInteraction.message.trim()) return;
    
    const interaction = {
      id: `int-${Date.now()}`,
      type: newInteraction.type,
      direction: newInteraction.direction,
      message: newInteraction.message,
      date: new Date(),
      user: 'Admin',
      duration: newInteraction.type === 'call' ? 'Just now' : undefined
    };

    setInteractions([interaction, ...interactions]);
    setNewInteraction({ type: 'call', direction: 'outbound', message: '', followUpDate: '' });
    setIsAddDialogOpen(false);
  };

  const handleViewInteraction = (interactionId: string) => {
    navigate(`/crm/toptier-experience/partners/profile/${partnerId}/interactions/${interactionId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          Interactions
          {isSimulated && <SimulationBadge />}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => console.log('Add follow-up task')}>
            <Calendar className="h-4 w-4 mr-2" />
            Add Follow-Up
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Log Interaction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log New Interaction</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={newInteraction.type} onValueChange={(v) => setNewInteraction({...newInteraction, type: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="call">Phone Call</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="text">Text Message</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="note">Internal Note</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Direction</Label>
                    <Select value={newInteraction.direction} onValueChange={(v) => setNewInteraction({...newInteraction, direction: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="outbound">Outbound</SelectItem>
                        <SelectItem value="inbound">Inbound</SelectItem>
                        <SelectItem value="in-person">In-Person</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes / Summary</Label>
                  <Textarea
                    placeholder="Describe the interaction..."
                    value={newInteraction.message}
                    onChange={(e) => setNewInteraction({...newInteraction, message: e.target.value})}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Follow-up Date (Optional)</Label>
                  <Input
                    type="date"
                    value={newInteraction.followUpDate}
                    onChange={(e) => setNewInteraction({...newInteraction, followUpDate: e.target.value})}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddInteraction}>Save Interaction</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Button 
          variant={typeFilter === 'all' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setTypeFilter('all')}
        >
          All
        </Button>
        <Button 
          variant={typeFilter === 'call' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setTypeFilter('call')}
        >
          <PhoneCall className="h-3 w-3 mr-1" />
          Calls
        </Button>
        <Button 
          variant={typeFilter === 'email' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setTypeFilter('email')}
        >
          <Mail className="h-3 w-3 mr-1" />
          Emails
        </Button>
        <Button 
          variant={typeFilter === 'text' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setTypeFilter('text')}
        >
          <MessageCircle className="h-3 w-3 mr-1" />
          Texts
        </Button>
        <Button 
          variant={typeFilter === 'meeting' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setTypeFilter('meeting')}
        >
          <Video className="h-3 w-3 mr-1" />
          Meetings
        </Button>
        <Button 
          variant={typeFilter === 'note' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setTypeFilter('note')}
        >
          <StickyNote className="h-3 w-3 mr-1" />
          Notes
        </Button>
      </div>

      {/* Timeline */}
      {filteredInteractions.length === 0 ? (
        <EmptyStateWithGuidance
          icon={MessageCircle}
          title="No Interactions Yet"
          description="Log your first interaction with this partner to start building a communication history."
          actionLabel="Log Interaction"
          onAction={() => setIsAddDialogOpen(true)}
        />
      ) : (
        <div className="space-y-4">
          {filteredInteractions.map((interaction, index) => (
            <Card 
              key={interaction.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleViewInteraction(interaction.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${getInteractionColor(interaction.type)}`}>
                    {getInteractionIcon(interaction.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="capitalize">{interaction.type}</Badge>
                      {interaction.direction && (
                        <Badge variant="secondary" className="text-xs capitalize">{interaction.direction}</Badge>
                      )}
                      {interaction.duration && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {interaction.duration}
                        </span>
                      )}
                    </div>
                    <p className="text-sm">{interaction.message}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {interaction.user}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(interaction.date, 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
