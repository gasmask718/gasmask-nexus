// ═══════════════════════════════════════════════════════════════════════════════
// RISK RADAR HOOK — Fetch and manage risk insights
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RiskLevel, RiskType, computeRiskSummary, RiskSummary } from '@/lib/riskEngine';

export interface RiskInsight {
  id: string;
  entity_type: string;
  entity_id: string | null;
  brand: string | null;
  region: string | null;
  risk_type: string;
  risk_score: number;
  risk_level: string;
  headline: string;
  details: string | null;
  recommended_action: string | null;
  source_data: Record<string, any>;
  status: string;
  created_at: string;
  expires_at: string | null;
}

export interface KpiSnapshot {
  id: string;
  snapshot_date: string;
  brand: string | null;
  region: string | null;
  total_stores: number;
  active_stores: number;
  inactive_stores: number;
  total_invoices: number;
  unpaid_invoices: number;
  total_revenue: number;
  deliveries_today: number;
  low_stock_items: number;
  created_at: string;
}

export interface RiskRadarFilters {
  brand?: string;
  region?: string;
  minLevel?: RiskLevel;
  riskType?: RiskType;
  status?: 'open' | 'resolved' | 'ignored';
}

export interface RisksByType {
  churn: RiskInsight[];
  non_payment: RiskInsight[];
  low_stock: RiskInsight[];
  overworked: RiskInsight[];
  inactive_ambassador: RiskInsight[];
}

export function useRiskRadar(filters?: RiskRadarFilters) {
  const [risks, setRisks] = useState<RiskInsight[]>([]);
  const [risksByType, setRisksByType] = useState<RisksByType>({
    churn: [],
    non_payment: [],
    low_stock: [],
    overworked: [],
    inactive_ambassador: [],
  });
  const [summary, setSummary] = useState<RiskSummary>({
    total: 0,
    byLevel: { low: 0, medium: 0, high: 0, critical: 0 },
    byType: { churn: 0, non_payment: 0, low_stock: 0, overworked: 0, inactive_ambassador: 0 },
    critical: 0,
    high: 0,
  });
  const [latestSnapshot, setLatestSnapshot] = useState<KpiSnapshot | null>(null);
  const [recentSnapshots, setRecentSnapshots] = useState<KpiSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRisks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Use type casting to work around type generation lag
      const client = supabase as any;
      
      let query = client
        .from('ai_risk_insights')
        .select('*')
        .eq('status', filters?.status || 'open')
        .order('risk_score', { ascending: false });

      if (filters?.brand) {
        query = query.eq('brand', filters.brand);
      }
      if (filters?.region) {
        query = query.eq('region', filters.region);
      }
      if (filters?.riskType) {
        query = query.eq('risk_type', filters.riskType);
      }
      if (filters?.minLevel) {
        const levelOrder = ['low', 'medium', 'high', 'critical'];
        const minIndex = levelOrder.indexOf(filters.minLevel);
        const validLevels = levelOrder.slice(minIndex);
        query = query.in('risk_level', validLevels);
      }

      const { data: risksData, error: risksError } = await query;

      if (risksError) throw risksError;

      const typedRisks = (risksData || []) as RiskInsight[];
      setRisks(typedRisks);

      // Group by type
      const grouped: RisksByType = {
        churn: [],
        non_payment: [],
        low_stock: [],
        overworked: [],
        inactive_ambassador: [],
      };

      for (const risk of typedRisks) {
        const type = risk.risk_type as keyof RisksByType;
        if (type in grouped) {
          grouped[type].push(risk);
        }
      }
      setRisksByType(grouped);

      // Compute summary
      const summaryData = computeRiskSummary(
        typedRisks.map(r => ({
          risk_level: r.risk_level as RiskLevel,
          risk_type: r.risk_type as RiskType,
        }))
      );
      setSummary(summaryData);

    } catch (err) {
      console.error('Error fetching risks:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch risks');
    } finally {
      setLoading(false);
    }
  }, [filters?.brand, filters?.region, filters?.minLevel, filters?.riskType, filters?.status]);

  const fetchSnapshots = useCallback(async () => {
    try {
      const client = supabase as any;
      
      // Get latest snapshot
      let latestQuery = client
        .from('ai_kpi_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(1);

      if (filters?.brand) {
        latestQuery = latestQuery.eq('brand', filters.brand);
      }
      if (filters?.region) {
        latestQuery = latestQuery.eq('region', filters.region);
      }

      const { data: latestData } = await latestQuery;
      if (latestData && latestData.length > 0) {
        setLatestSnapshot(latestData[0] as KpiSnapshot);
      }

      // Get last 7 days for trends
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      let recentQuery = client
        .from('ai_kpi_snapshots')
        .select('*')
        .gte('snapshot_date', sevenDaysAgo.toISOString().split('T')[0])
        .order('snapshot_date', { ascending: true });

      if (filters?.brand) {
        recentQuery = recentQuery.eq('brand', filters.brand);
      }
      if (filters?.region) {
        recentQuery = recentQuery.eq('region', filters.region);
      }

      const { data: recentData } = await recentQuery;
      setRecentSnapshots((recentData || []) as KpiSnapshot[]);

    } catch (err) {
      console.error('Error fetching snapshots:', err);
    }
  }, [filters?.brand, filters?.region]);

  const updateRiskStatus = useCallback(async (
    riskId: string,
    newStatus: 'open' | 'resolved' | 'ignored'
  ) => {
    try {
      const client = supabase as any;
      const { error } = await client
        .from('ai_risk_insights')
        .update({ status: newStatus })
        .eq('id', riskId);

      if (error) throw error;
      
      // Refresh data
      fetchRisks();
    } catch (err) {
      console.error('Error updating risk status:', err);
      throw err;
    }
  }, [fetchRisks]);

  const triggerRiskScan = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('ai-risk-scan');
      if (error) throw error;
      
      // Refresh data after scan
      await fetchRisks();
      await fetchSnapshots();
      
      return data;
    } catch (err) {
      console.error('Error triggering risk scan:', err);
      throw err;
    }
  }, [fetchRisks, fetchSnapshots]);

  useEffect(() => {
    fetchRisks();
    fetchSnapshots();
  }, [fetchRisks, fetchSnapshots]);

  return {
    risks,
    risksByType,
    summary,
    latestSnapshot,
    recentSnapshots,
    loading,
    error,
    refetch: fetchRisks,
    updateRiskStatus,
    triggerRiskScan,
  };
}

// Hook to get top risks for dashboard panels
export function useTopRisks(limit: number = 5) {
  const [topRisks, setTopRisks] = useState<RiskInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopRisks = async () => {
      try {
        const client = supabase as any;
        const { data, error } = await client
          .from('ai_risk_insights')
          .select('*')
          .eq('status', 'open')
          .in('risk_level', ['high', 'critical'])
          .order('risk_score', { ascending: false })
          .limit(limit);

        if (error) throw error;
        setTopRisks((data || []) as RiskInsight[]);
      } catch (err) {
        console.error('Error fetching top risks:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTopRisks();
  }, [limit]);

  return { topRisks, loading };
}
