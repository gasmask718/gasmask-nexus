import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MessageSquare, Send, Search, User, Phone, Building2, 
  FileText, Sparkles, ChevronDown, Clock, Check, CheckCheck
} from 'lucide-react';
import { useBusiness } from '@/contexts/BusinessContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Message {
  id: string;
  content: string;
  direction: 'inbound' | 'outbound';
  created_at: string;
  status?: 'sent' | 'delivered' | 'read';
}

interface Conversation {
  id: string;
  contact_name: string;
  contact_phone: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  business_name?: string;
}

const ManualTextPage = () => {
  const [searchParams] = useSearchParams();
  const contactId = searchParams.get('contact_id');
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState('');
  const [selectedBrandPhone, setSelectedBrandPhone] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Mock conversations (would come from DB)
  const conversations: Conversation[] = [
    { id: '1', contact_name: 'John Smith', contact_phone: '+1 555-123-4567', last_message: 'Thanks for the update!', last_message_at: new Date().toISOString(), unread_count: 2, business_name: 'Grabba' },
    { id: '2', contact_name: 'Sarah Johnson', contact_phone: '+1 555-234-5678', last_message: 'When will my order arrive?', last_message_at: new Date(Date.now() - 3600000).toISOString(), unread_count: 1, business_name: 'TopTier' },
    { id: '3', contact_name: 'Mike Williams', contact_phone: '+1 555-345-6789', last_message: 'Got it, thank you!', last_message_at: new Date(Date.now() - 7200000).toISOString(), unread_count: 0, business_name: 'Grabba' },
    { id: '4', contact_name: 'Emily Davis', contact_phone: '+1 555-456-7890', last_message: 'I need to reschedule', last_message_at: new Date(Date.now() - 86400000).toISOString(), unread_count: 0, business_name: 'Unforgettable' },
  ];

  // Mock messages for selected conversation
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', content: 'Hi, I wanted to check on my order status', direction: 'inbound', created_at: new Date(Date.now() - 7200000).toISOString() },
    { id: '2', content: 'Hi! Let me check that for you. What\'s your order number?', direction: 'outbound', created_at: new Date(Date.now() - 7000000).toISOString(), status: 'delivered' },
    { id: '3', content: 'It\'s #12345', direction: 'inbound', created_at: new Date(Date.now() - 6800000).toISOString() },
    { id: '4', content: 'Your order is out for delivery and should arrive today by 5 PM.', direction: 'outbound', created_at: new Date(Date.now() - 6600000).toISOString(), status: 'read' },
    { id: '5', content: 'Thanks for the update!', direction: 'inbound', created_at: new Date().toISOString() },
  ]);

  // Brand phone numbers
  const brandPhones = [
    { id: '1', label: 'Grabba Main', number: '+1 (555) 123-4567' },
    { id: '2', label: 'TopTier Support', number: '+1 (555) 234-5678' },
    { id: '3', label: 'Unforgettable', number: '+1 (555) 345-6789' },
  ];

  // Message templates
  const templates = [
    { id: '1', name: 'Order Update', content: 'Hi {name}, your order #{order_id} is on its way! Expected delivery: {date}.' },
    { id: '2', name: 'Follow-up', content: 'Hi {name}, just following up on our last conversation. Is there anything else I can help you with?' },
    { id: '3', name: 'Thank You', content: 'Thank you for reaching out! We appreciate your business.' },
    { id: '4', name: 'Schedule Call', content: 'Hi {name}, I\'d like to schedule a quick call to discuss your needs. What time works best for you?' },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: messageText,
      direction: 'outbound',
      created_at: new Date().toISOString(),
      status: 'sent',
    };

    setMessages(prev => [...prev, newMessage]);
    setMessageText('');

    // Log to database
    try {
      await supabase.from('communication_messages').insert({
        business_id: currentBusiness?.id,
        direction: 'outbound',
        channel: 'sms',
        content: messageText,
        sender_id: selectedConversation?.id,
        ai_generated: false,
      });
      toast.success('Message sent');
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const handleUseTemplate = (template: typeof templates[0]) => {
    setMessageText(template.content);
  };

  const handleAIRewrite = async (style: 'shorter' | 'nicer' | 'grammar') => {
    if (!messageText) return;
    
    // Mock AI rewrite (would call AI function)
    const rewrites = {
      shorter: messageText.split(' ').slice(0, Math.ceil(messageText.split(' ').length / 2)).join(' ') + '...',
      nicer: `I hope you're doing well! ${messageText} Please let me know if you need anything else! 😊`,
      grammar: messageText.charAt(0).toUpperCase() + messageText.slice(1),
    };
    
    setMessageText(rewrites[style]);
    toast.success(`Message rewritten (${style})`);
  };

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = conv.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         conv.contact_phone.includes(searchTerm);
    const matchesFilter = filter === 'all' || conv.unread_count > 0;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="w-full h-full flex overflow-hidden">
      {/* Left Panel - Conversation List */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button 
              variant={filter === 'all' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button 
              variant={filter === 'unread' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setFilter('unread')}
            >
              Unread
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="divide-y">
            {filteredConversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`p-4 cursor-pointer hover:bg-muted transition-colors ${
                  selectedConversation?.id === conv.id ? 'bg-muted' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{conv.contact_name}</p>
                        {conv.unread_count > 0 && (
                          <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{conv.business_name}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(conv.last_message_at), 'h:mm a')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate mt-2 pl-13">
                  {conv.last_message}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Center Panel - Message Thread */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{selectedConversation.contact_name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {selectedConversation.contact_phone}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedConversation.business_name}</Badge>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        msg.direction === 'outbound'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <div className={`flex items-center gap-1 mt-1 text-xs ${
                        msg.direction === 'outbound' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}>
                        <span>{format(new Date(msg.created_at), 'h:mm a')}</span>
                        {msg.direction === 'outbound' && msg.status && (
                          msg.status === 'read' ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Composer */}
            <div className="p-4 border-t space-y-3">
              {/* Brand Phone Selector */}
              <div className="flex items-center gap-3">
                <Select value={selectedBrandPhone} onValueChange={setSelectedBrandPhone}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Send from..." />
                  </SelectTrigger>
                  <SelectContent>
                    {brandPhones.map(phone => (
                      <SelectItem key={phone.id} value={phone.id}>
                        {phone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Template Button */}
                <Select onValueChange={(id) => {
                  const template = templates.find(t => t.id === id);
                  if (template) handleUseTemplate(template);
                }}>
                  <SelectTrigger className="w-40">
                    <FileText className="h-4 w-4 mr-2" />
                    <span>Templates</span>
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* AI Rewrite Buttons */}
                <div className="flex gap-1 ml-auto">
                  <Button variant="ghost" size="sm" onClick={() => handleAIRewrite('shorter')}>
                    <Sparkles className="h-3 w-3 mr-1" />
                    Shorter
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleAIRewrite('nicer')}>
                    <Sparkles className="h-3 w-3 mr-1" />
                    Nicer
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleAIRewrite('grammar')}>
                    <Sparkles className="h-3 w-3 mr-1" />
                    Fix Grammar
                  </Button>
                </div>
              </div>

              {/* Text Input */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Type your message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  rows={2}
                  className="flex-1 resize-none"
                />
                <Button onClick={handleSendMessage} className="self-end">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualTextPage;
