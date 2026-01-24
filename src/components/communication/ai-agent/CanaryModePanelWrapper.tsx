import { useAICallAgentConfig, useAITrustScore } from "@/hooks/useAICallAgent";
import { useCanaryStats, useCanaryCallLogs, useCanaryEscapeEvents } from "@/hooks/useCanaryMode";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CanaryModePanel } from "./CanaryModePanel";
import { CanaryKillSwitch } from "./CanaryKillSwitch";
import { CanaryCallHistory } from "./CanaryCallHistory";
import { CanaryEscapeLog } from "./CanaryEscapeLog";

interface CanaryModePanelWrapperProps {
  businessId: string;
}

export function CanaryModePanelWrapper({ businessId }: CanaryModePanelWrapperProps) {
  const { data: config } = useAICallAgentConfig(businessId);
  const { data: trustScore } = useAITrustScore(businessId);
  const { data: stats } = useCanaryStats(businessId);
  const { data: callLogs, isLoading: logsLoading } = useCanaryCallLogs(businessId);
  const { data: escapeEvents, isLoading: eventsLoading } = useCanaryEscapeEvents(businessId);

  // Check callable users
  const { data: callableUsers } = useQuery({
    queryKey: ['callable-users', businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('is_callable', true)
        .not('phone', 'is', null);
      return data || [];
    },
    enabled: !!businessId,
  });

  // Check unresolved calls
  const { data: unresolvedCalls } = useQuery({
    queryKey: ['unresolved-calls', businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from('call_outcomes')
        .select('id')
        .eq('business_id', businessId)
        .in('resolution_status', ['pending', 'in_progress']);
      return data || [];
    },
    enabled: !!businessId,
  });

  const callableCount = callableUsers?.length || 0;
  const unresolvedCount = unresolvedCalls?.length || 0;
  const isKillSwitchActive = config?.canary_kill_switch || false;
  const activeCanaryCalls = stats?.activeCanaryCalls || 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <CanaryModePanel
          config={config || null}
          trustScore={trustScore || null}
          stats={stats || null}
          hasCallableUsers={callableCount > 0}
          callableUsersCount={callableCount}
          unresolvedCallsCount={unresolvedCount}
        />
        <CanaryKillSwitch 
          businessId={businessId} 
          isActive={isKillSwitchActive}
          activeCallsCount={activeCanaryCalls}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CanaryCallHistory logs={callLogs || []} isLoading={logsLoading} />
        <CanaryEscapeLog events={escapeEvents || []} isLoading={eventsLoading} />
      </div>
    </div>
  );
}
