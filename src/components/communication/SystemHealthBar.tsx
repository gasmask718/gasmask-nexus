import { useCommunicationRuntime } from "@/contexts/CommunicationRuntimeContext";
import { cn } from "@/lib/utils";
import { Phone, Users, ListChecks, Clock } from "lucide-react";

/**
 * Global health indicator bar visible across all communication pages.
 * Shows: Twilio status, agent availability, queue depth, business hours.
 */
export function SystemHealthBar() {
  const { systemHealth, queueStats, agentStats } = useCommunicationRuntime();

  const indicators = [
    {
      label: "Dialer",
      ok: systemHealth.twilioReady,
      icon: Phone,
      detail: systemHealth.twilioReady ? "Ready" : "Disconnected",
    },
    {
      label: "Agents",
      ok: systemHealth.agentOnline,
      icon: Users,
      detail: `${agentStats.available}/${agentStats.total}`,
    },
    {
      label: "Queue",
      ok: systemHealth.queueHasItems,
      icon: ListChecks,
      detail: `${queueStats.queued} queued`,
      warn: !systemHealth.queueHasItems,
    },
    {
      label: "Hours",
      ok: systemHealth.withinBusinessHours,
      icon: Clock,
      detail: systemHealth.withinBusinessHours ? "Open" : "Closed",
    },
  ];

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 border-b bg-card/80 backdrop-blur-sm text-xs">
      {indicators.map((ind) => {
        const Icon = ind.icon;
        const dotColor = ind.ok
          ? "bg-green-500"
          : ind.warn
            ? "bg-amber-500"
            : "bg-destructive";

        return (
          <div key={ind.label} className="flex items-center gap-1.5">
            <div className="relative">
              <div className={cn("h-2 w-2 rounded-full", dotColor)} />
              {ind.ok && (
                <div className={cn("absolute inset-0 h-2 w-2 rounded-full animate-ping opacity-40", dotColor)} />
              )}
            </div>
            <Icon className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">{ind.label}:</span>
            <span className={cn("font-medium", ind.ok ? "text-foreground" : "text-destructive")}>
              {ind.detail}
            </span>
          </div>
        );
      })}
    </div>
  );
}
