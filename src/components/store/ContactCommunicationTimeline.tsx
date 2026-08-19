import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Phone, MessageSquare, Bot, Voicemail, ArrowUpRight, ArrowDownLeft,
  Loader2, ChevronDown, Send, AlertCircle, Sparkles, FileText,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CallTranscriptViewer } from "@/components/communication/CallTranscriptViewer";
import { CallAnalysisPanel } from "@/components/communication/CallAnalysisPanel";
import { RecordingPlayer } from "@/components/phone/RecordingPlayer";


interface Props {
  storeId: string;
  contactId: string;
  contactName: string;
  contactPhone?: string | null;
  canReceiveSms?: boolean | null;
  className?: string;
}

type Entry = {
  id: string;
  ts: string;
  direction: "inbound" | "outbound" | "system";
  channel: string; // call, sms, ai_call, voicemail, email, va_call, bland
  source: string;  // source_table from v_store_comms_detail
  who: string | null;
  duration: number | null;
  outcome: string | null;
  summary: string | null;
  body: string | null;
  transcript: string | null;
  recording_url: string | null;
  status: string | null;
  call_id?: string | null; // Bland/dynasty call_id for transcript+analysis lookup
};


const normalize = (p?: string | null) => (p || "").replace(/\D/g, "").slice(-10);

function ChannelBadge({ channel, source }: { channel: string; source: string }) {
  const ch = channel?.toLowerCase() || "";
  if (source === "dynasty_ai_calls" || ch.includes("ai") || ch === "bland") {
    return (
      <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30 text-[10px]">
        <Bot className="h-3 w-3 mr-1" /> AI Call
      </Badge>
    );
  }
  if (ch === "voicemail") {
    return (
      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">
        <Voicemail className="h-3 w-3 mr-1" /> Voicemail
      </Badge>
    );
  }
  if (ch === "call" || ch === "va_call") {
    return (
      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px]">
        <Phone className="h-3 w-3 mr-1" /> {ch === "va_call" ? "VA Call" : "Call"}
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-500/15 text-green-500 border-green-500/30 text-[10px]">
      <MessageSquare className="h-3 w-3 mr-1" /> SMS
    </Badge>
  );
}

