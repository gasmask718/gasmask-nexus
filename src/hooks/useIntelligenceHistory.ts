// ═══════════════════════════════════════════════════════════════════════════════
// INTELLIGENCE HISTORY HOOK
// Phase 3.25 — Observed Intelligence Calibration
// Persist CBRE, conflicts, and unpaid exposure for learning loop
// ═══════════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CBREResult, BrandConflict, InvoiceSummary } from './useMultiBrandIntelligence';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceSnapshot {
  route_id: string;
  recorded_date: string;
  
  // CBRE
  cbre_score: number;
  efficiency_gain_percent: number;
  efficiency_status: 'excellent' | 'acceptable' | 'inefficient';
  actual_stops: number;
  theoretical_stops: number;
  
  // Conflicts
  total_conflicts: number;
  conflict_details: BrandConflict[];
  
  // Finance
  unpaid_invoice_count: number;
  unpaid_exposure_amount: number;
  partial_delivery_count: number;
  
  // Acknowledgment
  acknowledged_at?: string;
  acknowledged_by?: string;
  acknowledgment_note?: string;
  
  // Outcome (post-dispatch)
  dispatch_proceeded?: boolean;
  actual_outcome?: 'success' | 'partial' | 'failed' | 'delayed';
  outcome_notes?: string;
}

