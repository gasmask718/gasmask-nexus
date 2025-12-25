import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';

export interface BikerPerformance {
  id: string;
  business_id?: string;
  biker_id: string;
  date: string;
  tasks_assigned: number;
  tasks_submitted: number;
  tasks_approved: number;
  tasks_rejected: number;
  tasks_late: number;
  avg_time_to_submit_minutes?: number;
  issues_reported: number;
  issues_overdue: number;
  score: number;
  coaching_notes?: string;
  created_at: string;
}

export function useBikerPerformance(bikerId: string, days: number = 14) {
  const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
  
  return useQuery({
    queryKey: ['biker-performance', bikerId, days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('biker_performance_daily')
        .select('*')
        .eq('biker_id', bikerId)
        .gte('date', startDate)
        .order('date', { ascending: true });
      if (error) throw error;
      return data as BikerPerformance[];
    },
    enabled: !!bikerId
  });
}

export function useBikerLatestPerformance(bikerId: string) {
  return useQuery({
    queryKey: ['biker-performance-latest', bikerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('biker_performance_daily')
        .select('*')
        .eq('biker_id', bikerId)
        .order('date', { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as BikerPerformance | null;
    },
    enabled: !!bikerId
  });
}

export function useAllBikersPerformance(date?: string) {
  const targetDate = date || format(new Date(), 'yyyy-MM-dd');
  
  return useQuery({
    queryKey: ['all-bikers-performance', targetDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('biker_performance_daily')
        .select(`
          *,
          biker:profiles(id, name)
        `)
        .eq('date', targetDate)
        .order('score', { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        biker: p.biker ? { id: p.biker.id, full_name: p.biker.name } : null
      }));
    }
  });
}

export function useComputeBikerPerformance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ bikerId, date }: { bikerId: string; date?: string }) => {
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      
      // Fetch store checks for the biker on this date
      const { data: checks } = await supabase
        .from('store_checks')
        .select('*')
        .eq('assigned_biker_id', bikerId)
        .eq('scheduled_date', targetDate);
      
      // Fetch issues for the biker
      const { data: issues } = await supabase
        .from('biker_issues')
        .select('*')
        .eq('assigned_biker_id', bikerId)
        .gte('created_at', `${targetDate}T00:00:00`)
        .lte('created_at', `${targetDate}T23:59:59`);
      
      const tasksAssigned = checks?.length || 0;
      const tasksSubmitted = checks?.filter(c => c.status === 'submitted' || c.status === 'approved' || c.status === 'rejected').length || 0;
      const tasksApproved = checks?.filter(c => c.status === 'approved').length || 0;
      const tasksRejected = checks?.filter(c => c.status === 'rejected').length || 0;
      const tasksLate = 0; // Would need SLA data from checks
      const issuesReported = issues?.filter(i => i.reported_by_biker_id === bikerId).length || 0;
      const issuesOverdue = issues?.filter(i => i.due_at && new Date(i.due_at) < new Date() && i.status !== 'resolved').length || 0;
      
      // Compute score
      const rejectedRate = tasksSubmitted > 0 ? tasksRejected / tasksSubmitted : 0;
      const lateRate = tasksSubmitted > 0 ? tasksLate / tasksSubmitted : 0;
      
      let score = 100;
      score -= rejectedRate * 30;
      score -= lateRate * 25;
      score -= issuesOverdue * 20;
      score += tasksApproved * 2;
      score = Math.max(0, Math.min(100, score));
      
      // Upsert performance record
      const { data, error } = await supabase
        .from('biker_performance_daily')
        .upsert({
          biker_id: bikerId,
          date: targetDate,
          tasks_assigned: tasksAssigned,
          tasks_submitted: tasksSubmitted,
          tasks_approved: tasksApproved,
          tasks_rejected: tasksRejected,
          tasks_late: tasksLate,
          issues_reported: issuesReported,
          issues_overdue: issuesOverdue,
          score: Math.round(score * 10) / 10
        }, { onConflict: 'biker_id,date' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['biker-performance', variables.bikerId] });
      queryClient.invalidateQueries({ queryKey: ['biker-performance-latest', variables.bikerId] });
      toast.success('Performance recomputed');
    },
    onError: () => toast.error('Failed to compute performance')
  });
}

export function useUpdateCoachingNotes() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ performanceId, notes }: { performanceId: string; notes: string }) => {
      const { error } = await supabase
        .from('biker_performance_daily')
        .update({ coaching_notes: notes })
        .eq('id', performanceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['biker-performance'] });
      toast.success('Coaching notes saved');
    },
    onError: () => toast.error('Failed to save notes')
  });
}
