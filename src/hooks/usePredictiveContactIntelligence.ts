/**
 * usePredictiveContactIntelligence — Phase III Predictive Communication Intelligence
 * 
 * CONSTITUTIONAL RULES:
 * - All outputs are ADVISORY only — no auto-sending, no auto-escalation.
 * - Derived strictly from existing communication data (communications + store_contacts).
 * - No new responsiveness heuristics invented.
 * 
 * Three layers:
 * ① Auto-Suggested Follow-Up Channel
 * ② Time-of-Day Responsiveness Heat
 * ③ AI-Recommended Contact Sequencing
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ─────────────────────────────────────────────

export interface ChannelRecommendation {
  suggested: 'text' | 'call' | 'none';
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export interface TimeOfDayHeat {
  best_window: string;        // e.g. "10am–1pm"
  best_day_type: string;      // "Weekdays" | "Weekends" | "No pattern"
  channel_note: string | null;// e.g. "Texts perform better mornings"
  data_quality: 'sufficient' | 'sparse' | 'none';
}

export interface ContactSequenceEntry {
  contact_id: string;
  name: string;
  phone: string | null;
  rank: number;
  suggested_channel: 'text' | 'call' | 'none';
  last_response_relative: string;
  reason: string;
}

export interface PredictiveIntelligence {
  channelRecommendation: ChannelRecommendation;
  timeOfDayHeat: TimeOfDayHeat;
  contactSequence: ContactSequenceEntry[];
}

// ─── Main Hook ─────────────────────────────────────────

export function usePredictiveContactIntelligence(storeId: string | undefined) {
  // Fetch store contacts with responsiveness data
  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ['predictive-intel-contacts', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await supabase
        .from('store_contacts')
        .select(`
          id, name, phone, store_id,
          responsive_by_text, responsive_by_call,
          responsiveness_status,
          last_responded_at,
          last_text_received_at, last_call_answered_at,
          total_calls_attempted, total_calls_answered,
          total_texts_sent, total_texts_received,
          is_primary
        `)
        .is('deleted_at', null)
        .eq('store_id', storeId)
        .eq('is_simulation', false);
      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch inbound communications for time-of-day analysis
  const { data: inboundComms, isLoading: commsLoading } = useQuery({
    queryKey: ['predictive-intel-comms', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await supabase
        .from('communications')
        .select('channel, direction, occurred_at')
        .eq('entity_id', storeId)
        .eq('entity_type', 'store')
        .eq('direction', 'inbound')
        .order('occurred_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
  });

  const intelligence = useMemo<PredictiveIntelligence | null>(() => {
    if (!contacts) return null;
    return {
      channelRecommendation: deriveChannelRecommendation(contacts),
      timeOfDayHeat: deriveTimeOfDayHeat(inboundComms || []),
      contactSequence: deriveContactSequence(contacts, inboundComms || []),
    };
  }, [contacts, inboundComms]);

  return {
    intelligence,
    isLoading: contactsLoading || commsLoading,
  };
}

// ─── ① Channel Recommendation ─────────────────────────

function deriveChannelRecommendation(contacts: any[]): ChannelRecommendation {
  if (contacts.length === 0) {
    return { suggested: 'none', confidence: 'low', reason: 'No contacts on file' };
  }

  let totalTextResponses = 0;
  let totalTextAttempts = 0;
  let totalCallResponses = 0;
  let totalCallAttempts = 0;
  let latestTextResponse = 0;
  let latestCallResponse = 0;

  for (const c of contacts) {
    totalTextResponses += c.total_texts_received || 0;
    totalTextAttempts += c.total_texts_sent || 0;
    totalCallResponses += c.total_calls_answered || 0;
    totalCallAttempts += c.total_calls_attempted || 0;

    if (c.last_text_received_at) {
      const t = new Date(c.last_text_received_at).getTime();
      if (t > latestTextResponse) latestTextResponse = t;
    }
    if (c.last_call_answered_at) {
      const t = new Date(c.last_call_answered_at).getTime();
      if (t > latestCallResponse) latestCallResponse = t;
    }
  }

  const textRate = totalTextAttempts > 0 ? totalTextResponses / totalTextAttempts : 0;
  const callRate = totalCallAttempts > 0 ? totalCallResponses / totalCallAttempts : 0;
  const totalAttempts = totalTextAttempts + totalCallAttempts;

  if (totalAttempts === 0) {
    return { suggested: 'text', confidence: 'low', reason: 'No outreach history — text is default' };
  }

  // Recency-weighted scoring
  const now = Date.now();
  const textRecencyBonus = latestTextResponse > 0 ? Math.max(0, 1 - (now - latestTextResponse) / (30 * 86400000)) : 0;
  const callRecencyBonus = latestCallResponse > 0 ? Math.max(0, 1 - (now - latestCallResponse) / (30 * 86400000)) : 0;

  const textScore = textRate * 0.6 + textRecencyBonus * 0.4;
  const callScore = callRate * 0.6 + callRecencyBonus * 0.4;

  const diff = Math.abs(textScore - callScore);
  const confidence: 'high' | 'medium' | 'low' = 
    totalAttempts >= 10 && diff > 0.2 ? 'high' :
    totalAttempts >= 5 ? 'medium' : 'low';

  if (textScore > callScore) {
    const responseCount = totalTextResponses;
    return {
      suggested: 'text',
      confidence,
      reason: `Based on ${responseCount} text response${responseCount !== 1 ? 's' : ''} (${Math.round(textRate * 100)}% reply rate)`,
    };
  } else if (callScore > textScore) {
    const responseCount = totalCallResponses;
    return {
      suggested: 'call',
      confidence,
      reason: `Based on ${responseCount} answered call${responseCount !== 1 ? 's' : ''} (${Math.round(callRate * 100)}% answer rate)`,
    };
  }

  return { suggested: 'text', confidence: 'low', reason: 'No clear preference yet' };
}

// ─── ② Time-of-Day Heat ──────────────────────────────

interface CommRecord {
  channel: string;
  direction: string;
  occurred_at: string;
}

function deriveTimeOfDayHeat(comms: CommRecord[]): TimeOfDayHeat {
  if (comms.length < 3) {
    return {
      best_window: 'Not enough data',
      best_day_type: 'No pattern',
      channel_note: null,
      data_quality: comms.length === 0 ? 'none' : 'sparse',
    };
  }

  // Bucketize by hour
  const hourBuckets: number[] = new Array(24).fill(0);
  let weekdayCount = 0;
  let weekendCount = 0;
  let textMorning = 0;
  let textAfternoon = 0;
  let callMorning = 0;
  let callAfternoon = 0;

  for (const c of comms) {
    try {
      const d = new Date(c.occurred_at);
      const hour = d.getHours();
      const day = d.getDay(); // 0=Sun, 6=Sat
      hourBuckets[hour]++;

      if (day === 0 || day === 6) weekendCount++;
      else weekdayCount++;

      const isMorning = hour >= 6 && hour < 13;
      if (c.channel === 'sms' || c.channel === 'text') {
        if (isMorning) textMorning++;
        else textAfternoon++;
      } else if (c.channel === 'call' || c.channel === 'phone') {
        if (isMorning) callMorning++;
        else callAfternoon++;
      }
    } catch { /* skip malformed dates */ }
  }

  // Find the best 3-hour window
  let bestWindowStart = 9;
  let bestWindowCount = 0;
  for (let h = 6; h <= 20; h++) {
    const windowCount = hourBuckets[h] + (hourBuckets[h + 1] || 0) + (hourBuckets[h + 2] || 0);
    if (windowCount > bestWindowCount) {
      bestWindowCount = windowCount;
      bestWindowStart = h;
    }
  }

  const formatHour = (h: number) => {
    if (h === 0 || h === 24) return '12am';
    if (h === 12) return '12pm';
    return h < 12 ? `${h}am` : `${h - 12}pm`;
  };

  const best_window = `${formatHour(bestWindowStart)}–${formatHour(bestWindowStart + 3)}`;

  const best_day_type = weekdayCount > weekendCount * 1.5
    ? 'Weekdays outperform weekends'
    : weekendCount > weekdayCount * 1.5
    ? 'Weekends outperform weekdays'
    : 'No strong day preference';

  // Channel-specific insight
  let channel_note: string | null = null;
  if (textMorning + textAfternoon > 3 || callMorning + callAfternoon > 3) {
    if (textMorning > textAfternoon * 1.5) {
      channel_note = 'Texts perform better mornings';
    } else if (callAfternoon > callMorning * 1.5) {
      channel_note = 'Calls connect better afternoons';
    }
  }

  return {
    best_window,
    best_day_type,
    channel_note,
    data_quality: comms.length >= 10 ? 'sufficient' : 'sparse',
  };
}

