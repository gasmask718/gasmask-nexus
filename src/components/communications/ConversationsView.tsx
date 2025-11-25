import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Mail, Phone, Calendar } from 'lucide-react';

interface ConversationsViewProps {
  brand: {
    id: string;
    name: string;
    colors: { primary: string; secondary: string; accent: string };
  };
}

export default function ConversationsView({ brand }: ConversationsViewProps) {
  const conversations = [
    {
      contact: 'John\'s Corner Store',
      lastMessage: 'Yes, interested in restocking',
      channel: 'sms',
      time: '2 hours ago',
      unread: true
    },
    {
      contact: 'Maria Rodriguez',
      lastMessage: 'Can you send pricing?',
      channel: 'email',
      time: '5 hours ago',
      unread: false
    },
    {
      contact: 'Brooklyn Smoke Shop',
      lastMessage: 'AI Call: Interested - Follow up needed',
      channel: 'call',
      time: '1 day ago',
      unread: true
    },
  ];

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'sms': return <MessageSquare className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'call': return <Phone className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Conversation History - {brand.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="space-y-2">
            <Label>Search Conversations</Label>
            <Input placeholder="Search by contact name or message..." />
          </div>

          {/* Filter Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="default" className="cursor-pointer">All</Badge>
            <Badge variant="outline" className="cursor-pointer">SMS</Badge>
            <Badge variant="outline" className="cursor-pointer">Email</Badge>
            <Badge variant="outline" className="cursor-pointer">Calls</Badge>
            <Badge variant="outline" className="cursor-pointer">Unread</Badge>
          </div>

          {/* Conversations List */}
          <div className="space-y-2">
            {conversations.map((conv, i) => (
              <div
                key={i}
                className="p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                style={conv.unread ? { borderLeft: `4px solid ${brand.colors.primary}` } : {}}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: brand.colors.primary }}
                    >
                      {conv.contact.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium">{conv.contact}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {getChannelIcon(conv.channel)}
                        <span>{conv.time}</span>
                      </div>
                    </div>
                  </div>
                  {conv.unread && (
                    <Badge variant="default" className="text-xs">New</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{conv.lastMessage}</p>
              </div>
            ))}
          </div>

          {/* Timeline View */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Contact Timeline
            </Label>
            <div className="p-4 rounded-lg border bg-muted/50">
              <p className="text-sm text-center text-muted-foreground">
                Select a conversation to view full timeline
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border text-center">
              <div className="text-2xl font-bold">247</div>
              <div className="text-xs text-muted-foreground">Total Conversations</div>
            </div>
            <div className="p-3 rounded-lg border text-center">
              <div className="text-2xl font-bold">12</div>
              <div className="text-xs text-muted-foreground">Unread</div>
            </div>
            <div className="p-3 rounded-lg border text-center">
              <div className="text-2xl font-bold">89%</div>
              <div className="text-xs text-muted-foreground">Response Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
