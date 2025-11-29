// ═══════════════════════════════════════════════════════════════════════════════
// DAILY BRIEFINGS HOOK — React hook for briefing management
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  DailyBriefingContent,
  BriefingRecord,
  getLatestBriefings,
  getEnhancedBriefingContent,
} from '@/services/briefingEngine';
import { toast } from 'sonner';

export interface UseDailyBriefingsReturn {
  briefings: {
    morning?: DailyBriefingContent;
    evening?: DailyBriefingContent;
  };
  rawRecords: {
    morning?: BriefingRecord;
    evening?: BriefingRecord;
  };
  loading: boolean;
  generating: boolean;
  error: string | null;
  fetchTodayBriefings: () => Promise<void>;
  generateBriefing: (type: 'morning' | 'evening') => Promise<DailyBriefingContent | null>;
  refreshBriefing: (type: 'morning' | 'evening') => Promise<void>;
}

export function useDailyBriefings(): UseDailyBriefingsReturn {
  const [briefings, setBriefings] = useState<{
    morning?: DailyBriefingContent;
    evening?: DailyBriefingContent;
  }>({});
  const [rawRecords, setRawRecords] = useState<{
    morning?: BriefingRecord;
    evening?: BriefingRecord;
  }>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTodayBriefings = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const records = await getLatestBriefings();
      setRawRecords(records);
      
      // Enhance content with AI summary if available
      const enhancedBriefings: typeof briefings = {};
      
      if (records.morning) {
        enhancedBriefings.morning = await getEnhancedBriefingContent(records.morning);
      }
      if (records.evening) {
        enhancedBriefings.evening = await getEnhancedBriefingContent(records.evening);
      }
      
      setBriefings(enhancedBriefings);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch briefings';
      setError(message);
      console.error('Fetch briefings error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const generateBriefing = useCallback(async (
    type: 'morning' | 'evening'
  ): Promise<DailyBriefingContent | null> => {
    setGenerating(true);
    setError(null);
    
    try {
      // Call the edge function to generate briefing
      const { data, error: fnError } = await supabase.functions.invoke('daily-briefing', {
        body: { type },
      });

      if (fnError) {
        throw fnError;
      }

      if (!data?.briefing) {
        throw new Error('No briefing data returned');
      }

      const briefing = data.briefing as DailyBriefingContent;
      
      // Update local state
      setBriefings(prev => ({
        ...prev,
        [type]: briefing,
      }));
      
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} briefing generated`);
      return briefing;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate briefing';
      setError(message);
      toast.error(message);
      console.error('Generate briefing error:', err);
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  const refreshBriefing = useCallback(async (type: 'morning' | 'evening') => {
    await generateBriefing(type);
    await fetchTodayBriefings();
  }, [generateBriefing, fetchTodayBriefings]);

  useEffect(() => {
    fetchTodayBriefings();
  }, [fetchTodayBriefings]);

  return {
    briefings,
    rawRecords,
    loading,
    generating,
    error,
    fetchTodayBriefings,
    generateBriefing,
    refreshBriefing,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIGHTWEIGHT HOOK FOR SNAPSHOT
// ═══════════════════════════════════════════════════════════════════════════════

export interface BriefingSnapshot {
  type: 'morning' | 'evening' | null;
  aiSummary: string | null;
  newRisks: number;
  unpaidInvoices: number;
  storesNeedingVisits: number;
  totalActions: number;
  generatedAt: string | null;
}

export function useBriefingSnapshot(): {
  snapshot: BriefingSnapshot | null;
  loading: boolean;
} {
  const [snapshot, setSnapshot] = useState<BriefingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSnapshot = async () => {
      try {
        const client = supabase as any;
        const today = new Date().toISOString().split('T')[0];
        
        const { data } = await client
          .from('ai_daily_briefings')
          .select('briefing_type, content, ai_summary, created_at')
          .eq('briefing_date', today)
          .order('created_at', { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          const record = data[0];
          const content = record.content as DailyBriefingContent;
          const actionsTaken = content.actionsTaken || {};
          const actionValues = Object.values(actionsTaken) as number[];
          
          setSnapshot({
            type: record.briefing_type as 'morning' | 'evening',
            aiSummary: record.ai_summary || content.aiCommentary || null,
            newRisks: Number(content.summary?.newRisks) || 0,
            unpaidInvoices: Number(content.summary?.unpaidInvoices) || 0,
            storesNeedingVisits: Number(content.summary?.storesNeedingVisits) || 0,
            totalActions: actionValues.reduce((a, b) => a + (b || 0), 0),
            generatedAt: record.created_at,
          });
        } else {
          setSnapshot(null);
        }
      } catch (error) {
        console.error('Failed to fetch briefing snapshot:', error);
        setSnapshot(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSnapshot();
  }, []);

  return { snapshot, loading };
}
