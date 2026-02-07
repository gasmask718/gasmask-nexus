/**
 * LastSuccessfulContactBadge — Shows the most recent contact who actually responded.
 *
 * Identifies the contact with the latest confirmed response across:
 *   - Inbound text (last_text_received_at)
 *   - Answered call (last_call_answered_at)
 *
 * Informational badge. Not interactive. Updates automatically.
 */

import { CheckCircle2, MessageSquare, Phone } from 'lucide-react';

interface LastSuccessfulContactBadgeProps {
  contacts: Array<{
    id: string;
    name: string;
    last_text_received_at: string | null;
    last_call_answered_at: string | null;
  }>;
  /** If the best contact is the same person, skip rendering to avoid redundancy */
  bestContactId: string | null;
}

export function LastSuccessfulContactBadge({ contacts, bestContactId }: LastSuccessfulContactBadgeProps) {
  const result = deriveLastSuccessful(contacts);

  if (!result) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/20 border border-border/30 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5" />
        No confirmed responses yet
      </div>
    );
  }

  const isSameAsBest = result.contactId === bestContactId;
  const ChannelIcon = result.channel === 'text' ? MessageSquare : Phone;
  const channelLabel = result.channel === 'text' ? 'Text' : 'Call';

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/20 border border-border/30 text-xs">
      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
      <span className="text-muted-foreground">Last Successful:</span>
      <span className="font-medium truncate">
        {isSameAsBest ? 'Same as best contact' : result.name}
      </span>
      <span className="text-muted-foreground">·</span>
      <ChannelIcon className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{channelLabel}</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">{result.relative}</span>
    </div>
  );
}

// ─── Derivation ────────────────────────────────────────

interface SuccessfulContact {
  contactId: string;
  name: string;
  channel: 'text' | 'call';
  relative: string;
}

function deriveLastSuccessful(contacts: LastSuccessfulContactBadgeProps['contacts']): SuccessfulContact | null {
  let best: { contactId: string; name: string; channel: 'text' | 'call'; timestamp: number } | null = null;

  for (const c of contacts) {
    const textTime = c.last_text_received_at ? new Date(c.last_text_received_at).getTime() : 0;
    const callTime = c.last_call_answered_at ? new Date(c.last_call_answered_at).getTime() : 0;

    const contactBest = textTime >= callTime
      ? { channel: 'text' as const, timestamp: textTime }
      : { channel: 'call' as const, timestamp: callTime };

    if (contactBest.timestamp > 0 && (!best || contactBest.timestamp > best.timestamp)) {
      best = { contactId: c.id, name: c.name, channel: contactBest.channel, timestamp: contactBest.timestamp };
    }
  }

  if (!best) return null;

  return {
    contactId: best.contactId,
    name: best.name,
    channel: best.channel,
    relative: formatRelativeTime(best.timestamp),
  };
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1d ago';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
