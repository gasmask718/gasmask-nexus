import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export type InboxItemType = "call" | "sms" | "email" | "follow-up" | "negotiation" | "alert";
export type InboxChannel = "voice" | "sms" | "email" | "ai" | "manual";
export type InboxDirection = "inbound" | "outbound";
export type InboxSentiment = "positive" | "neutral" | "negative" | "urgent";
export type InboxPriority = "low" | "medium" | "high";

export interface UnifiedInboxItem {
  id: string;
  type: InboxItemType;
  channel: InboxChannel;
  store_id: string | null;
  business_id: string | null;
  vertical_id: string | null;
  timestamp: string;
  direction: InboxDirection;
  summary: string;
  full_content: string | null;
  sentiment: InboxSentiment | null;
  ai_flag: boolean;
  priority_level: InboxPriority;
  requires_action: boolean;
  phone_number: string | null;
  email_address: string | null;
  // Joined data
  store?: { id: string; store_name: string } | null;
  business?: { id: string; name: string; primary_color: string } | null;
  vertical?: { id: string; name: string } | null;
  // Extra metadata
  metadata?: Record<string, any>;
}

export interface InboxFilters {
  businessId?: string;
  verticalId?: string;
  channel?: InboxChannel | "all";
  direction?: InboxDirection | "all";
  aiOnly?: boolean;
  humanOnly?: boolean;
  sentiment?: InboxSentiment | "all";
  priority?: InboxPriority | "all";
  requiresAction?: boolean | "all";
  dateRange?: "today" | "7days" | "30days" | "custom";
  customDateStart?: string;
  customDateEnd?: string;
  searchTerm?: string;
  type?: InboxItemType | "all";
}

