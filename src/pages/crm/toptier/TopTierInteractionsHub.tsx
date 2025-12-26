/**
 * TopTier Interactions Hub - Company-wide interactions view with deep linking
 */
import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, Search, PhoneCall, Mail, MessageCircle, 
  Video, StickyNote, Calendar, Clock, User, Building2,
  ArrowRight, Send
} from 'lucide-react';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { useResolvedData } from '@/hooks/useResolvedData';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Interaction {
  id: string;
  partnerId: string;
  partnerName: string;
  type: 'call' | 'email' | 'text' | 'meeting' | 'note';
  direction: 'inbound' | 'outbound' | 'in-person' | null;
  message: string;
  subject?: string;
  date: Date;
  user: string;
  duration?: string;
  thread?: { sender: string; message: string; timestamp: Date }[];
}

export default function TopTierInteractionsHub() {
  const navigate = useNavigate();
  const { interactionId } = useParams<{ interactionId: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | 'call' | 'email' | 'text'>('all');
  const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);
  const [newMessage, setNewMessage] = useState('');

  const { simulationMode } = useSimulationMode();
  const { getEntityData } = useCRMSimulation('toptier-experience');
  
  const simulatedPartners = getEntityData('partner');
  const { data: partners, isSimulated } = useResolvedData([], simulatedPartners);

  // Generate simulated interactions across all partners
  const allInteractions: Interaction[] = useMemo(() => {
    const interactions: Interaction[] = [];
    const types: Interaction['type'][] = ['call', 'email', 'text', 'meeting'];
    const directions: Interaction['direction'][] = ['inbound', 'outbound'];
    
    partners.forEach((partner: any, pIdx: number) => {
      // Generate 2-4 interactions per partner
      const count = 2 + (pIdx % 3);
      for (let i = 0; i < count; i++) {
        const type = types[(pIdx + i) % types.length];
        const direction = directions[(pIdx + i) % directions.length];
        
        const interaction: Interaction = {
          id: `int-${partner.id}-${i}`,
          partnerId: partner.id,
          partnerName: partner.company_name,
          type,
          direction,
          subject: `${type === 'call' ? 'Call' : type === 'email' ? 'Email' : type === 'text' ? 'Message' : 'Meeting'} with ${partner.company_name}`,
          message: `Discussion regarding partnership and upcoming events.`,
          date: new Date(Date.now() - (pIdx * 2 + i) * 86400000),
          user: direction === 'inbound' ? partner.company_name : 'Admin',
          duration: type === 'call' || type === 'meeting' ? `${5 + i * 3} min` : undefined,
        };

        if (type === 'email' || type === 'text') {
          interaction.thread = [
            { sender: 'Admin', message: 'Hi, following up on our previous conversation...', timestamp: new Date(interaction.date.getTime() - 3600000) },
            { sender: partner.company_name, message: 'Thanks for reaching out! Happy to discuss further.', timestamp: interaction.date },
          ];
        }

        interactions.push(interaction);
      }
    });

    return interactions.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [partners]);

  // Auto-select interaction from URL param
  useMemo(() => {
    if (interactionId && !selectedInteraction) {
      const found = allInteractions.find(i => i.id === interactionId);
      if (found) setSelectedInteraction(found);
    }
  }, [interactionId, allInteractions, selectedInteraction]);

  // Filter interactions
  const filteredInteractions = useMemo(() => {
    return allInteractions.filter((i) => {
      const matchesSearch = searchTerm === '' ||
        i.partnerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.message.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesChannel = channelFilter === 'all' || i.type === channelFilter;
      return matchesSearch && matchesChannel;
    });
  }, [allInteractions, searchTerm, channelFilter]);

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

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedInteraction) return;
    setSelectedInteraction(prev => prev ? {
      ...prev,
      thread: [...(prev.thread || []), { sender: 'Admin', message: newMessage, timestamp: new Date() }]
    } : null);
    setNewMessage('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate('/crm/toptier-experience/partners')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Interactions Hub</h1>
              {isSimulated && <SimulationBadge />}
            </div>
            <p className="text-muted-foreground">All communications across partners</p>
          </div>
        </div>
      </div>

      {/* Split Panel View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[600px]">
        {/* Left Panel - Interaction List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search interactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
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
                  <p className="text-sm">No interactions found</p>
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
                            <span className="font-medium text-sm truncate">{interaction.partnerName}</span>
                            <Badge variant={interaction.direction === 'inbound' ? 'secondary' : 'outline'} className="text-xs">
                              {interaction.direction === 'inbound' ? '←' : '→'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {interaction.message.slice(0, 40)}...
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
                      <CardTitle className="text-base">{selectedInteraction.subject}</CardTitle>
                      <div 
                        className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-primary"
                        onClick={() => navigate(`/crm/toptier-experience/partners/profile/${selectedInteraction.partnerId}`)}
                      >
                        <Building2 className="h-3 w-3" />
                        {selectedInteraction.partnerName}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(selectedInteraction.date, 'MMMM d, yyyy h:mm a')}
                    {selectedInteraction.duration && ` • ${selectedInteraction.duration}`}
                  </div>
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
