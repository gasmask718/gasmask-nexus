// ═══════════════════════════════════════════════════════════════════════════════
// OWNER BROADCAST CENTER — Send Empire-Wide Communications
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Send,
  MessageSquare,
  Mail,
  Phone,
  Users,
  Building2,
  CheckCircle,
  Clock,
  Loader2,
} from 'lucide-react';

const targetGroups = [
  { id: 'all-stores', label: 'All Stores', count: 127 },
  { id: 'grabba-stores', label: 'Grabba Stores', count: 127 },
  { id: 'ambassadors', label: 'Ambassadors', count: 78 },
  { id: 'wholesalers', label: 'Wholesalers', count: 24 },
  { id: 'drivers', label: 'Drivers & Bikers', count: 58 },
  { id: 'vas', label: 'Virtual Assistants', count: 6 },
];

const recentBroadcasts = [
  { id: '1', channel: 'SMS', target: 'All Stores', message: 'Holiday schedule update...', sent: '2 days ago', status: 'Delivered' },
  { id: '2', channel: 'Email', target: 'Ambassadors', message: 'New commission structure...', sent: '5 days ago', status: 'Delivered' },
  { id: '3', channel: 'SMS', target: 'Drivers', message: 'Route optimization tips...', sent: '1 week ago', status: 'Delivered' },
];

export default function OwnerBroadcastCenter() {
  const [channel, setChannel] = useState<'sms' | 'email' | 'ai-call'>('sms');
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [isSending, setIsSending] = useState(false);

  const toggleTarget = (targetId: string) => {
    setSelectedTargets(prev =>
      prev.includes(targetId)
        ? prev.filter(t => t !== targetId)
        : [...prev, targetId]
    );
  };

  const getTotalRecipients = () => {
    return targetGroups
      .filter(g => selectedTargets.includes(g.id))
      .reduce((sum, g) => sum + g.count, 0);
  };

  const handleSend = async () => {
    if (selectedTargets.length === 0) {
      toast.error('Please select at least one target group');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setIsSending(true);
    console.log('[BROADCAST CENTER] Sending broadcast:', { channel, selectedTargets, message });

    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 2000));

    toast.success(`Broadcast queued for ${getTotalRecipients()} recipients`);
    setMessage('');
    setSubject('');
    setSelectedTargets([]);
    setIsSending(false);
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/30">
          <Send className="h-8 w-8 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Broadcast Center</h1>
          <p className="text-sm text-muted-foreground">
            Send empire-wide communications across all channels
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compose Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Channel Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Channel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant={channel === 'sms' ? 'default' : 'outline'}
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => setChannel('sms')}
                >
                  <MessageSquare className="h-6 w-6" />
                  <span>SMS</span>
                </Button>
                <Button
                  variant={channel === 'email' ? 'default' : 'outline'}
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => setChannel('email')}
                >
                  <Mail className="h-6 w-6" />
                  <span>Email</span>
                </Button>
                <Button
                  variant={channel === 'ai-call' ? 'default' : 'outline'}
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => setChannel('ai-call')}
                >
                  <Phone className="h-6 w-6" />
                  <span>AI Call</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Target Groups */}
          <Card>
            <CardHeader>
              <CardTitle>Select Recipients</CardTitle>
              <CardDescription>Choose which groups will receive this broadcast</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {targetGroups.map(group => (
                  <div
                    key={group.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedTargets.includes(group.id)
                        ? 'bg-primary/10 border-primary/50'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => toggleTarget(group.id)}
                  >
                    <Checkbox checked={selectedTargets.includes(group.id)} />
                    <div>
                      <p className="font-medium text-sm">{group.label}</p>
                      <p className="text-xs text-muted-foreground">{group.count} contacts</p>
                    </div>
                  </div>
                ))}
              </div>
              {selectedTargets.length > 0 && (
                <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <p className="text-sm">
                    <span className="font-medium">{getTotalRecipients()}</span> total recipients selected
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Message Composition */}
          <Card>
            <CardHeader>
              <CardTitle>Compose Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {channel === 'email' && (
                <div className="space-y-2">
                  <Label>Subject Line</Label>
                  <Input
                    placeholder="Enter email subject..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  placeholder={
                    channel === 'sms' ? 'Enter SMS message (160 chars recommended)...' :
                    channel === 'email' ? 'Enter email body...' :
                    'Enter AI call script...'
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[150px]"
                />
                {channel === 'sms' && (
                  <p className="text-xs text-muted-foreground">
                    {message.length}/160 characters
                  </p>
                )}
              </div>
              <Button
                onClick={handleSend}
                disabled={isSending || selectedTargets.length === 0 || !message.trim()}
                className="w-full"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Broadcast to {getTotalRecipients()} Recipients
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Broadcast Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Contacts</span>
                <span className="font-medium">293</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Broadcasts This Week</span>
                <span className="font-medium">4</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Avg Delivery Rate</span>
                <span className="font-medium text-green-500">98.2%</span>
              </div>
            </CardContent>
          </Card>

          {/* Recent Broadcasts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Broadcasts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentBroadcasts.map(broadcast => (
                  <div key={broadcast.id} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-xs">
                        {broadcast.channel}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{broadcast.sent}</span>
                    </div>
                    <p className="text-sm font-medium">{broadcast.target}</p>
                    <p className="text-xs text-muted-foreground truncate">{broadcast.message}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      <span className="text-xs text-green-500">{broadcast.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
