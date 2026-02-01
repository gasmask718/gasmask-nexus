/**
 * COMMUNICATIONS LOG COMPONENT
 * 
 * Displays all logged communications for an office.
 * SMS, WhatsApp, calls - all auditable.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProductionCommunications } from '@/hooks/useProductionPortal';
import { MessageSquare, Phone, Mail, CheckCircle, XCircle, Clock, Send } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Communications Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : communications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No communications logged yet.</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {communications.map((comm: any) => {
                const channelConfig = CHANNEL_CONFIG[comm.channel] || CHANNEL_CONFIG.sms;
                const statusConfig = STATUS_CONFIG[comm.status] || STATUS_CONFIG.queued;
                
                return (
                  <div 
                    key={comm.id} 
                    className="p-3 bg-muted/50 rounded-lg space-y-2"
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
                      <p className="text-muted-foreground">
                        To: <span className="font-medium text-foreground">
                          {comm.worker?.full_name || comm.phone_used}
                        </span>
                      </p>
                      {comm.message_body && (
                        <p className="mt-1 text-foreground line-clamp-2">
                          {comm.message_body}
                        </p>
                      )}
                      {comm.error_message && (
                        <p className="mt-1 text-red-600 text-xs">
                          Error: {comm.error_message}
                        </p>
                      )}
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(comm.created_at), 'MMM d, yyyy h:mm a')}
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
