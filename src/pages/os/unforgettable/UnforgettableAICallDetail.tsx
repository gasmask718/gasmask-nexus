import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Phone, PhoneIncoming, PhoneOutgoing, Clock, CheckCircle, XCircle, 
  Calendar, User, Building2, FileText, ArrowRight, Play, ArrowLeft,
  MessageSquare, UserPlus, Paperclip, Send
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useToast } from '@/hooks/use-toast';

interface AICallLog {
  id: string;
  direction: 'inbound' | 'outbound';
  entityType: 'event_hall' | 'rental_company' | 'vendor' | 'influencer' | 'party_supplier' | 'staff' | 'customer';
  entityName: string;
  entityId: string;
  phone: string;
  state: string;
  duration: string;
  outcome: 'interested' | 'booked' | 'follow_up' | 'no_answer' | 'not_interested' | 'voicemail';
  transcript: string;
  summary: string;
  nextAction: string;
  createdAt: string;
  agentName: string;
  campaignName: string;
  notes: { id: string; text: string; author: string; createdAt: string }[];
}

const SIMULATED_CALL: AICallLog = {
  id: 'call-001',
  direction: 'outbound',
  entityType: 'event_hall',
  entityName: 'Grand Ballroom NYC',
  entityId: 'hall-001',
  phone: '+1 (212) 555-0101',
  state: 'New York',
  duration: '4:32',
  outcome: 'interested',
  transcript: `AI Agent: Hello, this is Dynasty Events calling. Am I speaking with the venue manager at Grand Ballroom?

Venue Manager: Yes, this is Patricia. How can I help you?

AI Agent: Hi Patricia! I'm calling from Unforgettable Times, a nationwide event solutions company. We work with premium venues like yours to bring in high-quality event bookings. We specialize in quinceañeras, weddings, corporate events, and private parties.

Venue Manager: Interesting. We do get a lot of those types of events. How does the partnership work?

AI Agent: Great question! We have a network of customers looking for venues across the country. When they need a venue in New York, we'd recommend Grand Ballroom. In return, you'd pay a small referral commission only when the booking is confirmed.

Venue Manager: What's the commission rate?

AI Agent: Typically 10-15% of the venue rental fee, negotiable based on volume. We also handle all the initial customer qualification so you only speak with serious, qualified leads.

Venue Manager: That sounds reasonable. I'd need to discuss with my manager, but I'm definitely interested in learning more.

AI Agent: Perfect! I can send over our partnership information packet. When would be a good time to follow up?

Venue Manager: How about Thursday afternoon, say 2pm?

AI Agent: Thursday at 2pm works great. I'll send the information now and call back then. Thank you so much, Patricia!

Venue Manager: Thank you. Talk to you Thursday.`,
  summary: 'Successfully pitched partnership to venue manager Patricia. She expressed interest and requested more information. Follow-up scheduled for Thursday 2pm. Manager approval needed for final decision. Venue handles weddings, quinceañeras, and corporate events.',
  nextAction: 'follow_up',
  createdAt: '2024-01-15T10:30:00Z',
  agentName: 'Alex (AI)',
  campaignName: 'NYC Venue Outreach Q1',
  notes: [
    { id: 'note-1', text: 'High potential venue - prime Manhattan location', author: 'System', createdAt: '2024-01-15T10:35:00Z' },
    { id: 'note-2', text: 'Patricia seemed very receptive. Good rapport established.', author: 'Alex (AI)', createdAt: '2024-01-15T10:32:00Z' }
  ]
};

