import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AIDecision {
  id: string;
  session_id: string;
  business_id: string;
  decision_type: string;
  decision_reason: string;
  confidence_at_decision: number;
  risk_level: string;
  active_thresholds: Record<string, unknown>;
  rule_applied: string;
  caller_sentiment: string;
  intent_at_decision: string;
  transcript_snapshot: string;
  created_at: string;
}

interface AIRiskEvent {
  id: string;
  session_id: string;
  business_id: string;
  risk_level: string;
  risk_triggers: string[];
  previous_risk_level: string;
  escalation_required: boolean;
  escalation_executed: boolean;
  human_notified: boolean;
  created_at: string;
}

interface AIAuditLog {
  id: string;
  session_id: string;
  business_id: string;
  audit_type: string;
  payload: Record<string, unknown>;
  transcript_at_event: string;
  confidence_timeline: unknown[];
  intent_timeline: unknown[];
  sentiment_timeline: unknown[];
  is_immutable: boolean;
  created_at: string;
}

export function useAIDecisions(businessId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ["ai-decisions", businessId, limit],
    queryFn: async (): Promise<AIDecision[]> => {
      if (!businessId) return [];

      const { data, error } = await supabase
        .from("ai_call_decisions")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as unknown as AIDecision[];
    },
    enabled: !!businessId,
  });
}

export function useAIDecisionsBySession(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["ai-decisions-session", sessionId],
    queryFn: async (): Promise<AIDecision[]> => {
      if (!sessionId) return [];

      const { data, error } = await supabase
        .from("ai_call_decisions")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as AIDecision[];
    },
    enabled: !!sessionId,
  });
}

export function useAIRiskEvents(businessId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ["ai-risk-events", businessId, limit],
    queryFn: async (): Promise<AIRiskEvent[]> => {
      if (!businessId) return [];

      const { data, error } = await supabase
        .from("ai_risk_events")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as unknown as AIRiskEvent[];
    },
    enabled: !!businessId,
  });
}

export function useAIAuditLogs(businessId: string | undefined, limit = 100) {
  return useQuery({
    queryKey: ["ai-audit-logs", businessId, limit],
    queryFn: async (): Promise<AIAuditLog[]> => {
      if (!businessId) return [];

      const { data, error } = await supabase
        .from("ai_audit_logs")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as unknown as AIAuditLog[];
    },
    enabled: !!businessId,
  });
}

export function useAIAuditLogsBySession(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["ai-audit-logs-session", sessionId],
    queryFn: async (): Promise<AIAuditLog[]> => {
      if (!sessionId) return [];

      const { data, error } = await supabase
        .from("ai_audit_logs")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as AIAuditLog[];
    },
    enabled: !!sessionId,
  });
}

export function useDecisionStats(businessId: string | undefined) {
  return useQuery({
    queryKey: ["ai-decision-stats", businessId],
    queryFn: async () => {
      if (!businessId) return null;

      // Get decisions from last 24 hours
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: decisions } = await supabase
        .from("ai_call_decisions")
        .select("decision_type, risk_level, confidence_at_decision")
        .eq("business_id", businessId)
        .gte("created_at", since);

      if (!decisions) return null;

      const stats = {
        total: decisions.length,
        by_type: {
          continue: 0,
          escalate: 0,
          handoff: 0,
          terminate: 0,
        },
        by_risk: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        },
        avg_confidence: 0,
      };

      let totalConfidence = 0;
      decisions.forEach((d) => {
        const decisionType = d.decision_type as keyof typeof stats.by_type;
        const riskLevel = d.risk_level as keyof typeof stats.by_risk;
        
        if (stats.by_type[decisionType] !== undefined) {
          stats.by_type[decisionType]++;
        }
        if (stats.by_risk[riskLevel] !== undefined) {
          stats.by_risk[riskLevel]++;
        }
        totalConfidence += d.confidence_at_decision || 0;
      });

      stats.avg_confidence = decisions.length > 0 ? totalConfidence / decisions.length : 0;

      return stats;
    },
    enabled: !!businessId,
  });
}