// ─── ③ Contact Sequencing ─────────────────────────────

function deriveContactSequence(contacts: any[], comms: CommRecord[]): ContactSequenceEntry[] {
  if (contacts.length === 0) return [];

  // Build time-of-day alignment bonus (current hour proximity to best response hours)
  const hourBuckets: number[] = new Array(24).fill(0);
  for (const c of comms) {
    try { hourBuckets[new Date(c.occurred_at).getHours()]++; } catch {}
  }

  const scored = contacts.map(c => {
    let score = 0;
    let reason = '';

    // 1. Primary responsive status
    if (c.responsiveness_status === 'responsive') {
      score += 100;
      reason = 'Responsive contact';
    } else if (c.responsiveness_status === 'unresponsive') {
      score += 10;
      reason = 'Previously unresponsive';
    } else {
      score += 30;
      reason = 'No response history';
    }

    // 2. Channel success rate
    const callRate = (c.total_calls_attempted || 0) > 0
      ? (c.total_calls_answered || 0) / (c.total_calls_attempted || 1)
      : 0;
    const textRate = (c.total_texts_sent || 0) > 0
      ? (c.total_texts_received || 0) / (c.total_texts_sent || 1)
      : 0;
    const bestRate = Math.max(callRate, textRate);
    score += bestRate * 30;

    // 3. Recency of response
    if (c.last_responded_at) {
      const days = daysSince(c.last_responded_at);
      const recencyBonus = Math.max(0, 50 - days);
      score += recencyBonus;
      if (days <= 2) reason = `Replied ${days === 0 ? 'today' : `${days}d ago`}`;
    }

    // 4. is_primary tiebreaker
    if (c.is_primary) score += 5;

    // Determine best channel for this contact
    let suggestedChannel: 'text' | 'call' | 'none' = 'none';
    if (c.responsive_by_text && c.responsive_by_call) {
      const textRecency = c.last_text_received_at ? new Date(c.last_text_received_at).getTime() : 0;
      const callRecency = c.last_call_answered_at ? new Date(c.last_call_answered_at).getTime() : 0;
      suggestedChannel = textRecency >= callRecency ? 'text' : 'call';
    } else if (c.responsive_by_text) {
      suggestedChannel = 'text';
    } else if (c.responsive_by_call) {
      suggestedChannel = 'call';
    } else if (textRate > callRate) {
      suggestedChannel = 'text';
    } else if (callRate > textRate) {
      suggestedChannel = 'call';
    } else {
      suggestedChannel = 'text'; // Default
    }

    return { contact: c, score, suggestedChannel, reason };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.map((s, i) => ({
    contact_id: s.contact.id,
    name: s.contact.name,
    phone: s.contact.phone,
    rank: i + 1,
    suggested_channel: s.suggestedChannel,
    last_response_relative: getRelativeTime(s.contact.last_responded_at),
    reason: s.reason,
  }));
}

// ─── Helpers ──────────────────────────────────────────

function daysSince(dateStr: string): number {
  try {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return 999;
  }
}

function getRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'No responses yet';
  const days = daysSince(dateStr);
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
