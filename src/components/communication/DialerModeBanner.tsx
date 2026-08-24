/**
 * DIALER MODE BANNER — the persistent, app-wide answer to "are real calls on?"
 *
 * Owner's rule (2026-08-24): it must be obvious at all times which mode the
 * calling system is in — a banner, not a badge. Admin/owner only. Simulation
 * renders nothing (that is the safe default, and the Power Dialer console
 * states it on its own screen); LIVE renders an unmissable strip on every
 * screen, with or without an armed campaign.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { PhoneCall } from "lucide-react";

export function DialerModeBanner() {
  const { isAdmin, role } = useUserRole();
  const elevated = isAdmin() || role === "owner";

  const { data } = useQuery({
    queryKey: ["dialer-mode-banner"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dialer_settings")
        .select("telephony_mode, twilio_enabled, engine_armed")
        .limit(1)
        .maybeSingle();
      return data as { telephony_mode?: string; twilio_enabled?: boolean; engine_armed?: boolean } | null;
    },
    enabled: elevated,
    refetchInterval: 60_000,
  });

  if (!elevated || !data) return null;
  const live = data.telephony_mode === "live" && data.twilio_enabled === true;
  if (!live) return null;

  return (
    <div className="sticky top-0 z-50 w-full bg-destructive text-destructive-foreground px-4 py-1.5 text-center text-sm font-semibold">
      <Link to="/communication/power-dialer" className="inline-flex items-center gap-2 hover:underline">
        <PhoneCall className="h-4 w-4 shrink-0" />
        {data.engine_armed
          ? "POWER DIALER LIVE — real calls are being placed right now"
          : "TELEPHONY LIVE — real calls will be placed when a campaign is armed"}
      </Link>
    </div>
  );
}

export default DialerModeBanner;
