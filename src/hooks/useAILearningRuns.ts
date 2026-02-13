// ═══════════════════════════════════════════════════════════════════════════════
// AI LEARNING RUNS HOOK — Phase 6: Controlled AI Learning (Opt-In, Gated)
// ═══════════════════════════════════════════════════════════════════════════════
// Read-only analytics over feedback data. No dispatch mutations.
// Learning output produces proposed diffs that require human approval.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback } from 'react';
import { toast } from 'sonner';

export interface LearningRun {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: 'pending' | 'completed' | 'rolled_back';
  initiated_by: string;
  data_window_start: string;
  data_window_end: string;
  proposed_diff: Record<string, any> | null;
  summary: Record<string, any> | null;
  approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  rolled_back_at: string | null;
  rolled_back_by: string | null;
}

export interface LearningAnalytics {
  totalFeedback: number;
  appliedCount: number;
  dismissedCount: number;
  ignoredCount: number;
  applyRate: number;
  avgLatencySeconds: number;
  byConfidenceBucket: { bucket: string; applied: number; dismissed: number; ignored: number }[];
  byRiskLevel: { risk: string; applied: number; dismissed: number }[];
  topDismissedStores: { store_name: string; count: number }[];
  topReasons: { reason_code: string; count: number }[];
}

export function useAILearningRuns() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch learning runs
  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ['ai-learning-runs'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('ai_learning_runs') as any)
        .select('*')
        .order('started_at', { ascending: false });
      if (error) throw error;
      return (data || []) as LearningRun[];
    },
  });

  // Fetch analytics from feedback data
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['ai-dispatch-analytics'],
    queryFn: async (): Promise<LearningAnalytics> => {
      const { data: feedback } = await supabase
        .from('ai_dispatch_feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      const items = feedback || [];
      const totalFeedback = items.length;
      const applied = items.filter((f: any) => f.event_type === 'applied');
      const dismissed = items.filter((f: any) => f.event_type === 'dismissed');
      const ignored = items.filter((f: any) => f.event_type === 'ignored');
      const shown = items.filter((f: any) => f.event_type === 'shown');

      const actionable = applied.length + dismissed.length + ignored.length;
      const applyRate = actionable > 0 ? Math.round((applied.length / actionable) * 100) : 0;

      const latencies = [...applied, ...dismissed]
        .filter((f: any) => f.decision_latency_seconds != null)
        .map((f: any) => f.decision_latency_seconds);
      const avgLatency = latencies.length > 0
        ? Math.round(latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length)
        : 0;

      // Confidence buckets
      const buckets = ['0-30', '31-50', '51-70', '71-85', '86-100'];
      const getBucket = (c: number) => {
        if (c <= 30) return '0-30';
        if (c <= 50) return '31-50';
        if (c <= 70) return '51-70';
        if (c <= 85) return '71-85';
        return '86-100';
      };

      const byConfidenceBucket = buckets.map(bucket => ({
        bucket,
        applied: items.filter((f: any) => f.event_type === 'applied' && getBucket(f.confidence) === bucket).length,
        dismissed: items.filter((f: any) => f.event_type === 'dismissed' && getBucket(f.confidence) === bucket).length,
        ignored: items.filter((f: any) => f.event_type === 'ignored' && getBucket(f.confidence) === bucket).length,
      }));

      // By risk level
      const risks = ['low', 'medium', 'high'];
      const byRiskLevel = risks.map(risk => ({
        risk,
        applied: items.filter((f: any) => f.event_type === 'applied' && f.risk_level === risk).length,
        dismissed: items.filter((f: any) => f.event_type === 'dismissed' && f.risk_level === risk).length,
      }));

      // Top dismissed stores
      const dismissedStores = new Map<string, number>();
      dismissed.forEach((f: any) => {
        dismissedStores.set(f.store_name, (dismissedStores.get(f.store_name) || 0) + 1);
      });
      const topDismissedStores = Array.from(dismissedStores.entries())
        .map(([store_name, count]) => ({ store_name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Top reason codes
      const { data: reasons } = await (supabase
        .from('ai_dispatch_feedback_reasons') as any)
        .select('reason_code')
        .limit(500);

      const reasonCounts = new Map<string, number>();
      (reasons || []).forEach((r: any) => {
        reasonCounts.set(r.reason_code, (reasonCounts.get(r.reason_code) || 0) + 1);
      });
      const topReasons = Array.from(reasonCounts.entries())
        .map(([reason_code, count]) => ({ reason_code, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalFeedback,
        appliedCount: applied.length,
        dismissedCount: dismissed.length,
        ignoredCount: ignored.length,
        applyRate,
        avgLatencySeconds: avgLatency,
        byConfidenceBucket,
        byRiskLevel,
        topDismissedStores,
        topReasons,
      };
    },
  });

  // Start a learning run (reads feedback, produces proposed diff)
  const startLearningRun = useCallback(async (windowStart: string, windowEnd: string) => {
    if (!user?.id) return;

    // Fetch feedback in window
    const { data: feedback } = await supabase
      .from('ai_dispatch_feedback')
      .select('*')
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd);

    const items = feedback || [];
    const applied = items.filter((f: any) => f.event_type === 'applied');
    const dismissed = items.filter((f: any) => f.event_type === 'dismissed');

    // Generate a proposed diff (read-only analysis — no actual weight changes)
    const proposedDiff = {
      analysis_window: { start: windowStart, end: windowEnd },
      total_feedback: items.length,
      applied_count: applied.length,
      dismissed_count: dismissed.length,
      apply_rate: items.length > 0 ? Math.round((applied.length / items.length) * 100) : 0,
      observations: [] as string[],
      proposed_weight_adjustments: {} as Record<string, string>,
    };

    // Observations based on patterns
    const highConfDismissed = dismissed.filter((f: any) => f.confidence >= 80).length;
    if (highConfDismissed > 5) {
      proposedDiff.observations.push(
        `${highConfDismissed} high-confidence suggestions (≥80%) were dismissed — confidence calibration may be needed`
      );
      proposedDiff.proposed_weight_adjustments['confidence_threshold'] = 'Consider raising from 70% to 75%';
    }

    const lowConfApplied = applied.filter((f: any) => f.confidence < 50).length;
    if (lowConfApplied > 3) {
      proposedDiff.observations.push(
        `${lowConfApplied} low-confidence suggestions (<50%) were applied — scoring may underweight certain factors`
      );
    }

    const summary = {
      feedback_count: items.length,
      apply_rate: proposedDiff.apply_rate,
      observations_count: proposedDiff.observations.length,
      generated_at: new Date().toISOString(),
    };

    const { error } = await (supabase.from('ai_learning_runs') as any).insert([{
      status: 'completed',
      initiated_by: user.id,
      completed_at: new Date().toISOString(),
      data_window_start: windowStart,
      data_window_end: windowEnd,
      proposed_diff: proposedDiff,
      summary,
    }]);

    if (error) {
      toast.error('Failed to create learning run');
      return;
    }

    toast.success('Learning run completed — review proposed changes');
    queryClient.invalidateQueries({ queryKey: ['ai-learning-runs'] });
  }, [user?.id, queryClient]);

  // Approve a learning run
  const approveLearningRun = useCallback(async (runId: string) => {
    if (!user?.id) return;

    const { error } = await (supabase.from('ai_learning_runs') as any)
      .update({
        approved: true,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', runId);

    if (error) {
      toast.error('Failed to approve learning run');
      return;
    }

    toast.success('Learning run approved — changes versioned');
    queryClient.invalidateQueries({ queryKey: ['ai-learning-runs'] });
  }, [user?.id, queryClient]);

  // Rollback a learning run
  const rollbackLearningRun = useCallback(async (runId: string) => {
    if (!user?.id) return;

    const { error } = await (supabase.from('ai_learning_runs') as any)
      .update({
        status: 'rolled_back',
        rolled_back_at: new Date().toISOString(),
        rolled_back_by: user.id,
        approved: false,
      })
      .eq('id', runId);

    if (error) {
      toast.error('Failed to rollback learning run');
      return;
    }

    toast.success('Learning run rolled back');
    queryClient.invalidateQueries({ queryKey: ['ai-learning-runs'] });
  }, [user?.id, queryClient]);

  return {
    runs,
    analytics,
    runsLoading,
    analyticsLoading,
    startLearningRun,
    approveLearningRun,
    rollbackLearningRun,
  };
}
