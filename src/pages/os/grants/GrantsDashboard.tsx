import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Trophy, FileText, CheckCircle, DollarSign, Clock, Database,
  Eye, Trash2, Building2, Users,
} from "lucide-react";
import { toast } from "sonner";

const GOLD = "#C9A84C";

type Stats = {
  total: number;
  awarded: number;
  totalAwardedAmt: number;
  pending: number;
  opportunities: number;
};

type Deadline = {
  id: string;
  grant_name: string;
  funder_name: string | null;
  deadline: string;
  status: string;
  applicant_type: string | null;
};

type AppRow = {
  id: string;
  grant_name: string;
  funder_name: string | null;
  applicant_type: string | null;
  amount_requested: number | null;
  amount_awarded: number | null;
  deadline: string | null;
  status: string;
  created_at: string;
  client_name: string | null;
};

const STATUS_OPTIONS = [
  "identified", "drafting", "submitted", "under_review",
  "approved", "awarded", "denied", "closed",
];

const STATUS_STYLES: Record<string, string> = {
  identified:   "bg-muted text-muted-foreground",
  drafting:     "bg-blue-500/15 text-blue-400 border-blue-500/30",
  submitted:    "bg-amber-500/15 text-amber-400 border-amber-500/30",
  under_review: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  approved:     "bg-green-500/15 text-green-400 border-green-500/30",
  awarded:      "",
  denied:       "bg-red-500/15 text-red-400 border-red-500/30",
  closed:       "bg-muted text-muted-foreground",
};

