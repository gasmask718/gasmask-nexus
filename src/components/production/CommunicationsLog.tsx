/**
 * COMMUNICATIONS LOG COMPONENT
 * 
 * Displays all logged communications for an office.
 * SMS, WhatsApp, calls - all auditable.
 * Includes action buttons to initiate new communications.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  useProductionCommunications, 
  useProductionWorkers, 
  useLogCommunication 
} from '@/hooks/useProductionPortal';
import { useMessage } from '@/components/communication/MessageProvider';
import { 
  MessageSquare, 
  Phone, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Send, 
  Plus,
  Search,
  Filter,
  User
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface CommunicationsLogProps {
  officeId: string;
  limit?: number;
}

const CHANNEL_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  sms: { label: 'SMS', icon: <MessageSquare className="h-4 w-4" />, color: 'text-blue-600' },
  whatsapp: { label: 'WhatsApp', icon: <MessageSquare className="h-4 w-4" />, color: 'text-emerald-600' },
  call: { label: 'Call', icon: <Phone className="h-4 w-4" />, color: 'text-purple-600' },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  queued: { label: 'Queued', icon: <Clock className="h-3 w-3" />, color: 'bg-muted text-muted-foreground' },
  sent: { label: 'Sent', icon: <Send className="h-3 w-3" />, color: 'bg-blue-100 text-blue-800' },
  delivered: { label: 'Delivered', icon: <CheckCircle className="h-3 w-3" />, color: 'bg-emerald-100 text-emerald-800' },
  failed: { label: 'Failed', icon: <XCircle className="h-3 w-3" />, color: 'bg-red-100 text-red-800' },
  read: { label: 'Read', icon: <CheckCircle className="h-3 w-3" />, color: 'bg-emerald-200 text-emerald-900' },
};

export function CommunicationsLog({ officeId, limit = 50 }: CommunicationsLogProps) {
  const { data: communications = [], isLoading } = useProductionCommunications(officeId, limit);
  const { data: workers = [] } = useProductionWorkers(officeId);
  const logCommunication = useLogCommunication();
  const { initiateMessage } = useMessage();
  const { toast } = useToast();

  const [showNewMessage, setShowNewMessage] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  
  // New message form state
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<'sms' | 'whatsapp' | 'call'>('sms');
  const [messageBody, setMessageBody] = useState('');

  // Filter communications
  const filteredCommunications = communications.filter((comm: any) => {
    const matchesSearch = searchTerm === '' || 
      comm.worker?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comm.message_body?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comm.phone_used?.includes(searchTerm);
    
    const matchesChannel = channelFilter === 'all' || comm.channel === channelFilter;
    
    return matchesSearch && matchesChannel;
  });

  const handleSendMessage = async () => {
    const worker = workers.find((w: any) => w.id === selectedWorkerId);
    if (!worker) {
      toast({
        title: 'Select a worker',
        description: 'Please select a worker to message.',
        variant: 'destructive',
      });
      return;
    }

    const phone = worker.phone || worker.whatsapp;
    if (!phone) {
      toast({
        title: 'No phone number',
        description: 'This worker has no phone number on file.',
        variant: 'destructive',
      });
      return;
    }

    // Use the global message provider to open the modal
    initiateMessage({
      destinationPhone: phone,
      entityType: 'other',
      entityId: worker.id,
      entityName: worker.full_name,
      channel: selectedChannel === 'call' ? 'sms' : selectedChannel,
    });

    // Also log to production communications
    try {
      await logCommunication.mutateAsync({
        officeId,
        workerId: worker.id,
        channel: selectedChannel,
        phoneUsed: phone,
        messageBody: messageBody || undefined,
      });

      toast({
        title: 'Communication logged',
        description: `${CHANNEL_CONFIG[selectedChannel].label} to ${worker.full_name} recorded.`,
      });

      // Reset form
      setShowNewMessage(false);
      setSelectedWorkerId('');
      setMessageBody('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to log communication.',
        variant: 'destructive',
      });
    }
  };

  const handleQuickContact = (worker: any, channel: 'sms' | 'whatsapp' | 'call') => {
    const phone = worker.phone || worker.whatsapp;
    if (!phone) {
      toast({
        title: 'No phone number',
        description: 'This worker has no phone number on file.',
        variant: 'destructive',
      });
      return;
    }

    initiateMessage({
      destinationPhone: phone,
      entityType: 'other',
      entityId: worker.id,
      entityName: worker.full_name,
      channel: channel === 'call' ? 'sms' : channel,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Communications Log
          </CardTitle>
          <Button size="sm" onClick={() => setShowNewMessage(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Message
          </Button>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by worker or message..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-[130px] h-9">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="call">Call</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredCommunications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>{searchTerm || channelFilter !== 'all' ? 'No matching communications.' : 'No communications logged yet.'}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowNewMessage(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Send First Message
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {filteredCommunications.map((comm: any) => {
                const channelConfig = CHANNEL_CONFIG[comm.channel] || CHANNEL_CONFIG.sms;
                const statusConfig = STATUS_CONFIG[comm.status] || STATUS_CONFIG.queued;
                
                return (
                  <div 
                    key={comm.id} 
                    className="p-3 bg-muted/50 rounded-lg space-y-2 hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn('flex items-center gap-1', channelConfig.color)}>
                          {channelConfig.icon}
                          <span className="text-sm font-medium">{channelConfig.label}</span>
                        </div>
                        <Badge className={cn('text-xs', statusConfig.color)}>
                          {statusConfig.icon}
                          <span className="ml-1">{statusConfig.label}</span>
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comm.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    
                    <div className="text-sm">
                      <p className="text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        To: <span className="font-medium text-foreground">
                          {comm.worker?.full_name || comm.phone_used}
                        </span>
                      </p>
                      {comm.message_body && (
                        <p className="mt-1 text-foreground line-clamp-2 bg-background/50 rounded p-2 text-xs">
                          {comm.message_body}
                        </p>
                      )}
                      {comm.error_message && (
                        <p className="mt-1 text-destructive text-xs">
                          Error: {comm.error_message}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{format(new Date(comm.created_at), 'MMM d, yyyy h:mm a')}</span>
                      {comm.worker && (
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => handleQuickContact(comm.worker, 'sms')}
                          >
                            <MessageSquare className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => handleQuickContact(comm.worker, 'call')}
                          >
                            <Phone className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* New Message Dialog */}
      <Dialog open={showNewMessage} onOpenChange={setShowNewMessage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Communication</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Worker</label>
              <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a worker..." />
                </SelectTrigger>
                <SelectContent>
                  {workers.filter((w: any) => w.status === 'active').map((worker: any) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {worker.full_name}
                        {(worker.phone || worker.whatsapp) && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {worker.phone || worker.whatsapp}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Channel</label>
              <div className="flex gap-2">
                {(['sms', 'whatsapp', 'call'] as const).map((channel) => {
                  const config = CHANNEL_CONFIG[channel];
                  return (
                    <Button
                      key={channel}
                      type="button"
                      variant={selectedChannel === channel ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedChannel(channel)}
                      className={cn(
                        selectedChannel === channel && 'ring-2 ring-offset-2',
                        'flex-1'
                      )}
                    >
                      {config.icon}
                      <span className="ml-1">{config.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {selectedChannel !== 'call' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Message (optional)</label>
                <Textarea
                  placeholder="Enter your message..."
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewMessage(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendMessage}
              disabled={!selectedWorkerId || logCommunication.isPending}
            >
              {logCommunication.isPending ? (
                <>Sending...</>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  {selectedChannel === 'call' ? 'Log Call' : 'Send'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
