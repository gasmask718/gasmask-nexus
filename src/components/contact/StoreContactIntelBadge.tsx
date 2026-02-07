/**
 * StoreContactIntelBadge — Compact contact intelligence for field portals & route planning.
 *
 * Shows: Primary contact name ⭐ · best channel · last response time
 * Read-only. No actions. Used in:
 *   - Route Planning stop previews
 *   - Driver/Biker portal store cards
 *   - StoreListPage rows
 */

import { Star, MessageSquare, Phone, AlertCircle } from 'lucide-react';
import { type PrimaryResponsiveContact } from '@/hooks/usePrimaryResponsiveContact';
import { cn } from '@/lib/utils';

interface StoreContactIntelBadgeProps {
  contact: PrimaryResponsiveContact | null | undefined;
  compact?: boolean;
  className?: string;
}

export function StoreContactIntelBadge({ contact, compact = false, className }: StoreContactIntelBadgeProps) {
  if (!contact) {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
        <AlertCircle className="h-3 w-3" />
        <span>No contact intel</span>
      </div>
    );
  }

  const ChannelIcon = contact.best_channel === 'text' ? MessageSquare : Phone;
  const channelLabel = contact.best_channel === 'text' ? 'Text responsive'
    : contact.best_channel === 'call' ? 'Call responsive'
    : 'Unresponsive';

  const isResponsive = contact.responsiveness_status === 'responsive';

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs truncate', className)}>
        <Star className="h-3 w-3 text-amber-500 shrink-0" />
        <span className="font-medium truncate">{contact.name}</span>
        <span className="text-muted-foreground">·</span>
        <ChannelIcon className={cn('h-3 w-3 shrink-0', isResponsive ? 'text-green-500' : 'text-muted-foreground')} />
        <span className="text-muted-foreground truncate">{contact.last_response_relative}</span>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-0.5 text-xs', className)}>
      <div className="flex items-center gap-1.5">
        <Star className="h-3 w-3 text-amber-500 shrink-0" />
        <span className="font-medium truncate">{contact.name}</span>
        {contact.phone && (
          <span className="text-muted-foreground truncate hidden sm:inline">· {contact.phone}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 pl-[18px]">
        <ChannelIcon className={cn('h-3 w-3 shrink-0', isResponsive ? 'text-green-500' : 'text-muted-foreground')} />
        <span className={cn(isResponsive ? 'text-green-600' : 'text-muted-foreground')}>
          {channelLabel}
        </span>
        <span className="text-muted-foreground">· {contact.last_response_relative}</span>
      </div>
    </div>
  );
}
