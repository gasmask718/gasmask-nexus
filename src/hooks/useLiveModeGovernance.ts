import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export interface LiveAuthorization {
  id: string;
  business_id: string;
  route_id: string | null;
  status: "pending" | "approved" | "revoked" | "expired" | "suspended";
  authorized_by: string | null;
  authorized_at: string | null;
  revoked_by: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
  justification: string;
  evidence_snapshot: Record<string, unknown>;
  trust_score_at_approval: number | null;
  accuracy_rate_at_approval: number | null;
  canary_days_completed: number;
  canary_calls_evaluated: number;
  expires_at: string | null;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
}

export interface KillSwitchState {
  id: string;
  scope: "global" | "business" | "route";
  business_id: string | null;
  route_id: string | null;
  is_active: boolean;
  activated_at: string | null;
  activated_by: string | null;
  activation_reason: string | null;
  auto_deactivate_at: string | null;
  deactivated_at: string | null;
  deactivated_by: string | null;
}

export interface AuditEvent {
  id: string;
  business_id: string;
  session_id: string | null;
  authorization_id: string | null;
  event_type: string;
  event_severity: "info" | "warning" | "critical" | "emergency";
  event_payload: Record<string, unknown>;
  trust_score_at_event: number | null;
  confidence_at_event: number | null;
  transcript_snapshot: string | null;
  triggered_by: string | null;
  actor_user_id: string | null;
  is_immutable: boolean;
  created_at: string;
}

// Get current authorization
export function useCurrentAuthorization(businessId: string | undefined) {
  return useQuery({
    queryKey: ["live-authorization", businessId],
    queryFn: async (): Promise<LiveAuthorization | null> => {
      if (!businessId) return null;

      const { data, error } = await supabase
        .from("ai_live_authorizations")
        .select("*")
        .eq("business_id", businessId)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as LiveAuthorization;
    },
    enabled: !!businessId,
  });
}

// Get all authorizations (history)
export function useAuthorizationHistory(businessId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ["authorization-history", businessId, limit],
    queryFn: async (): Promise<LiveAuthorization[]> => {
      if (!businessId) return [];

      const { data, error } = await supabase
        .from("ai_live_authorizations")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as unknown as LiveAuthorization[];
    },
    enabled: !!businessId,
  });
}

// Get kill switch states
export function useKillSwitchStates(businessId: string | undefined) {
  return useQuery({
    queryKey: ["kill-switch-states", businessId],
    queryFn: async (): Promise<{
      global: KillSwitchState | null;
      business: KillSwitchState | null;
      routes: KillSwitchState[];
    }> => {
      // Get global kill switch
      const { data: globalSwitch } = await supabase
        .from("ai_kill_switch_state")
        .select("*")
        .eq("scope", "global")
        .single();

      // Get business-level switch if businessId provided
      let businessSwitch = null;
      let routeSwitches: KillSwitchState[] = [];

      if (businessId) {
        const { data: bSwitch } = await supabase
          .from("ai_kill_switch_state")
          .select("*")
          .eq("scope", "business")
          .eq("business_id", businessId)
          .maybeSingle();
        businessSwitch = bSwitch;

        const { data: rSwitches } = await supabase
          .from("ai_kill_switch_state")
          .select("*")
          .eq("scope", "route")
          .eq("business_id", businessId);
        routeSwitches = (rSwitches || []) as unknown as KillSwitchState[];
      }

      return {
        global: globalSwitch as unknown as KillSwitchState,
        business: businessSwitch as unknown as KillSwitchState,
        routes: routeSwitches,
      };
    },
    enabled: true,
    refetchInterval: 5000, // Poll for real-time state
  });
}

// Get audit events
export function useAuditEvents(businessId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ["audit-events", businessId, limit],
    queryFn: async (): Promise<AuditEvent[]> => {
      if (!businessId) return [];

      const { data, error } = await supabase
        .from("ai_audit_events")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as unknown as AuditEvent[];
    },
    enabled: !!businessId,
  });
}

