import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RecordingPlayer } from "@/components/phone/RecordingPlayer";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bot, Phone, MessageSquare, History, Send, ChevronLeft, ChevronRight, ExternalLink, Loader2, Search, X, SkipForward, StopCircle, CheckCircle2, PhoneCall } from "lucide-react";
import { isSpanishLead } from "@/lib/spanishLeadDetector";

const PAGE_SIZE = 20;
const BRANDARO_SITE = "https://www.brandarodigital.com";
const DEFAULT_SMS = `Hi! This is Brandaro Digital — we build high-converting websites and dominate Google for local businesses. Browse our portfolio: ${BRANDARO_SITE}\n\nReply STOP to opt out.`;

interface CallLogRow {
  id: string;
  call_id: string | null;
  agent_type: string | null;
  call_outcome: string | null;
  transcript: string | null;
  recording_url: string | null;
  intent_summary: string | null;
  urgency: string | null;
  created_at: string;
  raw_payload: any;
  lead: { id: string; name: string | null; phone_number: string; status: string } | null;
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const outcomeBadge = (outcome: string | null) => {
  if (!outcome) return <Badge variant="outline">—</Badge>;
  const v = outcome.toLowerCase();
  const cls =
    v.includes("interest") || v.includes("won") ? "bg-green-500/10 text-green-700 border-green-500/30"
    : v.includes("callback") ? "bg-blue-500/10 text-blue-700 border-blue-500/30"
    : v.includes("not") || v.includes("fail") ? "bg-red-500/10 text-red-700 border-red-500/30"
    : v.includes("progress") ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
    : "bg-muted text-muted-foreground";
  return <Badge variant="outline" className={cls}>{outcome.replace(/_/g, " ")}</Badge>;
};

export default function BlandDialHubPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Bot className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Bland AI Dial Hub</h1>
          <p className="text-sm text-muted-foreground">
            Launch AI calls, send single & bulk SMS, and review every transcript / recording / summary.
          </p>
        </div>
      </div>

      <Tabs defaultValue="dial" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="dial"><Phone className="h-4 w-4 mr-2" />Dial Now</TabsTrigger>
          <TabsTrigger value="sms"><MessageSquare className="h-4 w-4 mr-2" />Send SMS</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-2" />Call History</TabsTrigger>
          <TabsTrigger value="texts"><MessageSquare className="h-4 w-4 mr-2" />Text History</TabsTrigger>
        </TabsList>