const fmtMoney = (n: number) =>
  `$${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const daysUntil = (d: string) =>
  Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);

const applicantBadge = (t: string | null) => {
  if (t === "dynasty_business") return { label: "Dynasty", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
  if (t === "funding_client")   return { label: "Client",  cls: "bg-purple-500/15 text-purple-400 border-purple-500/30" };
  if (t === "uben")             return { label: "UBEN",    cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  return { label: t ?? "—", cls: "bg-muted text-muted-foreground" };
};

const applicantLabel = (r: AppRow) => {
  if (r.applicant_type === "funding_client" && r.client_name) return r.client_name;
  if (r.applicant_type === "dynasty_business") return "Dynasty Business";
  if (r.applicant_type === "uben") return "UBEN";
  return r.applicant_type ?? "—";
};

export default function GrantsDashboard() {
  const navigate = useNavigate();

  // Section B — stats
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ total: 0, awarded: 0, totalAwardedAmt: 0, pending: 0, opportunities: 0 });
  const [submittedToday, setSubmittedToday] = useState<number>(0);

  // Section C — deadlines
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [deadlinesLoading, setDeadlinesLoading] = useState(true);

  // Sections D + E
  const [activeTab, setActiveTab] = useState<string>("all");
  const [applicantFilter, setApplicantFilter] = useState<string | null>(null);
  const [applications, setApplications] = useState<AppRow[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [pipeline, setPipeline] = useState<Record<string, number>>({
    dynasty_business: 0, funding_client: 0, uben: 0,
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [runningEligibility, setRunningEligibility] = useState(false);

  const handleRunAllEligibility = async () => {
    setRunningEligibility(true);
    try {
      const { data: clients } = await supabase.from("funding_clients").select("id").limit(50);
      let count = 0;
      let unlinked = 0;
      for (const client of clients ?? []) {
        // Single eligibility engine, keyed on the funding client identity.
        const { data, error } = await supabase.functions.invoke("grant-eligibility-checker", {
          body: { funding_client_id: client.id },
        });
        if (error || (data as any)?.error) unlinked++;
        else count++;
      }
      toast.success(
        unlinked > 0
          ? `Eligibility checked for ${count} clients — ${unlinked} skipped (no linked grant business profile)`
          : `Eligibility checked for ${count} clients`,
      );
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunningEligibility(false);
    }
  };

  // Stats + pipeline
  useEffect(() => {
    (async () => {
      setLoading(true);
      const todayStart = new Date().toISOString().split("T")[0] + "T00:00:00";
      const [total, awarded, awardedSum, pending, opps, pipelineRes, submittedTodayRes] = await Promise.all([
        supabase.from("grant_applications").select("*", { count: "exact", head: true }),
        supabase.from("grant_applications").select("*", { count: "exact", head: true }).in("status", ["approved", "awarded"]),
        supabase.from("grant_applications").select("amount_awarded").eq("status", "awarded"),
        supabase.from("grant_applications").select("*", { count: "exact", head: true }).in("status", ["submitted", "under_review", "drafting"]),
        supabase.from("grant_opportunities").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("grant_applications").select("applicant_type"),
        supabase.from("grant_applications").select("*", { count: "exact", head: true }).eq("status", "submitted").gte("submitted_at", todayStart),
      ]);
      const sum = (awardedSum.data ?? []).reduce((a: number, r: any) => a + Number(r.amount_awarded || 0), 0);
      setStats({
        total: total.count ?? 0,
        awarded: awarded.count ?? 0,
        totalAwardedAmt: sum,
        pending: pending.count ?? 0,
        opportunities: opps.count ?? 0,
      });
      setSubmittedToday(submittedTodayRes.count ?? 0);
      const counts: Record<string, number> = { dynasty_business: 0, funding_client: 0, uben: 0 };
      (pipelineRes.data ?? []).forEach((r: any) => {
        if (r.applicant_type && counts[r.applicant_type] !== undefined) counts[r.applicant_type]++;
      });
      setPipeline(counts);
      setLoading(false);
    })();

    (async () => {
      setDeadlinesLoading(true);
      const today = new Date().toISOString().slice(0, 10);
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("grant_applications")
        .select("id,grant_name,funder_name,deadline,status,applicant_type")
        .not("deadline", "is", null)
        .gte("deadline", today)
        .lte("deadline", in30)
        .not("status", "in", "(awarded,denied,closed)")
        .order("deadline", { ascending: true })
        .limit(8);
      setDeadlines((data as Deadline[]) ?? []);
      setDeadlinesLoading(false);
    })();
  }, []);

  const fetchApplications = async () => {
    setAppsLoading(true);
    let q = supabase
      .from("grant_applications")
      .select("id,grant_name,funder_name,applicant_type,amount_requested,amount_awarded,deadline,status,created_at,funding_clients(full_name)")
      .order("created_at", { ascending: false });
    if (activeTab !== "all") q = q.eq("status", activeTab);
    if (applicantFilter)     q = q.eq("applicant_type", applicantFilter);
    const { data, error } = await q;
    if (error) { toast.error(error.message); setApplications([]); }
    else setApplications((data ?? []).map((r: any) => ({
      ...r, client_name: r.funding_clients?.full_name ?? null,
    })));
    setAppsLoading(false);
  };

  useEffect(() => { fetchApplications(); /* eslint-disable-next-line */ }, [activeTab, applicantFilter]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("grant_applications").update({ status: newStatus }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Status updated");
    fetchApplications();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("grant_applications").delete().eq("id", deleteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Application deleted");
    setApplications((prev) => prev.filter((r) => r.id !== deleteId));
    setDeleteId(null);
  };

  const statCards = [
    { label: "Total Applications", value: stats.total,                       icon: FileText,    gold: false },
    { label: "Approved / Awarded", value: stats.awarded,                     icon: CheckCircle, gold: false },
    { label: "Total Awarded",      value: fmtMoney(stats.totalAwardedAmt),   icon: DollarSign,  gold: true  },
    { label: "Pending Review",     value: stats.pending,                     icon: Clock,       gold: false },
    { label: "Opportunities",      value: stats.opportunities,               icon: Database,    gold: false },
    { label: "Submitted Today",    value: submittedToday,                    icon: CheckCircle, gold: true, sub: "auto-pipeline" },
  ] as const;


  return (
    <div className="p-6 space-y-6">
      {/* SECTION A — Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy style={{ color: GOLD }} className="h-8 w-8" />
            Grant Company OS
          </h1>
          <p className="text-muted-foreground mt-1">
            Unified grant tracking across all Dynasty businesses and funding clients
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => navigate("/os/grants/opportunities")}>
            🗂️ Opportunities
          </Button>
          <button
            onClick={handleRunAllEligibility}
            disabled={runningEligibility}
            className="px-3 py-1.5 text-sm border border-[#C9A84C]/40 text-[#C9A84C] rounded hover:bg-[#C9A84C]/10 disabled:opacity-50 transition"
          >
            {runningEligibility ? "⏳ Running..." : "🎯 Run Eligibility Check"}
          </button>
          <Button
            style={{ backgroundColor: GOLD, color: "#0A0A0A" }}
            className="hover:opacity-90"
            onClick={() => navigate("/os/grants/new")}
          >
            + New Application
          </Button>
        </div>
      </div>

      {/* SECTION B — Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold" style={c.gold ? { color: GOLD } : undefined}>
                    {c.value}
                  </div>
                  {"sub" in c && c.sub && (
                    <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SECTION C — Upcoming Deadlines */}
      <Card>
        <CardHeader>
          <CardTitle>⚡ Deadlines This Month</CardTitle>
        </CardHeader>
        <CardContent>
          {deadlinesLoading ? (
            <div className="grid md:grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : deadlines.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No deadlines in the next 30 days ✅
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {deadlines.map((d) => {
                const days = daysUntil(d.deadline);
                const pillCls = days <= 7
                  ? "bg-red-500/15 text-red-400 border-red-500/30"
                  : "bg-amber-500/15 text-amber-400 border-amber-500/30";
                const ap = applicantBadge(d.applicant_type);
                return (
                  <div key={d.id} className="border rounded-lg p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{d.grant_name}</div>
                      <div className="text-sm text-muted-foreground truncate">{d.funder_name ?? "—"}</div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline" className={pillCls}>{days} days left</Badge>
                        <Badge variant="outline" className={ap.cls}>{ap.label}</Badge>
                        <Badge variant="outline">{d.status}</Badge>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/os/grants/${d.id}`)}>
                      View
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION E — Pipeline by Applicant */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { key: "dynasty_business", label: "Dynasty Businesses", Icon: Building2, cls: "text-blue-400 border-blue-500/30" },
          { key: "funding_client",   label: "Funding Clients",    Icon: Users,     cls: "text-purple-400 border-purple-500/30" },
          { key: "uben",             label: "UBEN",               Icon: Trophy,    cls: "text-emerald-400 border-emerald-500/30" },
        ].map(({ key, label, Icon, cls }) => (
          <Card
            key={key}
            onClick={() => setApplicantFilter(applicantFilter === key ? null : key)}
            className={`cursor-pointer transition ${applicantFilter === key ? "ring-2 ring-primary" : ""}`}
          >
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${cls}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{pipeline[key] ?? 0}</div>
              {applicantFilter === key && (
                <div className="text-xs text-muted-foreground mt-1">Filter active — click to clear</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SECTION D — Applications Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>All Applications</CardTitle>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="drafting">Drafting</TabsTrigger>
                <TabsTrigger value="submitted">Submitted</TabsTrigger>
                <TabsTrigger value="under_review">Under Review</TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="awarded">Awarded</TabsTrigger>
                <TabsTrigger value="denied">Denied</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {appsLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No applications yet. Click <span className="font-medium">+ New Application</span> to start.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grant Name</TableHead>
                    <TableHead>Funder</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead className="text-right">Requested</TableHead>
                    <TableHead className="text-right">Awarded</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((r) => {
                    const isAwarded = r.status === "awarded";
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.grant_name}</TableCell>
                        <TableCell>{r.funder_name ?? "—"}</TableCell>
                        <TableCell>{applicantLabel(r)}</TableCell>
                        <TableCell className="text-right">{fmtMoney(Number(r.amount_requested ?? 0))}</TableCell>
                        <TableCell className="text-right">{r.amount_awarded ? fmtMoney(Number(r.amount_awarded)) : "—"}</TableCell>
                        <TableCell>{r.deadline ?? "Rolling"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={STATUS_STYLES[r.status] ?? ""}
                            style={isAwarded ? { backgroundColor: GOLD + "22", color: GOLD, borderColor: GOLD } : undefined}
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => navigate(`/os/grants/${r.id}`)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Select value={r.status} onValueChange={(v) => handleStatusChange(r.id, v)}>
                              <SelectTrigger className="h-8 w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map((s) => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="icon" variant="ghost" onClick={() => setDeleteId(r.id)}>
                              <Trash2 className="h-4 w-4 text-red-400" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this application?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
