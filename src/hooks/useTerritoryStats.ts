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
      const { data, error } = await supabase
        .from('territory_stats_daily')
        .select('*')
        .order('heat_score', { ascending: false });

      if (error) throw error;
      
      let filtered = data || [];
      if (filters?.date) {
        filtered = filtered.filter((d: any) => d.date === filters.date);
      }
      if (filters?.boro) {
        filtered = filtered.filter((d: any) => d.boro === filters.boro);
      }
      
      return filtered as TerritoryStats[];
    }
  });
}

export function useBoroList() {
  return useQuery({
    queryKey: ['boro-list'],
    queryFn: async () => {
      // Return static NYC boros for now
      return ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
    }
  });
}

export function useNeighborhoodList(boro?: string) {
  return useQuery({
    queryKey: ['neighborhood-list', boro],
    queryFn: async () => {
      // Return sample neighborhoods
      const neighborhoods: Record<string, string[]> = {
        'Manhattan': ['Harlem', 'Upper East Side', 'Midtown', 'Chelsea', 'SoHo', 'Lower East Side'],
        'Brooklyn': ['Williamsburg', 'Bushwick', 'Bed-Stuy', 'Park Slope', 'Crown Heights'],
        'Queens': ['Astoria', 'Long Island City', 'Flushing', 'Jamaica', 'Jackson Heights'],
        'Bronx': ['South Bronx', 'Fordham', 'Riverdale', 'Tremont'],
        'Staten Island': ['St. George', 'Stapleton', 'New Dorp']
      };
      return boro ? (neighborhoods[boro] || []) : [];
    },
    enabled: !!boro
  });
}

export function useComputeTerritoryStats() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ date }: { date?: string }) => {
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      
      const { data: issues } = await supabase
        .from('biker_issues')
        .select('*')
        .in('status', ['open', 'in_progress']);
      
      const boroStats: Record<string, { tasks: number; issues_open: number; issues_critical: number }> = {};
      
      // Default NYC boros
      const defaultBoros = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
      for (const boro of defaultBoros) {
        boroStats[boro] = { tasks: 0, issues_open: 0, issues_critical: 0 };
      }
      
      for (const issue of (issues || [])) {
        const boro = 'Manhattan'; // Default for demo
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
        for (const record of upsertData) {
          await supabase.from('territory_stats_daily').upsert(record);
        }
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

export function useStoresInTerritory(boro?: string) {
  return useQuery({
    queryKey: ['stores-in-territory', boro],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_master')
        .select('*')
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!boro
  });
}

export function useIssuesInTerritory(boro?: string) {
  return useQuery({
    queryKey: ['issues-in-territory', boro],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('biker_issues')
        .select('*')
        .in('status', ['open', 'in_progress'])
        .order('severity', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!boro
  });
}