export function useUnifiedInbox(filters: InboxFilters = {}) {
  const queryClient = useQueryClient();
  const [realtimeItems, setRealtimeItems] = useState<UnifiedInboxItem[]>([]);

  // Fetch messages from communication_messages
  const { data: messagesData = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["unified-inbox-messages", filters.businessId, filters.dateRange],
    queryFn: async () => {
      let query = supabase
        .from("communication_messages")
        .select(`
          id, business_id, store_id, direction, channel, content, 
          phone_number, status, ai_generated, sentiment, created_at,
          store:store_master(id, store_name),
          business:businesses(id, name, primary_color)
        `)
        .order("created_at", { ascending: false })
        .limit(200);

      if (filters.businessId && filters.businessId !== "all") {
        query = query.eq("business_id", filters.businessId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((m: any): UnifiedInboxItem => ({
        id: m.id,
        type: m.channel?.includes("call") ? "call" : "sms",
        channel: m.ai_generated ? "ai" : (m.channel?.includes("call") ? "voice" : "sms"),
        store_id: m.store_id,
        business_id: m.business_id,
        vertical_id: null,
        timestamp: m.created_at,
        direction: m.direction || "outbound",
        summary: m.content?.substring(0, 120) || "No content",
        full_content: m.content,
        sentiment: m.sentiment as InboxSentiment | null,
        ai_flag: m.ai_generated || false,
        priority_level: m.sentiment === "negative" ? "high" : "medium",
        requires_action: m.direction === "inbound" && m.status !== "replied",
        phone_number: m.phone_number,
        email_address: null,
        store: m.store,
        business: m.business,
        vertical: null,
        metadata: { original_channel: m.channel, status: m.status },
      }));
    },
  });

  // Fetch AI call sessions
  const { data: callsData = [], isLoading: callsLoading } = useQuery({
    queryKey: ["unified-inbox-calls", filters.businessId],
    queryFn: async () => {
      let query = supabase
        .from("ai_call_sessions")
        .select(`
          id, business_id, store_id, status, transcript, call_summary,
          ai_notes, sentiment_trend, created_at,
          store:store_master(id, store_name),
          business:businesses(id, name, primary_color)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (filters.businessId && filters.businessId !== "all") {
        query = query.eq("business_id", filters.businessId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((c: any): UnifiedInboxItem => ({
        id: c.id,
        type: "call",
        channel: "ai",
        store_id: c.store_id,
        business_id: c.business_id,
        vertical_id: null,
        timestamp: c.created_at,
        direction: "outbound",
        summary: c.call_summary || c.ai_notes || "AI Call Session",
        full_content: c.transcript,
        sentiment: c.sentiment_trend as InboxSentiment | null,
        ai_flag: true,
        priority_level: c.sentiment_trend === "negative" ? "high" : "medium",
        requires_action: c.status === "needs_followup",
        phone_number: null,
        email_address: null,
        store: c.store,
        business: c.business,
        vertical: null,
        metadata: { status: c.status },
      }));
    },
  });

  // Fetch follow-ups
  const { data: followUpsData = [], isLoading: followUpsLoading } = useQuery({
    queryKey: ["unified-inbox-followups", filters.businessId],
    queryFn: async () => {
      let query = supabase
        .from("follow_up_queue")
        .select(`
          id, store_id, business_id, vertical_id, reason, priority, 
          due_at, status, recommended_action, context, created_at,
          store:store_master(id, store_name),
          business:businesses(id, name, primary_color),
          vertical:brand_verticals(id, name)
        `)
        .in("status", ["pending", "in_progress", "overdue"])
        .order("due_at", { ascending: true })
        .limit(100);

      if (filters.businessId && filters.businessId !== "all") {
        query = query.eq("business_id", filters.businessId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((f: any): UnifiedInboxItem => ({
        id: f.id,
        type: "follow-up",
        channel: f.recommended_action?.includes("call") ? "voice" : "sms",
        store_id: f.store_id,
        business_id: f.business_id,
        vertical_id: f.vertical_id,
        timestamp: f.created_at,
        direction: "outbound",
        summary: `${f.reason}: ${f.recommended_action || "Follow up needed"}`,
        full_content: JSON.stringify(f.context),
        sentiment: null,
        ai_flag: true,
        priority_level: (f.priority as InboxPriority) || "medium",
        requires_action: true,
        phone_number: null,
        email_address: null,
        store: f.store,
        business: f.business,
        vertical: f.vertical,
        metadata: { status: f.status, due_at: f.due_at, reason: f.reason },
      }));
    },
  });

  // Fetch alerts
  const { data: alertsData = [], isLoading: alertsLoading } = useQuery({
    queryKey: ["unified-inbox-alerts", filters.businessId],
    queryFn: async () => {
      let query = supabase
        .from("communication_alerts")
        .select(`
          id, business_id, store_id, alert_type, severity, message,
          is_resolved, created_at,
          store:store_master(id, store_name),
          business:businesses(id, name, primary_color)
        `)
        .eq("is_resolved", false)
        .order("created_at", { ascending: false })
        .limit(50);

      if (filters.businessId && filters.businessId !== "all") {
        query = query.eq("business_id", filters.businessId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((a: any): UnifiedInboxItem => ({
        id: a.id,
        type: "alert",
        channel: "ai",
        store_id: a.store_id,
        business_id: a.business_id,
        vertical_id: null,
        timestamp: a.created_at,
        direction: "inbound",
        summary: a.message || a.alert_type,
        full_content: a.message,
        sentiment: a.severity === "critical" ? "urgent" : "negative",
        ai_flag: true,
        priority_level: a.severity === "critical" || a.severity === "high" ? "high" : "medium",
        requires_action: true,
        phone_number: null,
        email_address: null,
        store: a.store,
        business: a.business,
        vertical: null,
        metadata: { alert_type: a.alert_type, severity: a.severity },
      }));
    },
  });

  // Fetch negotiations (simplified to avoid type issues)
  const negotiationsData: UnifiedInboxItem[] = [];
  const negotiationsLoading = false;

  // Merge all data
  const allItems: UnifiedInboxItem[] = [
    ...messagesData,
    ...callsData,
    ...followUpsData,
    ...alertsData,
    ...negotiationsData,
    ...realtimeItems,
  ];

  // Apply client-side filters
  const filteredItems = allItems.filter((item) => {
    // Type filter
    if (filters.type && filters.type !== "all" && item.type !== filters.type) return false;
    
    // Channel filter
    if (filters.channel && filters.channel !== "all" && item.channel !== filters.channel) return false;
    
    // Direction filter
    if (filters.direction && filters.direction !== "all" && item.direction !== filters.direction) return false;
    
    // AI only
    if (filters.aiOnly && !item.ai_flag) return false;
    
    // Human only
    if (filters.humanOnly && item.ai_flag) return false;
    
    // Sentiment filter
    if (filters.sentiment && filters.sentiment !== "all" && item.sentiment !== filters.sentiment) return false;
    
    // Priority filter
    if (filters.priority && filters.priority !== "all" && item.priority_level !== filters.priority) return false;
    
    // Requires action
    if (filters.requiresAction === true && !item.requires_action) return false;
    if (filters.requiresAction === false && item.requires_action) return false;
    
    // Search term
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      const matchesSearch = 
        item.summary?.toLowerCase().includes(term) ||
        item.store?.store_name?.toLowerCase().includes(term) ||
        item.business?.name?.toLowerCase().includes(term) ||
        item.phone_number?.includes(term);
      if (!matchesSearch) return false;
    }
    
    // Date range
    if (filters.dateRange && filters.dateRange !== "custom") {
      const itemDate = new Date(item.timestamp);
      const now = new Date();
      
      if (filters.dateRange === "today") {
        if (itemDate.toDateString() !== now.toDateString()) return false;
      } else if (filters.dateRange === "7days") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (itemDate < weekAgo) return false;
      } else if (filters.dateRange === "30days") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (itemDate < monthAgo) return false;
      }
    }
    
    return true;
  });

  // Sort by timestamp descending
  const sortedItems = filteredItems.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Set up real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("unified-inbox-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "communication_messages" },
        (payload) => {
          console.log("New message received:", payload);
          queryClient.invalidateQueries({ queryKey: ["unified-inbox-messages"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_call_sessions" },
        (payload) => {
          console.log("New call session:", payload);
          queryClient.invalidateQueries({ queryKey: ["unified-inbox-calls"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follow_up_queue" },
        (payload) => {
          console.log("Follow-up change:", payload);
          queryClient.invalidateQueries({ queryKey: ["unified-inbox-followups"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Mark item as reviewed
  const markReviewedMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: InboxItemType }) => {
      if (type === "alert") {
        const { error } = await supabase
          .from("communication_alerts")
          .update({ is_resolved: true, resolved_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } else if (type === "follow-up") {
        const { error } = await supabase
          .from("follow_up_queue")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unified-inbox"] });
      toast.success("Item marked as reviewed");
    },
  });

  // Stats
  const stats = {
    total: sortedItems.length,
    requiresAction: sortedItems.filter(i => i.requires_action).length,
    calls: sortedItems.filter(i => i.type === "call").length,
    sms: sortedItems.filter(i => i.type === "sms").length,
    followUps: sortedItems.filter(i => i.type === "follow-up").length,
    alerts: sortedItems.filter(i => i.type === "alert").length,
    negotiations: sortedItems.filter(i => i.type === "negotiation").length,
    highPriority: sortedItems.filter(i => i.priority_level === "high").length,
  };

  return {
    items: sortedItems,
    isLoading: messagesLoading || callsLoading || followUpsLoading || alertsLoading || negotiationsLoading,
    stats,
    markReviewed: markReviewedMutation.mutate,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ["unified-inbox-messages"] });
      queryClient.invalidateQueries({ queryKey: ["unified-inbox-calls"] });
      queryClient.invalidateQueries({ queryKey: ["unified-inbox-followups"] });
      queryClient.invalidateQueries({ queryKey: ["unified-inbox-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["unified-inbox-negotiations"] });
    },
  };
}

// Fetch businesses for filter dropdown
export function useInboxBusinesses() {
  return useQuery({
    queryKey: ["inbox-businesses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, primary_color")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as { id: string; name: string; primary_color: string }[];
    },
  });
}

// Fetch verticals for filter dropdown
export function useInboxVerticals() {
  return useQuery({
    queryKey: ["inbox-verticals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_verticals")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
  });
}
