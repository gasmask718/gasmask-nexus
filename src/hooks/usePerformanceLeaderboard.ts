import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RepPerformance {
  person_type: string;
  stores_visited: number;
  tube_counts_recorded: number;
  interested_signals: number;
  tasks_completed: number;
  notes_written: number;
  total_score: number;
}

export function usePerformanceLeaderboard(range: '7d' | '30d' | '90d' | 'all' = '30d') {
  return useQuery({
    queryKey: ['performance-leaderboard', range],
    queryFn: async () => {
      const daysMap = { '7d': 7, '30d': 30, '90d': 90, 'all': 9999 };
      const days = daysMap[range];
      const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
      const sinceTs = new Date(Date.now() - days * 86400000).toISOString();

      const [checklistRes, tasksRes, notesRes] = await Promise.all([
        supabase
          .from('checklist_tube_intelligence')
          .select('person_type, store_id, tube_count, interest, visit_date')
          .gte('visit_date', since),
        supabase
          .from('ai_work_tasks')
          .select('department, status, created_at')
          .eq('status', 'completed')
          .gte('created_at', sinceTs),
        supabase
          .from('store_notes')
          .select('created_by, created_at')
          .gte('created_at', sinceTs),
      ]);

      const personTypes = ['drivers', 'bikers', 'ambassadors'];
      const results: RepPerformance[] = [];

      for (const pt of personTypes) {
        const entries = (checklistRes.data || []).filter((e: any) => e.person_type === pt);
        const uniqueStores = new Set(entries.map((e: any) => e.store_id)).size;
        const tubesCounted = entries.filter((e: any) => (e.tube_count || 0) > 0).length;
        const interested = entries.filter((e: any) => e.interest === 'Interested').length;
        const notesWritten = (notesRes.data || []).filter((n: any) => n.created_by === pt).length;
        const tasksCompleted = (tasksRes.data || []).filter((t: any) => t.department === pt).length;

        const score = Math.round(
          uniqueStores * 10 + tubesCounted * 3 + interested * 8 + notesWritten * 5 + tasksCompleted * 12
        );

        results.push({
          person_type: pt,
          stores_visited: uniqueStores,
          tube_counts_recorded: tubesCounted,
          interested_signals: interested,
          tasks_completed: tasksCompleted,
          notes_written: notesWritten,
          total_score: score,
        });
      }

      return results.sort((a, b) => b.total_score - a.total_score);
    },
  });
}
