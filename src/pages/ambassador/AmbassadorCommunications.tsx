/**
 * Ambassador Communications Page
 * Communication hub for messages, calls, and templates
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  MessageSquare, Phone, Mail, Send, Search, 
  Clock, CheckCircle, Store, User, FileText,
  PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed
} from 'lucide-react';
import { useAmbassadorPortfolio } from '@/hooks/useAmbassadorPortfolio';
import { format } from 'date-fns';
import { EnhancedPortalLayout } from '@/components/portal/EnhancedPortalLayout';

interface Message {
  id: string;
  store_id: string;
  store_name: string;
  contact_name: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  channel: 'sms' | 'whatsapp' | 'email';
}

interface CallLog {
  id: string;
  store_name: string;
  contact_name: string;
  phone: string;
  type: 'inbound' | 'outbound' | 'missed';
  duration_seconds?: number;
  outcome?: string;
  created_at: string;
}

interface Template {
  id: string;
  name: string;
  category: string;
  content: string;
  usage_count: number;
}

export default function AmbassadorCommunications() {
  const { stores } = useAmbassadorPortfolio();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');

  // Mock data - will be replaced with real data
  const messages: Message[] = [
    {
      id: '1',
      store_id: 'store-1',
      store_name: 'Quick Stop Deli',
      contact_name: 'John Smith',
      last_message: 'Yes, we need more inventory by Friday',
      last_message_at: new Date().toISOString(),
      unread_count: 2,
      channel: 'sms',
    },
    {
      id: '2',
      store_id: 'store-2',
      store_name: 'Corner Bodega',
      contact_name: 'Maria Garcia',
      last_message: 'Thanks for the delivery!',
      last_message_at: new Date(Date.now() - 3600000).toISOString(),
      unread_count: 0,
      channel: 'whatsapp',
    },
    {
      id: '3',
      store_id: 'store-3',
      store_name: 'City Mart',
      contact_name: 'Mike Johnson',
      last_message: 'Can we schedule a visit next week?',
      last_message_at: new Date(Date.now() - 86400000).toISOString(),
      unread_count: 1,
      channel: 'sms',
    },
  ];

  const callLogs: CallLog[] = [
    {
      id: '1',
      store_name: 'Quick Stop Deli',
      contact_name: 'John Smith',
      phone: '(555) 123-4567',
      type: 'outbound',
      duration_seconds: 180,
      outcome: 'Scheduled restock',
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      store_name: 'Corner Bodega',
      contact_name: 'Maria Garcia',
      phone: '(555) 234-5678',
      type: 'inbound',
      duration_seconds: 120,
      outcome: 'Order inquiry',
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: '3',
      store_name: 'City Mart',
      contact_name: 'Mike Johnson',
      phone: '(555) 345-6789',
      type: 'missed',
      created_at: new Date(Date.now() - 14400000).toISOString(),
    },
  ];

  const templates: Template[] = [
    {
      id: '1',
      name: 'Reorder Reminder',
      category: 'Sales',
      content: 'Hi {contact_name}, this is a friendly reminder that your regular order is due. Would you like me to process the usual order?',
      usage_count: 45,
    },
    {
      id: '2',
      name: 'Visit ETA',
      category: 'Logistics',
      content: 'Hi {contact_name}, I\'ll be at {store_name} in approximately {eta} minutes. Is there anything specific you\'d like me to bring?',
      usage_count: 32,
    },
    {
      id: '3',
      name: 'Payment Reminder',
      category: 'Finance',
      content: 'Hi {contact_name}, this is a reminder that invoice #{invoice_number} for ${amount} is due. Please let me know if you have any questions.',
      usage_count: 28,
    },
    {
      id: '4',
      name: 'Inventory Check',
      category: 'Inventory',
      content: 'Hi {contact_name}, checking in to see how your inventory levels are looking. Would you like to schedule a restock?',
      usage_count: 21,
    },
  ];

  const getCallIcon = (type: string) => {
    switch (type) {
      case 'inbound': return <PhoneIncoming className="h-4 w-4 text-green-500" />;
      case 'outbound': return <PhoneOutgoing className="h-4 w-4 text-blue-500" />;
      case 'missed': return <PhoneMissed className="h-4 w-4 text-red-500" />;
      default: return <Phone className="h-4 w-4" />;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <EnhancedPortalLayout 
      title="Communications" 
      subtitle="Messages, calls, and templates"
      backPath="/ambassador/dashboard"
    >
      <div className="p-6 space-y-6">
        <Tabs defaultValue="messages" className="space-y-4">
          <TabsList>
            <TabsTrigger value="messages" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Messages
              {messages.reduce((sum, m) => sum + m.unread_count, 0) > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                  {messages.reduce((sum, m) => sum + m.unread_count, 0)}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="calls" className="gap-2">
              <Phone className="h-4 w-4" />
              Call Log
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="h-4 w-4" />
              Templates
            </TabsTrigger>
          </TabsList>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
              {/* Conversation List */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search conversations..." 
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {messages.map((msg) => (
                      <div 
                        key={msg.id}
                        onClick={() => setSelectedConversation(msg.id)}
                        className={`
                          flex items-start gap-3 p-4 border-b cursor-pointer transition-colors
                          ${selectedConversation === msg.id ? 'bg-muted' : 'hover:bg-muted/50'}
                        `}
                      >
                        <Avatar>
                          <AvatarFallback>{msg.contact_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">{msg.store_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(msg.last_message_at), 'h:mm a')}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{msg.contact_name}</p>
                          <p className="text-sm truncate">{msg.last_message}</p>
                        </div>
                        {msg.unread_count > 0 && (
                          <Badge variant="destructive" className="h-5 px-1.5">
                            {msg.unread_count}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Chat View */}
              <Card className="lg:col-span-2 flex flex-col">
                {selectedConversation ? (
                  <>
                    <CardHeader className="border-b">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>QS</AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base">
                            {messages.find(m => m.id === selectedConversation)?.store_name}
                          </CardTitle>
                          <CardDescription>
                            {messages.find(m => m.id === selectedConversation)?.contact_name}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-4">
                      <ScrollArea className="h-[380px]">
                        <div className="space-y-4">
                          <div className="flex justify-start">
                            <div className="bg-muted rounded-lg p-3 max-w-[80%]">
                              <p className="text-sm">Yes, we need more inventory by Friday</p>
                              <span className="text-xs text-muted-foreground">10:30 AM</span>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <div className="bg-primary text-primary-foreground rounded-lg p-3 max-w-[80%]">
                              <p className="text-sm">Perfect, I'll have the order ready. Same quantities as last time?</p>
                              <span className="text-xs opacity-80">10:32 AM</span>
                            </div>
                          </div>
                        </div>
                      </ScrollArea>
                    </CardContent>
                    <div className="p-4 border-t">
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Type a message..." 
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                        />
                        <Button>
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select a conversation to view messages</p>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* Calls Tab */}
          <TabsContent value="calls" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="relative w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search calls..." className="pl-9" />
              </div>
              <Button>
                <PhoneCall className="h-4 w-4 mr-2" />
                New Call
              </Button>
            </div>

            <Card>
              <ScrollArea className="h-[500px]">
                <div className="divide-y">
                  {callLogs.map((call) => (
                    <div key={call.id} className="flex items-center gap-4 p-4 hover:bg-muted/50">
                      <div className="p-2 rounded-full bg-muted">
                        {getCallIcon(call.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{call.store_name}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground">{call.contact_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{call.phone}</span>
                          {call.outcome && (
                            <>
                              <span>•</span>
                              <span>{call.outcome}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm">{formatDuration(call.duration_seconds)}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(call.created_at), 'MMM d, h:mm a')}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon">
                        <Phone className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="relative w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search templates..." className="pl-9" />
              </div>
              <Button>
                <FileText className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => (
                <Card key={template.id} className="hover:border-primary/50 cursor-pointer transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <Badge variant="secondary">{template.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{template.content}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Used {template.usage_count} times</span>
                      <Button variant="outline" size="sm">Use Template</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </EnhancedPortalLayout>
  );
}
