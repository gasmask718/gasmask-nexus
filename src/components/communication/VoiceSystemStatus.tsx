import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mic, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useTwilioDevice, VoiceHealth } from "@/hooks/useTwilioDevice";

function HealthRow({ label, ok }: { label: string; ok?: boolean }) {
  if (ok === undefined) return null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive" />
      )}
    </div>
  );
}

export function VoiceSystemStatus() {
  const { isReady, voiceHealth, tokenExpiresAt, deviceError, refreshToken } = useTwilioDevice();

  const allHealthy = voiceHealth && Object.values(voiceHealth).every(Boolean);
  const hasError = deviceError || (voiceHealth && !allHealthy);

  return (
    <Card className={hasError ? "border-destructive/50" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mic className="h-4 w-4" />
          Voice System Status
          {isReady ? (
            <Badge variant="outline" className="ml-auto text-green-600 border-green-600">Ready</Badge>
          ) : hasError ? (
            <Badge variant="destructive" className="ml-auto">Error</Badge>
          ) : (
            <Badge variant="outline" className="ml-auto">Initializing</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {deviceError && (
          <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{deviceError}</span>
          </div>
        )}

        {voiceHealth && (
          <div className="space-y-1.5">
            <HealthRow label="Account Authority (AC)" ok={voiceHealth.TWILIO_ACCOUNT_SID} />
            <HealthRow label="API Key Signature (SK)" ok={voiceHealth.TWILIO_API_SID} />
            <HealthRow label="API Secret" ok={voiceHealth.TWILIO_API_SECRET} />
            <HealthRow label="TwiML App Linked (AP)" ok={voiceHealth.TWILIO_TWIML_APP_SID} />
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Device Registered</span>
          {isReady ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {tokenExpiresAt && (
          <div className="text-xs text-muted-foreground">
            Token expires: {new Date(tokenExpiresAt).toLocaleTimeString()}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => refreshToken()}
        >
          <RefreshCw className="h-3 w-3" /> Refresh Token
        </Button>
      </CardContent>
    </Card>
  );
}
