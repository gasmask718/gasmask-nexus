// Brandaro AI Receptionist — Client Detail
// Route: /os/brandaro/receptionist/:id
// Tabs: Overview · Calls · Settings · Billing
import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Copy, Loader2, PhoneCall, RefreshCw, Pause, Play, X } from "lucide-react";

const money = (n?: number | null) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");

async function copyText(text: string, label = "Copied") {
  try {
    if (navigator?.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      toast.success(label);
      return;
    }
  } catch {}
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  if (ok) toast.success(label);
  else toast.error("Copy failed — select and press ⌘/Ctrl+C");
}

export default function BrandaroReceptionistClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelText, setCancelText] = useState("");

  const { data: client, isLoading } = useQuery({
    queryKey: ["brandaro-receptionist-client", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_receptionist_clients")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: calls = [] } = useQuery({
    queryKey: ["brandaro-receptionist-calls", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_receptionist_calls")
        .select("*")
        .eq("client_id", id!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const retry = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("brandaro-provision-receptionist", {
        body: { client_id: id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success("Provisioning triggered");
      qc.invalidateQueries({ queryKey: ["brandaro-receptionist-client", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Provisioning failed"),
  });

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const patch: any = { status };
      if (status === "cancelled") patch.cancelled_at = new Date().toISOString();
      const { error } = await supabase
        .from("brandaro_receptionist_clients")
        .update(patch)
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: (_r, status) => {
      toast.success(`Client ${status}`);
      qc.invalidateQueries({ queryKey: ["brandaro-receptionist-client", id] });
      qc.invalidateQueries({ queryKey: ["brandaro-receptionist-clients"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Update failed"),
  });

  if (isLoading) {
    return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }
  if (!client) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Client not found.
        <Button variant="link" onClick={() => navigate("/os/brandaro/receptionist")}>Back to Hub</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/os/brandaro/receptionist")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> All Clients
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-3 mt-2">
            {client.business_name}
            <Badge variant="outline" className="capitalize">{client.status}</Badge>
            <Badge variant="outline" className="capitalize">{client.plan}</Badge>
          </h1>
          {client.twilio_phone_number ? (
            <button
              onClick={() => copyText(client.twilio_phone_number, "Number copied")}
              className="mt-2 text-2xl font-mono text-primary hover:underline inline-flex items-center gap-2"
            >
              <PhoneCall className="w-5 h-5" /> {client.twilio_phone_number} <Copy className="w-4 h-4" />
            </button>
          ) : (
            <div className="mt-2 text-amber-600 italic">AI number provisioning…</div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {client.status === "active" && (
            <Button variant="outline" onClick={() => setStatus.mutate("paused")}>
              <Pause className="w-4 h-4 mr-1" /> Pause
            </Button>
          )}
          {client.status === "paused" && (
            <Button variant="outline" onClick={() => setStatus.mutate("active")}>
              <Play className="w-4 h-4 mr-1" /> Resume
            </Button>
          )}
          {client.status !== "cancelled" && (
            <Button variant="destructive" onClick={() => setCancelOpen(true)}>
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calls">Calls ({calls.length})</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Total Calls" value={client.total_calls_handled ?? 0} />
            <Stat label="This Month" value={client.calls_this_month ?? 0} />
            <Stat label="Appointments" value={client.appointments_booked_total ?? 0} />
            <Stat label="Avg Duration" value={`${Math.round((client.avg_call_duration_seconds ?? 0) / 60)} min`} />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Recent Calls</CardTitle></CardHeader>
            <CardContent>
              {calls.slice(0, 5).length === 0 ? (
                <p className="text-sm text-muted-foreground">No calls yet.</p>
              ) : (
                <div className="space-y-2">
                  {calls.slice(0, 5).map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between border-b py-2 last:border-0">
                      <div>
                        <div className="font-medium">{c.caller_name ?? c.caller_phone ?? "Unknown"}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{c.summary ?? "(no summary yet)"}</div>
                      </div>
                      <div className="text-right text-xs">
                        <OutcomeBadge outcome={c.call_outcome} />
                        <div className="text-muted-foreground">{Math.round((c.call_duration_seconds ?? 0) / 60)} min · {fmtDate(c.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Provisioning Status</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Retell Agent" value={client.retell_agent_id ?? <span className="text-amber-600">Not provisioned</span>} mono />
              <Row label="Twilio Number" value={client.twilio_phone_number ?? <span className="text-amber-600">Not assigned</span>} mono />
              <Row label="Twilio SID" value={client.twilio_number_sid ?? "—"} mono />
              <Row label="Status" value={<Badge variant="outline" className="capitalize">{client.status}</Badge>} />
              {(!client.agent_provisioned || !client.number_provisioned) && (
                <Button size="sm" onClick={() => retry.mutate()} disabled={retry.isPending}>
                  {retry.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                  Retry Provisioning
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calls">
          <CallsTable calls={calls} />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab client={client} />
        </TabsContent>

        <TabsContent value="billing">
          <BillingTab client={client} />
        </TabsContent>
      </Tabs>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel receptionist subscription</DialogTitle>
            <DialogDescription>
              This will stop billing at the end of the current cycle and mark the client as cancelled.
              Type <b>CANCEL</b> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input value={cancelText} onChange={(e) => setCancelText(e.target.value)} placeholder="CANCEL" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Back</Button>
            <Button
              variant="destructive"
              disabled={cancelText !== "CANCEL"}
              onClick={() => {
                setStatus.mutate("cancelled");
                setCancelOpen(false);
                setCancelText("");
              }}
            >
              Cancel subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Sub components ─────────────────────────────────────────────────────── */

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="flex justify-between border-b py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return <Badge variant="outline">—</Badge>;
  const styles: Record<string, string> = {
    appointment_booked:  "bg-green-500/15 text-green-600 border-green-500/40",
    callback_requested:  "bg-amber-500/15 text-amber-600 border-amber-500/40",
    info_provided:       "bg-blue-500/15 text-blue-600 border-blue-500/40",
    transferred_to_human:"bg-purple-500/15 text-purple-600 border-purple-500/40",
    voicemail_left:      "bg-gray-500/15 text-gray-500 border-gray-500/40",
    spam:                "bg-gray-500/15 text-gray-500 border-gray-500/40",
    wrong_number:        "bg-gray-500/15 text-gray-500 border-gray-500/40",
    other:               "bg-gray-500/15 text-gray-500 border-gray-500/40",
  };
  return <Badge variant="outline" className={`${styles[outcome] ?? ""} text-[10px]`}>{outcome.replace(/_/g, " ")}</Badge>;
}

function CallsTable({ calls }: { calls: any[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <Card>
      <CardContent className="pt-4">
        {calls.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No calls yet.</p>
        ) : (
          <div className="divide-y">
            {calls.map((c) => (
              <div key={c.id} className="py-3">
                <button
                  className="w-full text-left grid grid-cols-6 gap-2 items-center"
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                >
                  <div className="text-xs text-muted-foreground">{fmtDate(c.created_at)}</div>
                  <div className="text-sm">{c.caller_name ?? c.caller_phone ?? "Unknown"}</div>
                  <div className="text-xs">{Math.round((c.call_duration_seconds ?? 0) / 60)} min</div>
                  <div><OutcomeBadge outcome={c.call_outcome} /></div>
                  <div className="text-xs">{c.appointment_booked ? "✅" : "—"}</div>
                  <div className="text-xs line-clamp-1 text-muted-foreground">{c.summary ?? "—"}</div>
                </button>
                {expanded === c.id && (
                  <div className="mt-3 border-l-2 border-primary/40 pl-4 space-y-2 text-sm">
                    {c.recording_url && <audio controls src={c.recording_url} className="w-full h-8" />}
                    {c.summary && <div><b>Summary:</b> {c.summary}</div>}
                    {c.transcript && (
                      <div>
                        <b>Transcript:</b>
                        <pre className="whitespace-pre-wrap text-xs bg-muted/30 p-2 rounded mt-1 max-h-64 overflow-auto">{c.transcript}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SettingsTab({ client }: { client: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    receptionist_name: client.receptionist_name ?? "Sara",
    business_description: client.business_description ?? "",
    services_offered: (client.services_offered ?? []).join(", "),
    timezone: client.timezone ?? "America/New_York",
    faqs: JSON.stringify(client.faqs ?? [], null, 2),
    call_script: client.call_script ?? "",
    appointment_booking_enabled: !!client.appointment_booking_enabled,
    appointment_calendar_url: client.appointment_calendar_url ?? "",
    sms_followup_enabled: !!client.sms_followup_enabled,
    escalation_phone: client.escalation_phone ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      let faqsParsed: any = [];
      try { faqsParsed = JSON.parse(form.faqs || "[]"); } catch { throw new Error("FAQs must be valid JSON: [{question, answer}]"); }
      const { error } = await supabase
        .from("brandaro_receptionist_clients")
        .update({
          receptionist_name: form.receptionist_name,
          business_description: form.business_description,
          services_offered: form.services_offered.split(",").map((s) => s.trim()).filter(Boolean),
          timezone: form.timezone,
          faqs: faqsParsed,
          call_script: form.call_script,
          appointment_booking_enabled: form.appointment_booking_enabled,
          appointment_calendar_url: form.appointment_calendar_url,
          sms_followup_enabled: form.sms_followup_enabled,
          escalation_phone: form.escalation_phone,
        })
        .eq("id", client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["brandaro-receptionist-client", client.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Receptionist Name" value={form.receptionist_name} onChange={(v) => setForm({ ...form, receptionist_name: v })} />
          <Field label="Timezone" value={form.timezone} onChange={(v) => setForm({ ...form, timezone: v })} />
        </div>
        <div>
          <Label>Business Description</Label>
          <Textarea value={form.business_description} onChange={(e) => setForm({ ...form, business_description: e.target.value })} rows={3} />
        </div>
        <Field label="Services Offered (comma separated)" value={form.services_offered} onChange={(v) => setForm({ ...form, services_offered: v })} />
        <div>
          <Label>FAQs (JSON: [{`{ "question": "...", "answer": "..." }`}])</Label>
          <Textarea className="font-mono text-xs" value={form.faqs} onChange={(e) => setForm({ ...form, faqs: e.target.value })} rows={6} />
        </div>
        <div>
          <Label>Call Script</Label>
          <Textarea value={form.call_script} onChange={(e) => setForm({ ...form, call_script: e.target.value })} rows={4} />
        </div>
        <div className="flex items-center justify-between border rounded p-3">
          <div>
            <div className="font-medium">Appointment Booking</div>
            <div className="text-xs text-muted-foreground">Let the AI book appointments on the call.</div>
          </div>
          <Switch checked={form.appointment_booking_enabled} onCheckedChange={(v) => setForm({ ...form, appointment_booking_enabled: v })} />
        </div>
        {form.appointment_booking_enabled && (
          <Field label="Calendar URL (Calendly, etc.)" value={form.appointment_calendar_url} onChange={(v) => setForm({ ...form, appointment_calendar_url: v })} />
        )}
        <div className="flex items-center justify-between border rounded p-3">
          <div>
            <div className="font-medium">SMS Followup to Owner</div>
            <div className="text-xs text-muted-foreground">Send call summary via SMS after every call.</div>
          </div>
          <Switch checked={form.sms_followup_enabled} onCheckedChange={(v) => setForm({ ...form, sms_followup_enabled: v })} />
        </div>
        <Field label="Escalation Phone (transfer if caller demands human)" value={form.escalation_phone} onChange={(v) => setForm({ ...form, escalation_phone: v })} />

        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save Settings
        </Button>
      </CardContent>
    </Card>
  );
}

function BillingTab({ client }: { client: any }) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-2 text-sm">
        <Row label="Plan" value={<span className="capitalize">{client.plan}</span>} />
        <Row label="Monthly" value={`${money(client.monthly_amount)}/mo`} />
        <Row label="Next billing" value={client.next_billing_date ?? "—"} />
        <Row label="Setup fee" value={`${money(client.setup_fee_amount)} — ${client.setup_fee_paid ? `PAID ${fmtDate(client.setup_fee_paid_at)}` : "unpaid"}`} />
        <Row label="Stripe Customer" value={client.stripe_customer_id ?? "—"} mono />
        <Row label="Stripe Subscription" value={client.stripe_subscription_id ?? "—"} mono />
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
