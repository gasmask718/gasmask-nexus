import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ExternalLink, Wand2, RefreshCw, CheckCircle2, XCircle, Clock, FileText } from "lucide-react";
import { ManualDemoGenerator } from "@/components/brandaro/ManualDemoGenerator";
import { PaidBuildsPipeline } from "@/components/brandaro/PaidBuildsPipeline";
import { AuditLogCard } from "@/components/brandaro/AuditLogCard";



const EXPECTED_MDS = [
  "cleaning", "landscaping", "restaurant", "plumbing", "electrician",
  "hvac", "roofing", "auto_repair", "salon", "gym", "dentist", "legal",
  "real_estate", "photography", "construction", "general",
];

type Engine = "native" | "durable";

type DemoRow = {
  id: string;
  lead_id: string | null;
  sent_at: string | null;
  sms_sent_at: string | null;
  business_name: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  generation_engine: string | null;
  generation_status: string | null;
  engine_status: string | null;
  demo_url: string | null;
  durable_generated_url: string | null;
  durable_job_status: string | null;
  durable_last_error: string | null;
  audit_score: number | null;
  created_at: string;
  error_message: string | null;
  deployment_status: string | null;
  converted_to_paid: boolean | null;
  cta_clicked: boolean | null;
  view_count: number | null;
  last_viewed_at: string | null;
};

/** Spec row-color states, evaluated in priority order. */
type RowState = "converted" | "cta" | "sms_unviewed" | "deployed_idle" | "failed" | "none";

function rowState(d: DemoRow): RowState {
  if (d.deployment_status === "failed") return "failed";
  if (d.converted_to_paid) return "converted";
  if (d.cta_clicked) return "cta";
  const smsSent = Boolean(d.sms_sent_at || d.sent_at);
  const viewed = (d.view_count ?? 0) > 0 || Boolean(d.last_viewed_at);
  if (smsSent && !viewed) return "sms_unviewed";
  if (d.deployment_status === "live" && !smsSent && !viewed) return "deployed_idle";
  return "none";
}

const ROW_TINT: Record<RowState, string> = {
  converted: "bg-green-500/10 hover:bg-green-500/20",
  cta: "bg-amber-500/10 hover:bg-amber-500/20",
  sms_unviewed: "bg-blue-500/10 hover:bg-blue-500/20",
  deployed_idle: "bg-muted/40 hover:bg-muted/60",
  failed: "bg-destructive/10 hover:bg-destructive/20",
  none: "hover:bg-muted/30",
};


