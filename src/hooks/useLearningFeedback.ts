// Floor 9 - Learning Feedback System Hook
// Phase 9.2.1 - Results → Learning Feedback Loop

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { subDays } from 'date-fns';

// ============= TYPES =============

export type FeedbackDecisionType = 'approved' | 'rejected' | 'modified' | 'rolled_back' | 'escalated';

export type FeedbackCategory = 
  | 'accuracy' 
  | 'timing' 
  | 'context_missing' 
  | 'wrong_target' 
  | 'tone_inappropriate' 
  | 'data_stale' 
  | 'permission_issue'
  | 'ambiguous_instructions' 
  | 'other';

export interface FeedbackEntry {
  id: string;
  task_id: string | null;
  action_queue_id: string | null;
  worker_id: string | null;
  playbook_id: string | null;
  decision_type: FeedbackDecisionType;
  confidence_at_decision: number | null;
  task_type: string | null;
  target_entity_type: string | null;
  feedback_category: FeedbackCategory;
  feedback_subcategory: string | null;
  feedback_reasoning: string;
  original_recommendation: string | null;
  modified_to: string | null;
  what_changed: string | null;
  why_changed: string | null;
  was_overconfident: boolean;
  was_underconfident: boolean;
  escalation_was_correct: boolean | null;
  should_retrain_on: boolean;
  pattern_detected: string | null;
  suggested_rule_change: string | null;
  submitted_by: string | null;
  submitted_at: string;
  created_at: string;
}

export interface FeedbackPattern {
  id: string;
  task_type: string | null;
  target_entity_type: string | null;
  worker_id: string | null;
  playbook_id: string | null;
  total_feedback_count: number;
  approved_count: number;
  rejected_count: number;
  modified_count: number;
  rolled_back_count: number;
  avg_confidence_when_approved: number | null;
  avg_confidence_when_rejected: number | null;
  overconfidence_rate: number | null;
  underconfidence_rate: number | null;
  top_rejection_categories: Array<{ category: string; count: number }>;
  top_modification_reasons: Array<{ reason: string; count: number }>;
  confidence_recommendation: string | null;
  suggested_adjustments: Array<{ type: string; recommendation: string }>;
  period_start: string;
  period_end: string;
  created_at: string;
}

export interface ConfidenceRecalibration {
  id: string;
  task_type: string | null;
  worker_id: string | null;
  playbook_id: string | null;
  previous_baseline_confidence: number | null;
  new_baseline_confidence: number | null;
  adjustment_delta: number | null;
  recalibration_reason: string;
  based_on_feedback_count: number | null;
  based_on_pattern_id: string | null;
  triggered_by: 'system' | 'human';
  approved_by: string | null;
  created_at: string;
}

export interface SubmitFeedbackParams {
  taskId?: string;
  actionQueueId?: string;
  workerId?: string;
  playbookId?: string;
  decisionType: FeedbackDecisionType;
  confidenceAtDecision?: number;
  taskType?: string;
  targetEntityType?: string;
  feedbackCategory: FeedbackCategory;
  feedbackSubcategory?: string;
  feedbackReasoning: string;
  originalRecommendation?: string;
  modifiedTo?: string;
  whatChanged?: string;
  whyChanged?: string;
  wasOverconfident?: boolean;
  wasUnderconfident?: boolean;
  escalationWasCorrect?: boolean;
  shouldRetrainOn?: boolean;
  patternDetected?: string;
  suggestedRuleChange?: string;
}

export interface FeedbackAnalytics {
  totalFeedback: number;
  approvalRate: number;
  rejectionRate: number;
  modificationRate: number;
  avgConfidenceApproved: number;
  avgConfidenceRejected: number;
  overconfidenceRate: number;
  topRejectionReasons: Array<{ category: string; count: number; percentage: number }>;
  confidenceCalibrationScore: number;
  feedbackTrend: 'improving' | 'stable' | 'declining';
}

