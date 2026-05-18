import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Send,
  Mail,
  MessageSquare,
  Loader2,
  Link as LinkIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Inbox,
} from "lucide-react";

interface IntakeInvite {
  id: string;
  token: string;
  business_name: string | null;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  sent_via: string[];
  sms_status: string | null;
  email_status: string | null;
  destination_url: string;
  status: string;
  accessed_at: string | null;
  submitted_at: string | null;
  created_at: string;
}

interface QualifiedLead {
  id: string;
  business_name: string | null;
  phone_number: string | null;
  city: string | null;
  industry: string | null;
  service_interest: string | null;
  lead_status: string | null;
  source: string | null;
  created_at: string;
}

const fieldClass =
  "bg-slate-900/70 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500";

function StatusPill({ value, label }: { value: string | null; label: string }) {
  if (!value) return null;
  const ok = value === "sent" || value === "ok" || value === "delivered";
  const fail = value === "failed" || value === "error";
  return (
    <Badge
      variant="outline"
      className={`text-[10px] gap-1 ${
        ok
          ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
          : fail
          ? "border-red-500/40 text-red-300 bg-red-500/10"
          : "border-slate-600 text-slate-300 bg-slate-700/40"
      }`}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : fail ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {label}: {value}
    </Badge>
  );
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

export function VAIntakeInvitesPanel() {
  const { user } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState<"sms" | "email" | "both" | null>(null);

  const invitesQuery = useQuery({
    queryKey: ["va-intake-invites", user?.id],
    queryFn: async () => {
      if (!user) return [] as IntakeInvite[];
      const { data, error } = await (supabase as any)
        .from("va_intake_invites")
        .select("*")
        .eq("va_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as IntakeInvite[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const submittedQuery = useQuery({
    queryKey: ["va-intake-submitted-leads", user?.id],
    queryFn: async () => {
      if (!user) return [] as QualifiedLead[];
      const { data, error } = await (supabase as any)
        .from("brandaro_qualified_leads")
        .select("id, business_name, phone_number, city, industry, service_interest, lead_status, source, created_at")
        .eq("assigned_va", user.id)
        .eq("source", "va_intake")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as QualifiedLead[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const send = async (channels: ("sms" | "email")[], key: "sms" | "email" | "both") => {
    if (!businessName.trim()) {
      toast.error("Business name is required.");
      return;
    }
    if (channels.includes("sms") && !phone.trim()) {
      toast.error("Phone number is required for SMS.");
      return;
    }
    if (channels.includes("email") && !email.trim()) {
      toast.error("Email is required for Email delivery.");
      return;
    }
    setSending(key);
    try {
      const { data, error } = await supabase.functions.invoke("va-send-intake-invite", {
        body: {
          business_name: businessName,
          owner_name: ownerName,
          phone,
          email,
          channels,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const r = data?.results || {};
      const okParts: string[] = [];
      const failParts: string[] = [];
      if (channels.includes("sms"))
        r.sms?.ok ? okParts.push("SMS") : failParts.push(`SMS (${r.sms?.error || "failed"})`);
      if (channels.includes("email"))
        r.email?.ok ? okParts.push("Email") : failParts.push(`Email (${r.email?.error || "failed"})`);
      if (okParts.length) toast.success(`Intake link sent via ${okParts.join(" + ")}`);
      if (failParts.length) toast.error(`Failed: ${failParts.join(", ")}`);
      // Reset send form on any success
      if (okParts.length) {
        setBusinessName("");
        setOwnerName("");
        setPhone("");
        setEmail("");
      }
      invitesQuery.refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to send intake link");
    } finally {
      setSending(null);
    }
  };

  const invites = invitesQuery.data || [];
  const submitted = submittedQuery.data || [];

  return (
    <div className="space-y-6">
      {/* Send Intake Link */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-cyan-400" />
            Send Intake Link
          </CardTitle>
          <p className="text-xs text-slate-400">
            Sends a tracked link to the prospect. They fill out the discovery form on
            <span className="text-cyan-300"> brandarodigital.com/#contact</span>.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">
                Business Name <span className="text-cyan-400">*</span>
              </label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Acme Plumbing"
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">
                Owner / Contact Name
              </label>
              <Input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Jane Doe"
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">
                Phone (for SMS)
              </label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@business.com"
                className={fieldClass}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              onClick={() => send(["sms"], "sms")}
              disabled={!!sending}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {sending === "sms" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-2" />}
              Send via SMS
            </Button>
            <Button
              onClick={() => send(["email"], "email")}
              disabled={!!sending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {sending === "email" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              Send via Email
            </Button>
            <Button
              onClick={() => send(["sms", "email"], "both")}
              disabled={!!sending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {sending === "both" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send SMS + Email
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tracking Tables */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Inbox className="h-4 w-4 text-cyan-400" />
            Intake Tracking
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white"
            onClick={() => {
              invitesQuery.refetch();
              submittedQuery.refetch();
            }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="submitted">
            <TabsList className="bg-slate-800 border border-slate-700">
              <TabsTrigger value="submitted">
                Submitted Forms
                <Badge variant="secondary" className="ml-2 bg-slate-700 text-slate-200">
                  {submitted.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="sent">
                Sent Invites
                <Badge variant="secondary" className="ml-2 bg-slate-700 text-slate-200">
                  {invites.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Submitted leads (people who actually completed the form) */}
            <TabsContent value="submitted" className="mt-4">
              {submittedQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full bg-slate-800" />
                  ))}
                </div>
              ) : submitted.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No submitted intake forms yet. Send an invite to get started.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800/60 text-slate-400 text-xs">
                      <tr>
                        <th className="text-left p-3 font-medium">Business</th>
                        <th className="text-left p-3 font-medium">Phone</th>
                        <th className="text-left p-3 font-medium">City</th>
                        <th className="text-left p-3 font-medium">Industry</th>
                        <th className="text-left p-3 font-medium">Service Interest</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submitted.map((l) => (
                        <tr key={l.id} className="border-t border-slate-800 hover:bg-slate-800/40">
                          <td className="p-3 text-white font-medium">{l.business_name || "—"}</td>
                          <td className="p-3 text-slate-300 tabular-nums">{l.phone_number || "—"}</td>
                          <td className="p-3 text-slate-300">{l.city || "—"}</td>
                          <td className="p-3 text-slate-300">{l.industry || "—"}</td>
                          <td className="p-3 text-slate-300 max-w-[260px] truncate">{l.service_interest || "—"}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-[10px] border-cyan-500/40 text-cyan-300 bg-cyan-500/10">
                              {l.lead_status || "new"}
                            </Badge>
                          </td>
                          <td className="p-3 text-slate-400 text-xs">{fmtDate(l.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* Sent invites tracking */}
            <TabsContent value="sent" className="mt-4">
              {invitesQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full bg-slate-800" />
                  ))}
                </div>
              ) : invites.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No invites sent yet.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800/60 text-slate-400 text-xs">
                      <tr>
                        <th className="text-left p-3 font-medium">Business</th>
                        <th className="text-left p-3 font-medium">Contact</th>
                        <th className="text-left p-3 font-medium">Channels</th>
                        <th className="text-left p-3 font-medium">Delivery</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Sent</th>
                        <th className="text-left p-3 font-medium">Accessed</th>
                        <th className="text-left p-3 font-medium">Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map((inv) => (
                        <tr key={inv.id} className="border-t border-slate-800 hover:bg-slate-800/40">
                          <td className="p-3 text-white font-medium">{inv.business_name || "—"}</td>
                          <td className="p-3 text-slate-300">
                            <div className="flex flex-col">
                              <span>{inv.owner_name || "—"}</span>
                              <span className="text-[11px] text-slate-500">
                                {[inv.phone, inv.email].filter(Boolean).join(" · ") || "—"}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-slate-300 text-xs">
                            {(inv.sent_via || []).map((c) => (
                              <Badge key={c} variant="outline" className="mr-1 text-[10px] border-slate-600 text-slate-300">
                                {c}
                              </Badge>
                            ))}
                          </td>
                          <td className="p-3 space-y-1">
                            <StatusPill value={inv.sms_status} label="SMS" />
                            <StatusPill value={inv.email_status} label="Email" />
                          </td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                inv.status === "submitted"
                                  ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                                  : inv.status === "accessed"
                                  ? "border-cyan-500/40 text-cyan-300 bg-cyan-500/10"
                                  : "border-slate-600 text-slate-300 bg-slate-700/40"
                              }`}
                            >
                              {inv.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-slate-400 text-xs">{fmtDate(inv.created_at)}</td>
                          <td className="p-3 text-slate-400 text-xs">{fmtDate(inv.accessed_at)}</td>
                          <td className="p-3 text-slate-400 text-xs">{fmtDate(inv.submitted_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default VAIntakeInvitesPanel;
