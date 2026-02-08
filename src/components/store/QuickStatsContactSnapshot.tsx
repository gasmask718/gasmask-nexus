/**
 * QuickStatsContactSnapshot — Compact contact responsiveness summary
 * 
 * Placement: Store Profile → Quick Stats card → below Responsiveness row
 * Purpose: "Who at this store actually responds — and how?" in under 2 seconds.
 * 
 * Phase VI Layout (top → bottom):
 *   1. Section header: "Contact Insight"
 *   2. Intelligence Group (single visual container):
 *      a. Best Contact card (confidence + route annotation)
 *      b. Suggested Channel + Time-of-Day hint (inline row)
 *      c. Last Successful Contact badge
 *   3. Contact Sequence (advisory outreach order)
 *   4. Other contacts (remaining, below intelligence)
 * 
 * Phase VI changes:
 *   - Eliminated redundant PredictiveIntelPanel (signals now inline above fold)
 *   - Grouped all intelligence signals into one visual container
 *   - Elevated SuggestedChannel from below-fold panel to inline with TimeOfDay
 *   - Renamed header from "Contact Responsiveness" to "Contact Insight"
 * 
 * READ-ONLY. No filters, no edit actions, no deep analytics.
 */

import { Phone, MessageSquare, CheckCircle2, XCircle, HelpCircle, Users, Brain } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useStoreContactsWithResponsiveness } from '@/hooks/useContactResponsiveness';
import { usePredictiveContactIntelligence } from '@/hooks/usePredictiveContactIntelligence';
import { BestContactCard, deriveBestContactConfidence } from '@/components/store/contacts/BestContactCard';
import { LastSuccessfulContactBadge } from '@/components/store/contacts/LastSuccessfulContactBadge';
import { SuggestedChannelBadge } from '@/components/contact/SuggestedChannelBadge';
import { ResponsivenessHeatInsight } from '@/components/contact/ResponsivenessHeatInsight';
import { ContactSequenceList } from '@/components/contact/ContactSequenceList';
import { useIntelligenceExposureBatch } from '@/hooks/useIntelligenceExposure';
import type { ExposureEvent } from '@/services/intelligenceAccountability/exposureTracker';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const MAX_VISIBLE_OTHER_CONTACTS = 3;

interface QuickStatsContactSnapshotProps {
  storeId: string;
}

