import { useSystemHealth } from "@/hooks/useSystemHealth";
import { cn } from "@/lib/utils";
import { Phone, Users, ListChecks, Clock, Activity, Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Global health indicator bar — powered by /edge/system-health heartbeat.
 * Polls every 15s. Shows: Overall status, Twilio, Agents, Queue, Observability.
 */
export function SystemHealthBar() {
  const { data: health, isError, isLoading } = useSystemHealth();

  const overall = health?.overall_status || (isError ? "down" : "healthy");

  const overallConfig = {
    healthy: { label: "System Healthy", color: "bg-green-500", textColor: "text-green-600", icon: Activity },
    degraded: { label: "Degraded", color: "bg-amber-500", textColor: "text-amber-600", icon: AlertTriangle },
    down: { label: "System Down", color: "bg-destructive", textColor: "text-destructive", icon: WifiOff },
  }[overall] || { label: "Unknown", color: "bg-muted", textColor: "text-muted-foreground", icon: Wifi };

  const indicators = health
    ? [
        {
          label: "Twilio",
          ok: health.voice.twilio_api === "connected",
          warn: health.voice.twilio_api === "unconfigured",
          icon: Phone,
          detail: health.voice.twilio_api === "connected" ? "Connected" : health.voice.twilio_api === "unconfigured" ? "Not Set" : "Error",
          tooltip: `Token: ${health.voice.token_authority} | TwiML App: ${health.voice.twiml_app_configured ? "Yes" : "No"}`,
        },
        {
          label: "Agents",
          ok: health.agents.routing_ready,
          warn: false,
          icon: Users,
          detail: `${health.agents.online_agents}/${health.agents.total_agents}`,
          tooltip: `Routing: ${health.agents.routing_ready ? "Ready" : "No agents"}`,
        },
        {
          label: "Queue",
          ok: health.execution.queue_depth > 0,
          warn: health.execution.queue_depth === 0,
          icon: ListChecks,
          detail: `${health.execution.queue_depth} queued`,
          tooltip: `Dialing: ${health.execution.dialing} | Active: ${health.execution.active_calls}`,
        },
        {
          label: "Observatory",
          ok: health.observability.live_calls_stream === "connected",
          warn: health.observability.live_calls_stream === "idle",
          icon: Wifi,
          detail: health.observability.live_calls_stream === "connected" ? "Live" : "Idle",
          tooltip: health.observability.last_webhook_seconds >= 0
            ? `Last event: ${health.observability.last_webhook_seconds}s ago`
            : "No events yet",
        },
      ]
    : [];

  const OverallIcon = overallConfig.icon;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-4 px-4 py-1.5 border-b bg-card/80 backdrop-blur-sm text-xs">
        {/* Overall status beacon */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 mr-2">
              <div className="relative">
                <div className={cn("h-2.5 w-2.5 rounded-full", overallConfig.color)} />
                {overall === "healthy" && (
                  <div className={cn("absolute inset-0 h-2.5 w-2.5 rounded-full animate-ping opacity-30", overallConfig.color)} />
                )}
              </div>
              <OverallIcon className={cn("h-3.5 w-3.5", overallConfig.textColor)} />
              <span className={cn("font-semibold", overallConfig.textColor)}>
                {isLoading ? "Connecting…" : overallConfig.label}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {health ? (
              <div className="space-y-1">
                <p>ElevenLabs: {health.providers.elevenlabs}</p>
                <p>AWS Polly: {health.providers.aws_polly}</p>
                <p>Engine: {health.execution.dialer_engine}</p>
              </div>
            ) : (
              <p>Heartbeat polling every 15s</p>
            )}
          </TooltipContent>
        </Tooltip>

        {/* Separator */}
        <div className="h-3 w-px bg-border" />

        {/* Individual indicators */}
        {indicators.map((ind) => {
          const Icon = ind.icon;
          const dotColor = ind.ok
            ? "bg-green-500"
            : ind.warn
              ? "bg-amber-500"
              : "bg-destructive";

          return (
            <Tooltip key={ind.label}>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 cursor-default">
                  <div className={cn("h-2 w-2 rounded-full", dotColor)} />
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{ind.label}:</span>
                  <span className={cn("font-medium", ind.ok ? "text-foreground" : ind.warn ? "text-amber-600" : "text-destructive")}>
                    {ind.detail}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {ind.tooltip}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
