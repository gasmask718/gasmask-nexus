import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertTriangle, ChevronDown, ChevronRight, Copy, Download, ExternalLink,
  Trophy, Ban, RotateCcw, Info, Loader2, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import PhoneNameDuplicatesCard from "@/components/admin/PhoneNameDuplicatesCard";

// ─── Types ────────────────────────────────────────────────────────────
interface SummaryRow {
  duplicate_group_id: number;
  normalized_address: string;
  group_size: number;
  pristine_shell_count: number;
  active_record_count: number;
  proposed_winner_store_id: string | null;
  proposed_winner_name: string | null;
  proposed_winner_activity_score: number | null;
  group_classification: string;
  review_priority: string;
}

interface RecordRow {
  duplicate_group_id: number;
  normalized_address: string;
  group_size: number;
  store_id: string;
  store_name: string | null;
  raw_address: string | null;
  phone: string | null;
  created_at: string | null;
  last_updated_at: string | null;
  is_active: boolean | null;
  total_activity_score: number | null;
  is_pristine_shell: boolean | null;
  is_winner: boolean | null;
  needs_manual_review: boolean | null;
  last_invoice_date: string | null;
  last_call_date: string | null;
  last_visit_date: string | null;
  last_any_activity: string | null;
  [key: string]: unknown; // for the *_count columns
}

interface DataDupRow {
  entity_type: string;
  entity_count_total: number;
  entity_duplicates_within_group: number;
  sample_duplicate_pairs: unknown;
}

interface OverrideRow {
  id: string;
  duplicate_group_id: number;
  normalized_address: string;
  manual_winner_store_id: string;
  reason: string;
  set_by: string | null;
  set_at: string;
}

interface SkiplistRow {
  id: string;
  duplicate_group_id: number;
  normalized_address: string;
  reason: string;
  set_by: string | null;
  set_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────
const fmtPhone = (p: string | null) => {
  if (!p) return "—";
  const d = p.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return p;
};

const fmtRel = (iso: string | null): string => {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 0) return "in the future";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
};

