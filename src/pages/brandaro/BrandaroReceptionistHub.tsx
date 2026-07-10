// Brandaro AI Receptionist — Hub page
// Route: /os/brandaro/receptionist
// Shows all receptionist clients with MRR, stats, and an [Onboard New Client] flow.
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PhoneCall, Plus, Copy, DollarSign, CheckCircle2, Loader2 } from "lucide-react";

type Plan = "starter" | "pro" | "enterprise";

const PLANS: Record<Plan, { setup: number; monthly: number; blurb: string }> = {
  starter:    { setup: 497, monthly: 197, blurb: "AI answers calls, books appointments, answers FAQs" },
  pro:        { setup: 497, monthly: 297, blurb: "Everything in Starter + SMS followups + call recording" },
  enterprise: { setup: 997, monthly: 497, blurb: "Everything in Pro + dedicated number + weekly reports" },
};

const money = (n?: number | null) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n ?? 0);

async function copyText(text: string, label = "Copied") {
  try {
    if (navigator?.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      toast.success(label);
      return;
    }
  } catch (e) {
    console.warn("clipboard blocked, falling back", e);
  }
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

export default function BrandaroReceptionistHub() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [manual, setManual] = useState({
    business_name: "",
    owner_name: "",
    phone: "",
    email: "",
  });
  const [plan, setPlan] = useState<Plan>("starter");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["brandaro-receptionist-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_receptionist_clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: monthlyAppts = 0 } = useQuery({
    queryKey: ["brandaro-receptionist-monthly-appts"],
    queryFn: async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("brandaro_receptionist_calls")
        .select("id", { count: "exact", head: true })
        .eq("appointment_booked", true)
        .gte("created_at", monthStart.toISOString());
      return count ?? 0;
    },
  });

  const stats = useMemo(() => {
    const active = clients.filter((c: any) => c.status === "active");
    return {
      active: active.length,
      callsThisMonth: active.reduce((s: number, c: any) => s + (c.calls_this_month ?? 0), 0),
      mrr: active.reduce((s: number, c: any) => s + Number(c.monthly_amount ?? 0), 0),
    };
  }, [clients]);

  // Leads for the onboarding step 1 dropdown
  const { data: leads = [] } = useQuery({
    queryKey: ["brandaro-qualified-leads-onboarding"],
    enabled: onboardOpen,
    queryFn: async () => {
      const { data } = await supabase
        .from("brandaro_qualified_leads")
        .select("id, business_name, phone_number, phone, city, state, email, owner_name")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const sendPaymentLink = useMutation({
    mutationFn: async () => {
      const lead = leads.find((l: any) => l.id === selectedLeadId);
      const payload = {
        lead_id: selectedLeadId ?? null,
        plan,
        customer_email: lead?.email ?? manual.email,
        customer_name: lead?.owner_name ?? manual.owner_name,
        business_name: lead?.business_name ?? manual.business_name,
      };
      const { data, error } = await supabase.functions.invoke("brandaro-receptionist-checkout", {
        body: payload,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { checkout_url: string; sms_sent: boolean };
    },
    onSuccess: (data) => {
      setCheckoutUrl(data.checkout_url);
      setStep(4);
      toast.success(data.sms_sent ? "Payment link sent via SMS" : "Payment link created");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create payment link"),
  });

  const resetOnboard = () => {
    setOnboardOpen(false);
    setStep(1);
    setSelectedLeadId(null);
    setManual({ business_name: "", owner_name: "", phone: "", email: "" });
    setPlan("starter");
    setCheckoutUrl(null);
    qc.invalidateQueries({ queryKey: ["brandaro-receptionist-clients"] });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <PhoneCall className="w-7 h-7" /> AI Receptionist Clients
          </h1>
          <p className="text-muted-foreground">Automated 24/7 call answering</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-yellow-500/15 text-yellow-500 border-yellow-500/40 text-base px-3 py-1">
            {money(stats.mrr)}/mo MRR
          </Badge>
          <Button onClick={() => setOnboardOpen(true)} className="bg-yellow-500 text-black hover:bg-yellow-400">
            <Plus className="w-4 h-4 mr-1" /> Onboard New Client
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Clients" value={stats.active} />
        <StatCard label="Calls This Month" value={stats.callsThisMonth} />
        <StatCard label="Appointments Booked" value={monthlyAppts} sub="This month" />
        <StatCard label="MRR" value={money(stats.mrr)} icon={<DollarSign className="w-4 h-4" />} />
      </div>

      {/* Clients grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading receptionist clients…
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-muted-foreground">No receptionist clients yet.</p>
            <p className="text-xs text-muted-foreground">
              Clients appear here after their payment is confirmed by the Stripe webhook.
            </p>
            <Button onClick={() => setOnboardOpen(true)}>Send Payment Link</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map((c: any) => (
            <Card key={c.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{c.business_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {c.owner_name ?? "—"} · {c.phone}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[c.city, c.state].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={c.status} />
                    <Badge variant="outline" className="capitalize">{c.plan}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">AI Phone: </span>
                  {c.twilio_phone_number ? (
                    <button
                      onClick={() => copyText(c.twilio_phone_number, "Number copied")}
                      className="font-mono text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {c.twilio_phone_number} <Copy className="w-3 h-3" />
                    </button>
                  ) : (
                    <span className="text-amber-500 italic">Provisioning…</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs pt-2">
                  <Metric label="Calls / mo" value={c.calls_this_month ?? 0} />
                  <Metric label="Monthly" value={`$${Number(c.monthly_amount ?? 0).toFixed(0)}`} />
                  <Metric label="Next bill" value={c.next_billing_date ?? "—"} />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3"
                  onClick={() => navigate(`/os/brandaro/receptionist/${c.id}`)}
                >
                  Manage
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Onboarding modal */}
      <Dialog open={onboardOpen} onOpenChange={(o) => (o ? setOnboardOpen(true) : resetOnboard())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Onboard New Receptionist Client</DialogTitle>
            <DialogDescription>
              {step === 1 && "Select the qualified lead or enter details manually."}
              {step === 2 && "Choose the plan the prospect agreed to."}
              {step === 3 && "Review and send the payment link."}
              {step === 4 && "Payment link is ready to share."}
            </DialogDescription>
          </DialogHeader>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Qualified Lead</Label>
                <Select value={selectedLeadId ?? undefined} onValueChange={(v) => setSelectedLeadId(v)}>
                  <SelectTrigger><SelectValue placeholder="Pick a lead…" /></SelectTrigger>
                  <SelectContent>
                    {leads.map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.business_name} · {l.phone_number ?? l.phone ?? "no phone"} · {l.city ?? ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground text-center">— or enter manually —</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Business name" value={manual.business_name} onChange={(v) => setManual({ ...manual, business_name: v })} />
                <Field label="Owner name" value={manual.owner_name} onChange={(v) => setManual({ ...manual, owner_name: v })} />
                <Field label="Phone" value={manual.phone} onChange={(v) => setManual({ ...manual, phone: v })} />
                <Field label="Email" value={manual.email} onChange={(v) => setManual({ ...manual, email: v })} />
              </div>
              <DialogFooter>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!selectedLeadId && !manual.business_name}
                >
                  Next: choose plan
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {(Object.keys(PLANS) as Plan[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlan(p)}
                  className={`w-full text-left border rounded-lg p-4 transition-colors ${
                    plan === p ? "border-yellow-500 bg-yellow-500/5" : "hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold capitalize">{p}</div>
                    <div className="font-mono text-sm">
                      ${PLANS[p].setup} setup + ${PLANS[p].monthly}/mo
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{PLANS[p].blurb}</div>
                </button>
              ))}
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={() => setStep(3)}>Next: review</Button>
              </DialogFooter>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="border rounded-lg p-4 space-y-1 text-sm">
                <div><span className="text-muted-foreground">Business:</span> {leads.find((l: any) => l.id === selectedLeadId)?.business_name ?? manual.business_name}</div>
                <div><span className="text-muted-foreground">Plan:</span> {plan}</div>
                <div><span className="text-muted-foreground">Today:</span> ${PLANS[plan].setup + PLANS[plan].monthly} (setup + first month)</div>
                <div><span className="text-muted-foreground">Then:</span> ${PLANS[plan].monthly}/mo recurring</div>
              </div>
              <p className="text-xs text-muted-foreground">
                Payment link is created via Stripe and (if a phone is on file) sent via SMS.
              </p>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setStep(2)} disabled={sendPaymentLink.isPending}>Back</Button>
                <Button
                  onClick={() => sendPaymentLink.mutate()}
                  disabled={sendPaymentLink.isPending}
                >
                  {sendPaymentLink.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Send Payment Link
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === 4 && checkoutUrl && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-5 h-5" /> Payment link ready
              </div>
              <div className="flex gap-2">
                <Input readOnly value={checkoutUrl} className="font-mono text-xs" />
                <Button onClick={() => copyText(checkoutUrl, "Link copied")}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={resetOnboard}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, sub, icon }: { label: string; value: any; sub?: string; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          {icon}{label}
        </div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="text-center border rounded p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:     "bg-green-500/15 text-green-600 border-green-500/40",
    onboarding: "bg-amber-500/15 text-amber-600 border-amber-500/40",
    paused:     "bg-gray-500/15 text-gray-500 border-gray-500/40",
    trial:      "bg-blue-500/15 text-blue-500 border-blue-500/40",
    cancelled:  "bg-red-500/15 text-red-500 border-red-500/40",
    suspended:  "bg-red-500/15 text-red-500 border-red-500/40",
  };
  return (
    <Badge variant="outline" className={`${styles[status] ?? ""} capitalize text-xs`}>
      {status}
    </Badge>
  );
}
