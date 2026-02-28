import { useVoiceDevice, DeviceLifecycleState, MicPermission } from "@/contexts/VoiceDeviceProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, RefreshCw, AlertTriangle, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

function stateLabel(s: DeviceLifecycleState): string {
  switch (s) {
    case "idle": return "Idle";
    case "token_fetching": return "Fetching Token…";
    case "creating": return "Creating Device…";
    case "registering": return "Registering…";
    case "registered": return "Ready";
    case "error": return "Error";
  }
}

function StateBeacon({ state }: { state: DeviceLifecycleState }) {
  if (state === "registered") {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
        <span className="text-green-600 dark:text-green-400 font-medium">Voice Device Ready</span>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
        <span className="text-destructive font-medium">Device Error</span>
      </div>
    );
  }
  if (["token_fetching", "creating", "registering"].includes(state)) {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
        <span className="text-yellow-600 dark:text-yellow-400 font-medium">{stateLabel(state)}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
      <span className="text-muted-foreground">Idle</span>
    </div>
  );
}

function MicBadge({ permission, onRequest }: { permission: MicPermission; onRequest: () => void }) {
  if (permission === "granted") {
    return (
      <Badge variant="outline" className="gap-1 text-xs text-green-600 border-green-500/30">
        <Mic className="h-3 w-3" /> Mic OK
      </Badge>
    );
  }
  if (permission === "denied") {
    return (
      <Badge variant="destructive" className="gap-1 text-xs cursor-pointer" onClick={onRequest}>
        <MicOff className="h-3 w-3" /> Mic Blocked
      </Badge>
    );
  }
  if (permission === "checking") {
    return (
      <Badge variant="outline" className="gap-1 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking…
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-xs cursor-pointer" onClick={onRequest}>
      <Mic className="h-3 w-3" /> Allow Mic
    </Badge>
  );
}

export function VoiceDeviceReadiness({ showDebug = false }: { showDebug?: boolean }) {
  const {
    isReady, deviceState, deviceError, tokenExpiresAt, registeredAt,
    voiceHealth, micPermission, refreshToken, reinitialize, requestMicPermission,
  } = useVoiceDevice();
  const [debugOpen, setDebugOpen] = useState(false);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-muted-foreground" />
          <StateBeacon state={deviceState} />
          <MicBadge permission={micPermission} onRequest={requestMicPermission} />
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => refreshToken()}>
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => reinitialize()}>
            <RotateCcw className="h-3 w-3" /> Reinit
          </Button>
        </div>
      </div>

      {micPermission === "denied" && (
        <div className="flex items-start gap-2 p-2 rounded bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-xs">
          <MicOff className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>Microphone permission required for calling. Allow in browser settings then click Reinit.</span>
        </div>
      )}

      {deviceError && (
        <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{deviceError}</span>
        </div>
      )}

      {showDebug && (
        <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
          <CollapsibleTrigger className="text-[10px] text-muted-foreground hover:underline cursor-pointer">
            {debugOpen ? "Hide" : "Show"} Debug Info
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-1">
            <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
              <span className="text-muted-foreground">Device State:</span>
              <span>{deviceState}</span>
              <span className="text-muted-foreground">Registered:</span>
              <span className="flex items-center gap-1">
                {isReady ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-muted-foreground" />}
                {isReady ? "Yes" : "No"}
              </span>
              <span className="text-muted-foreground">Mic Permission:</span>
              <span>{micPermission}</span>
              <span className="text-muted-foreground">Registered At:</span>
              <span>{registeredAt ? new Date(registeredAt).toLocaleTimeString() : "—"}</span>
              <span className="text-muted-foreground">Token Expires:</span>
              <span>{tokenExpiresAt ? new Date(tokenExpiresAt).toLocaleTimeString() : "—"}</span>
              {voiceHealth && Object.entries(voiceHealth).map(([k, v]) => (
                <span key={k} className="contents">
                  <span className="text-muted-foreground">{k.replace("TWILIO_", "")}:</span>
                  <span>{v ? "✅" : "❌"}</span>
                </span>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
