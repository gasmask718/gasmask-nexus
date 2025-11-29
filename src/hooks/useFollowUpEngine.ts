// ═══════════════════════════════════════════════════════════════════════════════
// FOLLOW-UP ENGINE HOOK — React hook for follow-up automation
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  runFollowUpEngine,
  generateDailyBriefing,
  fetchFollowUpStats,
  fetchRecentFollowUpLogs,
  FollowUpEngineResult,
  DailyBriefingContent,
} from '@/services/followUpEngine';
import {
  FollowUpSettings,
  fetchFollowUpSettings,
  updateFollowUpSettings,
  sendInvoiceReminder,
  sendStoreRecoveryMessage,
  createReorderAlert,
  sendAmbassadorMotivation,
  logFollowUpAction,
} from '@/services/followUpActions';

export interface FollowUpStats {
  todayActions: number;
  escalations: number;
  pending: number;
  byCategory: Record<string, number>;
}

export interface FollowUpLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action_taken: string;
  action_category: string;
  result: string;
  message_sent: string | null;
  escalated: boolean;
  escalation_level: number;
  next_follow_up_date: string | null;
  created_at: string;
  metadata: Record<string, any>;
}

export function useFollowUpEngine() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<FollowUpEngineResult | null>(null);
  const [stats, setStats] = useState<FollowUpStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<FollowUpLog[]>([]);
  const [settings, setSettings] = useState<FollowUpSettings | null>(null);
  const [latestBriefing, setLatestBriefing] = useState<DailyBriefingContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, logsData, settingsData] = await Promise.all([
        fetchFollowUpStats(),
        fetchRecentFollowUpLogs(30),
        fetchFollowUpSettings(),
      ]);

      setStats(statsData);
      setRecentLogs(logsData);
      setSettings(settingsData);

      // Fetch latest briefing
      const client = supabase as any;
      const today = new Date().toISOString().split('T')[0];
      const { data: briefingData } = await client
        .from('ai_daily_briefings')
        .select('*')
        .eq('briefing_date', today)
        .order('created_at', { ascending: false })
        .limit(1);

      if (briefingData && briefingData.length > 0) {
        setLatestBriefing(briefingData[0].content);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Run the full follow-up engine
  const runEngine = useCallback(async (): Promise<FollowUpEngineResult> => {
    setIsRunning(true);
    setError(null);
    try {
      const result = await runFollowUpEngine();
      setLastResult(result);
      await fetchData(); // Refresh stats
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Engine failed';
      setError(errorMsg);
      throw err;
    } finally {
      setIsRunning(false);
    }
  }, [fetchData]);

  // Trigger via edge function
  const triggerFollowUpScan = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('follow-up-engine');
      if (fnError) throw fnError;
      await fetchData();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trigger failed');
      throw err;
    } finally {
      setIsRunning(false);
    }
  }, [fetchData]);

  // Generate briefing
  const generateBriefing = useCallback(async (type: 'morning' | 'evening') => {
    try {
      const briefing = await generateDailyBriefing(type);
      setLatestBriefing(briefing);
      return briefing;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate briefing');
      throw err;
    }
  }, []);

  // Update settings
  const updateSettings = useCallback(async (category: string, newSettings: Record<string, any>) => {
    const success = await updateFollowUpSettings(category, newSettings);
    if (success) {
      await fetchData();
    }
    return success;
  }, [fetchData]);

  // Manual follow-up actions
  const triggerInvoiceFollowUp = useCallback(async (invoiceId: string, daysOverdue: number) => {
    if (!settings?.invoice) return;
    return sendInvoiceReminder(invoiceId, daysOverdue, settings.invoice);
  }, [settings]);

  const triggerStoreFollowUp = useCallback(async (storeId: string, daysSinceVisit: number) => {
    if (!settings?.store) return;
    return sendStoreRecoveryMessage(storeId, daysSinceVisit, settings.store);
  }, [settings]);

  const triggerInventoryAlert = useCallback(async (
    itemId: string,
    itemName: string,
    currentQty: number,
    reorderPoint: number
  ) => {
    return createReorderAlert(itemId, itemName, currentQty, reorderPoint);
  }, []);

  const triggerAmbassadorFollowUp = useCallback(async (ambassadorId: string, daysSinceActivity: number) => {
    if (!settings?.ambassador) return;
    return sendAmbassadorMotivation(ambassadorId, daysSinceActivity, settings.ambassador);
  }, [settings]);

  // Mark entity as resolved
  const markResolved = useCallback(async (entityType: string, entityId: string, action: string) => {
    await logFollowUpAction({
      entityType,
      entityId,
      actionTaken: action,
      actionCategory: entityType,
      result: 'resolved',
    });

    // Also update risk insight if exists
    const client = supabase as any;
    await client
      .from('ai_risk_insights')
      .update({ status: 'resolved' })
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('status', 'open');

    await fetchData();
  }, [fetchData]);

  return {
    // State
    isRunning,
    lastResult,
    stats,
    recentLogs,
    settings,
    latestBriefing,
    loading,
    error,

    // Actions
    runEngine,
    triggerFollowUpScan,
    generateBriefing,
    updateSettings,
    fetchData,

    // Manual triggers
    triggerInvoiceFollowUp,
    triggerStoreFollowUp,
    triggerInventoryAlert,
    triggerAmbassadorFollowUp,
    markResolved,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK: FOLLOW-UP STATS ONLY (lighter weight)
// ═══════════════════════════════════════════════════════════════════════════════

export function useFollowUpStats() {
  const [stats, setStats] = useState<FollowUpStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await fetchFollowUpStats();
      setStats(data);
      setLoading(false);
    };
    load();
  }, []);

  return { stats, loading };
}
