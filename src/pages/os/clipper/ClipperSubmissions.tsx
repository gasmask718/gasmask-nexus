import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ExternalLink, Check, X, Flag, CheckSquare } from "lucide-react";

const GOLD = "#C9A84C";

const fmtViews = (n: number) =>
  !n ? "0" : n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" : n >= 1_000 ? (n / 1_000).toFixed(1) + "K" : n.toString();
const fmtMoney = (n: number) =>
  "$" + (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const PLATFORM_BADGE: Record<string, string> = {
  tiktok: "bg-pink-500/15 text-pink-300 border-pink-500/30",
  instagram: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  youtube: "bg-red-500/15 text-red-300 border-red-500/30",
  twitter: "bg-blue-500/15 text-blue-300 border-blue-500/30",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  approved: "bg-green-500/15 text-green-300 border-green-500/30",
  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
  flagged: "bg-orange-500/15 text-orange-300 border-orange-500/30",
};

const BUSINESS_BADGE: Record<string, string> = {
  gasmask: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  brandaro: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  toptier: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  uft: "bg-green-500/15 text-green-300 border-green-500/30",
  playboxxx: "bg-pink-500/15 text-pink-300 border-pink-500/30",
  iclean: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  dynasty_connect: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  uben: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
};

const BUSINESS_OPTIONS = Object.keys(BUSINESS_BADGE);
const PLATFORM_OPTIONS = ["tiktok", "instagram", "youtube", "twitter"] as const;

type Row = {
  id: string;
  clipper_id: string;
  campaign_id: string;
  platform: string;
  post_url: string | null;
  status: string;
  views: number | null;
  likes: number | null;
  base_earnings: number | null;
  total_earnings: number | null;
  submitted_at: string | null;
  clipper_accounts: { full_name: string | null } | null;
  clipper_campaigns: {
    brand_name: string | null;
    dynasty_business: string | null;
    base_rate_per_1k: number | null;
    commission_rate: number | null;
  } | null;
};

async function approveOne(row: Row) {
  const views = Number(row.views || 0);
  const rate = Number(row.clipper_campaigns?.base_rate_per_1k || 0);
  const baseEarnings = Number(((views / 1000) * rate).toFixed(2));

  const { error: e1 } = await supabase
    .from("clipper_submissions")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", row.id);
  if (e1) throw e1;

  const { error: e2 } = await supabase
    .from("clipper_submissions")
    .update({ base_earnings: baseEarnings, total_earnings: baseEarnings })
    .eq("id", row.id);
  if (e2) throw e2;

  const { error: e3 } = await supabase.from("clipper_earnings").insert({
    clipper_id: row.clipper_id,
    submission_id: row.id,
    campaign_id: row.campaign_id,
    earning_type: "base_views",
    amount: baseEarnings,
    views_at_calculation: views,
    status: "pending",
  });
  if (e3) throw e3;

  return baseEarnings;
}

export default function ClipperSubmissions() {
  const qc = useQueryClient();
  const [statusTab, setStatusTab] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [businessFilter, setBusinessFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectRow, setRejectRow] = useState<Row | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: rows, isLoading } = useQuery<Row[]>({
    queryKey: ["clipper-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clipper_submissions")
        .select(
          `id, clipper_id, campaign_id, platform, post_url, status, views, likes,
           base_earnings, total_earnings, submitted_at,
           clipper_accounts!clipper_id(full_name),
           clipper_campaigns!campaign_id(brand_name, dynasty_business, base_rate_per_1k, commission_rate)`
        )
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any as Row[];
    },
  });

  const stats = useMemo(() => {
    const list = rows ?? [];
    const pending = list.filter((r) => r.status === "pending").length;
    const approved = list.filter((r) => r.status === "approved");
    const approvedViews = approved.reduce((s, r) => s + Number(r.views || 0), 0);
    return { total: list.length, pending, approved: approved.length, approvedViews };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows ?? [];
    if (statusTab !== "all") list = list.filter((r) => r.status === statusTab);
    if (platformFilter !== "all") list = list.filter((r) => r.platform === platformFilter);
    if (businessFilter !== "all")
      list = list.filter((r) => r.clipper_campaigns?.dynasty_business === businessFilter);
    return list;
  }, [rows, statusTab, platformFilter, businessFilter]);

  const approveMut = useMutation({
    mutationFn: async (row: Row) => approveOne(row),
    onSuccess: (amount) => {
      toast.success(`Approved — ${fmtMoney(amount)} in earnings`);
      qc.invalidateQueries({ queryKey: ["clipper-submissions"] });
    },
    onError: (e: any) => toast.error(e.message || "Approve failed"),
  });

  const rejectMut = useMutation({
    mutationFn: async () => {
      if (!rejectRow) return;
      const { error } = await supabase
        .from("clipper_submissions")
        .update({ status: "rejected" })
        .eq("id", rejectRow.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Submission rejected");
      setRejectRow(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["clipper-submissions"] });
    },
    onError: (e: any) => toast.error(e.message || "Reject failed"),
  });

  const flagMut = useMutation({
    mutationFn: async (row: Row) => {
      const { error } = await supabase
        .from("clipper_submissions")
        .update({ status: "flagged" })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Submission flagged");
      qc.invalidateQueries({ queryKey: ["clipper-submissions"] });
    },
    onError: (e: any) => toast.error(e.message || "Flag failed"),
  });

  const bulkApprove = useMutation({
    mutationFn: async () => {
      const targets = (rows ?? []).filter((r) => selected.has(r.id) && r.status !== "approved");
      let ok = 0;
      let fail = 0;
      for (const r of targets) {
        try { await approveOne(r); ok += 1; } catch { fail += 1; }
      }
      return { ok, fail };
    },
    onSuccess: ({ ok, fail }) => {
      toast.success(`Approved ${ok}${fail ? `, ${fail} failed` : ""}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["clipper-submissions"] });
    },
    onError: (e: any) => toast.error(e.message || "Bulk approve failed"),
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: GOLD }}>📹 Submissions</h1>
          <p className="text-sm text-muted-foreground">Review and approve clipper submissions.</p>
        </div>
        {selected.size > 0 && (
          <Button onClick={() => bulkApprove.mutate()} disabled={bulkApprove.isPending}
            style={{ backgroundColor: GOLD, color: "#0A0A0A" }}>
            <CheckSquare className="h-4 w-4 mr-1" /> Approve Selected ({selected.size})
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground mb-1">Total Submissions</div>
          {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{stats.total}</div>}
        </CardContent></Card>
        <Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground mb-1">Pending Review</div>
          {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{stats.pending}</div>}
        </CardContent></Card>
        <Card className="border-green-500/30 bg-green-500/5"><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground mb-1">Approved</div>
          {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{stats.approved}</div>}
        </CardContent></Card>
        <Card className="border-blue-500/30 bg-blue-500/5"><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground mb-1">Approved Views</div>
          {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{fmtViews(stats.approvedViews)}</div>}
        </CardContent></Card>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs value={statusTab} onValueChange={setStatusTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="flagged">Flagged</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="All platforms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {PLATFORM_OPTIONS.map((p) => (<SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={businessFilter} onValueChange={setBusinessFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All businesses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All businesses</SelectItem>
              {BUSINESS_OPTIONS.map((b) => (<SelectItem key={b} value={b} className="capitalize">{b}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6"><Skeleton className="h-60" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No submissions match your filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2 px-3">
                      <Checkbox checked={selected.size > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} />
                    </th>
                    <th className="text-left py-2 pr-3">Clipper</th>
                    <th className="text-left py-2 pr-3">Brand</th>
                    <th className="text-left py-2 pr-3">Platform</th>
                    <th className="text-left py-2 pr-3">Post</th>
                    <th className="text-right py-2 pr-3">Views</th>
                    <th className="text-right py-2 pr-3">Likes</th>
                    <th className="text-left py-2 pr-3">Status</th>
                    <th className="text-right py-2 pr-3">Earnings</th>
                    <th className="text-left py-2 pr-3">Date</th>
                    <th className="text-right py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-2 px-3">
                        <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} />
                      </td>
                      <td className="py-2 pr-3">{r.clipper_accounts?.full_name || "—"}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span>{r.clipper_campaigns?.brand_name || "—"}</span>
                          {r.clipper_campaigns?.dynasty_business && (
                            <Badge variant="outline" className={cn("capitalize text-[10px] px-1.5 py-0", BUSINESS_BADGE[r.clipper_campaigns.dynasty_business])}>
                              {r.clipper_campaigns.dynasty_business}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className={cn("capitalize", PLATFORM_BADGE[r.platform])}>{r.platform}</Badge>
                      </td>
                      <td className="py-2 pr-3">
                        {r.post_url ? (
                          <a href={r.post_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-400 hover:underline">
                            View <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right">{fmtViews(Number(r.views || 0))}</td>
                      <td className="py-2 pr-3 text-right">{fmtViews(Number(r.likes || 0))}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className={cn("capitalize", STATUS_BADGE[r.status])}>{r.status}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-right" style={{ color: GOLD }}>{fmtMoney(Number(r.total_earnings || 0))}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{fmtDate(r.submitted_at)}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-end gap-1">
                          {r.status !== "approved" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-400 hover:text-green-300"
                              onClick={() => approveMut.mutate(r)} disabled={approveMut.isPending} title="Approve">
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          {r.status !== "rejected" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-300"
                              onClick={() => { setRejectRow(r); setRejectReason(""); }} title="Reject">
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                          {r.status !== "flagged" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-orange-400 hover:text-orange-300"
                              onClick={() => flagMut.mutate(r)} disabled={flagMut.isPending} title="Flag">
                              <Flag className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!rejectRow} onOpenChange={(o) => { if (!o) setRejectRow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: GOLD }}>Reject Submission</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              Rejecting submission from <b>{rejectRow?.clipper_accounts?.full_name || "clipper"}</b>.
            </p>
            <Input placeholder="Reason (optional)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectRow(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectMut.mutate()} disabled={rejectMut.isPending}>
              {rejectMut.isPending ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
