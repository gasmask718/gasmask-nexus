import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Check, X, Ban, RotateCcw, Search, ExternalLink, Copy, Link as LinkIcon, Plus,
} from "lucide-react";

const GOLD = "#C9A84C";
const PINK = "#EC4899";

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtMoney = (n: number) =>
  "$" + (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  active: "bg-green-500/15 text-green-300 border-green-500/30",
  suspended: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
};

const TIER_BADGE: Record<string, string> = {
  starter: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  pro: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  elite: "bg-pink-500/15 text-pink-300 border-pink-500/30",
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

type Clipper = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  bio: string | null;
  status: string;
  tier: string;
  total_views: number | null;
  total_earnings: number | null;
  created_at: string | null;
};

type Social = {
  id: string;
  platform: string;
  handle: string;
  profile_url: string | null;
  follower_count: number | null;
};

type Assignment = {
  id: string;
  campaign_id: string;
  status: string;
  tracking_link: string | null;
  assigned_at: string | null;
  clipper_campaigns: {
    brand_name: string | null;
    dynasty_business: string | null;
    title: string | null;
  } | null;
};

type Earning = {
  id: string;
  amount: number;
  earning_type: string | null;
  status: string;
  created_at: string | null;
};

type Campaign = {
  id: string;
  brand_name: string;
  dynasty_business: string;
  title: string;
  status: string;
};

