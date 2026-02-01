/**
 * PRODUCTION HISTORY COMPONENT
 * 
 * Audit log and activity timeline for production events.
 * Shows batch lifecycle, output recordings, status changes.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProductionHistory, ProductionHistory as HistoryItem } from '@/hooks/useProductionPortal';
import { History, Package, Play, CheckCircle, XCircle, Users, Wrench, MessageSquare } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface ProductionHistoryProps {
  officeId: string;
  limit?: number;
}

const EVENT_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  batch_created: { label: 'Batch Created', icon: <Package className="h-4 w-4" />, color: 'text-blue-600' },
  batch_started: { label: 'Batch Started', icon: <Play className="h-4 w-4" />, color: 'text-amber-600' },
  batch_completed: { label: 'Batch Completed', icon: <CheckCircle className="h-4 w-4" />, color: 'text-emerald-600' },
  batch_cancelled: { label: 'Batch Cancelled', icon: <XCircle className="h-4 w-4" />, color: 'text-red-600' },
  output_recorded: { label: 'Output Recorded', icon: <Package className="h-4 w-4" />, color: 'text-primary' },
  input_updated: { label: 'Inputs Updated', icon: <Package className="h-4 w-4" />, color: 'text-muted-foreground' },
  worker_assigned: { label: 'Worker Assigned', icon: <Users className="h-4 w-4" />, color: 'text-blue-600' },
  worker_removed: { label: 'Worker Removed', icon: <Users className="h-4 w-4" />, color: 'text-muted-foreground' },
  tool_status_changed: { label: 'Tool Status Changed', icon: <Wrench className="h-4 w-4" />, color: 'text-amber-600' },
  note_added: { label: 'Note Added', icon: <MessageSquare className="h-4 w-4" />, color: 'text-muted-foreground' },
  message_sent: { label: 'Message Sent', icon: <MessageSquare className="h-4 w-4" />, color: 'text-blue-600' },
};

export function ProductionHistoryPanel({ officeId, limit = 50 }: ProductionHistoryProps) {
  const { data: history = [], isLoading } = useProductionHistory(officeId, limit);

  const formatEventData = (event: HistoryItem) => {
    const data = event.event_data || {};
    const parts: string[] = [];

    if (data.brand) parts.push(data.brand);
    if (data.shift) parts.push(data.shift);
    if (data.boxes_completed) parts.push(`${data.boxes_completed} boxes`);
    if (data.old_status && data.new_status) {
      parts.push(`${data.old_status} → ${data.new_status}`);
    }

    return parts.join(' • ');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5" />
          Activity History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 bg-muted animate-pulse rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                  <div className="h-3 bg-muted animate-pulse rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No activity recorded yet.</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {history.map((event, index) => {
                const config = EVENT_CONFIG[event.event_type] || {
                  label: event.event_type,
                  icon: <History className="h-4 w-4" />,
                  color: 'text-muted-foreground',
                };

                return (
                  <div key={event.id} className="flex gap-3">
                    {/* Timeline connector */}
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center bg-muted',
                        config.color
                      )}>
                        {config.icon}
                      </div>
                      {index < history.length - 1 && (
                        <div className="w-px h-full bg-border mt-2" />
                      )}
                    </div>

                    {/* Event content */}
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{config.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      
                      {formatEventData(event) && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatEventData(event)}
                        </p>
                      )}
                      
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(event.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