// Authorize Live Mode
export function useAuthorizeLiveMode(businessId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      justification,
      authorizedBy,
      expiresAt,
      autoRenew = false,
    }: {
      justification: string;
      authorizedBy: string;
      expiresAt?: string;
      autoRenew?: boolean;
    }) => {
      if (!businessId) throw new Error("No business ID");

      const { data, error } = await supabase.functions.invoke("call-ai-authorize-live", {
        body: {
          business_id: businessId,
          justification,
          authorized_by: authorizedBy,
          expires_at: expiresAt,
          auto_renew: autoRenew,
        },
      });

      if (error) throw error;
      if (!data.authorized) {
        throw new Error(data.blockers?.join(", ") || "Authorization denied");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-authorization", businessId] });
      queryClient.invalidateQueries({ queryKey: ["authorization-history", businessId] });
      queryClient.invalidateQueries({ queryKey: ["live-mode-gate", businessId] });
      queryClient.invalidateQueries({ queryKey: ["ai-call-agent-config", businessId] });
      toast({
        title: "Live Mode Authorized",
        description: "AI is now authorized to answer calls autonomously",
      });
    },
    onError: (error) => {
      toast({
        title: "Authorization Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Revoke authorization
export function useRevokeAuthorization(businessId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      authorizationId,
      revokedBy,
      reason,
    }: {
      authorizationId: string;
      revokedBy: string;
      reason: string;
    }) => {
      if (!businessId) throw new Error("No business ID");

      // Update authorization status
      const { error: authError } = await supabase
        .from("ai_live_authorizations")
        .update({
          status: "revoked",
          revoked_by: revokedBy,
          revoked_at: new Date().toISOString(),
          revocation_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", authorizationId);

      if (authError) throw authError;

      // Downgrade to canary
      await supabase
        .from("ai_call_agent_config")
        .update({
          mode: "canary",
          live_mode_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", businessId);

      // Log audit event
      await supabase.rpc("log_ai_audit_event", {
        p_business_id: businessId,
        p_event_type: "authorization_revoked",
        p_event_severity: "warning",
        p_authorization_id: authorizationId,
        p_event_payload: { reason },
        p_triggered_by: "human",
        p_actor_user_id: revokedBy,
      });

      // Log mode transition
      await supabase.from("mode_transition_logs").insert({
        business_id: businessId,
        from_mode: "live",
        to_mode: "canary",
        trigger_reason: `Authorization revoked: ${reason}`,
        was_automatic: false,
      });

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-authorization", businessId] });
      queryClient.invalidateQueries({ queryKey: ["authorization-history", businessId] });
      queryClient.invalidateQueries({ queryKey: ["ai-call-agent-config", businessId] });
      toast({
        title: "Authorization Revoked",
        description: "Live Mode disabled, reverting to Canary Mode",
      });
    },
    onError: (error) => {
      toast({
        title: "Revocation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Kill switch mutations
export function useActivateKillSwitch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      scope,
      businessId,
      routeId,
      reason,
      activatedBy,
      autoDeactivateMinutes,
    }: {
      scope: "global" | "business" | "route";
      businessId?: string;
      routeId?: string;
      reason: string;
      activatedBy: string;
      autoDeactivateMinutes?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke("call-ai-kill-switch", {
        body: {
          action: "activate",
          scope,
          business_id: businessId,
          route_id: routeId,
          reason,
          activated_by: activatedBy,
          auto_deactivate_minutes: autoDeactivateMinutes,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["kill-switch-states"] });
      queryClient.invalidateQueries({ queryKey: ["ai-call-agent-config"] });
      queryClient.invalidateQueries({ queryKey: ["live-authorization"] });
      toast({
        title: "🚨 KILL SWITCH ACTIVATED",
        description: `${data.transferred_calls} active calls transferred to humans`,
        variant: "destructive",
      });
    },
    onError: (error) => {
      toast({
        title: "Kill Switch Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeactivateKillSwitch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      scope,
      businessId,
      routeId,
      deactivatedBy,
    }: {
      scope: "global" | "business" | "route";
      businessId?: string;
      routeId?: string;
      deactivatedBy: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("call-ai-kill-switch", {
        body: {
          action: "deactivate",
          scope,
          business_id: businessId,
          route_id: routeId,
          activated_by: deactivatedBy, // reusing field for deactivation
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kill-switch-states"] });
      toast({
        title: "Kill Switch Deactivated",
        description: "AI answering can resume if authorized",
      });
    },
    onError: (error) => {
      toast({
        title: "Deactivation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Export audit data
export function useExportAuditData(businessId: string | undefined) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      startDate,
      endDate,
      includeTranscripts = false,
      redactPii = true,
    }: {
      startDate?: string;
      endDate?: string;
      includeTranscripts?: boolean;
      redactPii?: boolean;
    }) => {
      if (!businessId) throw new Error("No business ID");

      const { data, error } = await supabase.functions.invoke("call-ai-audit-export", {
        body: {
          business_id: businessId,
          start_date: startDate,
          end_date: endDate,
          include_transcripts: includeTranscripts,
          redact_pii: redactPii,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Trigger download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-audit-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Audit Export Complete",
        description: "Download started",
      });
    },
    onError: (error) => {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Realtime subscription for kill switch changes
export function useRealtimeKillSwitch(businessId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("kill-switch-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ai_kill_switch_state",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["kill-switch-states", businessId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, queryClient]);
}
