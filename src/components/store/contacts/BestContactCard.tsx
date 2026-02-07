/**
 * BestContactCard — Dedicated highlight for the single best contact at a store.
 *
 * Selection logic (deterministic, explainable):
 *   1. Most recently responded (last_responded_at)
 *   2. Tie → highest responsiveness (text or call rates)
 *   3. Tie → is_primary flag
 *   4. Tie → most recently created
 *
 * READ-ONLY. No actions. Appears above the contact list in Quick Stats.
 */

import { Star, MessageSquare, Phone, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BestContactCardProps {
  contact: {
    id: string;
    name: string;
    phone: string | null;
    responsive_by_text: boolean | null;
    responsive_by_call: boolean | null;
    responsiveness_status: string | null;
    last_text_received_at: string | null;
    last_call_answered_at: string | null;
  };
}

export function BestContactCard({ contact }: BestContactCardProps) {
  const preferredChannel = derivePreferredChannel(contact);
  const statusLabel = getStatusLabel(contact.responsiveness_status);

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <Star className="h-3.5 w-3.5" />
        Best Contact
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{contact.name}</p>
          {contact.phone && (
            <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
          {/* Preferred channel */}
          <div className="flex items-center gap-1">
            <span className="hidden sm:inline">Preferred:</span>
            {preferredChannel.icon}
            <span className={cn(
              preferredChannel.channel !== 'none' && 'font-medium text-foreground'
            )}>
              {preferredChannel.label}
            </span>
          </div>

          {/* Status */}
          <span className={cn(
            'px-1.5 py-0.5 rounded text-[10px] font-medium',
            statusLabel.className
          )}>
            {statusLabel.label}
          </span>
        </div>
      </div>
    </div>
  );
}

function derivePreferredChannel(contact: BestContactCardProps['contact']) {
  const textResponsive = contact.responsive_by_text === true;
  const callResponsive = contact.responsive_by_call === true;

  if (textResponsive && callResponsive) {
    // Both responsive → prefer whichever responded more recently
    const textTime = contact.last_text_received_at ? new Date(contact.last_text_received_at).getTime() : 0;
    const callTime = contact.last_call_answered_at ? new Date(contact.last_call_answered_at).getTime() : 0;
    return textTime >= callTime
      ? { channel: 'text', label: 'Text', icon: <MessageSquare className="h-3.5 w-3.5 text-green-500" /> }
      : { channel: 'call', label: 'Call', icon: <Phone className="h-3.5 w-3.5 text-green-500" /> };
  }
  if (textResponsive) {
    return { channel: 'text', label: 'Text', icon: <MessageSquare className="h-3.5 w-3.5 text-green-500" /> };
  }
  if (callResponsive) {
    return { channel: 'call', label: 'Call', icon: <Phone className="h-3.5 w-3.5 text-green-500" /> };
  }
  return { channel: 'none', label: 'Unknown', icon: <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /> };
}

function getStatusLabel(status: string | null) {
  if (status === 'responsive') {
    return { label: 'Responsive', className: 'bg-green-500/10 text-green-600 dark:text-green-400' };
  }
  if (status === 'unresponsive') {
    return { label: 'Unresponsive', className: 'bg-red-500/10 text-red-600 dark:text-red-400' };
  }
  return { label: 'Limited Data', className: 'bg-muted text-muted-foreground' };
}
