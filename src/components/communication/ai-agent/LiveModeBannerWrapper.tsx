import { useLiveModeConfig, useDisableLiveMode } from "@/hooks/useLiveMode";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LiveModeBanner } from "./LiveModeBanner";

interface LiveModeBannerWrapperProps {
  businessId: string;
}

export function LiveModeBannerWrapper({ businessId }: LiveModeBannerWrapperProps) {
  const { data: config } = useLiveModeConfig(businessId);
  const disableLiveMode = useDisableLiveMode(businessId);

  // Get active live calls count
  const { data: activeCalls } = useQuery({
    queryKey: ['active-live-calls', businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_call_sessions')
        .select('id')
        .eq('business_id', businessId)
        .eq('status', 'active')
        .eq('handoff_state', 'ai_active');
      return data?.length || 0;
    },
    enabled: !!businessId,
    refetchInterval: 5000,
  });

  const isLiveActive = config?.mode === 'live' && config?.live_mode_enabled;

  if (!isLiveActive) return null;

  return (
    <LiveModeBanner
      mode={config?.mode || 'off'}
      isLiveActive={isLiveActive}
      activeCalls={activeCalls || 0}
      onKillSwitch={() => disableLiveMode.mutate("KILL SWITCH ACTIVATED")}
    />
  );
}
