import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OpsLog {
  id: string;
  cycle_type: 'morning' | 'midday' | 'evening';
  results: Record<string, any>;
  run_at: string;
  success: boolean;
  notes: string | null;
  errors: string[] | null;
}

export interface OpsSettings {
  morning_enabled: boolean;
  midday_enabled: boolean;
  evening_enabled: boolean;
}

export interface OpsStats {
  todayActions: number;
  routesCreated: number;
  highUrgencyIssues: number;
  criticalRisks: number;
  storesNeedingVisits: number;
  unpaidInvoices: number;
  pendingMessages: number;
}

export function useAutonomousOps() {
  const [logs, setLogs] = useState<OpsLog[]>([]);
  const [settings, setSettings] = useState<OpsSettings>({
    morning_enabled: true,
    midday_enabled: true,
    evening_enabled: true,
  });
  const [stats, setStats] = useState<OpsStats>({
    todayActions: 0,
    routesCreated: 0,
    highUrgencyIssues: 0,
    criticalRisks: 0,
    storesNeedingVisits: 0,
    unpaidInvoices: 0,
    pendingMessages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [runningCycle, setRunningCycle] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ai_ops_log')
        .select('*')
        .order('run_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setLogs((data || []) as OpsLog[]);
    } catch (error) {
      console.error('Error fetching ops logs:', error);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ai_follow_up_settings')
        .select('morning_enabled, midday_enabled, evening_enabled')
        .limit(1)
        .single();

      if (data) {
        setSettings({
          morning_enabled: data.morning_enabled ?? true,
          midday_enabled: data.midday_enabled ?? true,
          evening_enabled: data.evening_enabled ?? true,
        });
      }
    } catch (error) {
      console.error('Error fetching ops settings:', error);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayStart = `${today}T00:00:00.000Z`;

      // Get today's follow-up actions
      const { count: todayActions } = await supabase
        .from('ai_follow_up_log')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart);

      // Get route recommendations created today
      const { count: routesCreated } = await supabase
        .from('ai_recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('category', 'route')
        .gte('created_at', todayStart);

      // Get high urgency issues
      const { count: highUrgencyIssues } = await supabase
        .from('ai_communication_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .gte('urgency', 70);

      // Get critical risks
      const { count: criticalRisks } = await supabase
        .from('ai_risk_insights')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .eq('risk_level', 'critical');

      // Get stores needing visits
      const { count: storesNeedingVisits } = await supabase
        .from('ai_risk_insights')
        .select('*', { count: 'exact', head: true })
        .eq('entity_type', 'store')
        .eq('status', 'open')
        .gte('risk_score', 60);

      // Get unpaid invoices
      const { count: unpaidInvoices } = await supabase
        .from('ai_risk_insights')
        .select('*', { count: 'exact', head: true })
        .eq('entity_type', 'invoice')
        .eq('risk_type', 'non_payment')
        .eq('status', 'open');

      // Get pending messages
      const { count: pendingMessages } = await supabase
        .from('ai_communication_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      setStats({
        todayActions: todayActions || 0,
        routesCreated: routesCreated || 0,
        highUrgencyIssues: highUrgencyIssues || 0,
        criticalRisks: criticalRisks || 0,
        storesNeedingVisits: storesNeedingVisits || 0,
        unpaidInvoices: unpaidInvoices || 0,
        pendingMessages: pendingMessages || 0,
      });
    } catch (error) {
      console.error('Error fetching ops stats:', error);
    }
  }, []);

  const runCycle = useCallback(async (cycleType: 'morning' | 'midday' | 'evening') => {
    setRunningCycle(cycleType);
    try {
      const functionName = `${cycleType}-ops-cycle`;
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {},
      });

      if (error) throw error;

      toast.success(`${cycleType.charAt(0).toUpperCase() + cycleType.slice(1)} cycle completed`, {
        description: data?.skipped ? 'Cycle was skipped (disabled in settings)' : `Duration: ${data?.duration}ms`,
      });

      // Refresh data
      await Promise.all([fetchLogs(), fetchStats()]);

      return data;
    } catch (error) {
      console.error(`Error running ${cycleType} cycle:`, error);
      toast.error(`Failed to run ${cycleType} cycle`, {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      setRunningCycle(null);
    }
  }, [fetchLogs, fetchStats]);

  const updateSettings = useCallback(async (newSettings: Partial<OpsSettings>) => {
    try {
      // Get the first settings row ID
      const { data: existingSettings } = await supabase
        .from('ai_follow_up_settings')
        .select('id')
        .limit(1)
        .single();

      if (existingSettings) {
        const { error } = await supabase
          .from('ai_follow_up_settings')
          .update(newSettings)
          .eq('id', existingSettings.id);

        if (error) throw error;
      }

      setSettings(prev => ({ ...prev, ...newSettings }));
      toast.success('Settings updated');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    }
  }, []);

  const clearLogs = useCallback(async (cycleType?: string) => {
    try {
      let query = supabase.from('ai_ops_log').delete();
      
      if (cycleType) {
        query = query.eq('cycle_type', cycleType);
      } else {
        // Delete all logs older than 7 days
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.lt('run_at', weekAgo.toISOString());
      }

      const { error } = await query;
      if (error) throw error;

      toast.success('Logs cleared');
      await fetchLogs();
    } catch (error) {
      console.error('Error clearing logs:', error);
      toast.error('Failed to clear logs');
    }
  }, [fetchLogs]);

  const getLastRun = useCallback((cycleType: 'morning' | 'midday' | 'evening') => {
    return logs.find(log => log.cycle_type === cycleType);
  }, [logs]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchLogs(), fetchSettings(), fetchStats()]);
      setLoading(false);
    };
    loadData();
  }, [fetchLogs, fetchSettings, fetchStats]);

  return {
    logs,
    settings,
    stats,
    loading,
    runningCycle,
    runCycle,
    updateSettings,
    clearLogs,
    getLastRun,
    refreshData: () => Promise.all([fetchLogs(), fetchSettings(), fetchStats()]),
  };
}

// Lighter hook for just stats
export function useOpsStats() {
  const [stats, setStats] = useState<OpsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const todayStart = `${today}T00:00:00.000Z`;

        const [
          { count: todayActions },
          { count: criticalRisks },
          { count: pendingMessages },
        ] = await Promise.all([
          supabase.from('ai_follow_up_log').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
          supabase.from('ai_risk_insights').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('risk_level', 'critical'),
          supabase.from('ai_communication_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        ]);

        setStats({
          todayActions: todayActions || 0,
          routesCreated: 0,
          highUrgencyIssues: 0,
          criticalRisks: criticalRisks || 0,
          storesNeedingVisits: 0,
          unpaidInvoices: 0,
          pendingMessages: pendingMessages || 0,
        });
      } catch (error) {
        console.error('Error fetching ops stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading };
}