// ============= API FUNCTIONS =============

// Submit structured feedback
export async function submitFeedback(params: SubmitFeedbackParams): Promise<FeedbackEntry> {
  const { data: user } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('ai_feedback_entries')
    .insert({
      task_id: params.taskId || null,
      action_queue_id: params.actionQueueId || null,
      worker_id: params.workerId || null,
      playbook_id: params.playbookId || null,
      decision_type: params.decisionType,
      confidence_at_decision: params.confidenceAtDecision || null,
      task_type: params.taskType || null,
      target_entity_type: params.targetEntityType || null,
      feedback_category: params.feedbackCategory,
      feedback_subcategory: params.feedbackSubcategory || null,
      feedback_reasoning: params.feedbackReasoning,
      original_recommendation: params.originalRecommendation || null,
      modified_to: params.modifiedTo || null,
      what_changed: params.whatChanged || null,
      why_changed: params.whyChanged || null,
      was_overconfident: params.wasOverconfident || false,
      was_underconfident: params.wasUnderconfident || false,
      escalation_was_correct: params.escalationWasCorrect || null,
      should_retrain_on: params.shouldRetrainOn || false,
      pattern_detected: params.patternDetected || null,
      suggested_rule_change: params.suggestedRuleChange || null,
      submitted_by: user?.user?.id || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as FeedbackEntry;
}

// Get recent feedback entries
export async function getFeedbackEntries(limit: number = 100): Promise<FeedbackEntry[]> {
  const { data, error } = await supabase
    .from('ai_feedback_entries')
    .select('*')
    .order('submitted_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as unknown as FeedbackEntry[];
}

// Get feedback patterns
export async function getFeedbackPatterns(days: number = 30): Promise<FeedbackPattern[]> {
  const since = subDays(new Date(), days);
  
  const { data, error } = await supabase
    .from('ai_feedback_patterns')
    .select('*')
    .gte('period_start', since.toISOString())
    .order('period_start', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as FeedbackPattern[];
}

// Get confidence recalibrations
export async function getRecalibrations(limit: number = 50): Promise<ConfidenceRecalibration[]> {
  const { data, error } = await supabase
    .from('ai_confidence_recalibrations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as unknown as ConfidenceRecalibration[];
}

// Compute real-time feedback analytics
export async function computeFeedbackAnalytics(days: number = 30): Promise<FeedbackAnalytics> {
  const since = subDays(new Date(), days);
  
  const { data: feedback, error } = await supabase
    .from('ai_feedback_entries')
    .select('decision_type, confidence_at_decision, feedback_category, was_overconfident, was_underconfident')
    .gte('submitted_at', since.toISOString());

  if (error) throw error;

  const entries = feedback || [];
  const total = entries.length;

  if (total === 0) {
    return {
      totalFeedback: 0,
      approvalRate: 0,
      rejectionRate: 0,
      modificationRate: 0,
      avgConfidenceApproved: 0,
      avgConfidenceRejected: 0,
      overconfidenceRate: 0,
      topRejectionReasons: [],
      confidenceCalibrationScore: 50,
      feedbackTrend: 'stable',
    };
  }

  const approved = entries.filter(e => e.decision_type === 'approved');
  const rejected = entries.filter(e => e.decision_type === 'rejected');
  const modified = entries.filter(e => e.decision_type === 'modified');
  const overconfident = entries.filter(e => e.was_overconfident);

  // Compute average confidence for approved vs rejected
  const avgConfApproved = approved.length > 0
    ? approved.reduce((sum, e) => sum + (e.confidence_at_decision || 0), 0) / approved.length
    : 0;
  const avgConfRejected = rejected.length > 0
    ? rejected.reduce((sum, e) => sum + (e.confidence_at_decision || 0), 0) / rejected.length
    : 0;

  // Count rejection reasons
  const rejectionCategoryCounts: Record<string, number> = {};
  rejected.forEach(e => {
    const cat = e.feedback_category || 'other';
    rejectionCategoryCounts[cat] = (rejectionCategoryCounts[cat] || 0) + 1;
  });

  const topRejectionReasons = Object.entries(rejectionCategoryCounts)
    .map(([category, count]) => ({
      category,
      count,
      percentage: Math.round((count / rejected.length) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Confidence calibration score (0-100)
  // Higher = better calibrated (high confidence leads to approval, low to rejection)
  const calibrationScore = calculateCalibrationScore(entries);

  // Determine trend (simplified - compare first half vs second half)
  const midpoint = Math.floor(entries.length / 2);
  const firstHalf = entries.slice(midpoint);
  const secondHalf = entries.slice(0, midpoint);
  
  const firstHalfApprovalRate = firstHalf.filter(e => e.decision_type === 'approved').length / (firstHalf.length || 1);
  const secondHalfApprovalRate = secondHalf.filter(e => e.decision_type === 'approved').length / (secondHalf.length || 1);
  
  let feedbackTrend: 'improving' | 'stable' | 'declining' = 'stable';
  if (secondHalfApprovalRate > firstHalfApprovalRate + 0.1) feedbackTrend = 'improving';
  else if (secondHalfApprovalRate < firstHalfApprovalRate - 0.1) feedbackTrend = 'declining';

  return {
    totalFeedback: total,
    approvalRate: Math.round((approved.length / total) * 100),
    rejectionRate: Math.round((rejected.length / total) * 100),
    modificationRate: Math.round((modified.length / total) * 100),
    avgConfidenceApproved: Math.round(avgConfApproved),
    avgConfidenceRejected: Math.round(avgConfRejected),
    overconfidenceRate: Math.round((overconfident.length / total) * 100),
    topRejectionReasons,
    confidenceCalibrationScore: calibrationScore,
    feedbackTrend,
  };
}

// Helper: Calculate calibration score
function calculateCalibrationScore(entries: any[]): number {
  if (entries.length < 5) return 50; // Not enough data

  // Perfect calibration: high confidence = approved, low confidence = rejected
  let correctPredictions = 0;
  
  entries.forEach(e => {
    const conf = e.confidence_at_decision || 50;
    const wasApproved = e.decision_type === 'approved';
    
    // If confidence > 70 and approved, or confidence < 50 and rejected = correct
    if ((conf >= 70 && wasApproved) || (conf < 50 && !wasApproved)) {
      correctPredictions++;
    }
  });

  return Math.round((correctPredictions / entries.length) * 100);
}

// ============= HOOKS =============

export function useSubmitFeedback() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: submitFeedback,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor9', 'feedback'] });
      queryClient.invalidateQueries({ queryKey: ['floor9', 'feedback-analytics'] });
      toast({
        title: 'Feedback Recorded',
        description: 'Your feedback has been logged and will improve AI accuracy.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Feedback Failed',
        description: error instanceof Error ? error.message : 'Could not submit feedback',
      });
    },
  });
}

export function useFeedbackEntries(limit: number = 100) {
  return useQuery({
    queryKey: ['floor9', 'feedback', 'entries', limit],
    queryFn: () => getFeedbackEntries(limit),
    staleTime: 30000,
  });
}

export function useFeedbackPatterns(days: number = 30) {
  return useQuery({
    queryKey: ['floor9', 'feedback', 'patterns', days],
    queryFn: () => getFeedbackPatterns(days),
    staleTime: 60000,
  });
}

export function useRecalibrations(limit: number = 50) {
  return useQuery({
    queryKey: ['floor9', 'recalibrations', limit],
    queryFn: () => getRecalibrations(limit),
    staleTime: 60000,
  });
}

export function useFeedbackAnalytics(days: number = 30) {
  return useQuery({
    queryKey: ['floor9', 'feedback-analytics', days],
    queryFn: () => computeFeedbackAnalytics(days),
    staleTime: 60000,
    refetchInterval: 120000,
  });
}
