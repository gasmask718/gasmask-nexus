/**
 * COMMUNICATION TIMELINE ENTRY
 * 
 * Single entry in the communication timeline.
 * Shows channel, direction, status, worker, message, and batch info.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MessageSquare, 
  Phone, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Send,
  User,
  ArrowDownLeft,
  ArrowUpRight,
  Package
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface CommunicationEntry {
  id: string;
  channel: string;
  direction: string;
  status: string;
  message_body?: string;
  phone_used?: string;
  created_at: string;
  error_message?: string;
  batch_id?: string;
  worker?: {
    id: string;
    full_name: string;
    role?: string;
  } | null;
}

interface CommunicationTimelineEntryProps {
  entry: CommunicationEntry;
  onWorkerClick?: (worker: CommunicationEntry['worker']) => void;
  onQuickContact?: (worker: CommunicationEntry['worker'], channel: 'sms' | 'call') => void;
}

const CHANNEL_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  sms: { label: 'SMS', icon: <MessageSquare className="h-4 w-4" />, color: 'text-blue-600' },
  whatsapp: { label: 'WhatsApp', icon: <MessageSquare className="h-4 w-4" />, color: 'text-emerald-600' },
  call: { label: 'Call', icon: <Phone className="h-4 w-4" />, color: 'text-purple-600' },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  queued: { label: 'Queued', icon: <Clock className="h-3 w-3" />, color: 'bg-muted text-muted-foreground' },
  sent: { label: 'Sent', icon: <Send className="h-3 w-3" />, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  delivered: { label: 'Delivered', icon: <CheckCircle className="h-3 w-3" />, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  failed: { label: 'Failed', icon: <XCircle className="h-3 w-3" />, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  read: { label: 'Read', icon: <CheckCircle className="h-3 w-3" />, color: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800/30 dark:text-emerald-200' },
};

export function CommunicationTimelineEntry({ 
  entry, 
  onWorkerClick,
  onQuickContact 
}: CommunicationTimelineEntryProps) {
  const channelConfig = CHANNEL_CONFIG[entry.channel] || CHANNEL_CONFIG.sms;
  const statusConfig = STATUS_CONFIG[entry.status] || STATUS_CONFIG.queued;
  const isInbound = entry.direction === 'inbound';

  return (
    <div 
      className={cn(
        "p-3 rounded-lg space-y-2 transition-colors border",
        "bg-card hover:bg-muted/50",
        isInbound && "border-l-4 border-l-accent"
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Direction indicator */}
          {isInbound ? (
            <ArrowDownLeft className="h-4 w-4 text-accent" />
          ) : (
            <ArrowUpRight className="h-4 w-4 text-primary" />
          )}
          
          {/* Channel */}
          <div className={cn('flex items-center gap-1', channelConfig.color)}>
            {channelConfig.icon}
            <span className="text-sm font-medium">{channelConfig.label}</span>
          </div>
          
          {/* Status */}
          <Badge className={cn('text-xs', statusConfig.color)}>
            {statusConfig.icon}
            <span className="ml-1">{statusConfig.label}</span>
          </Badge>

          {/* Batch badge if applicable */}
          {entry.batch_id && (
            <Badge variant="outline" className="text-xs">
              <Package className="h-3 w-3 mr-1" />
              Batch
            </Badge>
          )}
        </div>
        
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
        </span>
      </div>
      
      {/* Content row */}
      <div className="text-sm">
        <button 
          type="button"
          className="text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
          onClick={() => entry.worker && onWorkerClick?.(entry.worker)}
        >
          <User className="h-3 w-3" />
          {isInbound ? 'From:' : 'To:'}{' '}
          <span className="font-medium text-foreground">
            {entry.worker?.full_name || entry.phone_used || 'Unknown'}
          </span>
          {entry.worker?.role && (
            <span className="text-xs text-muted-foreground capitalize">
              ({entry.worker.role})
            </span>
          )}
        </button>
        
        {entry.message_body && (
          <p className="mt-2 text-foreground bg-muted/50 rounded p-2 text-xs whitespace-pre-wrap">
            {entry.message_body}
          </p>
        )}
        
        {entry.error_message && (
          <p className="mt-1 text-destructive text-xs flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            {entry.error_message}
          </p>
        )}
      </div>
      
      {/* Footer row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}</span>
        {entry.worker && onQuickContact && (
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => onQuickContact(entry.worker, 'sms')}
            >
              <MessageSquare className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => onQuickContact(entry.worker, 'call')}
            >
              <Phone className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