const fmtMoney = (n: number | null | undefined) => {
  if (n == null) return "$0";
  return `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

const classBadge = (c: string) => {
  if (c === "pristine_easy") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (c === "scattered_clear_winner") return "bg-blue-500/15 text-blue-700 border-blue-500/30";
  if (c === "scattered_close_call") return "bg-amber-500/15 text-amber-700 border-amber-500/30";
  return "bg-muted text-muted-foreground";
};

// Activity sections for the per-record grid
const SECTIONS: { title: string; icon: string; keys: { k: string; label: string }[]; alwaysShow?: boolean }[] = [
  {
    title: "Money", icon: "💰", keys: [
      { k: "invoices_count", label: "invoices" },
      { k: "invoice_total_amount", label: "invoice $" },
      { k: "orders_count", label: "orders" },
      { k: "store_orders_count", label: "store_orders" },
      { k: "wholesale_orders_count", label: "wholesale_orders" },
      { k: "store_payments_count", label: "payments" },
      { k: "store_transactions_count", label: "transactions" },
      { k: "store_wallet_balance", label: "wallet $" },
      { k: "store_credits_count", label: "credits" },
      { k: "bag_sale_ledger_count", label: "bag_ledger" },
      { k: "tube_sale_ledger_count", label: "tube_ledger" },
    ],
  },
  {
    title: "Calls", icon: "📞", keys: [
      { k: "manual_call_logs_count", label: "manual_calls" },
      { k: "call_recordings_count", label: "recordings" },
      { k: "voicemails_count", label: "voicemails" },
      { k: "dialer_followups_count", label: "dialer_followups" },
      { k: "store_call_intelligence_count", label: "call_intel" },
      { k: "live_calls_count", label: "live_calls" },
      { k: "call_revenue_events_count", label: "rev_events" },
      { k: "call_revenue_attribution_count", label: "rev_attribution" },
    ],
  },
  {
    title: "Notes & Contacts", icon: "📝", keys: [
      { k: "store_notes_count", label: "notes" },
      { k: "store_voice_notes_count", label: "voice_notes" },
      { k: "store_contacts_count", label: "contacts" },
      { k: "contact_profiles_count", label: "contact_profiles" },
    ],
  },
  {
    title: "Communications", icon: "💬", keys: [
      { k: "communication_events_count", label: "events" },
      { k: "communication_messages_count", label: "messages" },
      { k: "messaging_targets_count", label: "messaging_targets" },
      { k: "contact_interactions_count", label: "interactions" },
    ],
  },
  {
    title: "Field Ops", icon: "🚚", keys: [
      { k: "route_stops_count", label: "route_stops" },
      { k: "route_checkins_count", label: "route_checkins" },
      { k: "visit_logs_count", label: "visit_logs" },
      { k: "store_visits_count", label: "store_visits" },
      { k: "deliveries_count", label: "deliveries" },
      { k: "location_events_count", label: "location_events" },
      { k: "store_brand_relationships_count", label: "brand_relationships" },
      { k: "store_brand_stickers_count", label: "brand_stickers" },
    ],
  },
  {
    title: "Tasks & Pipeline", icon: "🎯", keys: [
      { k: "mission_items_count", label: "mission_items" },
      { k: "reminders_count", label: "reminders" },
      { k: "followup_recommendations_count", label: "followups" },
      { k: "store_opportunities_count", label: "opportunities" },
      { k: "deals_count", label: "deals" },
      { k: "sales_prospects_count", label: "prospects" },
      { k: "fraud_flags_count", label: "fraud_flags" },
    ],
  },
  {
    title: "Other", icon: "📊", alwaysShow: true, keys: [
      { k: "enrichment_count", label: "enrichment" },
      { k: "inventory_state_count", label: "inventory_state" },
      { k: "pipeline_count", label: "pipeline" },
      { k: "messaging_log_count", label: "messaging_log" },
      { k: "other_fk_count", label: "other_fk" },
    ],
  },
];

// ─── Page ─────────────────────────────────────────────────────────────
export default function StoreMergePreview() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Filters
  const [classFilter, setClassFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("priority");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Dialog state
  const [overrideTarget, setOverrideTarget] = useState<{ group: SummaryRow; record: RecordRow } | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [skipTarget, setSkipTarget] = useState<SummaryRow | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ─── Queries ──────────────────────────────────────────────────────
  const summary = useQuery({
    queryKey: ["smp-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("analyze_store_duplicate_groups_summary" as never);
      if (error) throw error;
      return (data || []) as SummaryRow[];
    },
    staleTime: 5 * 60_000,
  });

  const overrides = useQuery({
    queryKey: ["smp-overrides"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dynasty_merge_overrides" as never).select("*");
      if (error) throw error;
      return (data || []) as unknown as OverrideRow[];
    },
    staleTime: 60_000,
  });

  const skiplist = useQuery({
    queryKey: ["smp-skiplist"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dynasty_merge_skiplist" as never).select("*");
      if (error) throw error;
      return (data || []) as unknown as SkiplistRow[];
    },
    staleTime: 60_000,
  });

  const overrideByGroup = useMemo(() => {
    const m = new Map<number, OverrideRow>();
    (overrides.data || []).forEach(o => m.set(o.duplicate_group_id, o));
    return m;
  }, [overrides.data]);

  const skipByGroup = useMemo(() => {
    const m = new Map<number, SkiplistRow>();
    (skiplist.data || []).forEach(s => m.set(s.duplicate_group_id, s));
    return m;
  }, [skiplist.data]);

  // ─── Filter + sort ────────────────────────────────────────────────
  const visibleRows = useMemo(() => {
    const all = summary.data || [];
    const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const filtered = all.filter(r => {
      if (classFilter !== "all" && r.group_classification !== classFilter) return false;
      if (priorityFilter !== "all" && r.review_priority !== priorityFilter) return false;
      const isOverride = overrideByGroup.has(r.duplicate_group_id);
      const isSkip = skipByGroup.has(r.duplicate_group_id);
      if (statusFilter === "active" && (isOverride || isSkip)) return false;
      if (statusFilter === "overridden" && !isOverride) return false;
      if (statusFilter === "skipped" && !isSkip) return false;
      if (search && !(r.normalized_address || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    filtered.sort((a, b) => {
      // skipped always to bottom
      const aSkip = skipByGroup.has(a.duplicate_group_id) ? 1 : 0;
      const bSkip = skipByGroup.has(b.duplicate_group_id) ? 1 : 0;
      if (aSkip !== bSkip) return aSkip - bSkip;
      switch (sortBy) {
        case "size": return b.group_size - a.group_size;
        case "score": return (b.proposed_winner_activity_score || 0) - (a.proposed_winner_activity_score || 0);
        case "address": return (a.normalized_address || "").localeCompare(b.normalized_address || "");
        case "priority":
        default: {
          const p = (PRIORITY_ORDER[a.review_priority] ?? 9) - (PRIORITY_ORDER[b.review_priority] ?? 9);
          if (p !== 0) return p;
          return b.group_size - a.group_size;
        }
      }
    });
    return filtered;
  }, [summary.data, classFilter, priorityFilter, statusFilter, search, sortBy, overrideByGroup, skipByGroup]);

  // ─── Summary card values ──────────────────────────────────────────
  const rows = summary.data || [];
  const totalGroups = rows.length;
  const pristineEasy = rows.filter(r => r.group_classification === "pristine_easy").length;
  const scatteredClear = rows.filter(r => r.group_classification === "scattered_clear_winner").length;
  const scatteredClose = rows.filter(r => r.group_classification === "scattered_close_call").length;
  const allPristine = rows.filter(r => r.group_classification === "all_pristine").length;
  const recordsToDelete = rows.reduce((s, r) => s + Math.max(0, r.group_size - 1), 0);
  const overriddenCount = overrideByGroup.size;
  const skippedCount = skipByGroup.size;
  const readyToAutoMerge = rows.filter(r =>
    r.group_classification === "scattered_clear_winner" &&
    !skipByGroup.has(r.duplicate_group_id) &&
    !overrideByGroup.has(r.duplicate_group_id)
  ).length;

  // ─── Toggle expand ────────────────────────────────────────────────
  const toggleExpand = (gid: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid);
      else next.add(gid);
      return next;
    });
  };

  // ─── Override submit ──────────────────────────────────────────────
  const submitOverride = async () => {
    if (!overrideTarget || !overrideReason.trim()) return;
    setSubmitting(true);
    try {
      const { group, record } = overrideTarget;
      const existing = overrideByGroup.get(group.duplicate_group_id);
      if (existing) {
        const { error } = await supabase.from("dynasty_merge_overrides" as never)
          .update({
            manual_winner_store_id: record.store_id,
            reason: overrideReason.trim(),
            set_by: user?.id ?? null,
            set_at: new Date().toISOString(),
          } as never)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("dynasty_merge_overrides" as never).insert({
          duplicate_group_id: group.duplicate_group_id,
          normalized_address: group.normalized_address,
          manual_winner_store_id: record.store_id,
          reason: overrideReason.trim(),
          set_by: user?.id ?? null,
        } as never);
        if (error) throw error;
      }
      toast.success("Override saved");
      setOverrideTarget(null);
      setOverrideReason("");
      qc.invalidateQueries({ queryKey: ["smp-overrides"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const removeOverride = async (gid: number) => {
    const o = overrideByGroup.get(gid);
    if (!o) return;
    const { error } = await supabase.from("dynasty_merge_overrides" as never).delete().eq("id", o.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Override removed");
    qc.invalidateQueries({ queryKey: ["smp-overrides"] });
  };

  // ─── Skip submit ──────────────────────────────────────────────────
  const submitSkip = async () => {
    if (!skipTarget || !skipReason.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("dynasty_merge_skiplist" as never).insert({
        duplicate_group_id: skipTarget.duplicate_group_id,
        normalized_address: skipTarget.normalized_address,
        reason: skipReason.trim(),
        set_by: user?.id ?? null,
      } as never);
      if (error) throw error;
      toast.success("Group marked as not duplicates");
      setSkipTarget(null);
      setSkipReason("");
      qc.invalidateQueries({ queryKey: ["smp-skiplist"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const removeSkip = async (gid: number) => {
    const s = skipByGroup.get(gid);
    if (!s) return;
    const { error } = await supabase.from("dynasty_merge_skiplist" as never).delete().eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Group restored");
    qc.invalidateQueries({ queryKey: ["smp-skiplist"] });
  };

  // ─── CSV export ───────────────────────────────────────────────────
  const handleExportCSV = async () => {
    toast.info("Building full per-record CSV…");
    const { data, error } = await supabase.rpc("analyze_store_duplicate_groups" as never);
    if (error) { toast.error(error.message); return; }
    const allRecords = (data || []) as RecordRow[];
    const summaryByGid = new Map<number, SummaryRow>();
    rows.forEach(r => summaryByGid.set(r.duplicate_group_id, r));

    const csvRows = allRecords.map(rec => {
      const s = summaryByGid.get(rec.duplicate_group_id);
      const ov = overrideByGroup.get(rec.duplicate_group_id);
      const sk = skipByGroup.get(rec.duplicate_group_id);
      const isManualOverride = ov?.manual_winner_store_id === rec.store_id;
      const effectiveWinnerId = ov?.manual_winner_store_id ?? s?.proposed_winner_store_id;
      const wouldBeDeleted = !sk && rec.store_id !== effectiveWinnerId;
      return {
        duplicate_group_id: rec.duplicate_group_id,
        group_classification: s?.group_classification ?? "",
        review_priority: s?.review_priority ?? "",
        group_size: rec.group_size,
        normalized_address: rec.normalized_address,
        store_id: rec.store_id,
        store_name: rec.store_name ?? "",
        raw_address: rec.raw_address ?? "",
        phone: rec.phone ?? "",
        total_activity_score: rec.total_activity_score ?? 0,
        is_winner: rec.is_winner ? "true" : "false",
        is_pristine_shell: rec.is_pristine_shell ? "true" : "false",
        is_manual_override: isManualOverride ? "true" : "false",
        invoices_count: rec.invoices_count,
        invoice_total_amount: rec.invoice_total_amount,
        store_notes_count: rec.store_notes_count,
        store_contacts_count: rec.store_contacts_count,
        manual_call_logs_count: rec.manual_call_logs_count,
        communication_events_count: rec.communication_events_count,
        route_stops_count: rec.route_stops_count,
        deliveries_count: rec.deliveries_count,
        store_brand_stickers_count: rec.store_brand_stickers_count,
        location_events_count: rec.location_events_count,
        tube_sale_ledger_count: rec.tube_sale_ledger_count,
        bag_sale_ledger_count: rec.bag_sale_ledger_count,
        enrichment_count: rec.enrichment_count,
        inventory_state_count: rec.inventory_state_count,
        pipeline_count: rec.pipeline_count,
        messaging_log_count: rec.messaging_log_count,
        other_fk_count: rec.other_fk_count,
        last_invoice_date: rec.last_invoice_date ?? "",
        last_call_date: rec.last_call_date ?? "",
        last_visit_date: rec.last_visit_date ?? "",
        last_any_activity: rec.last_any_activity ?? "",
        created_at: rec.created_at ?? "",
        updated_at: rec.last_updated_at ?? "",
        would_be_deleted_in_merge: wouldBeDeleted ? "true" : "false",
        override_status: ov ? `OVERRIDE: winner=${ov.manual_winner_store_id} reason="${ov.reason}"` : "",
        skiplist_status: sk ? `SKIPPED: reason="${sk.reason}"` : "",
      };
    });

    const headers = Object.keys(csvRows[0] ?? {});
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const csv = [
      headers.join(","),
      ...csvRows.map(r => headers.map(h => escape((r as Record<string, unknown>)[h])).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `store_merge_preview_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${csvRows.length} rows`);
  };

  return (
    <TooltipProvider>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Store Merge Preview</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Read-only analysis of duplicate store groups. Override winners and mark non-duplicates here; the actual merge happens in a separate, audited session.
            </p>
          </div>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" /> Download CSV
          </Button>
        </div>

        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <strong>MERGE PREVIEW — READ-ONLY.</strong> No store records, related data, or RLS will be modified by this page.
              Overrides and skiplist entries are operator decisions queued for the future merge phase.
            </div>
          </CardContent>
        </Card>

        <PhoneNameDuplicatesCard />

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-4">
          <SummaryCard label="Total groups" value={totalGroups} />
          <SummaryCard label="Pristine easy" value={pristineEasy} tone="emerald" />
          <SummaryCard label="Scattered clear" value={scatteredClear} tone="blue" />
          <SummaryCard label="Scattered close" value={scatteredClose} tone="amber" />
          <SummaryCard label="All pristine" value={allPristine} />
          <SummaryCard label="Records to delete" value={recordsToDelete} tone="destructive" />
          <SummaryCard label="Overridden" value={overriddenCount} tone="blue" />
          <SummaryCard label="Skipped" value={skippedCount} />
          <SummaryCard label="Ready to auto-merge" value={readyToAutoMerge} tone="emerald" />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-5 gap-3">
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger><SelectValue placeholder="Classification" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classifications</SelectItem>
                <SelectItem value="pristine_easy">Pristine Easy</SelectItem>
                <SelectItem value="scattered_clear_winner">Scattered Clear Winner</SelectItem>
                <SelectItem value="scattered_close_call">Scattered Close Call</SelectItem>
                <SelectItem value="all_pristine">All Pristine</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="HIGH">HIGH</SelectItem>
                <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                <SelectItem value="LOW">LOW</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="overridden">Manually Overridden</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Search address…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Sort: Priority</SelectItem>
                <SelectItem value="size">Sort: Group Size</SelectItem>
                <SelectItem value="score">Sort: Winner Score</SelectItem>
                <SelectItem value="address">Sort: Address</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Group table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Duplicate Groups ({visibleRows.length} of {totalGroups})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.isLoading && <p className="text-sm text-muted-foreground">Loading analysis (this can take 30–60s)…</p>}
            {summary.error && <p className="text-sm text-destructive">{(summary.error as Error).message}</p>}
            {!summary.isLoading && !summary.error && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>#</TableHead>
                    <TableHead>Normalized Address</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Winner / Status</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                    <TableHead className="text-right">Pristine</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map(r => {
                    const ov = overrideByGroup.get(r.duplicate_group_id);
                    const sk = skipByGroup.get(r.duplicate_group_id);
                    const isOpen = expanded.has(r.duplicate_group_id);
                    return (
                      <GroupRowFragment
                        key={r.duplicate_group_id}
                        row={r}
                        isOpen={isOpen}
                        onToggle={() => toggleExpand(r.duplicate_group_id)}
                        override={ov}
                        skiplist={sk}
                        onMakeWinner={(rec) => setOverrideTarget({ group: r, record: rec })}
                        onSkipGroup={() => setSkipTarget(r)}
                        onUnskip={() => removeSkip(r.duplicate_group_id)}
                        onRemoveOverride={() => removeOverride(r.duplicate_group_id)}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Override Dialog */}
        <Dialog open={!!overrideTarget} onOpenChange={(o) => { if (!o) { setOverrideTarget(null); setOverrideReason(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Override Auto-Selected Winner?</DialogTitle>
              <DialogDescription>
                The system selected <strong>{overrideTarget?.group.proposed_winner_name || "—"}</strong> as the winner based on activity score.
                You're choosing <strong>{overrideTarget?.record.store_name || "—"}</strong> instead.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="rounded border p-3">
                <div className="text-xs text-muted-foreground">Auto winner</div>
                <div className="font-medium text-sm truncate">{overrideTarget?.group.proposed_winner_name || "—"}</div>
                <div className="text-xs mt-1">Score: <span className="font-mono">{overrideTarget?.group.proposed_winner_activity_score ?? 0}</span></div>
              </div>
              <div className="rounded border border-primary p-3 bg-primary/5">
                <div className="text-xs text-muted-foreground">Your choice</div>
                <div className="font-medium text-sm truncate">{overrideTarget?.record.store_name || "—"}</div>
                <div className="text-xs mt-1">Score: <span className="font-mono">{overrideTarget?.record.total_activity_score ?? 0}</span></div>
              </div>
            </div>
            <Textarea
              placeholder="Reason for override (required)…"
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              rows={3}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => { setOverrideTarget(null); setOverrideReason(""); }}>Cancel</Button>
              <Button onClick={submitOverride} disabled={!overrideReason.trim() || submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm Override
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Skip Dialog */}
        <Dialog open={!!skipTarget} onOpenChange={(o) => { if (!o) { setSkipTarget(null); setSkipReason(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark group as Not Duplicates?</DialogTitle>
              <DialogDescription>
                Are you sure these are not the same store? This group will be excluded from any future merge operations.
                <br />
                <span className="font-mono text-xs mt-2 block">{skipTarget?.normalized_address}</span>
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Reason for skip (required)…"
              value={skipReason}
              onChange={e => setSkipReason(e.target.value)}
              rows={3}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => { setSkipTarget(null); setSkipReason(""); }}>Cancel</Button>
              <Button variant="destructive" onClick={submitSkip} disabled={!skipReason.trim() || submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm Skip
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

// ─── Group row + expansion ────────────────────────────────────────────
function GroupRowFragment({
  row, isOpen, onToggle, override, skiplist, onMakeWinner, onSkipGroup, onUnskip, onRemoveOverride,
}: {
  row: SummaryRow;
  isOpen: boolean;
  onToggle: () => void;
  override?: OverrideRow;
  skiplist?: SkiplistRow;
  onMakeWinner: (rec: RecordRow) => void;
  onSkipGroup: () => void;
  onUnskip: () => void;
  onRemoveOverride: () => void;
}) {
  const isSkipped = !!skiplist;
  return (
    <>
      <TableRow className={isSkipped ? "opacity-50" : ""}>
        <TableCell>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </TableCell>
        <TableCell className="font-mono text-xs">{row.duplicate_group_id}</TableCell>
        <TableCell className={`text-xs max-w-md truncate ${isSkipped ? "line-through" : ""}`}>
          {row.normalized_address}
          {isSkipped && (
            <div className="text-[10px] not-italic text-muted-foreground mt-1">
              skipped on {new Date(skiplist!.set_at).toLocaleDateString()} — reason: {skiplist!.reason}
            </div>
          )}
        </TableCell>
        <TableCell>{row.group_size}</TableCell>
        <TableCell>
          <Badge variant="outline" className={classBadge(row.group_classification)}>
            {row.group_classification}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge variant={row.review_priority === "HIGH" ? "destructive" : "outline"}>
            {row.review_priority}
          </Badge>
        </TableCell>
        <TableCell className="text-xs">
          {isSkipped ? (
            <Badge variant="outline" className="bg-muted">SKIPPED</Badge>
          ) : override ? (
            <div>
              <Badge className="bg-primary/15 text-primary border-primary/30">MANUAL OVERRIDE</Badge>
              <div className="text-[10px] text-muted-foreground mt-1">
                set on {new Date(override.set_at).toLocaleDateString()}
              </div>
            </div>
          ) : (
            <span>{row.proposed_winner_name || "—"}</span>
          )}
        </TableCell>
        <TableCell className="text-right font-mono">{row.proposed_winner_activity_score ?? 0}</TableCell>
        <TableCell className="text-right">{row.active_record_count}</TableCell>
        <TableCell className="text-right text-muted-foreground">{row.pristine_shell_count}</TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            {isSkipped ? (
              <Button variant="outline" size="sm" onClick={onUnskip}>
                <RotateCcw className="h-3 w-3 mr-1" /> Unskip
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={onSkipGroup}>
                <Ban className="h-3 w-3 mr-1" /> Not Dupes
              </Button>
            )}
            {override && !isSkipped && (
              <Button variant="ghost" size="sm" onClick={onRemoveOverride}>
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {isOpen && (
        <TableRow>
          <TableCell colSpan={11} className="bg-muted/30 p-0">
            <ExpandedGroup
              group={row}
              effectiveWinnerId={override?.manual_winner_store_id ?? row.proposed_winner_store_id ?? null}
              isOverride={!!override}
              onMakeWinner={onMakeWinner}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Expanded group content ───────────────────────────────────────────
function ExpandedGroup({
  group, effectiveWinnerId, isOverride, onMakeWinner,
}: {
  group: SummaryRow;
  effectiveWinnerId: string | null;
  isOverride: boolean;
  onMakeWinner: (rec: RecordRow) => void;
}) {
  const [showSlow, setShowSlow] = useState(false);
  // lazy load all per-record rows then filter to this group
  const records = useQuery({
    queryKey: ["smp-records-all"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("analyze_store_duplicate_groups" as never);
      if (error) throw error;
      return (data || []) as RecordRow[];
    },
    staleTime: 5 * 60_000,
  });

  const dataDups = useQuery({
    queryKey: ["smp-data-dups", group.duplicate_group_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("detect_data_duplicates_in_group" as never, {
        p_group_id: group.duplicate_group_id,
      } as never);
      if (error) throw error;
      return (data || []) as DataDupRow[];
    },
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!records.isLoading && !dataDups.isLoading) return;
    const t = setTimeout(() => setShowSlow(true), 10_000);
    return () => clearTimeout(t);
  }, [records.isLoading, dataDups.isLoading]);

  const groupRecords = useMemo(() => {
    return (records.data || []).filter(r => r.duplicate_group_id === group.duplicate_group_id);
  }, [records.data, group.duplicate_group_id]);

  // Hard invoice signal from invoices_unified (source of truth, not activity score)
  const invoiceSignals = useQuery({
    queryKey: ["smp-invoice-signals", group.duplicate_group_id, groupRecords.map(r => r.store_id).sort().join(",")],
    enabled: groupRecords.length > 0,
    queryFn: async () => {
      const ids = groupRecords.map(r => r.store_id);
      const { data, error } = await supabase
        .from("invoices_unified")
        .select("store_id, created_at, total_amount")
        .in("store_id", ids);
      if (error) throw error;
      const map = new Map<string, { count: number; lastDate: string | null; total: number }>();
      ids.forEach(id => map.set(id, { count: 0, lastDate: null, total: 0 }));
      (data || []).forEach((row: { store_id: string | null; created_at: string | null; total_amount: number | null }) => {
        if (!row.store_id) return;
        const cur = map.get(row.store_id) || { count: 0, lastDate: null, total: 0 };
        cur.count += 1;
        cur.total += Number(row.total_amount || 0);
        if (row.created_at && (!cur.lastDate || row.created_at > cur.lastDate)) cur.lastDate = row.created_at;
        map.set(row.store_id, cur);
      });
      return map;
    },
    staleTime: 60_000,
  });

  if (records.isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading per-record activity…
        {showSlow && <span className="ml-2 italic">still loading, this is a heavy query…</span>}
      </div>
    );
  }
  if (records.error) return <div className="p-6 text-sm text-destructive">{(records.error as Error).message}</div>;

  const recordsWithOrders = groupRecords.filter(r => (invoiceSignals.data?.get(r.store_id)?.count ?? 0) > 0).length;
  const multiTenantWarn = recordsWithOrders >= 2;

  return (
    <div className="p-4 space-y-4">
      {invoiceSignals.data && (
        <div className={`rounded border p-2 text-xs flex items-center gap-2 ${
          multiTenantWarn
            ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
            : "border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200"
        }`}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>{recordsWithOrders}</strong> of {groupRecords.length} records have invoices in <code>invoices_unified</code>.{" "}
            {multiTenantWarn
              ? "Possible multi-tenant building — do NOT merge unless you've confirmed they're the same business."
              : "True duplicate pattern: 1 record with orders + empty shells = safe to fold in."}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {groupRecords.map(rec => (
          <RecordCard
            key={rec.store_id}
            record={rec}
            isEffectiveWinner={rec.store_id === effectiveWinnerId}
            isOverride={isOverride}
            onMakeWinner={() => onMakeWinner(rec)}
            invoiceSignal={invoiceSignals.data?.get(rec.store_id) ?? null}
            invoiceSignalLoading={invoiceSignals.isLoading}
          />
        ))}
      </div>

      {/* Data duplicates section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            Data Duplicates Within This Group
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                These rows would be SKIPPED during merge to avoid bringing duplicate data over to the winner.
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dataDups.isLoading && <p className="text-xs text-muted-foreground">Scanning…</p>}
          {dataDups.error && <p className="text-xs text-destructive">{(dataDups.error as Error).message}</p>}
          {!dataDups.isLoading && !dataDups.error && (
            (dataDups.data || []).every(d => d.entity_duplicates_within_group === 0) ? (
              <p className="text-xs text-muted-foreground">
                No duplicate data detected in this group. All {(dataDups.data || []).reduce((s, d) => s + Number(d.entity_count_total), 0)} activity rows would be moved to the winner during merge.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity Type</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Duplicates</TableHead>
                    <TableHead>Sample</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dataDups.data || []).map(d => (
                    <TableRow key={d.entity_type}>
                      <TableCell className="text-xs font-medium">{d.entity_type}</TableCell>
                      <TableCell className="text-right text-xs font-mono">{d.entity_count_total}</TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {d.entity_duplicates_within_group > 0 ? (
                          <Badge variant="destructive">{d.entity_duplicates_within_group}</Badge>
                        ) : 0}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                        {(() => {
                          const s = d.sample_duplicate_pairs;
                          if (!s) return "—";
                          const str = typeof s === "string" ? s : JSON.stringify(s);
                          return str.length > 120 ? str.slice(0, 120) + "…" : str;
                        })()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Per-record card ──────────────────────────────────────────────────
function RecordCard({
  record, isEffectiveWinner, isOverride, onMakeWinner,
}: {
  record: RecordRow;
  isEffectiveWinner: boolean;
  isOverride: boolean;
  onMakeWinner: () => void;
}) {
  const copyId = () => {
    navigator.clipboard.writeText(record.store_id);
    toast.success("Store ID copied");
  };

  return (
    <Card className={isEffectiveWinner ? "border-primary border-2" : record.is_pristine_shell ? "border-dashed" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold truncate">{record.store_name || "(unnamed)"}</span>
              {isEffectiveWinner && (
                isOverride ? (
                  <Badge className="bg-primary/15 text-primary border-primary/30">
                    <Trophy className="h-3 w-3 mr-1" /> MANUAL OVERRIDE WINNER
                  </Badge>
                ) : (
                  <Badge className="bg-primary text-primary-foreground">
                    <Trophy className="h-3 w-3 mr-1" /> WINNER
                  </Badge>
                )
              )}
              {record.is_pristine_shell && (
                <Badge variant="outline" className="text-muted-foreground">
                  <ShieldAlert className="h-3 w-3 mr-1" /> Pristine Shell
                </Badge>
              )}
            </div>
            <button onClick={copyId} className="text-[10px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1">
              {record.store_id.slice(0, 8)}…{record.store_id.slice(-4)} <Copy className="h-2.5 w-2.5" />
            </button>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] text-muted-foreground uppercase">Activity</div>
            <div className="text-lg font-bold font-mono">{record.total_activity_score ?? 0}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <div><span className="text-muted-foreground">Address:</span> {record.raw_address || "—"}</div>
          <div><span className="text-muted-foreground">Phone:</span> {fmtPhone(record.phone)}</div>
          <div><span className="text-muted-foreground">Created:</span> {fmtRel(record.created_at)}</div>
          <div><span className="text-muted-foreground">Updated:</span> {fmtRel(record.last_updated_at)}</div>
        </div>

        {/* Activity grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SECTIONS.map(section => {
            const entries = section.keys
              .map(({ k, label }) => ({ label, k, value: Number((record[k] as number) ?? 0) }))
              .filter(e => section.alwaysShow || e.value > 0);
            if (!entries.length) return null;
            return (
              <div key={section.title} className="rounded border bg-background p-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  {section.icon} {section.title}
                </div>
                <div className="space-y-0.5">
                  {entries.map(e => (
                    <div key={e.k} className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground truncate">{e.label}</span>
                      <span className="font-mono">
                        {(e.k === "invoice_total_amount" || e.k === "store_wallet_balance")
                          ? fmtMoney(e.value)
                          : e.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Last activity dates */}
        <div className="rounded border bg-background p-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">📅 Last Activity</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-0.5 text-[11px]">
            <div><span className="text-muted-foreground">Invoice:</span> {fmtRel(record.last_invoice_date)}</div>
            <div><span className="text-muted-foreground">Call:</span> {fmtRel(record.last_call_date)}</div>
            <div><span className="text-muted-foreground">Visit:</span> {fmtRel(record.last_visit_date)}</div>
            <div><span className="text-muted-foreground">Any:</span> {fmtRel(record.last_any_activity)}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {!isEffectiveWinner && (
            <Button size="sm" variant="default" onClick={onMakeWinner}>
              <Trophy className="h-3 w-3 mr-1" /> Make This The Winner
            </Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <a href={`/stores/${record.store_id}`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3 w-3 mr-1" /> View Store Profile
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────
function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "blue" | "amber" | "destructive" }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-600" :
    tone === "blue" ? "text-blue-600" :
    tone === "amber" ? "text-amber-600" :
    tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground uppercase tracking-wide truncate">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${toneClass}`}>{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}