export function QuickStatsContactSnapshot({ storeId }: QuickStatsContactSnapshotProps) {
  const { data: contacts, isLoading } = useStoreContactsWithResponsiveness(storeId);
  const { intelligence } = usePredictiveContactIntelligence(storeId);
  const location = useLocation();

  // Detect route context — user is viewing store from a route/delivery/my-day flow
  const isRouteContext = /\/(route|delivery|my-day|driver|biker)/i.test(location.pathname);

  // Derive the single best contact using deterministic priority
  const bestContact = !isLoading && contacts?.length ? deriveBestContact(contacts) : null;
  // Compute confidence for the best contact
  const confidence = bestContact ? deriveBestContactConfidence(bestContact) : undefined;

  // ─── Phase V: Intelligence Exposure Tracking ───────────
  const exposureEvents: ExposureEvent[] = [];
  if (bestContact && confidence) {
    exposureEvents.push({
      store_id: storeId,
      exposure_type: 'best_contact',
      confidence_level: confidence.level,
      suggested_contact_id: bestContact.id,
      route_context: isRouteContext,
    });
  }
  if (intelligence?.channelRecommendation) {
    exposureEvents.push({
      store_id: storeId,
      exposure_type: 'suggested_channel',
      suggested_channel: intelligence.channelRecommendation.suggested,
      confidence_level: intelligence.channelRecommendation.confidence,
    });
  }
  if (intelligence?.timeOfDayHeat && intelligence.timeOfDayHeat.data_quality !== 'none') {
    exposureEvents.push({
      store_id: storeId,
      exposure_type: 'time_of_day_hint',
      metadata: { window: intelligence.timeOfDayHeat.best_window },
    });
  }
  if (isRouteContext && bestContact) {
    exposureEvents.push({
      store_id: storeId,
      exposure_type: 'route_annotation',
      suggested_contact_id: bestContact.id,
      route_context: true,
    });
  }
  useIntelligenceExposureBatch(exposureEvents, !isLoading && !!contacts?.length);
  // ─── End Phase V ──────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Contact Insight</p>
        </div>
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
        <div className="flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Contact Insight</p>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-md bg-muted/20 border border-border/30">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">No contacts on file</span>
        </div>
      </div>
    );
  }

  // Other contacts exclude the best contact
  const otherContacts = contacts.filter(c => c.id !== bestContact?.id);
  const visibleOthers = otherContacts.slice(0, MAX_VISIBLE_OTHER_CONTACTS);
  const remainingCount = otherContacts.length - MAX_VISIBLE_OTHER_CONTACTS;

  const hasChannelOrHeat = intelligence?.channelRecommendation || intelligence?.timeOfDayHeat;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-1.5">
        <Brain className="h-3.5 w-3.5 text-primary" />
        <p className="text-sm font-medium">Contact Insight</p>
        <span className="text-xs text-muted-foreground ml-auto">Advisory</span>
      </div>

      {/* ─── Intelligence Group (single visual container) ─── */}
      <div className="rounded-lg border border-border/50 bg-card/50 p-2.5 space-y-2">
        {/* ① Best Contact — dedicated highlight */}
        {bestContact ? (
          <BestContactCard
            contact={bestContact}
            confidence={confidence}
            isRouteAware={isRouteContext}
          />
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-md bg-muted/20 border border-border/30">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Best contact not yet determined</span>
          </div>
        )}

        {/* ② Suggested Channel + Time-of-Day (inline, one-glance row) */}
        {hasChannelOrHeat && (
          <div className="flex items-center gap-2 flex-wrap px-0.5">
            <SuggestedChannelBadge recommendation={intelligence?.channelRecommendation} />
            <ResponsivenessHeatInsight heat={intelligence?.timeOfDayHeat} compact />
          </div>
        )}

        {/* ③ Last Successful Contact */}
        <LastSuccessfulContactBadge
          contacts={contacts}
          bestContactId={bestContact?.id ?? null}
        />
      </div>

      {/* ─── Contact Sequence (advisory outreach order) ─── */}
      {intelligence?.contactSequence && intelligence.contactSequence.length > 0 && (
        <>
          <Separator className="my-1" />
          <ContactSequenceList sequence={intelligence.contactSequence} />
        </>
      )}

      {/* ─── Other contacts (below intelligence) ─── */}
      {visibleOthers.length > 0 && (
        <>
          <Separator className="my-1" />
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Other Contacts</p>
            {visibleOthers.map((contact) => (
              <ContactSnapshotRow
                key={contact.id}
                name={contact.name}
                phone={contact.phone}
                responsiveByText={contact.responsive_by_text}
                responsiveByCall={contact.responsive_by_call}
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
        </>
      )}
    </div>
  );
}

// ─── Contact Snapshot Row (for non-best contacts) ─────────

interface ContactSnapshotRowProps {
  name: string;
  phone: string | null;
  responsiveByText: boolean | null;
  responsiveByCall: boolean | null;
  lastTextReceivedAt: string | null;
  lastCallAnsweredAt: string | null;
}

function ContactSnapshotRow({
  name,
  phone,
  responsiveByText,
  responsiveByCall,
  lastTextReceivedAt,
  lastCallAnsweredAt,
}: ContactSnapshotRowProps) {
  const lastResponseText = getLastResponseRelative(lastTextReceivedAt, lastCallAnsweredAt);

  return (
    <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/20 border-border/30 text-xs">
      <div className="flex-1 min-w-0">
        <span className="font-medium truncate block">{name}</span>
        <div className="flex items-center gap-1 text-muted-foreground">
          {phone && <span className="truncate">{phone}</span>}
          {phone && lastResponseText && <span>·</span>}
          {lastResponseText && <span className="truncate">{lastResponseText}</span>}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0" title={`Text: ${getStatusLabel(responsiveByText)}`}>
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <StatusIcon value={responsiveByText} />
      </div>

      <div className="flex items-center gap-1 shrink-0" title={`Call: ${getStatusLabel(responsiveByCall)}`}>
        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
        <StatusIcon value={responsiveByCall} />
      </div>
    </div>
  );
}

function StatusIcon({ value }: { value: boolean | null }) {
  if (value === true) return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  if (value === false) return <XCircle className="h-3.5 w-3.5 text-red-500" />;
  return <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />;
}

function getStatusLabel(value: boolean | null): string {
  if (value === true) return 'Responsive';
  if (value === false) return 'Not responsive';
  return 'No data';
}

// ─── Best Contact Derivation ─────────────────────────────
// Deterministic priority: recency → responsiveness rates → is_primary → creation order

function deriveBestContact(contacts: any[]): any | null {
  if (contacts.length === 0) return null;

  const scored = contacts.map(c => {
    let score = 0;

    // 1. Most recently responded (biggest factor)
    if (c.last_responded_at) {
      const days = daysSince(c.last_responded_at);
      score += Math.max(0, 50 - days);
    }

    // 2. Responsiveness status boost
    if (c.responsiveness_status === 'responsive') score += 100;

    // 3. Channel response rates as tiebreaker
    const callRate = (c.total_calls_attempted || 0) > 0
      ? (c.total_calls_answered || 0) / (c.total_calls_attempted || 1) : 0;
    const textRate = (c.total_texts_sent || 0) > 0
      ? (c.total_texts_received || 0) / (c.total_texts_sent || 1) : 0;
    score += (callRate + textRate) * 10;

    // 4. is_primary flag
    if (c.is_primary) score += 5;

    return { contact: c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].contact;
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