const outcomeConfig: Record<string, { label: string; color: string }> = {
  interested: { label: 'Interested', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  booked: { label: 'Booked', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  follow_up: { label: 'Follow-up', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  no_answer: { label: 'No Answer', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  not_interested: { label: 'Not Interested', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  voicemail: { label: 'Voicemail', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
};

const entityTypeConfig: Record<string, { label: string; crmPath: string }> = {
  event_hall: { label: 'Event Hall', crmPath: '/crm/unforgettable_times_usa/event-halls' },
  rental_company: { label: 'Rental Company', crmPath: '/crm/unforgettable_times_usa/rentals' },
  vendor: { label: 'Vendor', crmPath: '/crm/unforgettable_times_usa/party-suppliers' },
  influencer: { label: 'Influencer', crmPath: '/crm/unforgettable_times_usa/influencers' },
  party_supplier: { label: 'Party Supplier', crmPath: '/crm/unforgettable_times_usa/party-suppliers' },
  staff: { label: 'Staff', crmPath: '/os/unforgettable/staff' },
  customer: { label: 'Customer', crmPath: '/crm/unforgettable_times_usa/customers' }
};

export default function UnforgettableAICallDetail() {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { simulationMode } = useSimulationMode();
  const [newNote, setNewNote] = useState('');
  const [isConverting, setIsConverting] = useState(false);

  const call = simulationMode ? SIMULATED_CALL : null;

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    toast({
      title: 'Note Added',
      description: 'Your note has been saved to this call record.',
    });
    setNewNote('');
  };

  const handleConvertToPartner = () => {
    if (!call) return;
    setIsConverting(true);
    
    setTimeout(() => {
      const config = entityTypeConfig[call.entityType];
      toast({
        title: 'Partner Created',
        description: `${call.entityName} has been added as a partner in CRM.`,
      });
      navigate(`${config.crmPath}?convert=${call.entityId}&name=${encodeURIComponent(call.entityName)}&state=${encodeURIComponent(call.state)}&phone=${encodeURIComponent(call.phone)}`);
    }, 1000);
  };

  const handleAssignFollowUp = () => {
    toast({
      title: 'Follow-up Assigned',
      description: 'Task created and assigned to onboarding team.',
    });
    navigate('/os/unforgettable/onboarding');
  };

  if (!call) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">Call Not Found</h3>
            <p className="text-muted-foreground mb-4">
              {simulationMode ? 'This call record does not exist' : 'Enable Simulation Mode to see demo data'}
            </p>
            <Button onClick={() => navigate('/os/unforgettable/ai-calling')}>
              ← Back to AI Calling
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" onClick={() => navigate('/os/unforgettable/ai-calling')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            {call.direction === 'inbound' ? (
              <PhoneIncoming className="h-8 w-8 text-blue-400" />
            ) : (
              <PhoneOutgoing className="h-8 w-8 text-green-400" />
            )}
            {call.entityName}
            {simulationMode && <SimulationBadge />}
          </h1>
          <p className="text-muted-foreground">
            {entityTypeConfig[call.entityType].label} • {call.phone} • {call.state}
          </p>
        </div>
        <div className="flex gap-2">
          {(call.outcome === 'interested' || call.outcome === 'follow_up') && (
            <Button 
              onClick={handleConvertToPartner}
              disabled={isConverting}
              className="bg-gradient-to-r from-green-600 to-emerald-500"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {isConverting ? 'Converting...' : 'Convert to Partner'}
            </Button>
          )}
          <Button variant="outline" onClick={handleAssignFollowUp}>
            <Calendar className="h-4 w-4 mr-2" />
            Assign Follow-up
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Duration</p>
            <p className="text-xl font-bold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {call.duration}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Outcome</p>
            <Badge className={outcomeConfig[call.outcome]?.color || ''}>
              {outcomeConfig[call.outcome]?.label || call.outcome}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Agent</p>
            <p className="text-xl font-bold">{call.agentName}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Campaign</p>
            <p className="text-lg font-medium">{call.campaignName}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Date/Time</p>
            <p className="text-lg font-medium">
              {new Date(call.createdAt).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="transcript">Full Transcript</TabsTrigger>
          <TabsTrigger value="notes">Notes ({call.notes.length})</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle>AI Call Summary</CardTitle>
              <CardDescription>Auto-generated summary from the conversation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm leading-relaxed">{call.summary}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Next Recommended Action</p>
                <Badge variant="outline" className="text-sm">
                  {call.nextAction === 'follow_up' && 'Schedule Follow-up Call'}
                  {call.nextAction === 'convert' && 'Convert to Partner'}
                  {call.nextAction === 'close' && 'Mark as Closed'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transcript">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Full Transcript
              </CardTitle>
              <CardDescription>Complete conversation record</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg whitespace-pre-wrap text-sm leading-relaxed max-h-[500px] overflow-auto">
                {call.transcript}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Notes & Comments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Note */}
              <div className="flex gap-2">
                <Textarea 
                  placeholder="Add a note about this call..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="flex-1"
                  rows={2}
                />
                <Button onClick={handleAddNote} disabled={!newNote.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              {/* Notes List */}
              <div className="space-y-3">
                {call.notes.map((note) => (
                  <div key={note.id} className="bg-muted p-3 rounded-lg">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{note.author}</span>
                      <span>{new Date(note.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm">{note.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle>Available Actions</CardTitle>
              <CardDescription>Take action on this call record</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  variant="outline" 
                  className="h-20 flex-col"
                  onClick={handleConvertToPartner}
                  disabled={isConverting}
                >
                  <UserPlus className="h-6 w-6 mb-2" />
                  Convert to CRM Partner
                </Button>
                <Button 
                  variant="outline" 
                  className="h-20 flex-col"
                  onClick={handleAssignFollowUp}
                >
                  <Calendar className="h-6 w-6 mb-2" />
                  Assign to Onboarding Agent
                </Button>
                <Button 
                  variant="outline" 
                  className="h-20 flex-col"
                  onClick={() => navigate('/os/unforgettable/customer-service')}
                >
                  <MessageSquare className="h-6 w-6 mb-2" />
                  Create Support Ticket
                </Button>
                <Button 
                  variant="outline" 
                  className="h-20 flex-col"
                  onClick={() => toast({ title: 'Media attached', description: 'Upload functionality ready' })}
                >
                  <Paperclip className="h-6 w-6 mb-2" />
                  Attach Media
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
