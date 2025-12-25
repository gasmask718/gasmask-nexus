import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

export interface TerritoryStats {
  id: string;
  business_id?: string;
  date: string;
  boro: string;
  neighborhood?: string;
  tasks_completed: number;
  issues_open: number;
  issues_critical: number;
  revenue_impact_estimate?: number;
  heat_score: number;
  created_at: string;
}

export function useTerritoryStats(filters?: {
  date?: string;
  boro?: string;
}) {
  return useQuery({
    queryKey: ['territory-stats', filters],
    queryFn: async () => {
      let query = supabase
        .from('territory_stats_daily')
        .select('*')
        .order('heat_score', { ascending: false });

      if (filters?.date) {
        query = query.eq('date', filters.date);
      }
      if (filters?.boro) {
        query = query.eq('boro', filters.boro);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TerritoryStats[];
    }
  });
}

export function useBoroList() {
  return useQuery({
    queryKey: ['boro-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_master')
        .select('boro')
        .not('boro', 'is', null);
      if (error) throw error;
      
      // Get unique boros
      const boros = [...new Set((data || []).map((d: any) => d.boro).filter(Boolean))];
      return boros.sort();
    }
  });
}

export function useNeighborhoodList(boro?: string) {
  return useQuery({
    queryKey: ['neighborhood-list', boro],
    queryFn: async () => {
      let query = supabase
        .from('store_master')
        .select('neighborhood')
        .not('neighborhood', 'is', null);
      
      if (boro) {
        query = query.eq('boro', boro);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const neighborhoods = [...new Set((data || []).map((d: any) => d.neighborhood).filter(Boolean))];
      return neighborhoods.sort();
    },
    enabled: !boro || boro.length > 0
  });
}

export function useComputeTerritoryStats() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ date }: { date?: string }) => {
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      
      const { data: issues } = await supabase.from('biker_issues').select('*').in('status', ['open', 'in_progress']);
      
      const boroStats: Record<string, { tasks: number; issues_open: number; issues_critical: number }> = {};
      
      for (const issue of (issues || [])) {
        const boro = 'Unknown';
        if (!boroStats[boro]) boroStats[boro] = { tasks: 0, issues_open: 0, issues_critical: 0 };
        boroStats[boro].issues_open++;
        if (issue.severity === 'critical') boroStats[boro].issues_critical++;
      }
      
      const upsertData = Object.entries(boroStats).map(([boro, stats]) => ({
        date: targetDate,
        boro,
        tasks_completed: stats.tasks,
        issues_open: stats.issues_open,
        issues_critical: stats.issues_critical,
        heat_score: Math.min(100, stats.issues_open * 10 + stats.issues_critical * 30)
      }));
      
      if (upsertData.length > 0) {
        await supabase.from('territory_stats_daily').upsert(upsertData as any);
      }
      
      return { updated: upsertData.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territory-stats'] });
      toast.success('Territory stats updated');
    },
    onError: () => toast.error('Failed to compute territory stats')
  });
}

export function useStoresInTerritory(boro?: string, neighborhood?: string) {
  return useQuery({
    queryKey: ['stores-in-territory', boro, neighborhood],
    queryFn: async () => {
      const { data, error } = await supabase.from('store_master').select('*').limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!boro || !!neighborhood
  });
}

export function useIssuesInTerritory(boro?: string) {
  return useQuery({
    queryKey: ['issues-in-territory', boro],
    queryFn: async () => {
      const { data, error } = await supabase.from('biker_issues').select('*').in('status', ['open', 'in_progress']);
      if (error) throw error;
      return data;
    },
    enabled: !!boro
  });
}

export function useIssuesInTerritory(boro?: string, neighborhood?: string) {
  return useQuery({
    queryKey: ['issues-in-territory', boro, neighborhood],
    queryFn: async () => {
      // First get store IDs in this territory
      let storesQuery = supabase
        .from('store_master')
        .select('id');
      
      if (boro) {
        storesQuery = storesQuery.eq('boro', boro);
      }
      if (neighborhood) {
        storesQuery = storesQuery.eq('neighborhood', neighborhood);
      }
      
      const { data: stores } = await storesQuery;
      const storeIds = (stores || []).map(s => s.id);
      
      if (storeIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('biker_issues')
        .select(`
          *,
          location:store_master(id, name, address)
        `)
        .in('location_id', storeIds)
        .in('status', ['open', 'in_progress'])
        .order('severity', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!boro || !!neighborhood
  });
}
