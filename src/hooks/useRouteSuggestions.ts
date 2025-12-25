import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

export interface RouteSuggestion {
  id: string;
  business_id?: string;
  date: string;
  suggested_for_biker_id?: string;
  status: 'draft' | 'reviewed' | 'approved' | 'applied' | 'dismissed';
  algorithm_version: string;
  summary?: string;
  priority_focus?: string;
  boro_filter?: string;
  neighborhood_filter?: string;
  stops_count: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  biker?: {
    id: string;
    full_name: string;
  };
  stops?: RouteSuggestionStop[];
}

export interface RouteSuggestionStop {
  id: string;
  route_suggestion_id: string;
  location_id?: string;
  stop_order: number;
  reason?: 'high_priority_issue' | 'sla_risk' | 'territory_gap' | 'followup_needed' | 'new_store' | 'other';
  priority: 'low' | 'normal' | 'high';
  estimated_minutes?: number;
  issue_id?: string;
  notes?: string;
  created_at: string;
  location?: {
    id: string;
    name: string;
    address?: string;
    city?: string;
    boro?: string;
    lat?: number;
    lng?: number;
  };
  issue?: {
    id: string;
    issue_type: string;
    severity: string;
    due_at?: string;
  };
}

export function useRouteSuggestions(filters?: {
  date?: string;
  status?: string;
  bikerId?: string;
}) {
  return useQuery({
    queryKey: ['route-suggestions', filters],
    queryFn: async () => {
      let query = supabase
        .from('route_suggestions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.date) query = query.eq('date', filters.date);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.bikerId) query = query.eq('suggested_for_biker_id', filters.bikerId);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as RouteSuggestion[];
    }
  });
}

export function useRouteSuggestion(suggestionId: string) {
  return useQuery({
    queryKey: ['route-suggestion', suggestionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_suggestions')
        .select('*')
        .eq('id', suggestionId)
        .single();
      if (error) throw error;
      
      const { data: stops } = await supabase
        .from('route_suggestion_stops')
        .select('*')
        .eq('route_suggestion_id', suggestionId)
        .order('stop_order', { ascending: true });
      
      return { ...data, stops: stops || [] } as RouteSuggestion;
    },
    enabled: !!suggestionId
  });
}

export function useGenerateRouteSuggestion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ date, boro, neighborhood, priorityFocus, bikerId }: { 
      date?: string; boro?: string; neighborhood?: string; priorityFocus?: string; bikerId?: string;
    }) => {
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      
      const { data: issues } = await supabase
        .from('biker_issues')
        .select('*')
        .in('status', ['open', 'in_progress'])
        .order('due_at', { ascending: true })
        .limit(20);
      
      const { data: suggestion, error } = await supabase
        .from('route_suggestions')
        .insert({
          date: targetDate,
          suggested_for_biker_id: bikerId || null,
          status: 'draft',
          algorithm_version: 'v1',
          summary: `Auto-generated route for ${targetDate}${boro ? ` in ${boro}` : ''}`,
          priority_focus: priorityFocus || 'sla_risk',
          boro_filter: boro,
          neighborhood_filter: neighborhood,
          stops_count: 0
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const stops: any[] = [];
      let order = 1;
      
      for (const issue of (issues || []).slice(0, 10)) {
        stops.push({
          route_suggestion_id: suggestion.id,
          location_id: issue.location_id,
          stop_order: order++,
          reason: issue.severity === 'critical' ? 'high_priority_issue' : 'sla_risk',
          priority: issue.severity === 'critical' ? 'high' : 'normal',
          issue_id: issue.id,
          estimated_minutes: 15
        });
      }
      
      if (stops.length > 0) {
        await supabase.from('route_suggestion_stops').insert(stops);
        await supabase.from('route_suggestions').update({ stops_count: stops.length }).eq('id', suggestion.id);
      }
      
      return { ...suggestion, stops_count: stops.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-suggestions'] });
      toast.success('Route suggestion generated');
    },
    onError: () => toast.error('Failed to generate route suggestion')
  });
}

export function useApplyRouteSuggestion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ suggestionId, bikerId }: { suggestionId: string; bikerId: string }) => {
      const { data: suggestion } = await supabase.from('route_suggestions').select('*').eq('id', suggestionId).single();
      const { data: stops } = await supabase.from('route_suggestion_stops').select('*').eq('route_suggestion_id', suggestionId);
      
      if (!suggestion || !stops?.length) throw new Error('No stops found');
      
      await supabase.from('route_suggestions').update({ status: 'applied', suggested_for_biker_id: bikerId }).eq('id', suggestionId);
      
      return { storeChecksCreated: stops.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['route-suggestions'] });
      toast.success(`Route applied - ${data.storeChecksCreated} tasks created`);
    },
    onError: () => toast.error('Failed to apply route suggestion')
  });
}

export function useDismissRouteSuggestion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const { error } = await supabase.from('route_suggestions').update({ status: 'dismissed' }).eq('id', suggestionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-suggestions'] });
      toast.success('Suggestion dismissed');
    },
    onError: () => toast.error('Failed to dismiss suggestion')
  });
}