export function ContactCommunicationTimeline({
  storeId, contactId, contactName, contactPhone, canReceiveSms, className,
}: Props) {
  const qc = useQueryClient();
  const phoneTail = normalize(contactPhone);

  // SINGLE SOURCE: public.v_store_comms_detail — the merge happens in SQL,
  // not here. (Retires the old four-query client-side merge.)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["contact-comm-timeline", storeId, contactId, phoneTail],
    enabled: !!contactId && !!storeId,
    queryFn: async (): Promise<Entry[]> => {
      let q = (supabase as any)
        .from("v_store_comms_detail")
        .select("*")
        .eq("store_id", storeId)
        .order("occurred_at", { ascending: false })
        .limit(200);

      // Contact-owned rows, plus anything on this contact's number that never
      // got a contact_id stamped on it.
      q = phoneTail
        ? q.or(`contact_id.eq.${contactId},phone.ilike.%${phoneTail}%`)
        : q.eq("contact_id", contactId);

      const { data: rows, error } = await q;
      if (error) throw error;

      const entries: Entry[] = (rows || []).map((r: any) => ({
        id: `${r.source_table}-${r.source_id}`,
        ts: r.occurred_at,
        direction: (r.direction as any) || "outbound",
        channel:
          r.is_ai && (r.channel === "call" || !r.channel) ? "ai_call" : r.channel || "sms",
        source: r.source_table,
        who: r.performed_by || (r.is_ai ? "AI" : null),
        duration: r.duration_seconds ?? null,
        outcome: r.outcome,
        summary: r.summary,
        body: r.body,
        transcript: r.transcript,
        recording_url: r.recording_url,
        status: r.status,
        call_id: r.source_table === "dynasty_ai_calls" ? r.provider_sid : null,
      }));

      // Same call can be mirrored into more than one source table.
      const seen = new Set<string>();
      return entries.filter((e) => {
        const key = `${e.ts}|${e.direction}|${(e.body || "").slice(0, 40)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
  });


  // realtime — refresh on new comm_logs for this store
  useEffect(() => {
    const ch = supabase
      .channel(`contact-comm-${contactId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "communication_logs", filter: `store_id=eq.${storeId}` },
        () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [storeId, contactId, refetch]);

  // unread = most recent inbound has no later outbound
  const needsResponse = useMemo(() => {
    if (!data?.length) return false;
    const lastInboundIdx = data.findIndex((e) => e.direction === "inbound");
    if (lastInboundIdx === -1) return false;
    // anything before it (more recent) that's outbound = replied
    return !data.slice(0, lastInboundIdx).some((e) => e.direction === "outbound");
  }, [data]);

  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const sendReply = async () => {
    if (!reply.trim() || !contactPhone) return;
    setSending(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("send-sms", {
        body: {
          to_number: contactPhone,
          message_body: reply.trim(),
          idempotency_key: `contact-reply-${contactId}-${Date.now()}`,
          store_id: storeId,
          skip_cooldown: true,
          metadata: { contact_id: contactId, source: "store_profile_quick_reply" },
        },
      });
      if (error) throw error;
      if (res?.success === false) throw new Error(res.error_message || res.reason || "Send failed");

      // Mirror to communication_logs for the timeline
      await supabase.from("communication_logs").insert({
        store_id: storeId,
        contact_id: contactId,
        channel: "sms",
        direction: "outbound",
        summary: `SMS to ${contactName}`,
        message_content: reply.trim(),
        recipient_phone: contactPhone,
        delivery_status: "sent",
        performed_by: "user",
      });

      setReply("");
      toast.success("Reply sent");
      qc.invalidateQueries({ queryKey: ["contact-comm-timeline", contactId] });
    } catch (e: any) {
      toast.error(`Failed: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" />
          Timeline · {contactName}
          {data?.length ? <Badge variant="outline" className="text-[10px]">{data.length}</Badge> : null}
        </div>
        {needsResponse && (
          <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">
            <AlertCircle className="h-3 w-3 mr-1" /> Needs Response
          </Badge>
        )}
      </div>

      {/* Quick reply */}
      {contactPhone && canReceiveSms !== false && (
        <div className="flex gap-2 items-start">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={`Quick reply to ${contactName}...`}
            rows={2}
            className="text-xs min-h-[44px] resize-none"
          />
          <Button size="sm" onClick={sendReply} disabled={!reply.trim() || sending}>
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : !data?.length ? (
        <p className="text-xs text-muted-foreground text-center py-4">No communication yet</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {data.map((e) => (
            <div key={e.id} className="rounded-md border border-border/50 bg-card/50 p-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {e.direction === "inbound" ? (
                    <ArrowDownLeft className="h-3 w-3 text-green-500" />
                  ) : e.direction === "outbound" ? (
                    <ArrowUpRight className="h-3 w-3 text-blue-500" />
                  ) : null}
                  <ChannelBadge channel={e.channel} source={e.source} />
                  {e.outcome && <Badge variant="outline" className="text-[10px]">{e.outcome}</Badge>}
                  {e.status && e.status !== e.outcome && (
                    <span className="text-[10px] text-muted-foreground">{e.status}</span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(e.ts), "MMM d, yyyy h:mm a")}
                  {e.duration ? ` · ${e.duration}s` : ""}
                </span>
              </div>

              {(e.summary || e.body) && (
                <p className="text-xs leading-relaxed">{e.body || e.summary}</p>
              )}

              {e.who && (
                <p className="text-[10px] text-muted-foreground">by {e.who}</p>
              )}

              {e.recording_url && (
                <RecordingPlayer recordingUrl={e.recording_url} recordingSid={e.call_id} />
              )}

              {e.source === "dynasty_ai_calls" && e.call_id ? (
                <details className="group">
                  <summary className="text-[10px] text-purple-400 cursor-pointer hover:text-purple-300 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> AI Analysis & Transcript
                    <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-2 space-y-3 rounded border border-purple-500/20 bg-purple-500/5 p-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        Analysis
                      </div>
                      <CallAnalysisPanel callId={e.call_id} />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Transcript
                      </div>
                      <CallTranscriptViewer callId={e.call_id} maxHeight="240px" />
                    </div>
                  </div>
                </details>
              ) : e.transcript ? (
                <details className="group">
                  <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                    Transcript
                    <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                  </summary>
                  <pre className="mt-1 text-[10px] bg-muted/50 rounded p-2 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {e.transcript}
                  </pre>
                </details>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