        <TabsContent value="dial" className="mt-4"><DialPanel /></TabsContent>
        <TabsContent value="sms" className="mt-4"><SmsPanel /></TabsContent>
        <TabsContent value="history" className="mt-4"><HistoryPanel /></TabsContent>
        <TabsContent value="texts" className="mt-4"><TextHistoryPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────── Dial Panel — Brandaro Lead Sequential Dialer ───────────────────
const LEAD_STATUS_OPTIONS = [
  { value: "interested", label: "Interested" },
  { value: "callback", label: "Call Back" },
  { value: "no_answer", label: "No Answer" },
  { value: "call_again", label: "Call Again" },
  { value: "voicemail", label: "Voicemail Left" },
  { value: "wrong_number", label: "Wrong Number" },
  { value: "not_interested", label: "Not Interested" },
  { value: "qualified", label: "Qualified" },
  { value: "won", label: "Won" },
  { value: "dnc", label: "Do Not Call" },
];

interface BrandaroLead {
  id: string;
  business_name: string | null;
  phone: string | null;
  email: string | null;
  industry: string | null;
  category?: string | null;
  subtypes?: string | null;
  location: string | null;
  status: string | null;
  intent_score: number | null;
  has_website: boolean | null;
}

type CallPhase = "idle" | "dialing" | "in_call" | "review" | "saving";

function DialPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<"all" | "spanish">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [queue, setQueue] = useState<BrandaroLead[]>([]);
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [activeLead, setActiveLead] = useState<BrandaroLead | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [activeLog, setActiveLog] = useState<any>(null);
  const [newStatus, setNewStatus] = useState<string>("callback");
  const [statusNote, setStatusNote] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  // Brandaro leads — sourced from VA Roster (brandaro_qualified_leads), phone-only
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["brandaro-qualified-leads-dialer"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_qualified_leads")
        .select("id, business_name, phone_number, email, industry, category, subtypes, city, state, lead_status, priority_tier, priority_score, has_website")
        .not("phone_number", "is", null)
        .order("priority_score", { ascending: false, nullsFirst: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        business_name: r.business_name,
        phone: r.phone_number,
        email: r.email,
        industry: r.industry,
        category: r.category,
        subtypes: r.subtypes,
        location: [r.city, r.state].filter(Boolean).join(", ") || null,
        status: r.lead_status ?? r.priority_tier ?? null,
        intent_score: r.priority_score != null ? Math.round(Number(r.priority_score)) : null,
        has_website: r.has_website,
      })) as BrandaroLead[];
    },
    staleTime: 30_000,
  });

  const statuses = useMemo(
    () => Array.from(new Set(leads.map((l) => l.status).filter(Boolean) as string[])),
    [leads],
  );

  const spanishCount = useMemo(() => leads.filter(isSpanishLead).length, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      const matchesSearch = !q
        || l.business_name?.toLowerCase().includes(q)
        || l.phone?.includes(q)
        || l.email?.toLowerCase().includes(q)
        || l.location?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || l.status === statusFilter;
      const matchesLanguage = languageFilter === "all" || isSpanishLead(l);
      return matchesSearch && matchesStatus && matchesLanguage;
    });
  }, [leads, search, statusFilter, languageFilter]);

  const toggle = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAllVisible = () => {
    const ids = filtered.map((l) => l.id);
    const allSel = ids.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) =>
      allSel ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids])),
    );
  };

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };
  useEffect(() => () => stopPolling(), []);

  const startQueue = () => {
    if (selectedIds.length === 0) return toast.error("Select at least one Brandaro lead");
    const selected = leads.filter((l) => selectedIds.includes(l.id) && l.phone);
    if (selected.length === 0) return toast.error("None of the selected leads have a phone number");
    setQueue(selected);
    setSelectedIds([]);
    void dialNext(selected);
  };

  const dialNext = async (q?: BrandaroLead[]) => {
    const remaining = q ?? queue;
    if (remaining.length === 0) {
      setPhase("idle");
      setActiveLead(null);
      toast.success("Queue complete", { description: "All selected leads have been called." });
      return;
    }
    const next = remaining[0];
    setQueue(remaining.slice(1));
    setActiveLead(next);
    setActiveCallId(null);
    setActiveLogId(null);
    setActiveLog(null);
    setNewStatus("callback");
    setStatusNote("");
    setElapsed(0);
    setPhase("dialing");

    try {
      const phoneRaw = (next.phone ?? "").trim();
      const phone = phoneRaw.startsWith("+") ? phoneRaw : `+1${phoneRaw.replace(/\D/g, "")}`;
      const { data, error } = await supabase.functions.invoke("bland-start-call", {
        body: {
          phone_number: phone,
          name: next.business_name ?? undefined,
          business_name: next.business_name ?? undefined,
          context: [
            next.industry ? `Industry: ${next.industry}` : null,
            next.location ? `Location: ${next.location}` : null,
            next.has_website === false ? "They have NO website yet — strong lead." : null,
            next.intent_score ? `Intent score: ${next.intent_score}` : null,
          ].filter(Boolean).join(" · "),
        },
      });
      if (error) throw error;
      const d = data as any;
      if (d?.error) throw new Error(d.error);
      const callId = d.call_id as string | null;
      if (!callId) throw new Error("Bland did not return a call_id");
      setActiveCallId(callId);
      setPhase("in_call");
      toast.success(`Calling ${next.business_name ?? phone}`);

      // Elapsed timer
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);

      // Poll bland_call_logs for completion
      pollRef.current = window.setInterval(async () => {
        const { data: logs } = await supabase
          .from("bland_call_logs")
          .select("id, call_outcome, transcript, recording_url, intent_summary, urgency, raw_payload, structured_outcome_received_at, created_at")
          .eq("call_id", callId)
          .order("created_at", { ascending: false })
          .limit(1);
        const log = logs?.[0];
        if (!log) return;
        setActiveLogId(log.id);
        const done =
          log.structured_outcome_received_at != null
          || (log.call_outcome && log.call_outcome !== "in_progress")
          || !!log.transcript;
        if (done) {
          stopPolling();
          setActiveLog(log);
          setNewStatus(suggestStatus(log));
          setPhase("review");
        }
      }, 5000);
    } catch (e: any) {
      toast.error("Call failed to start", { description: e?.message ?? String(e) });
      setPhase("idle");
      setActiveLead(null);
    }
  };

  const suggestStatus = (log: any): string => {
    const o = (log?.call_outcome ?? "").toLowerCase();
    if (o.includes("interest")) return "interested";
    if (o.includes("callback")) return "callback";
    if (o.includes("voicemail")) return "voicemail";
    if (o.includes("no_answer") || o.includes("no answer")) return "no_answer";
    if (o.includes("not_interested") || o.includes("not interested")) return "not_interested";
    if (o.includes("wrong")) return "wrong_number";
    return "callback";
  };

  const saveAndNext = async () => {
    if (!activeLead) return;
    setPhase("saving");
    try {
      const updates: any = {
        lead_status: newStatus,
        last_call_at: new Date().toISOString(),
        last_called_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (statusNote.trim()) updates.call_notes = statusNote.trim();
      if (newStatus === "callback" || newStatus === "call_again") {
        // default callback +1 day if operator chose callback
        updates.next_callback_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }
      const { error } = await supabase
        .from("brandaro_qualified_leads")
        .update(updates)
        .eq("id", activeLead.id);
      if (error) throw error;

      if (statusNote.trim() && activeLogId) {
        await supabase
          .from("bland_call_logs")
          .update({ raw_payload: { ...(activeLog?.raw_payload ?? {}), operator_note: statusNote.trim(), operator_status: newStatus } })
          .eq("id", activeLogId);
      }

      toast.success(`Status updated → ${newStatus}`);
      qc.invalidateQueries({ queryKey: ["brandaro-qualified-leads-dialer"] });
      qc.invalidateQueries({ queryKey: ["bland-call-logs"] });
      void dialNext();
    } catch (e: any) {
      toast.error("Could not save status", { description: e?.message ?? String(e) });
      setPhase("review");
    }
  };

  const skipCurrent = () => {
    stopPolling();
    toast.info("Skipped — moving to next");
    void dialNext();
  };
  const endQueue = () => {
    stopPolling();
    setQueue([]);
    setActiveLead(null);
    setActiveCallId(null);
    setActiveLog(null);
    setPhase("idle");
    toast.info("Queue ended");
  };

  const fmtMMSS = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── UI ──
  if (phase !== "idle") {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PhoneCall className={`h-5 w-5 ${phase === "in_call" || phase === "dialing" ? "text-green-500 animate-pulse" : "text-primary"}`} />
                <div>
                  <CardTitle className="text-lg">{activeLead?.business_name ?? "Active Call"}</CardTitle>
                  <CardDescription className="font-mono text-xs">{activeLead?.phone}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{queue.length} remaining</Badge>
                <Button variant="ghost" size="sm" onClick={endQueue}><StopCircle className="h-4 w-4 mr-1" />End</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {phase === "dialing" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Dialing via Bland AI…
              </div>
            )}
            {phase === "in_call" && (
              <div className="flex items-center justify-between rounded-lg border bg-green-500/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                  <div>
                    <p className="text-sm font-medium">Aria is on the call</p>
                    <p className="text-xs text-muted-foreground font-mono">Bland call ID: {activeCallId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm">{fmtMMSS(elapsed)}</span>
                  <Button size="sm" variant="outline" onClick={skipCurrent}><SkipForward className="h-4 w-4 mr-1" />Skip</Button>
                </div>
              </div>
            )}

            {phase === "review" && activeLog && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <p className="text-sm font-medium">Call complete · Duration {fmtMMSS(elapsed)}</p>
                    {outcomeBadge(activeLog.call_outcome)}
                  </div>
                  {activeLog.recording_url && (
                    <div>
                      <Label className="text-xs uppercase text-muted-foreground">Recording</Label>
                      <RecordingPlayer recordingUrl={activeLog.recording_url} recordingSid={activeLog.call_id} />
                    </div>
                  )}
                  {activeLog.intent_summary && (
                    <div>
                      <Label className="text-xs uppercase text-muted-foreground">Summary</Label>
                      <p className="text-sm whitespace-pre-wrap mt-1">{activeLog.intent_summary}</p>
                    </div>
                  )}
                  {activeLog.transcript && (
                    <details>
                      <summary className="text-xs cursor-pointer text-muted-foreground">View transcript</summary>
                      <pre className="text-xs whitespace-pre-wrap mt-2 max-h-64 overflow-auto bg-background rounded p-3 border">{activeLog.transcript}</pre>
                    </details>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-[200px_1fr]">
                  <div>
                    <Label>Set Lead Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LEAD_STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Note (optional)</Label>
                    <Input value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Best callback Tue 2pm…" />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" onClick={skipCurrent}>Skip without saving</Button>
                  <Button onClick={saveAndNext} disabled={(phase as CallPhase) === "saving"}>
                    {(phase as CallPhase) === "saving" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Save & Call Next ({queue.length})
                  </Button>
                </div>
              </div>
            )}

            {queue.length > 0 && phase !== "review" && (
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Up next</Label>
                <ScrollArea className="h-32 mt-1 border rounded-md">
                  <div className="p-2 space-y-1">
                    {queue.map((l, i) => (
                      <div key={l.id} className="flex items-center justify-between text-xs px-2 py-1">
                        <span><span className="text-muted-foreground mr-2">{i + 1}.</span>{l.business_name ?? "—"}</span>
                        <span className="font-mono text-muted-foreground">{l.phone}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Select Brandaro Leads to Dial</CardTitle>
            <CardDescription>
              Pick one or many Brandaro leads. Aria calls them one at a time — after each call you'll see the summary, recording, transcript, and can set the lead's new status before auto-advancing.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{leads.length} leads w/ phone</Badge>
            <Badge className="bg-primary/10 text-primary border-primary/30">{selectedIds.length} selected</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-[1fr_180px_180px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search business / phone / email / location" className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={languageFilter} onValueChange={(v) => setLanguageFilter(v as "all" | "spanish")}>
            <SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All languages</SelectItem>
              <SelectItem value="spanish">🇲🇽 Spanish ({spanishCount})</SelectItem>
            </SelectContent>
          </Select>
          {selectedIds.length > 0 && (
            <Button variant="ghost" onClick={() => setSelectedIds([])}><X className="h-4 w-4 mr-1" />Clear</Button>
          )}
        </div>

        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : (
          <div className="border rounded-md">
            <ScrollArea className="h-[420px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filtered.length > 0 && filtered.every((l) => selectedIds.includes(l.id))}
                        onCheckedChange={toggleAllVisible}
                      />
                    </TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="hidden md:table-cell">Industry</TableHead>
                    <TableHead className="hidden lg:table-cell">Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Intent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No matching Brandaro leads.</TableCell></TableRow>
                  ) : filtered.slice(0, 500).map((l) => (
                    <TableRow key={l.id} className="cursor-pointer hover:bg-muted/40" onClick={() => toggle(l.id)}>
                      <TableCell><Checkbox checked={selectedIds.includes(l.id)} onCheckedChange={() => toggle(l.id)} /></TableCell>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {l.business_name ?? "—"}
                          {isSpanishLead(l) && (
                            <Badge className="text-[9px] px-1.5 py-0 border bg-amber-500/15 text-amber-500 border-amber-500/30">
                              🇲🇽 ES
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{l.phone}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{l.industry ?? "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{l.location ?? "—"}</TableCell>
                      <TableCell>{l.status ? <Badge variant="outline" className="text-[10px]">{l.status}</Badge> : "—"}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{l.intent_score ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {Math.min(filtered.length, 500)} of {filtered.length} filtered · Calls run sequentially (one at a time).
          </p>
          <Button onClick={startQueue} disabled={selectedIds.length === 0}>
            <PhoneCall className="h-4 w-4 mr-2" />
            Start Sequential Calls ({selectedIds.length})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────── SMS Panel ───────────────────
function SmsPanel() {
  const [phones, setPhones] = useState("");
  const [message, setMessage] = useState(DEFAULT_SMS);
  const [busy, setBusy] = useState(false);

  const numbers = useMemo(
    () => phones.split(/[\s,;\n]+/).map((p) => p.trim()).filter(Boolean),
    [phones],
  );

  const send = async () => {
    if (numbers.length === 0) return toast.error("Add at least one phone number");
    if (!message.trim()) return toast.error("Message body is required");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("bland-send-sms", {
        body: { phone_numbers: numbers, message: message.trim(), source: numbers.length > 1 ? "bulk" : "single" },
      });
      if (error) throw error;
      const d = data as any;
      if (d?.error) throw new Error(d.error);
      toast.success(`Sent ${d?.sent ?? 0} of ${numbers.length}`, {
        description: d?.failed ? `${d.failed} failed — see results in console` : "All delivered to Twilio queue",
      });
      if (d?.failed) console.warn("SMS failures:", d.results?.filter((r: any) => !r.ok));
      if ((d?.sent ?? 0) === numbers.length) setPhones("");
    } catch (e: any) {
      toast.error("SMS send failed", { description: e?.message ?? String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Single & Bulk SMS</CardTitle>
        <CardDescription>
          Paste one or many phone numbers (comma, space, or newline-separated). Default message endorses Brandaro's portfolio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Phone Numbers <span className="text-muted-foreground font-normal">({numbers.length} parsed)</span></Label>
          <Textarea value={phones} onChange={(e) => setPhones(e.target.value)} placeholder={"+15551234567\n+15557654321"} rows={4} className="font-mono text-sm" />
        </div>
        <div>
          <Label>Message <span className="text-muted-foreground font-normal">({message.length} chars)</span></Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} />
        </div>
        <Button onClick={send} disabled={busy} className="w-full md:w-auto">
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Send to {numbers.length || 0} number{numbers.length === 1 ? "" : "s"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────── History Panel ───────────────────
function HistoryPanel() {
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<CallLogRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["bland-call-logs", page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count, error } = await supabase
        .from("bland_call_logs")
        .select("id, call_id, agent_type, call_outcome, transcript, recording_url, intent_summary, urgency, created_at, raw_payload, lead:bland_leads(id,name,phone_number,status)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { rows: (data ?? []) as unknown as CallLogRow[], total: count ?? 0 };
    },
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Call History</CardTitle>
        <CardDescription>Every Bland AI call — transcripts, recordings, and outcome summaries.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (data?.rows ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No calls yet — launch one from the Dial Now tab.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Prospect</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.rows.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/40">
                    <TableCell className="whitespace-nowrap text-xs">{fmtDate(r.created_at)}</TableCell>
                    <TableCell className="font-medium">{r.lead?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="font-mono text-xs">{r.lead?.phone_number ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.agent_type ?? "—"}</TableCell>
                    <TableCell>{outcomeBadge(r.call_outcome)}</TableCell>
                    <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                      {r.intent_summary ?? r.transcript?.slice(0, 80) ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setOpen(r)}>View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            Showing {Math.min(page * PAGE_SIZE + 1, total)}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs">Page {page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Call Details</DialogTitle>
          </DialogHeader>
          {open && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prospect" value={open.lead?.name ?? "—"} />
                <Field label="Phone" value={open.lead?.phone_number ?? "—"} mono />
                <Field label="Agent" value={open.agent_type ?? "—"} />
                <Field label="Outcome" value={open.call_outcome ?? "—"} />
                <Field label="Urgency" value={open.urgency ?? "—"} />
                <Field label="Bland Call ID" value={open.call_id ?? "—"} mono />
              </div>
              {open.recording_url && (
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Recording</Label>
                  <RecordingPlayer recordingUrl={open.recording_url} recordingSid={open.call_id} />
                </div>
              )}
              {open.intent_summary && (
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Summary</Label>
                  <p className="mt-1 whitespace-pre-wrap rounded bg-muted/40 p-3">{open.intent_summary}</p>
                </div>
              )}
              {open.transcript && (
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Transcript</Label>
                  <pre className="mt-1 whitespace-pre-wrap rounded bg-muted/40 p-3 text-xs max-h-80 overflow-auto">{open.transcript}</pre>
                </div>
              )}
              {open.raw_payload && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Raw payload</summary>
                  <pre className="mt-1 rounded bg-muted/40 p-3 overflow-auto max-h-80">{JSON.stringify(open.raw_payload, null, 2)}</pre>
                </details>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <p className={mono ? "font-mono text-xs mt-0.5" : "mt-0.5"}>{value}</p>
    </div>
  );
}

// ============================================================
// TEXT HISTORY PANEL — bland_sms_log feed
// ============================================================
interface SmsLogRow {
  id: string;
  lead_id: string | null;
  phone_number: string;
  message: string;
  source: string | null;
  twilio_sid: string | null;
  status: string;
  error: string | null;
  created_at: string;
  lead?: { id: string; name: string | null; phone_number: string } | null;
}

const smsStatusBadge = (status: string, hasError: boolean) => {
  const v = (status || "").toLowerCase();
  if (hasError || v === "failed" || v === "error") {
    return <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30">{status || "failed"}</Badge>;
  }
  if (v === "delivered") {
    return <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">delivered</Badge>;
  }
  if (v === "sent" || v === "queued") {
    return <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/30">{status}</Badge>;
  }
  return <Badge variant="outline">{status || "—"}</Badge>;
};

function TextHistoryPanel() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<SmsLogRow | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["bland-sms-log", page, search, statusFilter],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from("bland_sms_log")
        .select("*, lead:bland_leads(id, name, phone_number)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (search.trim()) {
        const s = search.trim();
        q = q.or(`phone_number.ilike.%${s}%,message.ilike.%${s}%`);
      }
      if (statusFilter !== "all") {
        if (statusFilter === "failed") q = q.or("status.eq.failed,status.eq.error,error.not.is.null");
        else q = q.eq("status", statusFilter);
      }

      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data || []) as SmsLogRow[], count: count || 0 };
    },
    refetchInterval: 30000,
  });

  // Realtime: refresh on insert/update
  useEffect(() => {
    const channel = supabase
      .channel("bland_sms_log_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "bland_sms_log" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  const rows = data?.rows || [];
  const total = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const sentCount = rows.filter(r => !r.error && r.status !== "failed").length;
  const failedCount = rows.filter(r => r.error || r.status === "failed").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> Text Message History
            </CardTitle>
            <CardDescription>
              Every SMS sent through Bland Dial — live from <code className="text-xs">bland_sms_log</code>.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
              ✓ {sentCount} on page
            </Badge>
            {failedCount > 0 && (
              <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30">
                ✗ {failedCount} failed
              </Badge>
            )}
            <Badge variant="outline">{total.toLocaleString()} total</Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search phone or message..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">When</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead className="min-w-[280px]">Message</TableHead>
                <TableHead className="w-[110px]">Source</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[70px] text-right">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No text messages yet. Send your first SMS from the "Send SMS" tab.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/40">
                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(row.created_at)}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{row.lead?.name || "—"}</div>
                      <div className="text-xs text-muted-foreground font-mono">{row.phone_number}</div>
                    </TableCell>
                    <TableCell className="max-w-[420px]">
                      <p className="text-sm line-clamp-2 whitespace-pre-wrap">{row.message}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.source || "—"}</TableCell>
                    <TableCell>{smsStatusBadge(row.status, !!row.error)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {total.toLocaleString()} messages
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> Text Message
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sent" value={fmtDate(selected.created_at)} />
                <Field label="Status" value={selected.status} />
                <Field label="Recipient" value={selected.lead?.name || "—"} />
                <Field label="Phone" value={selected.phone_number} mono />
                <Field label="Source" value={selected.source || "—"} />
                <Field label="Twilio SID" value={selected.twilio_sid || "—"} mono />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Message</Label>
                <ScrollArea className="h-40 mt-1 rounded-md border p-3">
                  <p className="text-sm whitespace-pre-wrap">{selected.message}</p>
                </ScrollArea>
              </div>
              {selected.error && (
                <div>
                  <Label className="text-xs uppercase tracking-wide text-red-600">Error</Label>
                  <p className="text-sm mt-1 p-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-700">
                    {selected.error}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
