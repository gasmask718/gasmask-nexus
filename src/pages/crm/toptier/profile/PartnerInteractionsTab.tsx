/**
 * Partner Interactions Tab - Chat-style view with conversation window
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, PhoneCall, Mail, MessageCircle, Video, 
  StickyNote, Calendar, Clock, User, Send, ArrowRight
} from 'lucide-react';
import { SimulationBadge, EmptyStateWithGuidance } from '@/contexts/SimulationModeContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface PartnerInteractionsTabProps {
  partner: any;
  isSimulated: boolean;
}

interface Interaction {
  id: string;
  type: 'call' | 'email' | 'text' | 'meeting' | 'note';
  direction: 'inbound' | 'outbound' | 'in-person' | null;
  message: string;
  date: Date;
  user: string;
  duration?: string;
  subject?: string;
  thread?: { sender: string; message: string; timestamp: Date }[];
}

export default function PartnerInteractionsTab({ partner, isSimulated }: PartnerInteractionsTabProps) {
  const navigate = useNavigate();
  const { partnerId } = useParams();
  const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);
  const [channelFilter, setChannelFilter] = useState<'all' | 'call' | 'email' | 'text'>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [newInteraction, setNewInteraction] = useState({
    type: 'call',
    direction: 'outbound',
    message: '',
    followUpDate: ''
  });

  // Simulated interactions with realistic chat threads
  const [interactions, setInteractions] = useState<Interaction[]>([
    { 
      id: '1', 
      type: 'call', 
      direction: 'outbound', 
      message: 'Discussed Q2 pricing updates and new package options', 
      date: new Date(Date.now() - 86400000 * 2), 
      user: 'Admin', 
      duration: '12 min',
      subject: 'Q2 Pricing Discussion'
    },
    { 
      id: '2', 
      type: 'email', 
      direction: 'outbound', 
      message: 'Sent contract renewal notice with updated terms', 
      date: new Date(Date.now() - 86400000 * 5), 
      user: 'Admin',
      subject: 'Contract Renewal Notice',
      thread: [
        { sender: 'Admin', message: 'Hi, please find attached the updated contract for Q2. Let me know if you have any questions.', timestamp: new Date(Date.now() - 86400000 * 5) },
        { sender: partner?.company_name || 'Partner', message: 'Thanks for sending this over. I will review and get back to you by Friday.', timestamp: new Date(Date.now() - 86400000 * 4) },
        { sender: 'Admin', message: 'Perfect! Looking forward to continuing our partnership.', timestamp: new Date(Date.now() - 86400000 * 4) },
      ]
    },
    { 
      id: '3', 
      type: 'text', 
      direction: 'inbound', 
      message: 'Partner confirmed availability for spring season bookings', 
      date: new Date(Date.now() - 86400000 * 8), 
      user: partner?.company_name || 'Partner',
      thread: [
        { sender: 'Admin', message: 'Hey! Just checking if you are available for the spring booking schedule?', timestamp: new Date(Date.now() - 86400000 * 8.1) },
        { sender: partner?.company_name || 'Partner', message: 'Yes! We are fully available April through June. Excited to work together!', timestamp: new Date(Date.now() - 86400000 * 8) },
        { sender: 'Admin', message: 'Awesome! I will send over the details shortly.', timestamp: new Date(Date.now() - 86400000 * 7.9) },
      ]
    },
    { 
      id: '4', 
      type: 'meeting', 
      direction: 'in-person', 
      message: 'On-site visit to review facilities and services', 
      date: new Date(Date.now() - 86400000 * 15), 
      user: 'Admin', 
      duration: '45 min',
      subject: 'Site Visit & Review'
    },
    { 
      id: '5', 
      type: 'call', 
      direction: 'inbound', 
      message: 'Partner inquired about commission structure changes', 
      date: new Date(Date.now() - 86400000 * 20), 
      user: partner?.company_name || 'Partner', 
      duration: '8 min',
      subject: 'Commission Inquiry'
    },
    { 
      id: '6', 
      type: 'email', 
      direction: 'outbound', 
      message: 'Welcome email with onboarding information sent', 
      date: new Date(Date.now() - 86400000 * 25), 
      user: 'Admin',
      subject: 'Welcome to TopTier Experience!',
      thread: [
        { sender: 'Admin', message: 'Welcome to TopTier Experience! We are excited to have you as a partner. Attached is your onboarding packet with all the details you need to get started.', timestamp: new Date(Date.now() - 86400000 * 25) },
      ]
    },
  ]);

  const filteredInteractions = useMemo(() => {
    if (channelFilter === 'all') return interactions;
    return interactions.filter(i => i.type === channelFilter);
  }, [interactions, channelFilter]);

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'call': return <PhoneCall className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'text': return <MessageCircle className="h-4 w-4" />;
      case 'meeting': return <Video className="h-4 w-4" />;
      case 'note': return <StickyNote className="h-4 w-4" />;
      default: return <MessageCircle className="h-4 w-4" />;
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
    
    const interaction: Interaction = {
      id: `int-${Date.now()}`,
      type: newInteraction.type as any,
      direction: newInteraction.direction as any,
      message: newInteraction.message,
      date: new Date(),
      user: 'Admin',
      duration: newInteraction.type === 'call' ? 'Just now' : undefined
    };

    setInteractions([interaction, ...interactions]);
    setNewInteraction({ type: 'call', direction: 'outbound', message: '', followUpDate: '' });
    setIsAddDialogOpen(false);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedInteraction) return;
    
    // Add message to thread
    const updatedInteractions = interactions.map(i => {
      if (i.id === selectedInteraction.id) {
        const newThread = [
          ...(i.thread || []),
          { sender: 'Admin', message: newMessage, timestamp: new Date() }
        ];
        return { ...i, thread: newThread };
      }
      return i;
    });
    
    setInteractions(updatedInteractions);
    setSelectedInteraction(prev => prev ? {
      ...prev,
      thread: [...(prev.thread || []), { sender: 'Admin', message: newMessage, timestamp: new Date() }]
    } : null);
    setNewMessage('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          Communication History
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

      {/* Split Panel View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[600px]">
        {/* Left Panel - Interaction List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Conversations</CardTitle>
            </div>
            {/* Channel Tabs */}
            <Tabs value={channelFilter} onValueChange={(v) => setChannelFilter(v as any)} className="mt-2">
              <TabsList className="grid grid-cols-4 h-8">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="text" className="text-xs">💬</TabsTrigger>
                <TabsTrigger value="email" className="text-xs">✉️</TabsTrigger>
                <TabsTrigger value="call" className="text-xs">📞</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {filteredInteractions.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredInteractions.map((interaction) => (
                    <div
                      key={interaction.id}
                      className={cn(
                        "p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                        selectedInteraction?.id === interaction.id && "bg-muted"
                      )}
                      onClick={() => setSelectedInteraction(interaction)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", getInteractionColor(interaction.type))}>
                          {getInteractionIcon(interaction.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {interaction.subject || interaction.message.slice(0, 30)}
                            </span>
                            <Badge variant={interaction.direction === 'inbound' ? 'secondary' : 'outline'} className="text-xs">
                              {interaction.direction === 'inbound' ? '←' : '→'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {interaction.message.slice(0, 50)}...
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(interaction.date, 'MMM d, h:mm a')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right Panel - Conversation View */}
        <Card className="lg:col-span-2">
          {selectedInteraction ? (
            <>
              <CardHeader className="pb-2 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", getInteractionColor(selectedInteraction.type))}>
                      {getInteractionIcon(selectedInteraction.type)}
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {selectedInteraction.subject || selectedInteraction.type.charAt(0).toUpperCase() + selectedInteraction.type.slice(1)}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {format(selectedInteraction.date, 'MMMM d, yyyy h:mm a')}
                        {selectedInteraction.duration && ` • ${selectedInteraction.duration}`}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => navigate(`/crm/toptier-experience/partners/profile/${partnerId}/interactions/${selectedInteraction.id}`)}
                  >
                    View Full <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex flex-col h-[480px]">
                {/* Chat Messages */}
                <ScrollArea className="flex-1 p-4">
                  {selectedInteraction.thread ? (
                    <div className="space-y-4">
                      {selectedInteraction.thread.map((msg, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "flex gap-3",
                            msg.sender === 'Admin' ? "flex-row-reverse" : ""
                          )}
                        >
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div
                            className={cn(
                              "max-w-[70%] rounded-lg p-3",
                              msg.sender === 'Admin'
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}
                          >
                            <p className="text-sm">{msg.message}</p>
                            <p className={cn(
                              "text-xs mt-1",
                              msg.sender === 'Admin' ? "text-primary-foreground/70" : "text-muted-foreground"
                            )}>
                              {format(msg.timestamp, 'h:mm a')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-sm">{selectedInteraction.message}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Logged by {selectedInteraction.user}
                      </p>
                    </div>
                  )}
                </ScrollArea>

                {/* Message Input */}
                {(selectedInteraction.type === 'text' || selectedInteraction.type === 'email') && (
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      />
                      <Button onClick={handleSendMessage}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a conversation to view details</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
