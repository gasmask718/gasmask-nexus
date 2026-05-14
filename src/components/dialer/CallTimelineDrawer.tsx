// Per-call live status drawer
// ─────────────────────────────────────────────────────────────────────────────
// Reads three sources, all keyed off a single outbound_call_queue row:
//   1. outbound_call_queue (the row itself)        — current status, SIDs,
//      bridge result, recording, final transcript
//   2. dialer_call_events (filter: queue_item_id)  — every Twilio + Bland
//      lifecycle event in order
//   3. live_call_transcripts (filter: call_sid)    — per-utterance live
//      transcript captured during the Bland conversation
//
// Renders three tabs: Timeline · Transcript · Summary.
// Realtime: re-fetches all three when new rows land.

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2,
  Phone, PhoneForwarded, Bot, User, Mic, XCircle, Sparkles, Save, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

type FollowUpStatus =
  | "won_back" | "closed_deal" | "callback_needed" | "follow_up_later"
  | "nurture" | "no_answer" | "not_interested";

const FOLLOWUP_OPTIONS: { value: FollowUpStatus; label: string }[] = [
  { value: "won_back",        label: "🏆 Won back the customer" },
  { value: "closed_deal",     label: "✅ Closed deal" },
  { value: "callback_needed", label: "📞 Need to call again" },
  { value: "follow_up_later", label: "🗓 Follow up later" },
  { value: "nurture",         label: "🌱 Nurture / long-term" },
  { value: "no_answer",       label: "📵 No answer / voicemail" },
  { value: "not_interested",  label: "❌ Not interested" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DialerEvent {
  id: string;
  created_at: string;
  event_type: string;
  source: string;
  severity: string | null;
  call_sid: string | null;
  payload: Record<string, unknown> | null;
}

interface QueueRow {
  id: string;
  status: string;
  phone_number: string | null;
  contact_name: string | null;
  twilio_call_sid: string | null;
  bland_call_id: string | null;
  bland_recording_url: string | null;
  bland_transcript: string | null;
  bridge_attempted_at: string | null;
  bridge_failed_reason: string | null;
  bridged_at: string | null;
  ended_at: string | null;
  dialing_started_at: string | null;
  answered_at: string | null;
  answered_by: string | null;
  dial_status: string | null;
  attempt_count: number | null;
  voicemail_left: boolean | null;
  last_error_severity: string | null;
  notes: string | null;
}

interface Utterance {
  id: string;
  speaker: string;
  text: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Visual helpers
// ─────────────────────────────────────────────────────────────────────────────

const sevIcon = (sev: string | null) => {
  switch (sev) {
    case "critical":
    case "error":
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "info":
    default:
      return <Info className="h-4 w-4 text-muted-foreground" />;
  }
};

// Human-readable label for raw event_type strings emitted by our edge fns.
function labelEvent(evt: string): { label: string; icon: any } {
  if (evt.startsWith("twilio.")) {
    const sub = evt.split(".")[1];
    if (sub === "ringing")     return { label: "Ringing customer",        icon: Phone };
    if (sub === "in-progress") return { label: "Customer answered",       icon: CheckCircle2 };
    if (sub === "answered")    return { label: "Customer answered",       icon: CheckCircle2 };
    if (sub === "completed")   return { label: "Twilio call completed",   icon: CheckCircle2 };
    if (sub === "busy")        return { label: "Line busy",               icon: XCircle };
    if (sub === "failed")      return { label: "Twilio call failed",      icon: XCircle };
    if (sub === "no-answer")   return { label: "No answer",               icon: XCircle };
    if (sub === "canceled")    return { label: "Call canceled",           icon: XCircle };
    if (sub === "amd" || sub === "amd_result") return { label: "Answering machine detection", icon: Mic };
    return { label: `Twilio: ${sub}`, icon: Phone };
  }
  if (evt === "dispatch.placed")          return { label: "Bland AI agent dispatched", icon: Bot };
  if (evt === "dispatch.twilio_error")    return { label: "Twilio dispatch error",     icon: XCircle };
  if (evt === "dispatch.exception")       return { label: "Dispatcher exception",      icon: XCircle };
  if (evt === "bridge.failed")            return { label: "Bridge to Bland failed",    icon: XCircle };
  if (evt === "bland.transcript_ready")   return { label: "Transcript captured",       icon: CheckCircle2 };
  if (evt === "bland.call_completed")     return { label: "Bland call completed",      icon: CheckCircle2 };
  if (evt === "bland.persist_error")      return { label: "Persist error",             icon: AlertCircle };
  if (evt === "bland.queue_update_error") return { label: "Queue update error",        icon: AlertCircle };
  if (evt === "bland.queue_link_missing") return { label: "Queue link missing",        icon: AlertTriangle };
  if (evt === "bland.webhook_unauthorized") return { label: "Webhook unauthorized",   icon: AlertCircle };
  if (evt === "transcript_ready")         return { label: "Transcript captured",       icon: CheckCircle2 };
  if (evt === "call_completed")           return { label: "Call completed",            icon: CheckCircle2 };
  return { label: evt, icon: Info };
}

const STATUS_TONE: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  dialing: "bg-blue-500/15 text-blue-600",
  ringing: "bg-blue-500/15 text-blue-600",
  intro_playing: "bg-indigo-500/15 text-indigo-600",
  awaiting_input: "bg-amber-500/15 text-amber-600",
  answered: "bg-green-500/15 text-green-600",
  connected: "bg-green-500/15 text-green-600",
  bridging: "bg-purple-500/15 text-purple-600",
  bridged: "bg-green-500/15 text-green-600",
  in_ai_conversation: "bg-emerald-500/15 text-emerald-600",
  transferred: "bg-blue-500/15 text-blue-600",
  completed: "bg-green-500/10 text-green-600",
  declined: "bg-orange-500/15 text-orange-600",
  no_input: "bg-amber-500/15 text-amber-600",
  no_answer: "bg-amber-500/15 text-amber-600",
  voicemail: "bg-orange-500/15 text-orange-600",
  voicemail_detected: "bg-orange-500/15 text-orange-600",
  voicemail_left: "bg-orange-500/15 text-orange-600",
  failed_bridge: "bg-destructive/15 text-destructive",
  failed: "bg-destructive/15 text-destructive",
};

interface Props {
  queueItemId: string | null;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CallTimelineDrawer({ queueItemId, onClose }: Props) {
  const open = !!queueItemId;
  const qc = useQueryClient();

  // 1) Queue row (header / summary)
  const { data: queueRow, isLoading: rowLoading } = useQuery({
    queryKey: ["dialer-call-row", queueItemId],
    enabled: open,
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outbound_call_queue")
        .select(
          "id, status, phone_number, contact_name, twilio_call_sid, bland_call_id, bland_recording_url, bland_transcript, bridge_attempted_at, bridge_failed_reason, bridged_at, ended_at, dialing_started_at, answered_at, answered_by, dial_status, attempt_count, voicemail_left, last_error_severity, notes",
        )
        .eq("id", queueItemId!)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as QueueRow | null;
    },
  });

  // 2) Timeline events
  const { data: events = [], isLoading: evLoading } = useQuery({
    queryKey: ["dialer-call-timeline", queueItemId],
    enabled: open,
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dialer_call_events" as any)
        .select("id, created_at, event_type, source, severity, call_sid, payload")
        .eq("queue_item_id", queueItemId)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      return (data || []) as unknown as DialerEvent[];
    },
  });

  // 3) Live transcript utterances (keyed by Twilio call SID)
  const callSid = queueRow?.twilio_call_sid || null;
  const { data: utterances = [], isLoading: trLoading } = useQuery({
    queryKey: ["dialer-call-utterances", callSid],
    enabled: open && !!callSid,
    refetchInterval: 3000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_call_transcripts" as any)
        .select("id, speaker, text, created_at")
        .eq("call_sid", callSid)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as Utterance[];
    },
  });

  // Realtime subscriptions (events + transcripts + queue row)
  useEffect(() => {
    if (!queueItemId) return;
    const ch = supabase
      .channel(`call-drawer-${queueItemId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dialer_call_events",
          filter: `queue_item_id=eq.${queueItemId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["dialer-call-timeline", queueItemId] }),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "outbound_call_queue",
          filter: `id=eq.${queueItemId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["dialer-call-row", queueItemId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [queueItemId, qc]);

  useEffect(() => {
    if (!callSid) return;
    const ch = supabase
      .channel(`call-drawer-tx-${callSid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_call_transcripts",
          filter: `call_sid=eq.${callSid}`,
        },
        () => qc.invalidateQueries({ queryKey: ["dialer-call-utterances", callSid] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [callSid, qc]);

  // ─── render ────────────────────────────────────────────────────────────────
  const status = queueRow?.status || "queued";
  const statusTone = STATUS_TONE[status] || "bg-muted text-muted-foreground";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-3 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="truncate">
                {queueRow?.contact_name || queueRow?.phone_number || "Call"}
              </SheetTitle>
              <SheetDescription className="font-mono text-xs truncate">
                {queueRow?.phone_number}
              </SheetDescription>
            </div>
            <Badge className={`${statusTone} flex-shrink-0`}>{status.replace(/_/g, " ")}</Badge>
          </div>

          {/* Live status chips: shows what's happening right now */}
          <div className="flex flex-wrap gap-1 mt-2">
            {queueRow?.twilio_call_sid && (
              <Badge variant="outline" className="text-[10px]">
                <Phone className="h-3 w-3 mr-1" /> Twilio
              </Badge>
            )}
            {queueRow?.bland_call_id && (
              <Badge variant="outline" className="text-[10px]">
                <Bot className="h-3 w-3 mr-1" /> Bland
              </Badge>
            )}
            {queueRow?.bridged_at && (
              <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-600">
                <PhoneForwarded className="h-3 w-3 mr-1" /> Bridged
              </Badge>
            )}
            {queueRow?.answered_at && !queueRow?.bridge_failed_reason && (
              <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Picked up
              </Badge>
            )}
            {queueRow?.voicemail_left && (
              <Badge variant="outline" className="text-[10px] border-orange-500/40 text-orange-600">
                <Mic className="h-3 w-3 mr-1" /> Voicemail
              </Badge>
            )}
            {queueRow?.bridge_failed_reason && (
              <Badge variant="destructive" className="text-[10px]">
                <XCircle className="h-3 w-3 mr-1" /> {queueRow.bridge_failed_reason}
              </Badge>
            )}
            {queueRow?.attempt_count != null && queueRow.attempt_count > 0 && (
              <Badge variant="outline" className="text-[10px]">
                Attempt {queueRow.attempt_count}
              </Badge>
            )}
          </div>
        </SheetHeader>

        <Tabs defaultValue="timeline" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-3 grid grid-cols-3">
            <TabsTrigger value="timeline">Timeline ({events.length})</TabsTrigger>
            <TabsTrigger value="transcript">
              Transcript ({utterances.length || (queueRow?.bland_transcript ? "✓" : 0)})
            </TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          {/* ── Timeline ─────────────────────────────────────────────────── */}
          <TabsContent value="timeline" className="flex-1 overflow-hidden mt-3 px-6 pb-6">
            <ScrollArea className="h-full pr-3">
              {evLoading && (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
                </div>
              )}
              {!evLoading && events.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No events recorded yet — waiting for the dispatcher to pick this call up.
                </div>
              )}
              <ol className="space-y-2">
                {events.map((e) => {
                  const meta = labelEvent(e.event_type);
                  const Icon = meta.icon;
                  return (
                    <li
                      key={e.id}
                      className="border rounded-md p-3 bg-card text-card-foreground"
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5"><Icon className="h-4 w-4 text-muted-foreground" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-sm font-medium">{meta.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(e.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">{e.source}</Badge>
                            {e.severity && e.severity !== "info" && (
                              <Badge
                                variant={e.severity === "warning" ? "secondary" : "destructive"}
                                className="text-[10px]"
                              >
                                {sevIcon(e.severity)}<span className="ml-1">{e.severity}</span>
                              </Badge>
                            )}
                            <code className="text-[10px] text-muted-foreground">
                              {e.event_type}
                            </code>
                          </div>
                          {e.payload && Object.keys(e.payload).length > 0 && (
                            <pre className="mt-2 text-[10px] bg-muted p-2 rounded overflow-x-auto max-h-32">
                              {JSON.stringify(e.payload, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </ScrollArea>
          </TabsContent>

          {/* ── Transcript ───────────────────────────────────────────────── */}
          <TabsContent value="transcript" className="flex-1 overflow-hidden mt-3 px-6 pb-6">
            <ScrollArea className="h-full pr-3">
              {trLoading && (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading transcript…
                </div>
              )}

              {!trLoading && utterances.length === 0 && !queueRow?.bland_transcript && (
                <div className="text-center py-12 text-muted-foreground text-sm space-y-1">
                  <Mic className="h-6 w-6 mx-auto opacity-40" />
                  <div>No transcript yet.</div>
                  <div className="text-xs">
                    {callSid
                      ? "Live utterances will stream in once the AI starts talking."
                      : "Transcript appears once the call is connected to Bland."}
                  </div>
                </div>
              )}

              {/* Live per-utterance feed */}
              {utterances.length > 0 && (
                <div className="space-y-2">
                  {utterances.map((u) => {
                    const isAi = u.speaker === "ai";
                    return (
                      <div
                        key={u.id}
                        className={`flex gap-2 ${isAi ? "" : "flex-row-reverse"}`}
                      >
                        <div className={`flex-shrink-0 h-7 w-7 rounded-full grid place-items-center ${
                          isAi ? "bg-primary/15 text-primary" : "bg-muted"
                        }`}>
                          {isAi ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                        </div>
                        <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          isAi ? "bg-primary/10" : "bg-muted"
                        }`}>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                            {u.speaker} · {new Date(u.created_at).toLocaleTimeString()}
                          </div>
                          <div className="whitespace-pre-wrap">{u.text}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Final transcript fallback (delivered when Bland posts the
                  webhook with concatenated_transcript) */}
              {utterances.length === 0 && queueRow?.bland_transcript && (
                <div className="space-y-2">
                  <Badge variant="outline" className="text-[10px]">
                    Final transcript (post-call)
                  </Badge>
                  <pre className="whitespace-pre-wrap text-sm bg-muted p-3 rounded">
                    {queueRow.bland_transcript}
                  </pre>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* ── Summary ──────────────────────────────────────────────────── */}
          <TabsContent value="summary" className="flex-1 overflow-hidden mt-3 px-6 pb-6">
            <ScrollArea className="h-full pr-3">
              {rowLoading && (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
                </div>
              )}
              {queueRow && (
                <div className="space-y-2 text-sm">
                  <SummaryRow k="Status" v={queueRow.status} />
                  <SummaryRow k="Phone" v={queueRow.phone_number} mono />
                  <SummaryRow k="Twilio Call SID" v={queueRow.twilio_call_sid} mono />
                  <SummaryRow k="Bland Call ID" v={queueRow.bland_call_id} mono />
                  <SummaryRow k="Dial Status" v={queueRow.dial_status} />
                  <SummaryRow k="Answered By" v={queueRow.answered_by} />
                  <SummaryRow k="Attempts" v={queueRow.attempt_count?.toString()} />
                  <SummaryRow k="Dialing Started" v={fmtTs(queueRow.dialing_started_at)} />
                  <SummaryRow k="Answered At" v={fmtTs(queueRow.answered_at)} />
                  <SummaryRow k="Bridge Attempted" v={fmtTs(queueRow.bridge_attempted_at)} />
                  <SummaryRow k="Bridged At" v={fmtTs(queueRow.bridged_at)} />
                  <SummaryRow k="Ended At" v={fmtTs(queueRow.ended_at)} />
                  {queueRow.bridge_failed_reason && (
                    <SummaryRow k="Bridge Error" v={queueRow.bridge_failed_reason} alert />
                  )}
                  {queueRow.bland_recording_url && (
                    <div className="pt-2">
                      <div className="text-xs text-muted-foreground mb-1">Recording</div>
                      <audio controls className="w-full" src={queueRow.bland_recording_url} />
                    </div>
                  )}
                  {queueRow.notes && (
                    <div className="pt-2">
                      <div className="text-xs text-muted-foreground mb-1">Notes</div>
                      <div className="bg-muted p-2 rounded whitespace-pre-wrap">{queueRow.notes}</div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small render helpers
// ─────────────────────────────────────────────────────────────────────────────

function SummaryRow({
  k, v, mono, alert,
}: { k: string; v: string | null | undefined; mono?: boolean; alert?: boolean }) {
  if (!v) return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b py-1.5">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className={`text-xs text-right ${mono ? "font-mono" : ""} ${alert ? "text-destructive" : ""}`}>
        {v}
      </span>
    </div>
  );
}

function fmtTs(ts: string | null): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleString();
}
