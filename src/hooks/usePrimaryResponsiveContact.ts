/**
 * usePrimaryResponsiveContact — Derives the single best contact per store.
 * 
 * CONSTITUTIONAL RULE:
 * This hook reads from store_contacts only. It does NOT invent new responsiveness logic.
 * It projects a "primary responsive contact" from existing fields:
 *   - last_responded_at (most recent response wins)
 *   - responsiveness_status ('responsive' preferred)
 *   - call/text answer rates as tiebreakers
 *   - is_primary flag as final tiebreaker
 * 
 * One contact per store. Auto-derived, no manual selection.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PrimaryResponsiveContact {
  contact_id: string;
  name: string;
  phone: string | null;
  responsive_by_text: boolean | null;
  responsive_by_call: boolean | null;
  responsiveness_status: string | null;
  last_responded_at: string | null;
  last_text_received_at: string | null;
  last_call_answered_at: string | null;
  best_channel: 'text' | 'call' | 'none';
  last_response_relative: string; // "2d ago", "No responses yet"
}

/**
 * Derive the primary responsive contact for a single store.
 */
export function usePrimaryResponsiveContact(storeId: string | undefined) {
  const { data: contacts, isLoading } = useQuery({
    queryKey: ['primary-responsive-contact', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await supabase
        .from('store_contacts')
        .select(`
          id, name, phone,
          responsive_by_text, responsive_by_call,
          responsiveness_status,
          last_responded_at,
          last_text_received_at,
          last_call_answered_at,
          total_calls_attempted, total_calls_answered,
          total_texts_sent, total_texts_received,
          is_primary
        `)
        .eq('store_id', storeId)
        .eq('is_simulation', false);

      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
    staleTime: 2 * 60 * 1000,
  });

  const primary = useMemo<PrimaryResponsiveContact | null>(() => {
    if (!contacts || contacts.length === 0) return null;
    return derivePrimary(contacts);
  }, [contacts]);

  return { primary, isLoading, allContacts: contacts };
}

/**
 * Batch version: derive primary responsive contact for multiple stores.
 * Used in field portals and route planning for efficient loading.
 */
export function usePrimaryResponsiveContactBatch(storeIds: string[]) {
  const { data, isLoading } = useQuery({
    queryKey: ['primary-responsive-contacts-batch', storeIds.sort().join(',')],
    queryFn: async () => {
      if (storeIds.length === 0) return {};
      const CHUNK_SIZE = 100;
      const chunks: string[][] = [];
      for (let i = 0; i < storeIds.length; i += CHUNK_SIZE) {
        chunks.push(storeIds.slice(i, i + CHUNK_SIZE));
      }
      const results = await Promise.all(
        chunks.map((chunk) =>
          supabase
            .from('store_contacts')
            .select(`
              id, name, phone, store_id,
              responsive_by_text, responsive_by_call,
              responsiveness_status,
              last_responded_at,
              last_text_received_at,
              last_call_answered_at,
              total_calls_attempted, total_calls_answered,
              total_texts_sent, total_texts_received,
              is_primary
            `)
            .in('store_id', chunk)
            .eq('is_simulation', false)
        )
      );
      const firstError = results.find((r) => r.error);
      if (firstError?.error) throw firstError.error;
      const contacts = results.flatMap((r) => r.data || []);

      // Group by store
      const grouped: Record<string, typeof contacts> = {};
      for (const c of contacts || []) {
        if (!grouped[c.store_id]) grouped[c.store_id] = [];
        grouped[c.store_id].push(c);
      }

      // Derive primary per store
      const result: Record<string, PrimaryResponsiveContact> = {};
      for (const [sid, storeContacts] of Object.entries(grouped)) {
        const p = derivePrimary(storeContacts);
        if (p) result[sid] = p;
      }
      return result;
    },
    enabled: storeIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  return { contactsByStore: data || {}, isLoading };
}

// ─── Internal Logic ────────────────────────────────────────

function derivePrimary(contacts: any[]): PrimaryResponsiveContact | null {
  if (contacts.length === 0) return null;

  // Score each contact
  const scored = contacts.map(c => {
    let score = 0;

    // Responsive contacts get a big boost
    if (c.responsiveness_status === 'responsive') score += 100;

    // Recent response gets a time-based score (more recent = higher)
    if (c.last_responded_at) {
      const daysAgo = daysSince(c.last_responded_at);
      score += Math.max(0, 50 - daysAgo); // Up to 50 points for recency
    }

    // Answer rates as tiebreaker
    const callRate = (c.total_calls_attempted || 0) > 0
      ? (c.total_calls_answered || 0) / (c.total_calls_attempted || 1)
      : 0;
    const textRate = (c.total_texts_sent || 0) > 0
      ? (c.total_texts_received || 0) / (c.total_texts_sent || 1)
      : 0;
    score += (callRate + textRate) * 10;

    // is_primary is a final tiebreaker
    if (c.is_primary) score += 5;

    return { contact: c, score };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].contact;

  // Determine best channel
  let bestChannel: 'text' | 'call' | 'none' = 'none';
  if (best.responsive_by_text && best.responsive_by_call) {
    // Prefer text if more recent text reply
    const textRecency = best.last_text_received_at ? new Date(best.last_text_received_at).getTime() : 0;
    const callRecency = best.last_call_answered_at ? new Date(best.last_call_answered_at).getTime() : 0;
    bestChannel = textRecency >= callRecency ? 'text' : 'call';
  } else if (best.responsive_by_text) {
    bestChannel = 'text';
  } else if (best.responsive_by_call) {
    bestChannel = 'call';
  }

  // Build last response relative time
  const lastResponseRelative = getLastResponseRelative(best);

  return {
    contact_id: best.id,
    name: best.name,
    phone: best.phone,
    responsive_by_text: best.responsive_by_text,
    responsive_by_call: best.responsive_by_call,
    responsiveness_status: best.responsiveness_status,
    last_responded_at: best.last_responded_at,
    last_text_received_at: best.last_text_received_at,
    last_call_answered_at: best.last_call_answered_at,
    best_channel: bestChannel,
    last_response_relative: lastResponseRelative,
  };
}

function daysSince(dateStr: string): number {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  } catch {
    return 999;
  }
}

function getLastResponseRelative(contact: any): string {
  const lastText = contact.last_text_received_at;
  const lastCall = contact.last_call_answered_at;

  if (!lastText && !lastCall) return 'No responses yet';

  const textTime = lastText ? new Date(lastText).getTime() : 0;
  const callTime = lastCall ? new Date(lastCall).getTime() : 0;

  const mostRecent = textTime > callTime
    ? { date: lastText, channel: 'Texted back' }
    : { date: lastCall, channel: 'Last call answered' };

  const days = daysSince(mostRecent.date);
  if (days === 0) return `${mostRecent.channel} today`;
  if (days === 1) return `${mostRecent.channel} 1d ago`;
  if (days < 7) return `${mostRecent.channel} ${days}d ago`;
  if (days < 30) return `${mostRecent.channel} ${Math.floor(days / 7)}w ago`;
  return `${mostRecent.channel} ${Math.floor(days / 30)}mo ago`;
}
