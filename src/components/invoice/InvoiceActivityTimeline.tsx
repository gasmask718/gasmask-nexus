import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Ban, 
  Clock,
  Phone,
  Loader2,
  MessageSquare,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';

interface TimelineEvent {
  id: string;
  type: 'invoice_created' | 'receipt_queued' | 'receipt_sent' | 'receipt_delivered' | 'receipt_failed' | 'receipt_blocked' | 'receipt_skipped';
  timestamp: string;
  description: string;
  metadata?: {
    phone?: string;
    error?: string;
    source?: string;
    message_sid?: string;
    sent_reason?: string;
  };
}

interface InvoiceActivityTimelineProps {
  invoiceId: string;
  invoiceCreatedAt?: string;
  invoiceCreatedBy?: string;
}

const EVENT_CONFIG: Record<TimelineEvent['type'], {
  icon: typeof FileText;
  color: string;
  bgColor: string;
  label: string;
}> = {
  invoice_created: {
    icon: FileText,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    label: 'Invoice Created',
  },
  receipt_queued: {
    icon: Clock,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    label: 'Receipt Queued',
  },
  receipt_sent: {
    icon: Send,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    label: 'Receipt Sent',
  },
  receipt_delivered: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    label: 'Receipt Delivered',
  },
  receipt_failed: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    label: 'Receipt Failed',
  },
  receipt_blocked: {
    icon: Ban,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    label: 'Receipt Blocked',
  },
  receipt_skipped: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    label: 'Receipt Skipped',
  },
};

export function InvoiceActivityTimeline({ 
  invoiceId, 
  invoiceCreatedAt,
  invoiceCreatedBy 
}: InvoiceActivityTimelineProps) {
  // Fetch receipt log events for this invoice
  const { data: receiptLogs, isLoading } = useQuery({
    queryKey: ['invoice-receipt-logs', invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_receipt_log')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!invoiceId,
  });

  // Build unified timeline from invoice creation + receipt logs
  const buildTimeline = (): TimelineEvent[] => {
    const events: TimelineEvent[] = [];

    // 1. Invoice Created (always first)
    if (invoiceCreatedAt) {
      events.push({
        id: 'invoice-created',
        type: 'invoice_created',
        timestamp: invoiceCreatedAt,
        description: invoiceCreatedBy 
          ? `Invoice created by ${invoiceCreatedBy}` 
          : 'Invoice created',
      });
    }

    // 2. Receipt lifecycle events from receipt_log
    if (receiptLogs) {
      for (const log of receiptLogs) {
        const status = log.delivery_status as string;
        const sentReason = log.sent_reason as string;
        
        // Map delivery_status to timeline event type
        let eventType: TimelineEvent['type'];
        let description: string;

        switch (status) {
          case 'queued':
          case 'pending':
            eventType = 'receipt_queued';
            description = 'Receipt queued for SMS delivery';
            break;
          case 'sent':
            eventType = 'receipt_sent';
            description = log.phone_number 
              ? `Receipt text sent to ${log.phone_number}`
              : 'Receipt text sent';
            break;
          case 'delivered':
            eventType = 'receipt_delivered';
            description = 'Receipt confirmed delivered';
            break;
          case 'failed':
          case 'undelivered':
            eventType = 'receipt_failed';
            description = log.error_message 
              ? `Receipt failed: ${log.error_message}`
              : 'Receipt delivery failed';
            break;
          case 'blocked':
            eventType = 'receipt_blocked';
            description = 'Receipt blocked (historical record)';
            break;
          case 'skipped':
            eventType = 'receipt_skipped';
            description = log.error_message 
              ? `Receipt skipped: ${log.error_message}`
              : 'Receipt skipped';
            break;
          default:
            eventType = 'receipt_queued';
            description = `Receipt status: ${status}`;
        }

        events.push({
          id: log.id,
          type: eventType,
          timestamp: log.sent_at || log.created_at || new Date().toISOString(),
          description,
          metadata: {
            phone: log.phone_number !== 'MISSING' && log.phone_number !== 'N/A' 
              ? log.phone_number 
              : undefined,
            error: log.error_message || undefined,
            message_sid: log.message_sid || undefined,
            sent_reason: sentReason,
          },
        });

        // If we have a delivered_at separate from sent_at, add delivery confirmation
        if (log.delivered_at && log.delivery_status === 'delivered') {
          events.push({
            id: `${log.id}-delivered`,
            type: 'receipt_delivered',
            timestamp: log.delivered_at,
            description: 'Carrier confirmed delivery',
            metadata: {
              phone: log.phone_number,
            },
          });
        }
      }
    }

    // Sort by timestamp
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return events;
  };

  const timeline = buildTimeline();

  if (isLoading) {
    return (
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Invoice Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Invoice Activity
          <Badge variant="secondary" className="ml-auto text-xs">
            {timeline.length} {timeline.length === 1 ? 'event' : 'events'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No activity recorded yet
          </p>
        ) : (
          <div className="relative">
            {/* Timeline connector line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
            
            <div className="space-y-4">
              {timeline.map((event, index) => {
                const config = EVENT_CONFIG[event.type];
                const Icon = config.icon;
                const isLast = index === timeline.length - 1;

                return (
                  <div key={event.id} className="relative flex items-start gap-3 pl-1">
                    {/* Icon container */}
                    <div className={`
                      relative z-10 flex items-center justify-center 
                      w-7 h-7 rounded-full ${config.bgColor}
                      ${isLast ? 'ring-2 ring-background' : ''}
                    `}>
                      <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${config.color}`}>
                          {config.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.timestamp), 'MMM d, yyyy, h:mm a')}
                        </span>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {event.description}
                      </p>

                      {/* Metadata details */}
                      {event.metadata?.phone && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{event.metadata.phone}</span>
                        </div>
                      )}

                      {event.metadata?.sent_reason && event.metadata.sent_reason !== 'auto_live' && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          {event.metadata.sent_reason === 'manual_resend' ? 'Manual Resend' : 
                           event.metadata.sent_reason === 'blocked_historical' ? 'Historical Record' :
                           event.metadata.sent_reason}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