export default function BuilderHubPage() {
  const qc = useQueryClient();
  const [leadId, setLeadId] = useState<string>("");
  const [engine, setEngine] = useState<Engine>("native");

  const { data: leads = [] } = useQuery({
    queryKey: ["builder-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_qualified_leads")
        .select("id,business_name,city,state,industry,demo_status")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // Spec: demos table shows only the last 48 hours.
  const { data: demos = [], isLoading: demosLoading } = useQuery<DemoRow[]>({
    queryKey: ["builder-demos-48h"],
    queryFn: async () => {
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data, error } = await (supabase.from("brandaro_demo_sites") as any)
        .select(
          "id,lead_id,sent_at,sms_sent_at,business_name,industry,city,state,generation_engine,generation_status,engine_status,demo_url,durable_generated_url,durable_job_status,durable_last_error,audit_score,created_at,error_message,deployment_status,converted_to_paid,cta_clicked,view_count,last_viewed_at"
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as DemoRow[];
    },
    refetchInterval: 15000,
  });


  const { data: mdFiles = [] } = useQuery({
    queryKey: ["design-mds"],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("brandaro-design-mds").list("", { limit: 100 });
      if (error) return [];
      return (data || []).map(f => f.name.replace(/\.md$/, ""));
    },
  });

  const missingMds = useMemo(
    () => EXPECTED_MDS.filter(i => !mdFiles.includes(i)),
    [mdFiles]
  );

  // Real aggregate stats — full-table counts, not scoped to the 50-row demo list.
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["builder-stats"],
    refetchInterval: 30000,
    queryFn: async () => {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [todayRes, liveRes, paidRes, auditRes] = await Promise.all([
        supabase
          .from("brandaro_demo_sites")
          .select("id", { count: "exact", head: true })
          .gte("created_at", startOfToday.toISOString()),
        supabase
          .from("brandaro_demo_sites")
          .select("id", { count: "exact", head: true })
          .eq("deployment_status", "live"),
        supabase
          .from("brandaro_demo_sites")
          .select("id", { count: "exact", head: true })
          .eq("converted_to_paid", true),
        supabase
          .from("brandaro_demo_sites")
          .select("audit_score")
          .gte("created_at", sevenDaysAgo.toISOString())
          .not("audit_score", "is", null),
      ]);

      if (todayRes.error) throw todayRes.error;
      if (liveRes.error) throw liveRes.error;
      if (paidRes.error) throw paidRes.error;
      if (auditRes.error) throw auditRes.error;

      const scores = (auditRes.data || []).map((r: any) => Number(r.audit_score));
      const avgAudit = scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null;

      return {
        todayCount: todayRes.count ?? 0,
        liveCount: liveRes.count ?? 0,
        convertedCount: paidRes.count ?? 0,
        avgAudit,
        auditSample: scores.length,
      };
    },
  });


  const generate = useMutation({
    mutationFn: async () => {
      if (!leadId) throw new Error("Pick a lead first");
      const { data, error } = await supabase.functions.invoke("brandaro-generate-demo", {
        body: { lead_id: leadId, engine },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success("Demo generation started");
      qc.invalidateQueries({ queryKey: ["builder-demos"] });
      qc.invalidateQueries({ queryKey: ["builder-leads"] });
    },
    onError: (e: any) => toast.error(e.message || "Generation failed"),
  });

  const sendDemo = useMutation({
    mutationFn: async (demo: any) => {
      // Column is `phone_number`, not `phone`.
      const { data: lead, error: leadErr } = await supabase
        .from("brandaro_qualified_leads")
        .select("phone_number")
        .eq("id", demo.lead_id)
        .single();
      if (leadErr) throw leadErr;
      const destination = (lead as any)?.phone_number?.trim();
      if (!destination) throw new Error("No phone number on file for this lead");

      const { data, error } = await supabase.functions.invoke("brandaro-send-demo", {
        body: { demo_id: demo.id, lead_id: demo.lead_id, channel: "sms", destination },
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      if (data?.already_sent) toast.info("Already sent — the demo link went out automatically when it was generated.");
      else if (data?.suppressed) toast.error(`Blocked: contact is on the do-not-contact list (${data.reason}).`);
      else if (data?.ok) toast.success("Demo SMS sent");
      else toast.error(`SMS failed: ${data?.error || "unknown error"}`);
      qc.invalidateQueries({ queryKey: ["builder-demos"] });
    },
    onError: (e: any) => toast.error(e.message || "Send failed"),
  });


  const durableDemos = demos.filter(d => d.generation_engine === "durable");

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wand2 className="h-7 w-7" /> Website Builder
          </h1>
          <p className="text-muted-foreground">Generate, monitor, and dispatch demo sites for qualified leads.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today's Demos" value={stats?.todayCount ?? 0} loading={statsLoading} />
        <StatCard label="Live Right Now" value={stats?.liveCount ?? 0} tone="success" loading={statsLoading} />
        <StatCard label="Converted to Paid" value={stats?.convertedCount ?? 0} tone="warn" loading={statsLoading} />
        <StatCard
          label="Avg Audit Score (7d)"
          value={stats?.avgAudit ?? "—"}
          hint={stats?.auditSample ? `${stats.auditSample} scored` : "no scores yet"}
          loading={statsLoading}
        />
      </div>


      <Card>
        <CardHeader><CardTitle>Generate Demo</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[280px]">
            <label className="text-xs text-muted-foreground mb-1 block">Qualified Lead</label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger><SelectValue placeholder="Choose a lead..." /></SelectTrigger>
              <SelectContent>
                {leads.map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.business_name} — {l.city}, {l.state} ({l.industry || "?"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Engine</label>
            <Select value={engine} onValueChange={(v) => setEngine(v as Engine)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="native">Native (Lovable AI)</SelectItem>
                <SelectItem value="durable">Durable (Tier-1)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => generate.mutate()} disabled={!leadId || generate.isPending}>
            {generate.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
            Generate
          </Button>
        </CardContent>
      </Card>

      <ManualDemoGenerator onGenerated={() => qc.invalidateQueries()} />



      <Tabs defaultValue="demos">
        <TabsList>
          <TabsTrigger value="demos">Demos (48h)</TabsTrigger>
          <TabsTrigger value="durable">Durable Jobs ({durableDemos.length})</TabsTrigger>
          <TabsTrigger value="design">DESIGN.md System</TabsTrigger>
        </TabsList>

        <TabsContent value="demos">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
              <CardTitle className="text-base">Demos — last 48 hours ({demos.length})</CardTitle>
              <RowColorLegend />
            </CardHeader>
            <CardContent className="p-0">
              {demosLoading ? (
                <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
              ) : demos.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No demos in the last 48 hours.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="p-3">Time</th>
                        <th className="p-3">Business</th>
                        <th className="p-3">City</th>
                        <th className="p-3">Industry</th>
                        <th className="p-3">Audit Score</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">SMS</th>
                        <th className="p-3">Converted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demos.map(d => {
                        const url = d.durable_generated_url || d.demo_url;
                        const smsAt = d.sms_sent_at || d.sent_at;
                        const viewed = (d.view_count ?? 0) > 0 || Boolean(d.last_viewed_at);
                        return (
                          <tr
                            key={d.id}
                            className={`border-t transition-colors ${ROW_TINT[rowState(d)]} ${url ? "cursor-pointer" : "cursor-default"}`}
                            title={url ? "Open demo in a new tab" : "No demo URL yet"}
                            onClick={() => { if (url) window.open(url, "_blank", "noopener,noreferrer"); }}
                          >
                            <td className="p-3 whitespace-nowrap">
                              <div>{new Date(d.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(d.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                              </div>
                            </td>
                            <td className="p-3 font-medium">{d.business_name || "—"}</td>
                            <td className="p-3 whitespace-nowrap">{d.city ? `${d.city}${d.state ? `, ${d.state}` : ""}` : "—"}</td>
                            <td className="p-3">{d.industry || "—"}</td>
                            <td className="p-3">{d.audit_score ?? "—"}</td>
                            <td className="p-3">
                              <StatusBadge status={d.generation_status || "unknown"} error={d.error_message} />
                              {d.deployment_status && (
                                <div className="text-xs text-muted-foreground mt-1">{d.deployment_status}</div>
                              )}
                            </td>
                            <td className="p-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              {smsAt ? (
                                <Badge variant="secondary">
                                  {viewed ? "Viewed" : "Sent"} {new Date(smsAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                                </Badge>
                              ) : d.generation_status === "ready" ? (
                                <Button size="sm" onClick={() => sendDemo.mutate(d)} disabled={sendDemo.isPending}>
                                  {sendDemo.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send SMS"}
                                </Button>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-3">
                              {d.converted_to_paid ? (
                                <Badge className="bg-green-100 text-green-800">
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Paid
                                </Badge>
                              ) : d.cta_clicked ? (
                                <Badge className="bg-amber-100 text-amber-800">CTA clicked</Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="durable">
          <Card>
            <CardContent className="p-0">
              {durableDemos.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No Durable jobs.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="p-3">Business</th>
                        <th className="p-3">Job Status</th>
                        <th className="p-3">Durable URL</th>
                        <th className="p-3">Last Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {durableDemos.map(d => (
                        <tr key={d.id} className="border-t">
                          <td className="p-3">{d.business_name}</td>
                          <td className="p-3"><Badge variant="outline">{d.durable_job_status || "—"}</Badge></td>
                          <td className="p-3">
                            {d.durable_generated_url ? (
                              <a href={d.durable_generated_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                                Open <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : "—"}
                          </td>
                          <td className="p-3 text-xs text-destructive max-w-md truncate" title={d.durable_last_error || ""}>
                            {d.durable_last_error || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="design">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                DESIGN.md Files ({mdFiles.length}/{EXPECTED_MDS.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {EXPECTED_MDS.map(ind => {
                  const present = mdFiles.includes(ind);
                  return (
                    <Badge
                      key={ind}
                      variant={present ? "default" : "outline"}
                      className={present ? "" : "border-destructive text-destructive"}
                    >
                      {present ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                      {ind}
                    </Badge>
                  );
                })}
              </div>
              {missingMds.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Upload the missing <code>.md</code> files to the <code>brandaro-design-mds</code> storage bucket.
                  The generator falls back to <code>general.md</code> when a specific industry file is absent.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PaidBuildsPipeline />
    </div>

  );
}

function StatCard({ label, value, tone, hint, loading }: { label: string; value: number | string; tone?: "success" | "warn" | "error"; hint?: string; loading?: boolean }) {
  const color = tone === "success" ? "text-green-600" : tone === "warn" ? "text-amber-600" : tone === "error" ? "text-destructive" : "";
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : value}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </CardContent></Card>
  );
}


function StatusBadge({ status, error }: { status: string; error?: string | null }) {
  if (status === "ready") return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />ready</Badge>;
  if (status === "generating") return <Badge className="bg-amber-100 text-amber-800"><Clock className="h-3 w-3 mr-1" />generating</Badge>;
  if (status === "error") return <Badge variant="destructive" title={error || ""}><XCircle className="h-3 w-3 mr-1" />error</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function RowColorLegend() {
  const items: { state: RowState; label: string }[] = [
    { state: "converted", label: "Converted" },
    { state: "cta", label: "CTA clicked" },
    { state: "sms_unviewed", label: "SMS sent, not viewed" },
    { state: "deployed_idle", label: "Deployed, no activity" },
    { state: "failed", label: "Failed" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {items.map(i => (
        <span key={i.state} className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded-sm border ${ROW_TINT[i.state].split(" ")[0]}`} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
