/**
 * Voice Browser Test (placeholder)
 *
 * Live in-browser ElevenLabs WebRTC testing has been removed. The voice
 * stack now runs through Twilio + Bland AI on the telephony side, so this
 * panel just shows a notice. We leave the file in place to keep imports
 * stable; it can be deleted entirely once any remaining references are pruned.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Mic } from "lucide-react";

export function VoiceBrowserTest() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Mic className="h-6 w-6 text-primary" />
          Browser Voice Test
        </h2>
        <p className="text-muted-foreground">
          In-browser voice agent testing is disabled. Voice conversations now
          run through Bland AI over Twilio — initiate a real call to test.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          To test a voice agent, place an outbound call from the Dialer or
          dial the configured Twilio inbound number. Live audio is handled by
          Bland AI and bridged via Twilio.
        </CardContent>
      </Card>
    </div>
  );
}