export interface IntelligenceHistoryRecord {
  id: string;
  route_id: string;
  recorded_date: string;
  cbre_score: number | null;
  efficiency_gain_percent: number | null;
  efficiency_status: string | null;
  actual_stops: number | null;
  theoretical_stops: number | null;
  total_conflicts: number | null;
  conflict_details: unknown;
  unpaid_invoice_count: number | null;
  unpaid_exposure_amount: number | null;
  partial_delivery_count: number | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  acknowledgment_note: string | null;
  dispatch_proceeded: boolean | null;
  actual_outcome: string | null;
  outcome_notes: string | null;
  created_at: string;
  updated_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE SNAPSHOT FROM CURRENT INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════════════

export function createIntelligenceSnapshot(
  routeId: string,
  cbre: CBREResult,
  conflicts: BrandConflict[],
  invoiceSummary: InvoiceSummary
): Omit<IntelligenceSnapshot, 'recorded_date'> {
  return {
    route_id: routeId,
    cbre_score: cbre.cbre,
    efficiency_gain_percent: cbre.efficiencyGain,
    efficiency_status: cbre.rating,
    actual_stops: cbre.actualStops,
    theoretical_stops: cbre.theoreticalStops,
    total_conflicts: conflicts.length,
    conflict_details: conflicts,
    unpaid_invoice_count: invoiceSummary.byStatus.unpaid,
    unpaid_exposure_amount: invoiceSummary.unpaidAmount,
    partial_delivery_count: invoiceSummary.byStatus.partial,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useIntelligenceHistory(routeId?: string) {
  const queryClient = useQueryClient();

  // Fetch history for a specific route
  const { data: history, isLoading } = useQuery({
    queryKey: ['intelligence-history', routeId],
    queryFn: async () => {
      if (!routeId) return [];
      
      const { data, error } = await supabase
        .from('multi_brand_intelligence_history')
        .select('*')
        .eq('route_id', routeId)
        .order('recorded_date', { ascending: false })
        .limit(30);
      
      if (error) throw error;
      return data as IntelligenceHistoryRecord[];
    },
    enabled: !!routeId,
  });

  // Fetch today's aggregated stats
  const { data: todayStats } = useQuery({
    queryKey: ['intelligence-history', 'today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('multi_brand_intelligence_history')
        .select('*')
        .eq('recorded_date', today);
      
      if (error) throw error;
      
      const records = data as IntelligenceHistoryRecord[];
      
      return {
        totalRoutes: records.length,
        avgCbre: records.length > 0 
          ? records.reduce((sum, r) => sum + Number(r.cbre_score), 0) / records.length 
          : 0,
        totalConflicts: records.reduce((sum, r) => sum + r.total_conflicts, 0),
        totalUnpaidExposure: records.reduce((sum, r) => sum + Number(r.unpaid_exposure_amount), 0),
        acknowledgedCount: records.filter(r => r.acknowledged_at).length,
        dispatchedCount: records.filter(r => r.dispatch_proceeded).length,
        successRate: records.filter(r => r.actual_outcome === 'success').length / 
          Math.max(1, records.filter(r => r.actual_outcome).length) * 100,
      };
    },
  });

  // Record snapshot
  const recordSnapshot = useMutation({
    mutationFn: async (snapshot: Omit<IntelligenceSnapshot, 'recorded_date'>) => {
      const today = new Date().toISOString().split('T')[0];
      
      // First try to insert
      const { error: insertError } = await supabase
        .from('multi_brand_intelligence_history')
        .insert([{
          route_id: snapshot.route_id,
          recorded_date: today,
          cbre_score: snapshot.cbre_score,
          efficiency_gain_percent: snapshot.efficiency_gain_percent,
          efficiency_status: snapshot.efficiency_status,
          actual_stops: snapshot.actual_stops,
          theoretical_stops: snapshot.theoretical_stops,
          total_conflicts: snapshot.total_conflicts,
          conflict_details: JSON.stringify(snapshot.conflict_details),
          unpaid_invoice_count: snapshot.unpaid_invoice_count,
          unpaid_exposure_amount: snapshot.unpaid_exposure_amount,
          partial_delivery_count: snapshot.partial_delivery_count,
        }]);
      
      // If conflict (already exists), update instead
      if (insertError?.code === '23505') {
        const { error: updateError } = await supabase
          .from('multi_brand_intelligence_history')
          .update({
            cbre_score: snapshot.cbre_score,
            efficiency_gain_percent: snapshot.efficiency_gain_percent,
            efficiency_status: snapshot.efficiency_status,
            actual_stops: snapshot.actual_stops,
            theoretical_stops: snapshot.theoretical_stops,
            total_conflicts: snapshot.total_conflicts,
            conflict_details: JSON.stringify(snapshot.conflict_details),
            unpaid_invoice_count: snapshot.unpaid_invoice_count,
            unpaid_exposure_amount: snapshot.unpaid_exposure_amount,
            partial_delivery_count: snapshot.partial_delivery_count,
          })
          .eq('route_id', snapshot.route_id)
          .eq('recorded_date', today);
        
        if (updateError) throw updateError;
      } else if (insertError) {
        throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelligence-history'] });
    },
  });

  // Acknowledge intelligence
  const acknowledge = useMutation({
    mutationFn: async ({ 
      routeId, 
      note 
    }: { 
      routeId: string; 
      note?: string;
    }) => {
      const today = new Date().toISOString().split('T')[0];
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('multi_brand_intelligence_history')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user?.id,
          acknowledgment_note: note,
        })
        .eq('route_id', routeId)
        .eq('recorded_date', today);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Intelligence acknowledged');
      queryClient.invalidateQueries({ queryKey: ['intelligence-history'] });
    },
    onError: (error) => {
      toast.error(`Failed to acknowledge: ${error.message}`);
    },
  });

  // Record dispatch decision
  const recordDispatch = useMutation({
    mutationFn: async ({ 
      routeId, 
      proceeded,
      notes,
    }: { 
      routeId: string; 
      proceeded: boolean;
      notes?: string;
    }) => {
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('multi_brand_intelligence_history')
        .update({
          dispatch_proceeded: proceeded,
          outcome_notes: notes,
        })
        .eq('route_id', routeId)
        .eq('recorded_date', today);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelligence-history'] });
    },
  });

  // Record outcome (post-dispatch)
  const recordOutcome = useMutation({
    mutationFn: async ({ 
      routeId, 
      outcome,
      notes,
    }: { 
      routeId: string; 
      outcome: 'success' | 'partial' | 'failed' | 'delayed';
      notes?: string;
    }) => {
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('multi_brand_intelligence_history')
        .update({
          actual_outcome: outcome,
          outcome_notes: notes,
        })
        .eq('route_id', routeId)
        .eq('recorded_date', today);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Outcome recorded');
      queryClient.invalidateQueries({ queryKey: ['intelligence-history'] });
    },
  });

  return {
    history,
    isLoading,
    todayStats,
    recordSnapshot: recordSnapshot.mutate,
    isRecording: recordSnapshot.isPending,
    acknowledge: acknowledge.mutate,
    isAcknowledging: acknowledge.isPending,
    recordDispatch: recordDispatch.mutate,
    recordOutcome: recordOutcome.mutate,
  };
}
