import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CommunicationMessage {
  id: string;
  business_id: string | null;
  store_id: string | null;
  contact_id: string | null;
  direction: "inbound" | "outbound";
  channel: "sms" | "call" | "ai-call" | "ai-sms" | "email" | "whatsapp";
  content: string | null;
  phone_number: string | null;
  status: string;
  ai_generated: boolean;
  sentiment: string | null;
  created_at: string;
  // Joined data
  store?: { id: string; store_name: string } | null;
  business?: { id: string; name: string; primary_color: string } | null;
}

export interface CommunicationAlert {
  id: string;
  business_id: string | null;
  store_id: string | null;
  alert_type: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  is_resolved: boolean;
  created_at: string;
}

export function useCommunicationCenter(businessId?: string) {
  const queryClient = useQueryClient();

  // Fetch messages
  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ["communication-messages", businessId],
    queryFn: async () => {
      let query = supabase
        .from("communication_messages")
        .select(`
          *,
          store:store_master(id, store_name),
          business:businesses(id, name, primary_color)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CommunicationMessage[];
    },
  });

  // Fetch alerts
  const { data: alerts = [], isLoading: alertsLoading, refetch: refetchAlerts } = useQuery({
    queryKey: ["communication-alerts", businessId],
    queryFn: async () => {
      let query = supabase
        .from("communication_alerts")
        .select("*")
        .eq("is_resolved", false)
        .order("created_at", { ascending: false });

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CommunicationAlert[];
    },
  });

  // Fetch sequences
  const { data: sequences = [], isLoading: sequencesLoading } = useQuery({
    queryKey: ["communication-sequences", businessId],
    queryFn: async () => {
      let query = supabase
        .from("communication_sequences")
        .select("*")
        .order("created_at", { ascending: false });

      if (businessId) {
        query = query.eq("business_id", businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: Partial<CommunicationMessage>) => {
      const { error } = await supabase.from("communication_messages").insert({
        business_id: message.business_id,
        store_id: message.store_id,
        contact_id: message.contact_id,
        direction: "outbound",
        channel: message.channel || "sms",
        content: message.content,
        phone_number: message.phone_number,
        status: "delivered",
        ai_generated: message.ai_generated || false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchMessages();
      toast.success("Message sent");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // AI suggest reply
  const suggestReplyMutation = useMutation({
    mutationFn: async (data: { brandName: string; storeName: string; previousMessage: string; context?: string }) => {
      const response = await supabase.functions.invoke("communication-ai", {
        body: { type: "suggest_reply", data },
      });
      if (response.error) throw response.error;
      return response.data?.result;
    },
    onError: (error: Error) => {
      toast.error(`AI error: ${error.message}`);
    },
  });

  // AI rewrite in brand tone
  const rewriteBrandToneMutation = useMutation({
    mutationFn: async (data: { brandName: string; message: string; brandTone?: string }) => {
      const response = await supabase.functions.invoke("communication-ai", {
        body: { type: "rewrite_brand_tone", data },
      });
      if (response.error) throw response.error;
      return response.data?.result;
    },
    onError: (error: Error) => {
      toast.error(`AI error: ${error.message}`);
    },
  });

  // Generate sequence
  const generateSequenceMutation = useMutation({
    mutationFn: async (data: {
      brandName: string;
      goal: string;
      targetDescription: string;
      tone?: string;
      duration?: string;
      stepCount?: number;
    }) => {
      const response = await supabase.functions.invoke("communication-ai", {
        body: { type: "generate_sequence", data },
      });
      if (response.error) throw response.error;
      return response.data?.result;
    },
    onError: (error: Error) => {
      toast.error(`AI error: ${error.message}`);
    },
  });

  // Resolve alert
  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from("communication_alerts")
        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchAlerts();
      toast.success("Alert resolved");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Stats
  const todayMessages = messages.filter(m => {
    const today = new Date().toDateString();
    return new Date(m.created_at).toDateString() === today;
  });

  const inboundCount = messages.filter(m => m.direction === "inbound").length;
  const outboundCount = messages.filter(m => m.direction === "outbound").length;
  const aiGeneratedCount = messages.filter(m => m.ai_generated).length;

  return {
    messages,
    messagesLoading,
    refetchMessages,
    alerts,
    alertsLoading,
    refetchAlerts,
    sequences,
    sequencesLoading,
    sendMessage: sendMessageMutation.mutateAsync,
    isSending: sendMessageMutation.isPending,
    suggestReply: suggestReplyMutation.mutateAsync,
    isSuggestingReply: suggestReplyMutation.isPending,
    rewriteBrandTone: rewriteBrandToneMutation.mutateAsync,
    isRewriting: rewriteBrandToneMutation.isPending,
    generateSequence: generateSequenceMutation.mutateAsync,
    isGeneratingSequence: generateSequenceMutation.isPending,
    resolveAlert: resolveAlertMutation.mutate,
    stats: {
      todayMessages: todayMessages.length,
      inboundCount,
      outboundCount,
      aiGeneratedCount,
      unresolvedAlerts: alerts.length,
    },
  };
}