export default function ClipperClippers() {
  const qc = useQueryClient();
  const [statusTab, setStatusTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Clipper | null>(null);
  const [rejectRow, setRejectRow] = useState<Clipper | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignCampaignId, setAssignCampaignId] = useState<string>("");
  const [lastTrackingLink, setLastTrackingLink] = useState<string | null>(null);

  const { data: clippers, isLoading } = useQuery<Clipper[]>({
    queryKey: ["clipper-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clipper_accounts")
        .select("id, full_name, email, phone, bio, status, tier, total_views, total_earnings, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Clipper[];
    },
  });

  const stats = useMemo(() => {
    const list = clippers ?? [];
    return {
      total: list.length,
      active: list.filter((c) => c.status === "active").length,
      pending: list.filter((c) => c.status === "pending").length,
      suspended: list.filter((c) => c.status === "suspended").length,
    };
  }, [clippers]);

  const filtered = useMemo(() => {
    let list = clippers ?? [];
    if (statusTab !== "all") list = list.filter((c) => c.status === statusTab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) => c.full_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [clippers, statusTab, search]);

  // ── Detail slide-over data ────────────────────────────────────────────
  const { data: socials } = useQuery<Social[]>({
    queryKey: ["clipper-socials", selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clipper_social_accounts")
        .select("id, platform, handle, profile_url, follower_count")
        .eq("clipper_id", selected!.id);
      if (error) throw error;
      return (data ?? []) as Social[];
    },
  });

  const { data: assignments } = useQuery<Assignment[]>({
    queryKey: ["clipper-assignments", selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clipper_assignments")
        .select(`id, campaign_id, status, tracking_link, assigned_at,
                 clipper_campaigns!campaign_id(brand_name, dynasty_business, title)`)
        .eq("clipper_id", selected!.id)
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any as Assignment[];
    },
  });

  const { data: earnings } = useQuery<Earning[]>({
    queryKey: ["clipper-earnings", selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clipper_earnings")
        .select("id, amount, earning_type, status, created_at")
        .eq("clipper_id", selected!.id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as Earning[];
    },
  });

  const { data: activeCampaigns } = useQuery<Campaign[]>({
    queryKey: ["clipper-active-campaigns"],
    enabled: assignOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clipper_campaigns")
        .select("id, brand_name, dynasty_business, title, status")
        .eq("status", "active")
        .order("brand_name");
      if (error) throw error;
      return (data ?? []) as Campaign[];
    },
  });

  const earningsSummary = useMemo(() => {
    const list = earnings ?? [];
    const total = list.reduce((s, e) => s + Number(e.amount || 0), 0);
    const paid = list.filter((e) => e.status === "paid").reduce((s, e) => s + Number(e.amount || 0), 0);
    const pending = list.filter((e) => e.status === "pending").reduce((s, e) => s + Number(e.amount || 0), 0);
    return { total, paid, pending, count: list.length };
  }, [earnings]);

  // ── Mutations ─────────────────────────────────────────────────────────
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("clipper_accounts")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return { id, status };
    },
    onSuccess: ({ status }, vars) => {
      qc.invalidateQueries({ queryKey: ["clipper-accounts"] });
      if (selected?.id === vars.id) setSelected({ ...selected, status });
      if (status === "active") {
        toast.success(
          "Approved. Welcome email dispatched via trigger — see Edge Function logs for delivery result.",
          { duration: 6000 }
        );
      } else {
        toast.success(`Status updated to ${status}`);
      }
    },
    onError: (e: any) => toast.error(e.message || "Update failed"),
  });

  const rejectMut = useMutation({
    mutationFn: async () => {
      if (!rejectRow) return;
      const { error } = await supabase
        .from("clipper_accounts")
        .update({
          status: "rejected",
          bio: rejectReason ? `[REJECTED] ${rejectReason}\n${rejectRow.bio ?? ""}` : rejectRow.bio,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rejectRow.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Clipper rejected");
      setRejectRow(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["clipper-accounts"] });
    },
    onError: (e: any) => toast.error(e.message || "Reject failed"),
  });

  const assignMut = useMutation({
    mutationFn: async () => {
      if (!selected || !assignCampaignId) throw new Error("Pick a campaign");
      const { data, error } = await supabase
        .from("clipper_assignments")
        .insert({ clipper_id: selected.id, campaign_id: assignCampaignId, status: "active" })
        .select("tracking_link")
        .single();
      if (error) throw error;
      return data?.tracking_link as string | null;
    },
    onSuccess: (link) => {
      setLastTrackingLink(link);
      toast.success("Assigned. Tracking link generated.");
      setAssignOpen(false);
      setAssignCampaignId("");
      qc.invalidateQueries({ queryKey: ["clipper-assignments", selected?.id] });
    },
    onError: (e: any) => toast.error(e.message || "Assign failed"),
  });

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Copied");
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: GOLD }}>👥 Clippers</h1>
        <p className="text-sm text-muted-foreground">Review, approve, and manage all Clipper Nation creators.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground mb-1">Total Clippers</div>
          {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{stats.total}</div>}
        </CardContent></Card>
        <Card className="border-green-500/30 bg-green-500/5"><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground mb-1">Active</div>
          {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{stats.active}</div>}
        </CardContent></Card>
        <Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground mb-1">Pending Approval</div>
          {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{stats.pending}</div>}
        </CardContent></Card>
        <Card className="border-orange-500/30 bg-orange-500/5"><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground mb-1">Suspended</div>
          {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{stats.suspended}</div>}
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs value={statusTab} onValueChange={setStatusTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="suspended">Suspended</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground space-y-2">
              <div>No clippers yet.</div>
              <a
                href="https://dynastyclipper.io/apply"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs hover:underline"
                style={{ color: GOLD }}
              >
                Public apply page <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2 pl-4 pr-3">Name</th>
                    <th className="text-left py-2 pr-3">Email</th>
                    <th className="text-left py-2 pr-3">Status</th>
                    <th className="text-left py-2 pr-3">Tier</th>
                    <th className="text-left py-2 pr-3">Applied</th>
                    <th className="text-right py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-border/50 hover:bg-muted/20 cursor-pointer"
                      onClick={() => { setSelected(c); setLastTrackingLink(null); }}
                    >
                      <td className="py-2 pl-4 pr-3 font-medium">{c.full_name || "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{c.email}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className={cn("capitalize", STATUS_BADGE[c.status])}>{c.status}</Badge>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className={cn("capitalize", TIER_BADGE[c.tier])}>{c.tier}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{fmtDate(c.created_at)}</td>
                      <td className="py-2 pr-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {c.status === "pending" && (
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 text-green-400 hover:text-green-300"
                              onClick={() => updateStatus.mutate({ id: c.id, status: "active" })}
                              disabled={updateStatus.isPending}
                              title="Approve"
                            >
                              <Check className="h-4 w-4 mr-1" /> Approve
                            </Button>
                          )}
                          {c.status !== "rejected" && c.status !== "active" && (
                            <Button
                              size="icon" variant="ghost"
                              className="h-7 w-7 text-red-400 hover:text-red-300"
                              onClick={() => { setRejectRow(c); setRejectReason(""); }}
                              title="Reject"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                          {c.status === "active" && (
                            <Button
                              size="icon" variant="ghost"
                              className="h-7 w-7 text-orange-400 hover:text-orange-300"
                              onClick={() => updateStatus.mutate({ id: c.id, status: "suspended" })}
                              disabled={updateStatus.isPending}
                              title="Suspend"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          {c.status === "suspended" && (
                            <Button
                              size="icon" variant="ghost"
                              className="h-7 w-7 text-green-400 hover:text-green-300"
                              onClick={() => updateStatus.mutate({ id: c.id, status: "active" })}
                              disabled={updateStatus.isPending}
                              title="Reactivate"
                            >
                              <RotateCcw className="h-4 w-4" />
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

      {/* Reject Dialog */}
      <Dialog open={!!rejectRow} onOpenChange={(o) => { if (!o) setRejectRow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: GOLD }}>Reject Clipper</DialogTitle>
            <DialogDescription>
              Rejecting <b>{rejectRow?.full_name || "clipper"}</b>. Reason is optional and logged to their profile.
            </DialogDescription>
          </DialogHeader>
          <Input placeholder="Reason (optional)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectRow(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectMut.mutate()} disabled={rejectMut.isPending}>
              {rejectMut.isPending ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Slide-over */}
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setLastTrackingLink(null); } }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle style={{ color: GOLD }}>{selected.full_name}</SheetTitle>
                <SheetDescription className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={cn("capitalize", STATUS_BADGE[selected.status])}>{selected.status}</Badge>
                  <Badge variant="outline" className={cn("capitalize", TIER_BADGE[selected.tier])}>{selected.tier}</Badge>
                  <span className="text-xs">Joined {fmtDate(selected.created_at)}</span>
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Profile */}
                <section className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Profile</h3>
                  <div className="text-sm space-y-1">
                    <div><span className="text-muted-foreground">Email:</span> {selected.email}</div>
                    <div><span className="text-muted-foreground">Phone:</span> {selected.phone || "—"}</div>
                    {selected.bio && <div className="text-muted-foreground whitespace-pre-wrap text-xs pt-1">{selected.bio}</div>}
                  </div>
                </section>

                {/* Socials */}
                <section className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Social Accounts</h3>
                  {socials === undefined ? (
                    <Skeleton className="h-10" />
                  ) : socials.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No linked socials.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {socials.map((s) => (
                        <div key={s.id} className="flex items-center justify-between text-sm border border-border/50 rounded px-3 py-1.5">
                          <div>
                            <span className="capitalize text-xs text-muted-foreground mr-2">{s.platform}</span>
                            <span>@{s.handle}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{(s.follower_count || 0).toLocaleString()} followers</div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Assignments */}
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Campaign Assignments</h3>
                    <Button
                      size="sm"
                      onClick={() => setAssignOpen(true)}
                      disabled={selected.status !== "active"}
                      style={{ backgroundColor: PINK, color: "white" }}
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Assign to Campaign
                    </Button>
                  </div>
                  {selected.status !== "active" && (
                    <div className="text-xs text-muted-foreground">Clipper must be active to assign campaigns.</div>
                  )}
                  {lastTrackingLink && (
                    <div className="rounded border p-2 text-xs space-y-1"
                         style={{ borderColor: GOLD + "55", backgroundColor: GOLD + "0d" }}>
                      <div className="font-semibold" style={{ color: GOLD }}>New tracking link generated:</div>
                      <div className="flex items-center gap-2 font-mono break-all">
                        <LinkIcon className="h-3 w-3 shrink-0" />
                        <span className="flex-1">{lastTrackingLink}</span>
                        <button onClick={() => copyLink(lastTrackingLink)} className="hover:opacity-70"><Copy className="h-3 w-3" /></button>
                      </div>
                    </div>
                  )}
                  {assignments === undefined ? (
                    <Skeleton className="h-10" />
                  ) : assignments.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No active assignments.</div>
                  ) : (
                    <div className="space-y-2">
                      {assignments.map((a) => (
                        <div key={a.id} className="border border-border/50 rounded p-2 space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium">{a.clipper_campaigns?.brand_name || "—"}</span>
                            {a.clipper_campaigns?.dynasty_business && (
                              <Badge variant="outline" className={cn("capitalize text-[10px] px-1.5 py-0", BUSINESS_BADGE[a.clipper_campaigns.dynasty_business])}>
                                {a.clipper_campaigns.dynasty_business}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto capitalize">{a.status}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{a.clipper_campaigns?.title}</div>
                          {a.tracking_link && (
                            <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                              <LinkIcon className="h-3 w-3 shrink-0" />
                              <span className="truncate flex-1">{a.tracking_link}</span>
                              <button onClick={() => copyLink(a.tracking_link!)} className="hover:text-foreground"><Copy className="h-3 w-3" /></button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Earnings */}
                <section className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Earnings Summary</h3>
                  {earnings === undefined ? (
                    <Skeleton className="h-16" />
                  ) : earnings.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No earnings yet.</div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="border border-border/50 rounded p-2">
                        <div className="text-[10px] uppercase text-muted-foreground">Total</div>
                        <div className="font-bold" style={{ color: GOLD }}>{fmtMoney(earningsSummary.total)}</div>
                      </div>
                      <div className="border border-border/50 rounded p-2">
                        <div className="text-[10px] uppercase text-muted-foreground">Paid</div>
                        <div className="font-bold text-green-400">{fmtMoney(earningsSummary.paid)}</div>
                      </div>
                      <div className="border border-border/50 rounded p-2">
                        <div className="text-[10px] uppercase text-muted-foreground">Pending</div>
                        <div className="font-bold text-yellow-400">{fmtMoney(earningsSummary.pending)}</div>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Assign Campaign Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: GOLD }}>Assign to Campaign</DialogTitle>
            <DialogDescription>
              Assigning <b>{selected?.full_name}</b>. A unique tracking link will be generated automatically.
            </DialogDescription>
          </DialogHeader>
          <Select value={assignCampaignId} onValueChange={setAssignCampaignId}>
            <SelectTrigger><SelectValue placeholder="Pick an active campaign…" /></SelectTrigger>
            <SelectContent>
              {(activeCampaigns ?? []).length === 0 && (
                <div className="p-2 text-xs text-muted-foreground">No active campaigns.</div>
              )}
              {(activeCampaigns ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="capitalize text-xs text-muted-foreground mr-1">[{c.dynasty_business}]</span>
                  {c.brand_name} — {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button
              onClick={() => assignMut.mutate()}
              disabled={!assignCampaignId || assignMut.isPending}
              style={{ backgroundColor: GOLD, color: "#0A0A0A" }}
            >
              {assignMut.isPending ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
