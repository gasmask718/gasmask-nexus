import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SentimentAnalysis {
  id: string;
  message_id: string | null;
  business_id: string | null;
  sentiment: "positive" | "neutral" | "negative";
  score: number;
  keywords: string[];
  ai_summary: string | null;
  created_at: string;
}

export interface ConversationRouting {
  id: string;
  business_id: string | null;
  store_id: string | null;
  department: string;
  reason: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CommunicationEscalation {
  id: string;
  business_id: string | null;
  store_id: string | null;
  message_id: string | null;
  escalation_type: string;
  severity: "low" | "medium" | "high" | "critical";
  ai_notes: string | null;
  assigned_department: string | null;
  resolved: boolean;
  created_at: string;
  store?: { id: string; store_name: string } | null;
}

export interface EngagementScore {
  id: string;
  business_id: string | null;
  store_id: string | null;
  score: number;
  response_rate: number | null;
  last_contact: string | null;
  sentiment_trend: "improving" | "stable" | "declining" | null;
  updated_at: string;
  store?: { id: string; store_name: string } | null;
}

export function useCommunicationIntelligence(businessId?: string) {
  const queryClient = useQueryClient();

  // Fetch escalations
  const { data: escalations = [], isLoading: escalationsLoading, refetch: refetchEscalations } = useQuery({
    queryKey: ["communication-escalations", businessId],
    queryFn: async () => {
      let query = supabase
        .from("communication_escalations")
        .select(`*, store:store_master(id, store_name)`)
        .eq("resolved", false)
        .order("created_at", { ascending: false });

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CommunicationEscalation[];
    },
  });

  // Fetch engagement scores
  const { data: engagementScores = [], isLoading: engagementLoading } = useQuery({
    queryKey: ["engagement-scores", businessId],
    queryFn: async () => {
      let query = supabase
        .from("engagement_scores")
        .select(`*, store:store_master(id, store_name)`)
        .order("score", { ascending: true })
        .limit(50);

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EngagementScore[];
    },
  });

  // Fetch routing assignments
  const { data: routingAssignments = [], isLoading: routingLoading } = useQuery({
    queryKey: ["conversation-routing", businessId],
    queryFn: async () => {
      let query = supabase
        .from("conversation_routing")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ConversationRouting[];
    },
  });

  // Analyze sentiment mutation
  const analyzeSentimentMutation = useMutation({
    mutationFn: async (data: { messageId: string; content: string; businessId?: string }) => {
      // Simple keyword-based sentiment (can be replaced with AI later)
      const negativeWords = ["angry", "upset", "cancel", "problem", "issue", "complaint", "terrible", "worst", "bad", "hate", "refund"];
      const positiveWords = ["great", "thanks", "love", "excellent", "amazing", "perfect", "happy", "wonderful", "best", "appreciate"];
      
      const lowerContent = data.content.toLowerCase();
      let score = 0;
      const keywords: string[] = [];
      
      negativeWords.forEach(word => {
        if (lowerContent.includes(word)) {
          score -= 20;
          keywords.push(word);
        }
      });
      
      positiveWords.forEach(word => {
        if (lowerContent.includes(word)) {
          score += 20;
          keywords.push(word);
        }
      });
      
      score = Math.max(-100, Math.min(100, score));
      const sentiment = score > 10 ? "positive" : score < -10 ? "negative" : "neutral";

      const { error } = await supabase.from("sentiment_analysis").insert({
        message_id: data.messageId,
        business_id: data.businessId,
        sentiment,
        score,
        keywords,
      });
      if (error) throw error;
      return { sentiment, score, keywords };
    },
  });

  // Create escalation mutation
  const createEscalationMutation = useMutation({
    mutationFn: async (data: {
      businessId?: string;
      storeId?: string;
      messageId?: string;
      escalationType: string;
      severity: string;
      aiNotes?: string;
    }) => {
      const { error } = await supabase.from("communication_escalations").insert({
        business_id: data.businessId,
        store_id: data.storeId,
        message_id: data.messageId,
        escalation_type: data.escalationType,
        severity: data.severity,
        ai_notes: data.aiNotes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchEscalations();
      toast.success("Escalation created");
    },
  });

  // Resolve escalation mutation
  const resolveEscalationMutation = useMutation({
    mutationFn: async (escalationId: string) => {
      const { error } = await supabase
        .from("communication_escalations")
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq("id", escalationId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchEscalations();
      toast.success("Escalation resolved");
    },
  });

  // Update routing mutation
  const updateRoutingMutation = useMutation({
    mutationFn: async (data: { storeId: string; department: string; reason?: string; businessId?: string }) => {
      const { error } = await supabase.from("conversation_routing").upsert({
        store_id: data.storeId,
        business_id: data.businessId,
        department: data.department,
        reason: data.reason,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation-routing"] });
      toast.success("Routing updated");
    },
  });

  // Calculate priority score
  const calculatePriority = (message: {
    sentiment?: string;
    sentimentScore?: number;
    daysSinceContact?: number;
    unansweredCount?: number;
    engagementScore?: number;
  }): { score: number; level: "high" | "medium" | "low" } => {
    let priority = 50;

    if (message.sentiment === "negative") priority += 30;
    if (message.sentimentScore && message.sentimentScore < -50) priority += 20;
    if (message.daysSinceContact && message.daysSinceContact > 7) priority += 15;
    if (message.unansweredCount && message.unansweredCount > 2) priority += 25;
    if (message.engagementScore && message.engagementScore < 30) priority += 10;

    priority = Math.min(100, priority);

    return {
      score: priority,
      level: priority >= 70 ? "high" : priority >= 40 ? "medium" : "low",
    };
  };

  // Generate smart reply suggestions
  const generateSmartReply = (sentiment: string, keywords: string[]): string[] => {
    if (sentiment === "negative") {
      return [
        "I apologize for the inconvenience. Let me help resolve this right away.",
        "Thank you for bringing this to our attention. We'll fix this immediately.",
        "I understand your frustration. Let me connect you with our team to solve this.",
      ];
    }
    if (sentiment === "positive") {
      return [
        "Thank you for your kind words! We appreciate your business.",
        "We're glad you're happy! Is there anything else we can help with?",
        "Thanks for the feedback! Let us know if you need anything.",
      ];
    }
    return [
      "Thank you for reaching out. How can we assist you today?",
      "Thanks for your message. Our team will get back to you shortly.",
      "We received your message. Is there anything specific you need help with?",
    ];
  };

  return {
    escalations,
    escalationsLoading,
    refetchEscalations,
    engagementScores,
    engagementLoading,
    routingAssignments,
    routingLoading,
    analyzeSentiment: analyzeSentimentMutation.mutateAsync,
    createEscalation: createEscalationMutation.mutateAsync,
    resolveEscalation: resolveEscalationMutation.mutate,
    updateRouting: updateRoutingMutation.mutateAsync,
    calculatePriority,
    generateSmartReply,
  };
}
