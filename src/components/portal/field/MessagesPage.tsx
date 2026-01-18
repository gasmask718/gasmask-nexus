import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  Send, 
  AlertCircle, 
  Bell,
  User,
  Clock,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  content: string;
  sender_type: 'driver' | 'dispatch' | 'system';
  sender_name: string;
  created_at: string;
  read: boolean;
  context_type?: string;
  context_id?: string;
}

interface MessagesPageProps {
  portalType: 'driver' | 'biker';
}

export function MessagesPage({ portalType }: MessagesPageProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMessages() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // For demo, create sample messages - in production, fetch from messages table
        const sampleMessages: Message[] = [
          {
            id: '1',
            content: 'Your route for today has been updated. Check your stops.',
            sender_type: 'dispatch',
            sender_name: 'Dispatch',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            read: true,
          },
          {
            id: '2',
            content: 'Store ABC at 123 Main St will be closed between 2-3pm for lunch.',
            sender_type: 'system',
            sender_name: 'System Alert',
            created_at: new Date(Date.now() - 7200000).toISOString(),
            read: true,
          },
          {
            id: '3',
            content: 'Great job on completing all stops yesterday! Keep it up.',
            sender_type: 'dispatch',
            sender_name: 'Dispatch',
            created_at: new Date(Date.now() - 86400000).toISOString(),
            read: true,
          },
          {
            id: '4',
            content: 'Reminder: Submit your vehicle inspection report by end of day.',
            sender_type: 'system',
            sender_name: 'System',
            created_at: new Date(Date.now() - 1800000).toISOString(),
            read: false,
          },
        ];

        setMessages(sampleMessages);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchMessages();
  }, []);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // In production, insert into messages table
      const newMsg: Message = {
        id: Date.now().toString(),
        content: newMessage,
        sender_type: 'driver',
        sender_name: 'You',
        created_at: new Date().toISOString(),
        read: true,
      };

      setMessages(prev => [newMsg, ...prev]);
      setNewMessage('');
      toast({ title: 'Message sent' });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ title: 'Failed to send message', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const unreadCount = messages.filter(m => !m.read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Messages</h1>
          <p className="text-sm text-muted-foreground">Communication with dispatch and system alerts</p>
        </div>
        {unreadCount > 0 && (
          <Badge variant="destructive">{unreadCount} unread</Badge>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-auto py-4 flex-col gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <span className="text-sm">Report Issue</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2">
          <Bell className="h-5 w-5 text-blue-500" />
          <span className="text-sm">Request Support</span>
        </Button>
      </div>

      {/* Compose Message */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Send className="h-5 w-5" />
            Message Dispatch
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea 
            placeholder="Type your message to dispatch..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button 
              onClick={handleSendMessage}
              disabled={sending || !newMessage.trim()}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Messages List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Recent Messages
          </CardTitle>
          <CardDescription>
            {messages.length} messages
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No messages yet</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {messages.map((message) => (
                  <div 
                    key={message.id}
                    className={`p-4 rounded-lg border ${
                      !message.read ? 'border-primary/30 bg-primary/5' : ''
                    } ${
                      message.sender_type === 'driver' ? 'ml-8 bg-hud-cyan/5 border-hud-cyan/20' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          message.sender_type === 'dispatch' 
                            ? 'bg-blue-500/20 text-blue-500'
                            : message.sender_type === 'system'
                            ? 'bg-amber-500/20 text-amber-500'
                            : 'bg-hud-cyan/20 text-hud-cyan'
                        }`}>
                          {message.sender_type === 'dispatch' ? (
                            <User className="h-4 w-4" />
                          ) : message.sender_type === 'system' ? (
                            <Bell className="h-4 w-4" />
                          ) : (
                            <User className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{message.sender_name}</span>
                            {!message.read && (
                              <Badge variant="secondary" className="text-xs">New</Badge>
                            )}
                          </div>
                          <p className="text-sm">{message.content}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                        <Clock className="h-3 w-3" />
                        {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
