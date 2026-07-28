import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PhoneIncoming, PhoneOutgoing, MessageSquare, Voicemail, Clock, User } from "lucide-react";
import { RecordingPlayer } from "./RecordingPlayer";
import type { PhoneLogEntry } from "@/hooks/usePhoneLog";

const fmtDuration = (s?: number | null) => {
  if (!s) return null;
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
};

function EntryIcon({ e }: { e: PhoneLogEntry }) {
  if (e.outcome === "voicemail" || e.status === "voicemail")
    return <Voicemail className="h-4 w-4 text-amber-500" />;
  if (e.channel === "sms") return <MessageSquare className="h-4 w-4 text-primary" />;
  return e.direction === "inbound" ? (
    <PhoneIncoming className="h-4 w-4 text-emerald-500" />
  ) : (
    <PhoneOutgoing className="h-4 w-4 text-sky-500" />
  );
}

/** One merged calls + texts + recordings timeline for a single number. */
export function PhoneLogTimeline({ entries }: { entries: PhoneLogEntry[] }) {
  if (!entries.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No calls or texts logged for this number yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((e) => {
        const isVoicemail = e.outcome === "voicemail" || e.status === "voicemail";
        const body = e.channel === "sms" ? e.message_content || e.summary : e.summary;
        return (
          <Card key={e.id} className="border-border/60">
            <CardContent className="flex gap-3 p-4">
              <div className="mt-0.5 rounded-lg bg-muted p-2">
                <EntryIcon e={e} />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold capitalize">
                    {isVoicemail ? "Voicemail" : e.channel === "sms" ? "Text" : "Call"}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {e.direction === "inbound" ? "Incoming" : "Outgoing"}
                  </Badge>
                  {e.status && !isVoicemail && (
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {e.status}
                    </Badge>
                  )}
                  {fmtDuration(e.call_duration) && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {fmtDuration(e.call_duration)}
                    </span>
                  )}
                  <time className="ml-auto text-[11px] text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </time>
                </div>

                {body && <p className="whitespace-pre-wrap break-words text-sm">{body}</p>}

                {e.transcript && (
                  <blockquote className="rounded-md border-l-2 border-primary/50 bg-muted/40 px-3 py-2 text-xs italic text-muted-foreground">
                    {e.transcript}
                  </blockquote>
                )}

                {e.recording_url && (
                  <RecordingPlayer recordingUrl={e.recording_url} recordingSid={e.twilio_sid} />
                )}

                {e.performed_by && (
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <User className="h-3 w-3" />
                    {e.performed_by}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
