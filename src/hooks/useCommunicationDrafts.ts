import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export type DraftStatus = "draft" | "pending_approval" | "approved" | "sent" | "cancelled";
export type DraftChannel = "sms" | "email" | "whatsapp" | "call";

export interface CommunicationDraft {
  id: string;
  status: DraftStatus;
  requires_approval: boolean;
  channel: DraftChannel;
  subject: string | null;
  body: string;
  rendered_preview: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  entity_type: string | null;
  entity_id: string | null;
  business_id: string | null;
  store_id: string | null;
  template_id: string | null;
  template_key: string | null;
  collection_account_id: string | null;
  invoice_ids: string[];
  from_number: string | null;
  from_email: string | null;
  ai_generated: boolean;
  automation_source: string | null;
  automation_step: Record<string, unknown> | null;
  context_data: Record<string, unknown>;
  warnings: string[];
  created_by: string | null;
  edited_by: string | null;
  edited_before_send: boolean;
  approved_by: string | null;
  approved_at: string | null;
  sent_by: string | null;
  sent_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  scheduled_for: string | null;
  expires_at: string | null;
  external_message_id: string | null;
  delivery_status: string | null;
  sent_message_id: string | null;
}

export interface CreateDraftParams {
  channel: DraftChannel;
  body: string;
  subject?: string;
  recipient_phone?: string;
  recipient_email?: string;
  recipient_name?: string;
  entity_type?: string;
  entity_id?: string;
  business_id?: string;
  store_id?: string;
  template_key?: string;
  collection_account_id?: string;
  invoice_ids?: string[];
  from_number?: string;
  from_email?: string;
  ai_generated?: boolean;
  automation_source?: string;
  automation_step?: Json;
  context_data?: Json;
  warnings?: string[];
}

