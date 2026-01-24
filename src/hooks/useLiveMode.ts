import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

interface LiveModeGateResult {
  allowed: boolean;
  mode: string;
  blockers: string[];
  warnings: string[];
  metrics: {
    trust_score: number;
    trust_threshold: number;
    override_rate: number;
    max_override_rate: number;
    consecutive_failures: number;
    callable_humans: number;
  };
  config?: {
    disclosure_script: string;
    escape_phrases: string[];
    high_risk_keywords: string[];
    consent_recording_enabled: boolean;
  };
}

interface LiveModeConfig {
  id: string;
  business_id: string;
  mode: string;
  live_mode_enabled: boolean;
  live_kill_switch: boolean;
  live_trust_threshold: number;
  live_max_override_rate: number;
  live_min_canary_days: number;
  ai_disclosure_script: string;
  escape_phrases: string[];
  high_risk_keywords: string[];
  consent_recording_enabled: boolean;
  data_retention_days: number;
}

interface ModeTransition {
  id: string;
  business_id: string;
  from_mode: string;
  to_mode: string;
  trigger_reason: string;
  was_automatic: boolean;
  created_at: string;
}

export function useLiveModeGate(businessId: string | undefined) {
  return useQuery({
    queryKey: ["live-mode-gate", businessId],
    queryFn: async (): Promise<LiveModeGateResult> => {
      if (!businessId) throw new Error("No business ID");

      const { data, error } = await supabase.functions.invoke("call-ai-live-gate", {
        body: { business_id: businessId },
      });

      if (error) throw error;
      return data as LiveModeGateResult;
    },
    enabled: !!businessId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useLiveModeConfig(businessId: string | undefined) {
  return useQuery({
    queryKey: ["live-mode-config", businessId],
    queryFn: async (): Promise<LiveModeConfig | null> => {
      if (!businessId) return null;

      const { data, error } = await supabase
        .from("ai_call_agent_config")
        .select("*")
        .eq("business_id", businessId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data as unknown as LiveModeConfig;
    },
    enabled: !!businessId,
  });
}

export function useModeTransitions(businessId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ["mode-transitions", businessId, limit],
    queryFn: async (): Promise<ModeTransition[]> => {
      if (!businessId) return [];

      const { data, error } = await supabase
        .from("mode_transition_logs")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as unknown as ModeTransition[];
    },
    enabled: !!businessId,
  });
}

export function useEnableLiveMode(businessId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("No business ID");

      // First check if all gates pass
      const { data: gateCheck } = await supabase.functions.invoke("call-ai-live-gate", {
        body: { business_id: businessId },
      });

      if (!gateCheck?.allowed) {
        throw new Error(`Cannot enable Live Mode: ${gateCheck?.blockers?.join(", ")}`);
      }

      // Get current config
      const { data: currentConfig } = await supabase
        .from("ai_call_agent_config")
        .select("mode")
        .eq("business_id", businessId)
        .single();

      const previousMode = (currentConfig as { mode?: string })?.mode || "canary";

      // Enable live mode
      const { error } = await supabase
        .from("ai_call_agent_config")
        .update({
          mode: "live",
          live_mode_enabled: true,
          live_kill_switch: false,
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", businessId);

      if (error) throw error;

      // Log the transition
      await supabase.from("mode_transition_logs").insert({
        business_id: businessId,
        from_mode: previousMode,
        to_mode: "live",
        trigger_reason: "Admin manually enabled Live Mode",
        was_automatic: false,
      });

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-mode-gate", businessId] });
      queryClient.invalidateQueries({ queryKey: ["live-mode-config", businessId] });
      queryClient.invalidateQueries({ queryKey: ["mode-transitions", businessId] });
      queryClient.invalidateQueries({ queryKey: ["ai-call-agent-config", businessId] });
    },
  });
}

export function useDisableLiveMode(businessId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reason?: string) => {
      if (!businessId) throw new Error("No business ID");

      // Get current config
      const { data: currentConfig } = await supabase
        .from("ai_call_agent_config")
        .select("mode")
        .eq("business_id", businessId)
        .single();

      const previousMode = (currentConfig as { mode?: string })?.mode || "live";

      // Disable live mode, downgrade to canary
      const { error } = await supabase
        .from("ai_call_agent_config")
        .update({
          mode: "canary",
          live_mode_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", businessId);

      if (error) throw error;

      // Log the transition
      await supabase.from("mode_transition_logs").insert({
        business_id: businessId,
        from_mode: previousMode,
        to_mode: "canary",
        trigger_reason: reason || "Admin manually disabled Live Mode",
        was_automatic: false,
      });

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-mode-gate", businessId] });
      queryClient.invalidateQueries({ queryKey: ["live-mode-config", businessId] });
      queryClient.invalidateQueries({ queryKey: ["mode-transitions", businessId] });
      queryClient.invalidateQueries({ queryKey: ["ai-call-agent-config", businessId] });
    },
  });
}

export function useLiveKillSwitch(businessId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (activate: boolean) => {
      if (!businessId) throw new Error("No business ID");

      // Get current config
      const { data: currentConfig } = await supabase
        .from("ai_call_agent_config")
        .select("mode")
        .eq("business_id", businessId)
        .single();

      const previousMode = (currentConfig as { mode?: string })?.mode || "live";

      // Toggle kill switch
      const updatePayload: Record<string, unknown> = {
        live_kill_switch: activate,
        updated_at: new Date().toISOString(),
      };

      // If activating, also downgrade mode
      if (activate) {
        updatePayload.mode = "canary";
        updatePayload.live_mode_enabled = false;
      }

      const { error } = await supabase
        .from("ai_call_agent_config")
        .update(updatePayload)
        .eq("business_id", businessId);

      if (error) throw error;

      // Log the transition if mode changed
      if (activate) {
        await supabase.from("mode_transition_logs").insert({
          business_id: businessId,
          from_mode: previousMode,
          to_mode: "canary",
          trigger_reason: "KILL SWITCH ACTIVATED",
          was_automatic: false,
        });
      }

      return { success: true, activated: activate };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-mode-gate", businessId] });
      queryClient.invalidateQueries({ queryKey: ["live-mode-config", businessId] });
      queryClient.invalidateQueries({ queryKey: ["mode-transitions", businessId] });
    },
  });
}

export function useRealtimeModeTransitions(businessId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!businessId) return;

    const channel = supabase
      .channel(`mode-transitions-${businessId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mode_transition_logs",
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["mode-transitions", businessId] });
          queryClient.invalidateQueries({ queryKey: ["live-mode-gate", businessId] });
          queryClient.invalidateQueries({ queryKey: ["live-mode-config", businessId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, queryClient]);
}