import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HealthStatus = "pass" | "warn" | "fail" | "unknown" | "paused";

export interface HealthCheck {
  id: string;
  check_key: string;
  kind: "cron" | "function" | "trigger" | "chain" | "integration" | "data_canary" | "agent";
  business: string;
  floor: string | null;
  label: string;
  cadence_expected_minutes: number | null;
  config: Record<string, any>;
  last_run_at: string | null;
  last_ok_at: string | null;
  last_status: HealthStatus;
  last_message: string | null;
  details: Record<string, any>;
  enabled: boolean;
  updated_at: string;
}

export interface HealthRun {
  id: string;
  check_key: string;
  status: "pass" | "warn" | "fail";
  message: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface MonitoringControl {
  system_name: "system_health_monitoring" | "system_health_sms" | "comms_health_monitoring" | "comms_health_sms";
  alerts_enabled: boolean;
  sms_throttle_minutes: number;
  updated_at: string;
}

export function useHealthChecks() {
  return useQuery({
    queryKey: ["health_checks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_checks" as any)
        .select("*")
        .eq("enabled", true)
        .order("business")
        .order("floor")
        .order("label");
      if (error) throw error;
      return (data ?? []) as unknown as HealthCheck[];
    },
    refetchInterval: 30_000,
  });
}

export function useHealthRuns(check_key: string | null) {
  return useQuery({
    queryKey: ["health_check_runs", check_key],
    queryFn: async () => {
      if (!check_key) return [] as HealthRun[];
      const { data, error } = await supabase
        .from("health_check_runs" as any)
        .select("*")
        .eq("check_key", check_key)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as HealthRun[];
    },
    enabled: !!check_key,
  });
}

export function useMonitoringControls() {
  return useQuery({
    queryKey: ["monitoring_controls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_alert_config")
        .select("system_name, alerts_enabled, sms_throttle_minutes, updated_at")
        .in("system_name", ["system_health_monitoring", "system_health_sms", "comms_health_monitoring", "comms_health_sms"])
        .order("system_name");
      if (error) throw error;
      return (data ?? []) as MonitoringControl[];
    },
    refetchInterval: 30_000,
  });
}

export function useUpdateMonitoringControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ systemName, enabled }: { systemName: MonitoringControl["system_name"]; enabled: boolean }) => {
      const { error } = await supabase
        .from("system_alert_config")
        .update({ alerts_enabled: enabled, updated_at: new Date().toISOString() })
        .eq("system_name", systemName);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["monitoring_controls"] }),
  });
}

export async function runHealthCheck(check_key?: string) {
  const params = check_key ? `?key=${encodeURIComponent(check_key)}` : "";
  const { data, error } = await supabase.functions.invoke(`system-health-runner${params}`, { body: {} });
  if (error) throw error;
  return data;
}