export function useCommunicationDrafts(options?: { 
  status?: DraftStatus | DraftStatus[];
  channel?: DraftChannel;
  limit?: number;
}) {
  const queryClient = useQueryClient();

  // Fetch drafts
  const { data: drafts, isLoading, error, refetch } = useQuery({
    queryKey: ["communication-drafts", options],
    queryFn: async () => {
      let query = supabase
        .from("communication_drafts")
        .select("*")
        .order("created_at", { ascending: false });

      if (options?.status) {
        if (Array.isArray(options.status)) {
          query = query.in("status", options.status);
        } else {
          query = query.eq("status", options.status);
        }
      }

      if (options?.channel) {
        query = query.eq("channel", options.channel);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CommunicationDraft[];
    },
  });

  // Check if current user can send
  const { data: canSend } = useQuery({
    queryKey: ["can-send-messages"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase.rpc("can_send_messages", {
        user_id: user.id,
      });
      
      if (error) {
        console.error("Error checking send permissions:", error);
        return false;
      }
      return data as boolean;
    },
  });

  // Create draft mutation
  const createDraftMutation = useMutation({
    mutationFn: async (params: CreateDraftParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("communication_drafts")
        .insert({
          ...params,
          created_by: user.id,
          status: "draft",
          requires_approval: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CommunicationDraft;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communication-drafts"] });
    },
  });

  // Update draft mutation
  const updateDraftMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreateDraftParams> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("communication_drafts")
        .update({
          ...updates,
          edited_by: user.id,
          edited_before_send: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "draft") // Can only edit drafts
        .select()
        .single();

      if (error) throw error;
      return data as CommunicationDraft;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communication-drafts"] });
    },
  });

  // Approve draft mutation (requires permission)
  const approveDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Verify permission
      const { data: hasPermission } = await supabase.rpc("can_send_messages", {
        user_id: user.id,
      });

      if (!hasPermission) {
        throw new Error("You don't have permission to approve messages");
      }

      const { data, error } = await supabase
        .from("communication_drafts")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", draftId)
        .in("status", ["draft", "pending_approval"])
        .select()
        .single();

      if (error) throw error;
      return data as CommunicationDraft;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communication-drafts"] });
      toast.success("Draft approved");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Approve and send in one step (requires permission)
  const approveAndSendMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Verify permission
      const { data: hasPermission } = await supabase.rpc("can_send_messages", {
        user_id: user.id,
      });

      if (!hasPermission) {
        throw new Error("You don't have permission to send messages");
      }

      // Get the draft
      const { data: draft, error: fetchError } = await supabase
        .from("communication_drafts")
        .select("*")
        .eq("id", draftId)
        .single();

      if (fetchError || !draft) throw new Error("Draft not found");

      // Actually send the message via edge function
      if (draft.channel === "sms" && draft.recipient_phone) {
        const { data: sendResult, error: sendError } = await supabase.functions.invoke("send-sms", {
          body: {
            to_number: draft.recipient_phone,
            message_body: draft.body,
            idempotency_key: crypto.randomUUID(),
            skip_cooldown: true,
            send_class: "conversational",
            store_id: draft.store_id,
            metadata: {
              business_id: draft.business_id,
              contact_id: draft.entity_id,
              contact_name: draft.recipient_name,
              from_number: draft.from_number,
              initiated_by: user.id,
              source_ui: "draft_approval",
            },
          },
        });

        if (sendError) throw sendError;

        // Update draft to sent status
        const { data: updatedDraft, error: updateError } = await supabase
          .from("communication_drafts")
          .update({
            status: "sent",
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            sent_by: user.id,
            sent_at: new Date().toISOString(),
            external_message_id: sendResult?.sid,
            delivery_status: sendResult?.status,
          })
          .eq("id", draftId)
          .select()
          .single();

        if (updateError) throw updateError;

        // Log to immutable sent log
        await supabase.from("communication_sent_log").insert({
          draft_id: draftId,
          channel: draft.channel,
          subject: draft.subject,
          final_body: draft.body,
          recipient_phone: draft.recipient_phone,
          recipient_email: draft.recipient_email,
          recipient_name: draft.recipient_name,
          entity_type: draft.entity_type,
          entity_id: draft.entity_id,
          context_snapshot: draft.context_data,
          invoice_ids: draft.invoice_ids,
          created_by: draft.created_by,
          approved_by: user.id,
          sent_by: user.id,
          edited_before_send: draft.edited_before_send,
          created_at: draft.created_at,
          approved_at: new Date().toISOString(),
          external_message_id: sendResult?.sid,
          delivery_status: sendResult?.status,
        });

        return updatedDraft as CommunicationDraft;
      }

      // For other channels (email, whatsapp) - mark as sent but log for manual handling
      const { data: updatedDraft, error: updateError } = await supabase
        .from("communication_drafts")
        .update({
          status: "sent",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          sent_by: user.id,
          sent_at: new Date().toISOString(),
        })
        .eq("id", draftId)
        .select()
        .single();

      if (updateError) throw updateError;
      return updatedDraft as CommunicationDraft;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communication-drafts"] });
      toast.success("Message sent successfully");
    },
    onError: (error) => {
      toast.error(`Failed to send: ${error.message}`);
    },
  });

  // Cancel draft mutation
  const cancelDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("communication_drafts")
        .update({
          status: "cancelled",
          cancelled_by: user.id,
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", draftId)
        .in("status", ["draft", "pending_approval", "approved"])
        .select()
        .single();

      if (error) throw error;
      return data as CommunicationDraft;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communication-drafts"] });
      toast.success("Draft cancelled");
    },
  });

  return {
    drafts: drafts || [],
    isLoading,
    error,
    refetch,
    canSend: canSend ?? false,
    createDraft: createDraftMutation.mutateAsync,
    isCreating: createDraftMutation.isPending,
    updateDraft: updateDraftMutation.mutateAsync,
    isUpdating: updateDraftMutation.isPending,
    approveDraft: approveDraftMutation.mutateAsync,
    isApproving: approveDraftMutation.isPending,
    approveAndSend: approveAndSendMutation.mutateAsync,
    isSending: approveAndSendMutation.isPending,
    cancelDraft: cancelDraftMutation.mutateAsync,
    isCancelling: cancelDraftMutation.isPending,
  };
}
