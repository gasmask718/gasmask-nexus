import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "sonner";
import { Bot, Phone, MessageSquare, History, Send, ChevronLeft, ChevronRight, ExternalLink, Loader2 } from "lucide-react";

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
        <TabsList className="grid grid-cols-3 w-full max-w-xl">
          <TabsTrigger value="dial"><Phone className="h-4 w-4 mr-2" />Dial Now</TabsTrigger>
          <TabsTrigger value="sms"><MessageSquare className="h-4 w-4 mr-2" />Send SMS</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-2" />Call History</TabsTrigger>
        </TabsList>

        <TabsContent value="dial" className="mt-4"><DialPanel /></TabsContent>
        <TabsContent value="sms" className="mt-4"><SmsPanel /></TabsContent>
        <TabsContent value="history" className="mt-4"><HistoryPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────── Dial Panel ───────────────────
function DialPanel() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const start = async () => {
    if (!phone.trim()) return toast.error("Phone number is required");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("bland-start-call", {
        body: { phone_number: phone.trim(), name: name.trim() || undefined, business_name: business.trim() || undefined, context: context.trim() || undefined },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Call initiated", { description: `Call ID ${(data as any)?.call_id ?? "(pending)"}. Brandaro link will be sent via SMS.` });
      setPhone(""); setName(""); setBusiness(""); setContext("");
      qc.invalidateQueries({ queryKey: ["bland-call-logs"] });
    } catch (e: any) {
      toast.error("Failed to start call", { description: e?.message ?? String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Launch AI Call</CardTitle>
        <CardDescription>
          Aria — Brandaro's AI rep — calls the prospect, pitches the agency, and texts them <span className="font-mono">{BRANDARO_SITE}</span> after the call.
          Transcript, recording and summary land in Call History automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Phone (E.164) *</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+15551234567" /></div>
          <div><Label>Prospect Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Owner" /></div>
          <div className="md:col-span-2"><Label>Business Name</Label><Input value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Acme Pizzeria" /></div>
          <div className="md:col-span-2"><Label>Operator Context (optional)</Label><Textarea value={context} onChange={(e) => setContext(e.target.value)} placeholder="Cold lead from Yelp scrape, no current website" rows={3} /></div>
        </div>
        <Button onClick={start} disabled={busy} className="w-full md:w-auto">
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Phone className="h-4 w-4 mr-2" />}
          Start Bland AI Call
        </Button>
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
                  <audio controls src={open.recording_url} className="w-full mt-1" />
                  <a href={open.recording_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 mt-1">
                    Open in new tab <ExternalLink className="h-3 w-3" />
                  </a>
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
