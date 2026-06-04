import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HealthStatus = "pass" | "warn" | "fail" | "unknown";

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

export async function runHealthCheck(check_key?: string) {
  const params = check_key ? `?key=${encodeURIComponent(check_key)}` : "";
  const { data, error } = await supabase.functions.invoke(`system-health-runner${params}`, { body: {} });
  if (error) throw error;
  return data;
}
