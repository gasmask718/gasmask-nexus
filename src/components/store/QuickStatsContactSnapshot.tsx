/**
 * QuickStatsContactSnapshot — Compact contact responsiveness summary
 * 
 * Placement: Store Profile → Quick Stats card → below Responsiveness row
 * Purpose: "Who at this store actually responds — and how?" in under 2 seconds.
 * 
 * Phase II Enhancements:
 * - ⭐ Primary Responsive Contact badge
 * - Temporal intelligence ("replied 2d ago")
 * 
 * READ-ONLY. No filters, no edit actions, no deep analytics.
 * For the full cadence view, see the Communication Cadence section.
 */

import { Phone, MessageSquare, CheckCircle2, XCircle, HelpCircle, Users, Star } from 'lucide-react';
import { useStoreContactsWithResponsiveness } from '@/hooks/useContactResponsiveness';
import { PredictiveIntelPanel } from '@/components/contact/PredictiveIntelPanel';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const MAX_VISIBLE_CONTACTS = 3;

interface QuickStatsContactSnapshotProps {
  storeId: string;
}

export function QuickStatsContactSnapshot({ storeId }: QuickStatsContactSnapshotProps) {
  const { data: contacts, isLoading } = useStoreContactsWithResponsiveness(storeId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Contact Responsiveness</p>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 bg-muted/30 rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!contacts || contacts.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Contact Responsiveness</p>
        <div className="flex items-center gap-2 p-3 rounded-md bg-muted/20 border border-border/30">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">No contacts on file</span>
        </div>
      </div>
    );
  }

  // Derive primary responsive contact (same logic as usePrimaryResponsiveContact)
  const primaryId = derivePrimaryContactId(contacts);
  const visibleContacts = contacts.slice(0, MAX_VISIBLE_CONTACTS);
  const remainingCount = contacts.length - MAX_VISIBLE_CONTACTS;

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Contact Responsiveness</p>
      <div className="space-y-1.5">
        {visibleContacts.map((contact) => (
          <ContactSnapshotRow
            key={contact.id}
            name={contact.name}
            phone={contact.phone}
            responsiveByText={contact.responsive_by_text}
            responsiveByCall={contact.responsive_by_call}
            status={contact.responsiveness_status as 'responsive' | 'unresponsive' | 'unknown' | null}
            isPrimary={contact.id === primaryId}
            lastTextReceivedAt={contact.last_text_received_at}
            lastCallAnsweredAt={contact.last_call_answered_at}
          />
        ))}
        {remainingCount > 0 && (
          <p className="text-xs text-muted-foreground pl-1">
            + {remainingCount} more contact{remainingCount > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Phase III — Predictive Intelligence */}
      <Separator className="my-2" />
      <PredictiveIntelPanel storeId={storeId} />
    </div>
  );
}

interface ContactSnapshotRowProps {
  name: string;
  phone: string | null;
  responsiveByText: boolean | null;
  responsiveByCall: boolean | null;
  status: 'responsive' | 'unresponsive' | 'unknown' | null;
  isPrimary: boolean;
  lastTextReceivedAt: string | null;
  lastCallAnsweredAt: string | null;
}

function ContactSnapshotRow({
  name,
  phone,
  responsiveByText,
  responsiveByCall,
  status,
  isPrimary,
  lastTextReceivedAt,
  lastCallAnsweredAt,
}: ContactSnapshotRowProps) {
  const lastResponseText = getLastResponseRelative(lastTextReceivedAt, lastCallAnsweredAt);

  return (
    <div className={cn(
      "flex items-center gap-2 p-2 rounded-md border text-xs",
      isPrimary
        ? "bg-amber-500/5 border-amber-500/20"
        : "bg-muted/20 border-border/30"
    )}>
      {/* Primary badge */}
      {isPrimary && (
        <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      )}

      {/* Name + Phone + Last Response */}
      <div className="flex-1 min-w-0">
        <span className="font-medium truncate block">{name}</span>
        <div className="flex items-center gap-1 text-muted-foreground">
          {phone && <span className="truncate">{phone}</span>}
          {phone && lastResponseText && <span>·</span>}
          {lastResponseText && (
            <span className="truncate">{lastResponseText}</span>
          )}
        </div>
      </div>

      {/* Text status */}
      <div className="flex items-center gap-1 shrink-0" title={`Text: ${getStatusLabel(responsiveByText)}`}>
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <StatusIcon value={responsiveByText} />
      </div>

      {/* Call status */}
      <div className="flex items-center gap-1 shrink-0" title={`Call: ${getStatusLabel(responsiveByCall)}`}>
        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
        <StatusIcon value={responsiveByCall} />
      </div>
    </div>
  );
}

function StatusIcon({ value }: { value: boolean | null }) {
  if (value === true) {
    return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  }
  if (value === false) {
    return <XCircle className="h-3.5 w-3.5 text-red-500" />;
  }
  return <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />;
}

function getStatusLabel(value: boolean | null): string {
  if (value === true) return 'Responsive';
  if (value === false) return 'Not responsive';
  return 'No data';
}

// ─── Primary contact derivation (inline, matches hook logic) ────

function derivePrimaryContactId(contacts: any[]): string | null {
  if (contacts.length === 0) return null;

  const scored = contacts.map(c => {
    let score = 0;
    if (c.responsiveness_status === 'responsive') score += 100;
    if (c.last_responded_at) {
      const days = daysSince(c.last_responded_at);
      score += Math.max(0, 50 - days);
    }
    const callRate = (c.total_calls_attempted || 0) > 0
      ? (c.total_calls_answered || 0) / (c.total_calls_attempted || 1)
      : 0;
    const textRate = (c.total_texts_sent || 0) > 0
      ? (c.total_texts_received || 0) / (c.total_texts_sent || 1)
      : 0;
    score += (callRate + textRate) * 10;
    if (c.is_primary) score += 5;
    return { id: c.id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].id;
}

function daysSince(dateStr: string): number {
  try {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return 999;
  }
}

function getLastResponseRelative(textAt: string | null, callAt: string | null): string | null {
  if (!textAt && !callAt) return null;

  const textTime = textAt ? new Date(textAt).getTime() : 0;
  const callTime = callAt ? new Date(callAt).getTime() : 0;

  const mostRecent = textTime > callTime
    ? { date: textAt!, label: 'replied' }
    : { date: callAt!, label: 'answered' };

  const days = daysSince(mostRecent.date);
  if (days === 0) return `${mostRecent.label} today`;
  if (days === 1) return `${mostRecent.label} 1d ago`;
  if (days < 7) return `${mostRecent.label} ${days}d ago`;
  if (days < 30) return `${mostRecent.label} ${Math.floor(days / 7)}w ago`;
  return `${mostRecent.label} ${Math.floor(days / 30)}mo ago`;
}
