import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Plus, ChevronDown, ChevronUp, Play, Pause, Pencil,
  ExternalLink, Copy, Film,
} from "lucide-react";

const GOLD = "#C9A84C";

const fmtViews = (n: number) =>
  !n ? "0" : n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" : n >= 1_000 ? (n / 1_000).toFixed(1) + "K" : n.toString();
const fmtMoney = (n: number) =>
  "$" + (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-500/15 text-green-300 border-green-500/30",
  paused: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  completed: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  draft: "bg-blue-500/15 text-blue-300 border-blue-500/30",
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

type Campaign = {
  id: string;
  brand_name: string;
  dynasty_business: string;
  title: string | null;
  description: string | null;
  brief: string | null;
  dos: string | null;
  donts: string | null;
  hashtags: string[] | null;
  raw_footage_url: string | null;
  tracking_base_url: string | null;
  base_rate_per_1k: number | null;
  commission_rate: number | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  total_clips: number | null;
  total_views: number | null;
  created_at: string;
};

type CampaignRow = Campaign & {
  assigned_clippers: number;
  total_subs: number;
};

function CampaignCard({
  c,
  onToggle,
  onEdit,
}: {
  c: CampaignRow;
  onToggle: (c: CampaignRow) => void;
  onEdit: (c: CampaignRow) => void;
}) {
  const [briefOpen, setBriefOpen] = useState(false);
  const [dosOpen, setDosOpen] = useState(false);
  const [dontsOpen, setDontsOpen] = useState(false);

  const brief = c.brief || "";
  const briefTruncated = brief.length > 100 ? brief.slice(0, 100) + "…" : brief;

  const copyTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    toast.success(`Copied ${tag}`);
  };

  const splitLines = (s: string | null) =>
    !s ? [] : s.includes("\n") ? s.split("\n").map((x) => x.trim()).filter(Boolean) : [s];

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-foreground truncate">{c.brand_name}</h3>
              {c.dynasty_business && (
                <Badge variant="outline" className={cn("capitalize", BUSINESS_BADGE[c.dynasty_business])}>
                  {c.dynasty_business}
                </Badge>
              )}
            </div>
            {c.title && <p className="text-xs text-muted-foreground mt-1">{c.title}</p>}
          </div>
          <Badge variant="outline" className={cn("capitalize shrink-0", STATUS_BADGE[c.status])}>
            {c.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 flex-1 flex flex-col">
        {brief && (
          <div>
            <p className="text-sm text-foreground/90">{briefOpen ? brief : briefTruncated}</p>
            {brief.length > 100 && (
              <button
                onClick={() => setBriefOpen((v) => !v)}
                className="text-xs mt-1 hover:underline"
                style={{ color: GOLD }}
              >
                {briefOpen ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}

        {c.dos && (
          <Collapsible open={dosOpen} onOpenChange={setDosOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left border border-green-500/30 bg-green-500/5 rounded px-2 py-1.5 text-xs font-medium text-green-300">
              ✅ Do's {dosOpen ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="border border-t-0 border-green-500/30 bg-green-500/5 rounded-b px-3 py-2 text-xs text-foreground/90 space-y-1">
              {splitLines(c.dos).map((line, i) => <div key={i}>• {line}</div>)}
            </CollapsibleContent>
          </Collapsible>
        )}

        {c.donts && (
          <Collapsible open={dontsOpen} onOpenChange={setDontsOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left border border-red-500/30 bg-red-500/5 rounded px-2 py-1.5 text-xs font-medium text-red-300">
              ❌ Don'ts {dontsOpen ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="border border-t-0 border-red-500/30 bg-red-500/5 rounded-b px-3 py-2 text-xs text-foreground/90 space-y-1">
              {splitLines(c.donts).map((line, i) => <div key={i}>• {line}</div>)}
            </CollapsibleContent>
          </Collapsible>
        )}

        {c.hashtags && c.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {c.hashtags.map((t) => (
              <button
                key={t}
                onClick={() => copyTag(t.startsWith("#") ? t : "#" + t)}
                className="text-xs px-2 py-0.5 rounded-full border border-[#C9A84C]/40 bg-[#C9A84C]/10 text-[#C9A84C] hover:bg-[#C9A84C]/20 inline-flex items-center gap-1"
              >
                {t.startsWith("#") ? t : "#" + t}
                <Copy className="h-2.5 w-2.5" />
              </button>
            ))}
          </div>
        )}

        {c.raw_footage_url && (
          <a
            href={c.raw_footage_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs px-2 py-1.5 rounded border border-border hover:border-[#C9A84C]/50 text-foreground/90 w-fit"
          >
            <Film className="h-3 w-3" /> Raw Footage <ExternalLink className="h-3 w-3" />
          </a>
        )}

        <div className="mt-auto pt-3 border-t border-border/50 grid grid-cols-2 gap-y-1.5 text-xs">
          <div className="text-muted-foreground">Rate / 1K:</div>
          <div className="text-right font-medium" style={{ color: GOLD }}>
            {fmtMoney(Number(c.base_rate_per_1k || 0))}
          </div>
          <div className="text-muted-foreground">Commission:</div>
          <div className="text-right font-medium">{Number(c.commission_rate || 0).toFixed(1)}%</div>
          <div className="text-muted-foreground">Clippers:</div>
          <div className="text-right">{c.assigned_clippers}</div>
          <div className="text-muted-foreground">Clips:</div>
          <div className="text-right">{c.total_subs}</div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => onToggle(c)}>
            {c.status === "active" ? (
              <><Pause className="h-3 w-3 mr-1" /> Pause</>
            ) : (
              <><Play className="h-3 w-3 mr-1" /> Activate</>
            )}
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit(c)}>
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type FormState = {
  brand_name: string;
  dynasty_business: string;
  title: string;
  description: string;
  brief: string;
  dos: string;
  donts: string;
  hashtags: string;
  raw_footage_url: string;
  base_rate_per_1k: string;
  commission_rate: string;
  start_date: string;
  end_date: string;
  status: string;
};

const emptyForm: FormState = {
  brand_name: "",
  dynasty_business: "gasmask",
  title: "",
  description: "",
  brief: "",
  dos: "",
  donts: "",
  hashtags: "",
  raw_footage_url: "",
  base_rate_per_1k: "0",
  commission_rate: "0",
  start_date: "",
  end_date: "",
  status: "active",
};

export default function ClipperCampaigns() {
  const qc = useQueryClient();
  const [statusTab, setStatusTab] = useState<string>("all");
  const [businessFilter, setBusinessFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: campaigns, isLoading } = useQuery<CampaignRow[]>({
    queryKey: ["clipper-campaigns-list"],
    queryFn: async () => {
      const [{ data: cs, error: e1 }, { data: assigns, error: e2 }, { data: subs, error: e3 }] = await Promise.all([
        supabase.from("clipper_campaigns").select("*").order("brand_name", { ascending: true }),
        supabase.from("clipper_assignments").select("campaign_id, status").eq("status", "active"),
        supabase.from("clipper_submissions").select("campaign_id"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;

      const assignCount = new Map<string, number>();
      (assigns ?? []).forEach((r: any) => {
        assignCount.set(r.campaign_id, (assignCount.get(r.campaign_id) ?? 0) + 1);
      });
      const subCount = new Map<string, number>();
      (subs ?? []).forEach((r: any) => {
        subCount.set(r.campaign_id, (subCount.get(r.campaign_id) ?? 0) + 1);
      });

      const rows = (cs ?? []).map((c: any) => ({
        ...c,
        assigned_clippers: assignCount.get(c.id) ?? 0,
        total_subs: subCount.get(c.id) ?? 0,
      })) as CampaignRow[];

      const order = (s: string) => (s === "active" ? 0 : s === "paused" ? 1 : 2);
      rows.sort((a, b) => order(a.status) - order(b.status) || a.brand_name.localeCompare(b.brand_name));
      return rows;
    },
  });

  const stats = useMemo(() => {
    const list = campaigns ?? [];
    const active = list.filter((c) => c.status === "active");
    const totalClips = list.reduce((s, c) => s + Number(c.total_clips || 0), 0);
    const totalViews = list.reduce((s, c) => s + Number(c.total_views || 0), 0);
    const avgCommission =
      active.length === 0
        ? 0
        : active.reduce((s, c) => s + Number(c.commission_rate || 0), 0) / active.length;
    return { activeCount: active.length, totalClips, totalViews, avgCommission };
  }, [campaigns]);

  const filtered = useMemo(() => {
    let list = campaigns ?? [];
    if (statusTab !== "all") list = list.filter((c) => c.status === statusTab);
    if (businessFilter !== "all") list = list.filter((c) => c.dynasty_business === businessFilter);
    return list;
  }, [campaigns, statusTab, businessFilter]);

  const toggleStatus = useMutation({
    mutationFn: async (c: CampaignRow) => {
      const next = c.status === "active" ? "paused" : "active";
      const { error } = await supabase.from("clipper_campaigns").update({ status: next }).eq("id", c.id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      toast.success(`Campaign ${next}`);
      qc.invalidateQueries({ queryKey: ["clipper-campaigns-list"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to update status"),
  });

  const saveCampaign = useMutation({
    mutationFn: async () => {
      const hashtags = form.hashtags
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean);
      const payload: any = {
        brand_name: form.brand_name.trim(),
        dynasty_business: form.dynasty_business,
        title: form.title || null,
        description: form.description || null,
        brief: form.brief || null,
        dos: form.dos || null,
        donts: form.donts || null,
        hashtags,
        raw_footage_url: form.raw_footage_url || null,
        base_rate_per_1k: Number(form.base_rate_per_1k) || 0,
        commission_rate: Number(form.commission_rate) || 0,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
      };
      if (!payload.brand_name) throw new Error("Brand name is required");
      if (editingId) {
        const { error } = await supabase.from("clipper_campaigns").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clipper_campaigns").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Campaign updated" : "Campaign created");
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["clipper-campaigns-list"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to save"),
  });

  const openEdit = (c: CampaignRow) => {
    setEditingId(c.id);
    setForm({
      brand_name: c.brand_name || "",
      dynasty_business: c.dynasty_business || "gasmask",
      title: c.title || "",
      description: c.description || "",
      brief: c.brief || "",
      dos: c.dos || "",
      donts: c.donts || "",
      hashtags: (c.hashtags || []).join(", "),
      raw_footage_url: c.raw_footage_url || "",
      base_rate_per_1k: String(c.base_rate_per_1k ?? 0),
      commission_rate: String(c.commission_rate ?? 0),
      start_date: c.start_date ? c.start_date.slice(0, 10) : "",
      end_date: c.end_date ? c.end_date.slice(0, 10) : "",
      status: c.status || "active",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: GOLD }}>
            📢 Campaigns
          </h1>
          <p className="text-sm text-muted-foreground">Clipper Nation brand campaigns.</p>
        </div>
        <Button onClick={openNew} style={{ backgroundColor: GOLD, color: "#0A0A0A" }} className="hover:opacity-90">
          <Plus className="h-4 w-4 mr-1" /> Add Campaign
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground mb-1">Active Campaigns</div>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{stats.activeCount}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground mb-1">Total Clips</div>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{stats.totalClips}</div>}
          </CardContent>
        </Card>
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground mb-1">Total Views</div>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{fmtViews(stats.totalViews)}</div>}
          </CardContent>
        </Card>
        <Card className="border-[#C9A84C]/30 bg-[#C9A84C]/5">
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground mb-1">Avg Commission</div>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{stats.avgCommission.toFixed(1)}%</div>}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs value={statusTab} onValueChange={setStatusTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="paused">Paused</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={businessFilter} onValueChange={setBusinessFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All businesses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All businesses</SelectItem>
            {BUSINESS_OPTIONS.map((b) => (
              <SelectItem key={b} value={b} className="capitalize">{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground text-sm">
            No campaigns yet. Click "Add Campaign" to create your first one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((c) => (
            <CampaignCard key={c.id} c={c} onToggle={(c) => toggleStatus.mutate(c)} onEdit={openEdit} />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: GOLD }}>
              {editingId ? "Edit Campaign" : "New Campaign"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <Label>Brand Name *</Label>
              <Input value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <Label>Dynasty Business</Label>
              <Select value={form.dynasty_business} onValueChange={(v) => setForm({ ...form, dynasty_business: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUSINESS_OPTIONS.map((b) => (
                    <SelectItem key={b} value={b} className="capitalize">{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Brief</Label>
              <Textarea rows={3} value={form.brief} onChange={(e) => setForm({ ...form, brief: e.target.value })} />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <Label>Do's (one per line)</Label>
              <Textarea rows={3} value={form.dos} onChange={(e) => setForm({ ...form, dos: e.target.value })} />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <Label>Don'ts (one per line)</Label>
              <Textarea rows={3} value={form.donts} onChange={(e) => setForm({ ...form, donts: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Hashtags (comma-separated)</Label>
              <Input value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} placeholder="dynasty, gasmask, drop" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Raw Footage URL</Label>
              <Input value={form.raw_footage_url} onChange={(e) => setForm({ ...form, raw_footage_url: e.target.value })} />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <Label>Base Rate per 1K ($)</Label>
              <Input type="number" step="0.01" value={form.base_rate_per_1k} onChange={(e) => setForm({ ...form, base_rate_per_1k: e.target.value })} />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <Label>Commission Rate (%)</Label>
              <Input type="number" step="0.1" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })} />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <Label>End Date</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              style={{ backgroundColor: GOLD, color: "#0A0A0A" }}
              onClick={() => saveCampaign.mutate()}
              disabled={saveCampaign.isPending}
            >
              {saveCampaign.isPending ? "Saving…" : editingId ? "Save Changes" : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
