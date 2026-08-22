/**
 * InviteDeliveryInfo — shows which channels an ambassador invite was sent over
 * (SMS / email), whether each succeeded, and when the last send happened.
 * Reads ambassador_invite_events rows of type 'sent' (already written by the
 * send-ambassador-invite edge function).
 */
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Mail } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface InviteSendEvent {
  invite_id: string;
  created_at: string;
  metadata: any;
}

export function InviteDeliveryInfo({ events }: { events: InviteSendEvent[] }) {
  if (!events || events.length === 0) {
    return <span className="text-xs text-muted-foreground">Not sent yet</span>;
  }

  const latest = events[0]; // hook returns newest first
  const logs: any[] = (latest.metadata as any)?.send_log ?? [];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1 flex-wrap">
        {logs.length === 0 && (
          <span className="text-xs text-muted-foreground">—</span>
        )}
        {logs.map((l, i) => (
          <Badge
            key={i}
            variant={l.ok ? 'secondary' : 'destructive'}
            className="text-[10px] px-1.5 py-0 flex items-center gap-1"
            title={l.ok ? `Delivered to ${l.to ?? ''}` : (l.error || 'Send failed')}
          >
            {l.channel === 'sms'
              ? <MessageSquare className="h-2.5 w-2.5" />
              : <Mail className="h-2.5 w-2.5" />}
            {l.channel}{l.ok ? '' : ' failed'}
          </Badge>
        ))}
        {events.length > 1 && (
          <span className="text-[10px] text-muted-foreground self-center">×{events.length} sends</span>
        )}
      </div>
      <span className="text-[11px] text-muted-foreground">
        {formatDistanceToNow(new Date(latest.created_at), { addSuffix: true })}
      </span>
    </div>
  );
}

export default InviteDeliveryInfo;
