/**
 * COMMUNICATIONS DISPLAY WINDOW
 * 
 * The single source of truth for all worker and office communications.
 * Features:
 * - Unified communication timeline
 * - Grouped view by worker
 * - Worker context panel
 * - Full filtering (channel, status, date, worker)
 * - Send message actions
 * - Batch awareness display
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
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
  Plus,
  Send,
  User
} from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// Sub-components
import { CommunicationFilters } from './communication/CommunicationFilters';
import { CommunicationTimelineEntry } from './communication/CommunicationTimelineEntry';
import { GroupedCommunicationView } from './communication/GroupedCommunicationView';
import { WorkerContextPanel } from './communication/WorkerContextPanel';

interface CommunicationsLogProps {
  officeId: string;
  limit?: number;
}

const CHANNEL_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  sms: { label: 'SMS', icon: <MessageSquare className="h-4 w-4" /> },
  whatsapp: { label: 'WhatsApp', icon: <MessageSquare className="h-4 w-4" /> },
  call: { label: 'Call', icon: <Phone className="h-4 w-4" /> },
};

export function CommunicationsLog({ officeId, limit = 100 }: CommunicationsLogProps) {
  const { data: communications = [], isLoading } = useProductionCommunications(officeId, limit);
  const { data: workers = [] } = useProductionWorkers(officeId);
  const logCommunication = useLogCommunication();
  const { initiateMessage } = useMessage();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  // UI State
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [selectedWorkerContext, setSelectedWorkerContext] = useState<any>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [workerFilter, setWorkerFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'grouped' | 'timeline'>('timeline');
  
  // New message form state
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'sms' | 'whatsapp' | 'call'>('sms');
  const [messageBody, setMessageBody] = useState('');

  // Auto-scroll on new messages
  const prevLengthRef = useRef(communications.length);
  useEffect(() => {
    if (communications.length > prevLengthRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    prevLengthRef.current = communications.length;
  }, [communications.length]);

  // Filter communications
  const filteredCommunications = useMemo(() => {
    return communications.filter((comm: any) => {
      // Search filter
      const matchesSearch = searchTerm === '' || 
        comm.worker?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comm.message_body?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comm.phone_used?.includes(searchTerm);
      
      // Channel filter
      const matchesChannel = channelFilter === 'all' || comm.channel === channelFilter;
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || comm.status === statusFilter;
      
      // Worker filter
      const matchesWorker = workerFilter === 'all' || comm.worker_id === workerFilter;
      
      // Date range filter
      let matchesDate = true;
      if (dateRange?.from) {
        const commDate = new Date(comm.created_at);
        const from = startOfDay(dateRange.from);
        const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        matchesDate = isWithinInterval(commDate, { start: from, end: to });
      }
      
      return matchesSearch && matchesChannel && matchesStatus && matchesWorker && matchesDate;
    });
  }, [communications, searchTerm, channelFilter, statusFilter, workerFilter, dateRange]);

  // Get last contact for selected worker
  const selectedWorkerLastContact = useMemo(() => {
    if (!selectedWorkerContext) return null;
    const workerComms = communications.filter(
      (c: any) => c.worker_id === selectedWorkerContext.id
    );
    return workerComms.length > 0 ? workerComms[0].created_at : null;
  }, [selectedWorkerContext, communications]);

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

    // Use global message provider
    initiateMessage({
      destinationPhone: phone,
      entityType: 'other',
      entityId: worker.id,
      entityName: worker.full_name,
      channel: selectedChannel === 'call' ? 'sms' : selectedChannel,
    });

    // Log to production communications
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
    if (!worker) return;
    
    const fullWorker = workers.find((w: any) => w.id === worker.id);
    const phone = fullWorker?.phone || fullWorker?.whatsapp;
    
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

    // Log the attempt
    logCommunication.mutate({
      officeId,
      workerId: worker.id,
      channel,
      phoneUsed: phone,
    });
  };

  const handleWorkerClick = (worker: any) => {
    if (!worker) return;
    const fullWorker = workers.find((w: any) => w.id === worker.id);
    setSelectedWorkerContext(fullWorker || worker);
  };

  const handleContextAction = (channel: 'sms' | 'whatsapp' | 'call') => {
    if (selectedWorkerContext) {
      handleQuickContact(selectedWorkerContext, channel);
    }
  };

  return (
    <div className="flex gap-4">
      {/* Main Communications Panel */}
      <Card className="flex-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Communications
            </CardTitle>
            <Button size="sm" onClick={() => setShowNewMessage(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New Message
            </Button>
          </div>
          
          {/* Filters */}
          <CommunicationFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            channelFilter={channelFilter}
            onChannelChange={setChannelFilter}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            workerFilter={workerFilter}
            onWorkerChange={setWorkerFilter}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            workers={workers.map((w: any) => ({ id: w.id, full_name: w.full_name }))}
          />
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredCommunications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">
                {communications.length === 0 
                  ? 'No communication recorded yet for this office'
                  : 'No communications match your filters'}
              </p>
              <p className="text-sm mt-1">
                {communications.length === 0 
                  ? 'Start by sending a message to a worker'
                  : 'Try adjusting your search or filters'}
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4" 
                onClick={() => setShowNewMessage(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Send First Message
              </Button>
            </div>
          ) : viewMode === 'grouped' ? (
            <GroupedCommunicationView
              communications={filteredCommunications}
              onWorkerClick={handleWorkerClick}
              onQuickContact={handleQuickContact}
            />
          ) : (
            <ScrollArea className="h-[500px] pr-4" ref={scrollRef}>
              <div className="space-y-3">
                {filteredCommunications.map((comm: any) => (
                  <CommunicationTimelineEntry
                    key={comm.id}
                    entry={comm}
                    onWorkerClick={handleWorkerClick}
                    onQuickContact={handleQuickContact}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Worker Context Panel */}
      {selectedWorkerContext && (
        <WorkerContextPanel
          worker={selectedWorkerContext}
          lastContactAt={selectedWorkerLastContact}
          onClose={() => setSelectedWorkerContext(null)}
          onAction={handleContextAction}
        />
      )}

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
    </div>
  );
}
