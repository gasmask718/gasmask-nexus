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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MessageSquare, Phone, Send, Search, 
  FileText, PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  AlertCircle
} from 'lucide-react';
import { useAmbassadorThreads, useCallHistory, useLogCall } from '@/hooks/useAmbassadorComms';
import { format } from 'date-fns';
import { EnhancedPortalLayout } from '@/components/portal/EnhancedPortalLayout';
import { toast } from 'sonner';

interface Template {
  id: string;
  name: string;
  category: string;
  content: string;
  usage_count: number;
}

export default function AmbassadorCommunications() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');

  // Fetch real data
  const { threads, isLoading: threadsLoading, sendMessage, isSending } = useAmbassadorThreads();
  const { data: callLogs = [], isLoading: callsLoading } = useCallHistory();
  const logCall = useLogCall();

  // Static templates (could be fetched from DB in future)
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

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation) return;
    
    const thread = threads.find(t => t.id === selectedConversation);
    if (!thread) return;

    try {
      await sendMessage({
        storeId: thread.store_id,
        phone: thread.contact_phone || '',
        content: messageInput,
        contactName: thread.contact_name,
      });
      setMessageInput('');
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleNewCall = async (storeId?: string, phone?: string) => {
    if (!storeId) {
      toast.info('Select a store to make a call');
      return;
    }

    try {
      await logCall.mutateAsync({
        storeId,
        phone: phone || '',
        type: 'outbound',
        outcome: 'attempted',
      });
      
      // Open phone dialer if on mobile
      if (phone) {
        window.open(`tel:${phone}`, '_self');
      }
    } catch (err) {
      // Error handled by hook
    }
  };

  const selectedThread = threads.find(t => t.id === selectedConversation);
  const unreadCount = threads.reduce((sum, t) => sum + t.unread_count, 0);

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
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                  {unreadCount}
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
                    {threadsLoading ? (
                      <div className="p-4 space-y-4">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                      </div>
                    ) : threads.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No conversations yet</p>
                        <p className="text-xs">Stores will appear here once assigned</p>
                      </div>
                    ) : (
                      threads.map((thread) => (
                        <div 
                          key={thread.id}
                          onClick={() => setSelectedConversation(thread.id)}
                          className={`
                            flex items-start gap-3 p-4 border-b cursor-pointer transition-colors
                            ${selectedConversation === thread.id ? 'bg-muted' : 'hover:bg-muted/50'}
                          `}
                        >
                          <Avatar>
                            <AvatarFallback>{thread.contact_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-medium truncate">{thread.store_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(thread.last_message_at), 'h:mm a')}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{thread.contact_name}</p>
                            <p className="text-sm truncate">{thread.last_message}</p>
                          </div>
                          {thread.unread_count > 0 && (
                            <Badge variant="destructive" className="h-5 px-1.5">
                              {thread.unread_count}
                            </Badge>
                          )}
                        </div>
                      ))
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Chat View */}
              <Card className="lg:col-span-2 flex flex-col">
                {selectedThread ? (
                  <>
                    <CardHeader className="border-b">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{selectedThread.contact_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-base">{selectedThread.store_name}</CardTitle>
                            <CardDescription>{selectedThread.contact_name}</CardDescription>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleNewCall(selectedThread.store_id, selectedThread.contact_phone || undefined)}
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          Call
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-4">
                      <ScrollArea className="h-[380px]">
                        <div className="text-center text-muted-foreground py-12">
                          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Start the conversation</p>
                          <p className="text-xs mt-1">Messages will appear here</p>
                        </div>
                      </ScrollArea>
                    </CardContent>
                    <div className="p-4 border-t">
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Type a message..." 
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <Button onClick={handleSendMessage} disabled={isSending || !messageInput.trim()}>
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
              <Button onClick={() => handleNewCall()}>
                <PhoneCall className="h-4 w-4 mr-2" />
                New Call
              </Button>
            </div>

            <Card>
              <ScrollArea className="h-[500px]">
                {callsLoading ? (
                  <div className="p-4 space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                  </div>
                ) : callLogs.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No call history yet</p>
                    <p className="text-sm mt-1">Calls will be logged here</p>
                  </div>
                ) : (
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
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleNewCall(call.store_id, call.phone)}
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
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
              <Button onClick={() => toast.info('Template creation coming soon')}>
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
                      <Button variant="outline" size="sm" onClick={() => toast.info('Template applied to message')}>
                        Use Template
                      </Button>
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
