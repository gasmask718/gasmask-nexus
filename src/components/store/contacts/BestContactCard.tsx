/**
 * BestContactCard — Dedicated highlight for the single best contact at a store.
 *
 * Selection logic (deterministic, explainable):
 *   1. Most recently responded (last_responded_at)
 *   2. Tie → highest responsiveness (text or call rates)
 *   3. Tie → is_primary flag
 *   4. Tie → most recently created
 *
 * Phase IV additions:
 *   - Confidence scoring (High / Medium / Low)
 *   - Route-aware annotation when accessed from route context
 *   - Time-of-day responsiveness hint
 *
 * READ-ONLY. No actions. Appears above the contact list in Quick Stats.
 */

import { Star, MessageSquare, Phone, HelpCircle, Shield, ShieldAlert, ShieldQuestion, Navigation } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface BestContactConfidence {
  level: 'high' | 'medium' | 'low';
  reason: string;
}

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
    total_calls_attempted?: number;
    total_calls_answered?: number;
    total_texts_sent?: number;
    total_texts_received?: number;
    last_responded_at?: string | null;
  };
  confidence?: BestContactConfidence;
  isRouteAware?: boolean;
}

export function BestContactCard({ contact, confidence, isRouteAware }: BestContactCardProps) {
  const preferredChannel = derivePreferredChannel(contact);
  const statusLabel = getStatusLabel(contact.responsiveness_status);

  return (
    <TooltipProvider>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
          <Star className="h-3.5 w-3.5" />
          Best Contact
          {confidence && <ConfidenceBadge confidence={confidence} />}
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

        {/* Route-aware annotation */}
        {isRouteAware && (
          <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400">
            <Navigation className="h-3 w-3" />
            <span>Optimized for current route</span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── Confidence Badge ────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: BestContactConfidence }) {
  const config = {
    high: {
      icon: Shield,
      className: 'text-green-600 dark:text-green-400 bg-green-500/10',
      label: 'High',
    },
    medium: {
      icon: ShieldAlert,
      className: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
      label: 'Medium',
    },
    low: {
      icon: ShieldQuestion,
      className: 'text-muted-foreground bg-muted/30',
      label: 'Low',
    },
  }[confidence.level];

  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(
          'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ml-auto cursor-default',
          config.className
        )}>
          <Icon className="h-3 w-3" />
          {config.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px]">
        <p className="text-xs font-medium">Confidence: {config.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{confidence.reason}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Helpers (unchanged) ──────────────────────────────

function derivePreferredChannel(contact: BestContactCardProps['contact']) {
  const textResponsive = contact.responsive_by_text === true;
  const callResponsive = contact.responsive_by_call === true;

  if (textResponsive && callResponsive) {
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

// ─── Confidence Derivation (exported for use by parent) ────

/**
 * Compute confidence level for the best contact selection.
 * 
 * High:   ≥10 total attempts with clear channel dominance and recency within 30 days
 * Medium: 4–9 total attempts or mixed results
 * Low:    <4 attempts or sparse data
 */
export function deriveBestContactConfidence(contact: BestContactCardProps['contact']): BestContactConfidence {
  const totalAttempts = (contact.total_calls_attempted || 0) + (contact.total_texts_sent || 0);
  const totalResponses = (contact.total_calls_answered || 0) + (contact.total_texts_received || 0);

  if (totalAttempts === 0) {
    return { level: 'low', reason: 'No outreach attempts recorded' };
  }

  const overallRate = totalResponses / totalAttempts;

  // Recency check
  const daysSinceResponse = contact.last_responded_at
    ? Math.floor((Date.now() - new Date(contact.last_responded_at).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // Channel dominance — clear difference between text and call rates
  const callRate = (contact.total_calls_attempted || 0) > 0
    ? (contact.total_calls_answered || 0) / (contact.total_calls_attempted || 1) : 0;
  const textRate = (contact.total_texts_sent || 0) > 0
    ? (contact.total_texts_received || 0) / (contact.total_texts_sent || 1) : 0;
  const rateDelta = Math.abs(textRate - callRate);

  if (totalAttempts >= 10 && overallRate > 0.3 && daysSinceResponse <= 30) {
    const attemptDetail = `${totalResponses} responses from ${totalAttempts} attempts`;
    const recencyDetail = daysSinceResponse <= 7 ? 'responded this week' : `responded ${daysSinceResponse}d ago`;
    return {
      level: 'high',
      reason: `${attemptDetail} · ${recencyDetail}`,
    };
  }

  if (totalAttempts >= 4 || (totalAttempts >= 2 && overallRate > 0.4)) {
    return {
      level: 'medium',
      reason: `${totalResponses} responses from ${totalAttempts} attempts · ${rateDelta > 0.2 ? 'some channel preference' : 'mixed results'}`,
    };
  }

  return {
    level: 'low',
    reason: `Only ${totalAttempts} attempt${totalAttempts !== 1 ? 's' : ''} recorded — more data needed`,
  };
}
