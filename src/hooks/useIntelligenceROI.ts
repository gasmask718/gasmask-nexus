/**
 * useIntelligenceROI — Phase V Behavior Correlation & Confidence Calibration
 * 
 * Read-only queries that answer:
 * 1. Did a communication occur within 24h/48h after intelligence exposure?
 * 2. Was the suggested channel used?
 * 3. Was the suggested contact reached?
 * 4. Is High confidence actually more successful than Low?
 * 
 * CONSTITUTIONAL RULES:
 * - Correlation only, NOT causation
 * - No nudging, no scoring, no enforcement
 * - Internal diagnostics, not UI features (admin-only)
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ─────────────────────────────────────────────

export interface ExposureCorrelation {
  total_exposures: number;
  followed_by_communication_24h: number;
  followed_by_communication_48h: number;
  suggested_channel_used: number;
  suggested_contact_reached: number;
  correlation_rate_24h: number;  // 0–1
  correlation_rate_48h: number;  // 0–1
  channel_alignment_rate: number; // 0–1
}

export interface ConfidenceCalibration {
  level: 'high' | 'medium' | 'low';
  total_exposures: number;
  followed_by_response: number;
  response_rate: number;          // 0–1
  avg_time_to_response_hours: number | null;
}

// ─── Correlation Hook ──────────────────────────────────

export function useExposureCorrelation(storeId?: string, days: number = 30) {
  return useQuery({
    queryKey: ['intel-roi-correlation', storeId, days],
    queryFn: async (): Promise<ExposureCorrelation> => {
      const cutoff = new Date(Date.now() - days * 86400000).toISOString();

      // 1. Get exposures
      const exposureQuery = (supabase as any)
        .from('intelligence_exposures')
        .select('id, store_id, exposure_type, suggested_channel, suggested_contact_id, exposed_at')
        .gte('exposed_at', cutoff)
        .order('exposed_at', { ascending: true });

      if (storeId) exposureQuery.eq('store_id', storeId);

      const { data: exposures, error: expError } = await exposureQuery;
      if (expError) throw expError;
      if (!exposures || exposures.length === 0) {
        return emptyCorrelation();
      }

      // 2. Get communications in the same period
      const commQuery = supabase
        .from('communications')
        .select('entity_id, channel, direction, occurred_at')
        .eq('entity_type', 'store')
        .eq('direction', 'outbound')
        .gte('occurred_at', cutoff);

      if (storeId) commQuery.eq('entity_id', storeId);

      const { data: comms, error: commError } = await commQuery;
      if (commError) throw commError;

      // 3. Correlate
      let followed24h = 0;
      let followed48h = 0;
      let channelAligned = 0;
      let contactAligned = 0;

      for (const exp of exposures) {
        const expTime = new Date(exp.exposed_at).getTime();
        const window24h = expTime + 24 * 3600000;
        const window48h = expTime + 48 * 3600000;

        const followUpComms = (comms || []).filter(
          (c: any) => c.entity_id === exp.store_id &&
            new Date(c.occurred_at).getTime() > expTime
        );

        const within24h = followUpComms.some(
          (c: any) => new Date(c.occurred_at).getTime() <= window24h
        );
        const within48h = followUpComms.some(
          (c: any) => new Date(c.occurred_at).getTime() <= window48h
        );

        if (within24h) followed24h++;
        if (within48h) followed48h++;

        // Channel alignment
        if (exp.suggested_channel && within48h) {
          const channelMap: Record<string, string[]> = {
            text: ['sms', 'text'],
            call: ['call', 'phone'],
          };
          const expectedChannels = channelMap[exp.suggested_channel] || [];
          const used = followUpComms.some(
            (c: any) =>
              expectedChannels.includes(c.channel) &&
              new Date(c.occurred_at).getTime() <= window48h
          );
          if (used) channelAligned++;
        }

        // Contact alignment — communications table lacks contact_id,
        // so we track whether ANY communication happened to the same store.
        // This is correlation, not precision matching.
        if (exp.suggested_contact_id && within48h) {
          contactAligned++;
        }
      }

      const total = exposures.length;
      return {
        total_exposures: total,
        followed_by_communication_24h: followed24h,
        followed_by_communication_48h: followed48h,
        suggested_channel_used: channelAligned,
        suggested_contact_reached: contactAligned,
        correlation_rate_24h: total > 0 ? followed24h / total : 0,
        correlation_rate_48h: total > 0 ? followed48h / total : 0,
        channel_alignment_rate: total > 0 ? channelAligned / total : 0,
      };
    },
    enabled: true,
    staleTime: 10 * 60 * 1000, // 10 min cache
  });
}

// ─── Confidence Calibration Hook ───────────────────────

export function useConfidenceCalibration(days: number = 90) {
  return useQuery({
    queryKey: ['intel-roi-calibration', days],
    queryFn: async (): Promise<ConfidenceCalibration[]> => {
      const cutoff = new Date(Date.now() - days * 86400000).toISOString();

      // Get best_contact exposures with confidence
      const { data: exposures, error: expError } = await (supabase as any)
        .from('intelligence_exposures')
        .select('store_id, confidence_level, suggested_contact_id, exposed_at')
        .eq('exposure_type', 'best_contact')
        .not('confidence_level', 'is', null)
        .gte('exposed_at', cutoff);

      if (expError) throw expError;
      if (!exposures || exposures.length === 0) return [];

      // Get inbound communications (responses) in the same period
      const { data: responses, error: respError } = await supabase
        .from('communications')
        .select('entity_id, occurred_at')
        .eq('entity_type', 'store')
        .eq('direction', 'inbound')
        .gte('occurred_at', cutoff);

      if (respError) throw respError;

      // Group exposures by confidence level
      const buckets: Record<string, { total: number; responded: number; responseTimes: number[] }> = {
        high: { total: 0, responded: 0, responseTimes: [] },
        medium: { total: 0, responded: 0, responseTimes: [] },
        low: { total: 0, responded: 0, responseTimes: [] },
      };

      for (const exp of exposures) {
        const level = exp.confidence_level as string;
        if (!buckets[level]) continue;

        buckets[level].total++;

        const expTime = new Date(exp.exposed_at).getTime();
        const window48h = expTime + 48 * 3600000;

        // Did a response come in within 48h from this store?
        const response = (responses || []).find(
          (r: any) =>
            r.entity_id === exp.store_id &&
            new Date(r.occurred_at).getTime() > expTime &&
            new Date(r.occurred_at).getTime() <= window48h
        );

        if (response) {
          buckets[level].responded++;
          const hoursToRespond =
            (new Date(response.occurred_at).getTime() - expTime) / 3600000;
          buckets[level].responseTimes.push(hoursToRespond);
        }
      }

      return (['high', 'medium', 'low'] as const).map(level => ({
        level,
        total_exposures: buckets[level].total,
        followed_by_response: buckets[level].responded,
        response_rate: buckets[level].total > 0
          ? buckets[level].responded / buckets[level].total
          : 0,
        avg_time_to_response_hours: buckets[level].responseTimes.length > 0
          ? buckets[level].responseTimes.reduce((a, b) => a + b, 0) / buckets[level].responseTimes.length
          : null,
      }));
    },
    enabled: true,
    staleTime: 30 * 60 * 1000, // 30 min cache
  });
}

// ─── Helpers ──────────────────────────────────────────

function emptyCorrelation(): ExposureCorrelation {
  return {
    total_exposures: 0,
    followed_by_communication_24h: 0,
    followed_by_communication_48h: 0,
    suggested_channel_used: 0,
    suggested_contact_reached: 0,
    correlation_rate_24h: 0,
    correlation_rate_48h: 0,
    channel_alignment_rate: 0,
  };
}
