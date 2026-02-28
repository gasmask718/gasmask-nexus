import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemHealthResponse {
  timestamp: string;
  overall_status: "healthy" | "degraded" | "down";
  execution: {
    dialer_engine: string;
    active_calls: number;
    queue_depth: number;
    dialing: number;
  };
  voice: {
    token_authority: string;
    twilio_api: string;
    twiml_app_configured: boolean;
  };
  providers: {
    elevenlabs: string;
    aws_polly: string;
  };
  agents: {
    online_agents: number;
    total_agents: number;
    routing_ready: boolean;
  };
  observability: {
    live_calls_stream: string;
    last_webhook_seconds: number;
  };
  error?: string;
}

export function useSystemHealth(enabled = true) {
  return useQuery<SystemHealthResponse>({
    queryKey: ["system-health"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("system-health", {
        method: "POST",
        body: {},
      });
      if (error) throw error;
      return data as SystemHealthResponse;
    },
    enabled,
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: 1,
  });
}
