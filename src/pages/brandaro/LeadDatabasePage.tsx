import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { CsvLeadImporter } from "@/components/brandaro/CsvLeadImporter";
import { BuildDemoModal } from "@/components/brandaro/BuildDemoModal";
import { exportData } from "@/utils/exportUtils";
import { useNavigate } from "react-router-dom";
import {
  Database, Phone, Star, MapPin, Filter, MessageSquare, Loader2,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight,
  Download, Upload, Trash2, Globe, MoreHorizontal, ExternalLink,
  Zap, Radio, Calendar, DollarSign, UserCircle, Pause, Play,
  Search, X, Copy, Eye, Bot, RefreshCw, Columns,
} from "lucide-react";

// ── Types ──
type Lead = {
  id: string;
  business_name: string;
  phone_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  pipeline_stage: string;
  lead_status: string | null;
  priority_score: number | null;
  priority_tier: string | null;
  rating: number | null;
  review_count: number | null;
  demo_url: string | null;
  email: string | null;
  engagement_score: number | null;
  call_attempts: number | null;
  last_call_at: string | null;
  website_status: string | null;
  has_website: boolean | null;
  discovery_job_id: string | null;
  google_maps_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  ai_paused: boolean | null;
  converted: boolean | null;
  source_file: string | null;
  category: string | null;
  postal_code: string | null;
};

const STAGE_COLORS: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  contacted: "bg-amber-500/15 text-amber-400",
  responded: "bg-blue-500/15 text-blue-400",
  interested: "bg-purple-500/15 text-purple-400",
  booked: "bg-teal-500/15 text-teal-400",
  closed: "bg-green-500/15 text-green-400",
  lost: "bg-muted text-muted-foreground",
};

const STAGES = ["new", "contacted", "responded", "interested", "booked", "closed", "lost"];

const DEFAULT_VISIBLE_COLS = [
  "select", "business_name", "phone_number", "location", "industry",
  "pipeline_stage", "priority_score", "rating", "demo", "actions",
];
const TOGGLEABLE_COLS = [
  { key: "address", label: "Address" },
  { key: "email", label: "Email" },
  { key: "engagement_score", label: "Engagement" },
  { key: "call_attempts", label: "Call Attempts" },
  { key: "last_call_at", label: "Last Contact" },
  { key: "website_status", label: "Website Status" },
  { key: "review_count", label: "Review Count" },
  { key: "source", label: "Source" },
  { key: "created_at", label: "Date Added" },
  { key: "google_maps", label: "Google Maps" },
];

function getInitialCols(): string[] {
  try {
    const saved = localStorage.getItem("brandaro_lead_cols");
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

export default function LeadDatabasePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ── State ──
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [sortCol, setSortCol] = useState("priority_score");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [extraCols, setExtraCols] = useState<string[]>(getInitialCols);
  const [executionOpen, setExecutionOpen] = useState(true);
  const [filterStages, setFilterStages] = useState<string[]>([]);
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [filterNoDemo, setFilterNoDemo] = useState(false);
  const [filterScout, setFilterScout] = useState(false);
  const [fromNumber, setFromNumber] = useState<string>("");
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [demoLead, setDemoLead] = useState<any>(null);
  const [colDropdownOpen, setColDropdownOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const lastShiftIdx = useRef<number | null>(null);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Save col prefs
  useEffect(() => {
    localStorage.setItem("brandaro_lead_cols", JSON.stringify(extraCols));
  }, [extraCols]);

  // Load from number from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("brandaro_from_number");
    if (saved) setFromNumber(saved);
  }, []);

  const addLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setExecutionLog((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 20));
  };

  // ── Queries ──
  const { data: statsData } = useQuery({
    queryKey: ["brandaro-lead-stats"],
    queryFn: async () => {
      const results: Record<string, number> = {};
      const { count: total } = await supabase.from("brandaro_qualified_leads").select("*", { count: "exact", head: true });
      results.total = total || 0;
      for (const stage of STAGES) {
        const { count } = await supabase.from("brandaro_qualified_leads").select("*", { count: "exact", head: true }).eq("pipeline_stage", stage);
        results[stage] = count || 0;
      }
      const { count: hasPhone } = await supabase.from("brandaro_qualified_leads").select("*", { count: "exact", head: true }).not("phone_number", "is", null);
      results.hasPhone = hasPhone || 0;
      const { count: hasDemo } = await supabase.from("brandaro_qualified_leads").select("*", { count: "exact", head: true }).not("demo_url", "is", null);
      results.hasDemo = hasDemo || 0;
      const { count: scout } = await supabase.from("brandaro_qualified_leads").select("*", { count: "exact", head: true }).not("discovery_job_id", "is", null);
      results.scout = scout || 0;
      results.csv = (results.total || 0) - (results.scout || 0);
      return results;
    },
    refetchInterval: 60000,
  });

  const { data: phoneNumbers } = useQuery({
    queryKey: ["brandaro-phone-numbers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("business_phone_numbers")
        .select("id, phone_number, label, provider, is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  // Set default from number
  useEffect(() => {
    if (!fromNumber && phoneNumbers?.length) {
      const num = phoneNumbers[0].phone_number;
      setFromNumber(num);
      localStorage.setItem("brandaro_from_number", num);
    }
  }, [phoneNumbers, fromNumber]);

  const { data: leadsResult, isLoading } = useQuery({
    queryKey: ["brandaro-leads-table", debouncedSearch, page, pageSize, sortCol, sortAsc, filterStages, filterHasPhone, filterNoDemo, filterScout],
    queryFn: async () => {
      let query = supabase
        .from("brandaro_qualified_leads")
        .select("*", { count: "exact" })
        .order(sortCol as any, { ascending: sortAsc })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (debouncedSearch) {
        query = query.or(
          `business_name.ilike.%${debouncedSearch}%,phone_number.ilike.%${debouncedSearch}%,city.ilike.%${debouncedSearch}%,state.ilike.%${debouncedSearch}%,industry.ilike.%${debouncedSearch}%`
        );
      }
      if (filterStages.length > 0) {
        query = query.in("pipeline_stage", filterStages);
      }
      if (filterHasPhone) query = query.not("phone_number", "is", null);
      if (filterNoDemo) query = query.is("demo_url", null);
      if (filterScout) query = query.not("discovery_job_id", "is", null);

      const { data, count } = await query;
      return { rows: (data || []) as Lead[], total: count || 0 };
    },
  });

  const leads = leadsResult?.rows || [];
  const totalFiltered = leadsResult?.total || 0;
  const totalPages = Math.ceil(totalFiltered / pageSize);

  // ── Realtime ──
  useEffect(() => {
    const channel = supabase
      .channel("leads-db-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "brandaro_qualified_leads" }, () => {
        queryClient.invalidateQueries({ queryKey: ["brandaro-leads-table"] });
        queryClient.invalidateQueries({ queryKey: ["brandaro-lead-stats"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // ── Selection helpers ──
  const toggleSelect = (id: string, idx: number, shiftKey: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastShiftIdx.current !== null) {
        const start = Math.min(lastShiftIdx.current, idx);
        const end = Math.max(lastShiftIdx.current, idx);
        for (let i = start; i <= end; i++) {
          if (leads[i]) next.add(leads[i].id);
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      lastShiftIdx.current = idx;
      return next;
    });
  };

  const selectAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      leads.forEach((l) => { if (checked) next.add(l.id); else next.delete(l.id); });
      return next;
    });
  };

  const allOnPageSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id));

  const EXPORT_COLUMNS = [
    { key: "business_name", label: "Business Name" },
    { key: "phone_number", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "industry", label: "Industry" },
    { key: "pipeline_stage", label: "Pipeline Stage" },
    { key: "priority_score", label: "Priority Score" },
    { key: "priority_tier", label: "Priority Tier" },
    { key: "rating", label: "Rating" },
    { key: "review_count", label: "Review Count" },
    { key: "call_attempts", label: "Call Attempts" },
    { key: "last_call_at", label: "Last Contact" },
    { key: "website_status", label: "Website Status" },
    { key: "demo_url", label: "Demo URL" },
    { key: "google_maps_url", label: "Google Maps" },
    { key: "created_at", label: "Date Added" },
  ];


  const handleExportAll = async (format: 'csv' | 'excel' | 'json') => {
    // If rows are selected, export only those from current page
    if (selectedIds.size > 0) {
      const selectedLeads = leads.filter((l) => selectedIds.has(l.id));
      exportData({ filename: "brandaro-leads", format, data: selectedLeads as Record<string, unknown>[], columns: EXPORT_COLUMNS });
      return;
    }
    // Otherwise fetch ALL leads from database
    setExporting(true);
    try {
      const allLeads: Record<string, unknown>[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        let query = supabase
          .from("brandaro_qualified_leads")
          .select("*")
          .order("priority_score", { ascending: false })
          .range(from, from + batchSize - 1);
        if (filterStages.length > 0) query = query.in("pipeline_stage", filterStages);
        if (filterHasPhone) query = query.not("phone_number", "is", null);
        if (filterNoDemo) query = query.is("demo_url", null);
        if (filterScout) query = query.not("discovery_job_id", "is", null);
        if (debouncedSearch) {
          query = query.or(
            `business_name.ilike.%${debouncedSearch}%,phone_number.ilike.%${debouncedSearch}%,city.ilike.%${debouncedSearch}%,state.ilike.%${debouncedSearch}%,industry.ilike.%${debouncedSearch}%`
          );
        }
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        allLeads.push(...(data as Record<string, unknown>[]));
        if (data.length < batchSize) break;
        from += batchSize;
      }
      if (allLeads.length === 0) {
        toast.warning("No leads to export");
        return;
      }
      exportData({ filename: "brandaro-leads", format, data: allLeads, columns: EXPORT_COLUMNS });
      toast.success(`Exported ${allLeads.length.toLocaleString()} leads`);
    } catch (err: any) {
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  // ── Sort handler ──
  const handleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(false); }
    setPage(0);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  // ── Actions ──
  const handleSms = async (lead: Lead) => {
    if (!lead.phone_number) { toast.error("No phone number"); return; }
    setLoadingAction(`sms-${lead.id}`);
    try {
      const { data, error } = await supabase.functions.invoke("sms-writer", {
        body: { lead_id: lead.id, from_number: fromNumber },
      });
      if (error) throw error;
      toast.success(`SMS queued for ${lead.business_name}`);
      addLog(`SMS queued for ${lead.business_name}`);
    } catch (err: any) {
      toast.error(`SMS failed: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAiCall = async (lead: Lead) => {
    if (!lead.phone_number) { toast.error("No phone number"); return; }
    setLoadingAction(`call-${lead.id}`);
    try {
      const { data, error } = await supabase.functions.invoke("brandaro-ai-caller", {
        body: { lead_id: lead.id, from_number: fromNumber },
      });
      if (error) throw error;
      toast.success(`AI call initiated to ${lead.business_name}`);
      addLog(`AI call initiated to ${lead.business_name}`);
    } catch (err: any) {
      toast.error(`Call failed: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleMoveStage = async (lead: Lead, stage: string) => {
    try {
      const { error } = await supabase
        .from("brandaro_qualified_leads")
        .update({ pipeline_stage: stage, updated_at: new Date().toISOString() } as any)
        .eq("id", lead.id);
      if (error) throw error;
      toast.success(`${lead.business_name} → ${stage}`);
      addLog(`${lead.business_name} moved to ${stage}`);
      queryClient.invalidateQueries({ queryKey: ["brandaro-leads-table"] });
      queryClient.invalidateQueries({ queryKey: ["brandaro-lead-stats"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTogglePause = async (lead: Lead) => {
    const paused = !lead.ai_paused;
    await supabase.from("brandaro_qualified_leads").update({ ai_paused: paused } as any).eq("id", lead.id);
    toast.success(paused ? "AI paused" : "AI resumed");
    queryClient.invalidateQueries({ queryKey: ["brandaro-leads-table"] });
  };

  const handleBookingLink = async (lead: Lead) => {
    if (!lead.phone_number) { toast.error("No phone number"); return; }
    setLoadingAction(`book-${lead.id}`);
    try {
      const { error } = await supabase.functions.invoke("send-sms", {
        body: {
          to: lead.phone_number,
          from_number: fromNumber,
          message: `Hi ${lead.business_name}, book a quick 15-min strategy call here: https://calendly.com/brandaro/website-strategy`,
        },
      });
      if (error) throw error;
      toast.success("Booking link sent");
      addLog(`Booking link sent to ${lead.business_name}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // ── Bulk Actions ──
  const selectedLeads = useMemo(() => leads.filter((l) => selectedIds.has(l.id)), [leads, selectedIds]);

  const handleBulkSms = async () => {
    const targets = selectedLeads.filter((l) => l.phone_number);
    if (!targets.length) { toast.error("No selected leads with phone numbers"); return; }
    setLoadingAction("bulk-sms");
    let count = 0;
    for (const lead of targets) {
      try {
        await supabase.functions.invoke("sms-writer", { body: { lead_id: lead.id, from_number: fromNumber } });
        count++;
      } catch {}
    }
    toast.success(`SMS queued for ${count} leads`);
    addLog(`SMS queued for ${count} leads`);
    setLoadingAction(null);
  };

  const handleBulkAiCall = async () => {
    const targets = selectedLeads.filter((l) => l.phone_number);
    if (!targets.length) { toast.error("No selected leads with phone numbers"); return; }
    setLoadingAction("bulk-call");
    let count = 0;
    for (const lead of targets) {
      try {
        await supabase.functions.invoke("brandaro-ai-caller", { body: { lead_id: lead.id, from_number: fromNumber } });
        count++;
      } catch {}
    }
    toast.success(`AI calls initiated for ${count} leads`);
    addLog(`AI calls initiated for ${count} leads`);
    setLoadingAction(null);
  };

  const handleBulkStageMove = async (stage: string) => {
    if (!selectedIds.size) { toast.error("Select leads first"); return; }
    setLoadingAction("bulk-move");
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("brandaro_qualified_leads")
      .update({ pipeline_stage: stage, updated_at: new Date().toISOString() } as any)
      .in("id", ids);
    if (!error) {
      toast.success(`${ids.length} leads moved to ${stage}`);
      addLog(`${ids.length} leads moved to ${stage}`);
      queryClient.invalidateQueries({ queryKey: ["brandaro-leads-table"] });
      queryClient.invalidateQueries({ queryKey: ["brandaro-lead-stats"] });
    }
    setLoadingAction(null);
  };

  const handleBulkLost = async () => {
    if (!selectedIds.size) return;
    if (!confirm(`Mark ${selectedIds.size} leads as Lost? This cannot be undone.`)) return;
    await handleBulkStageMove("lost");
  };

  const handleExportSelected = () => {
    const data = selectedIds.size ? selectedLeads : leads;
    exportData({
      filename: "brandaro-leads",
      format: "csv",
      data: data as any[],
      columns: [
        { key: "business_name", label: "Business Name" },
        { key: "phone_number", label: "Phone" },
        { key: "city", label: "City" },
        { key: "state", label: "State" },
        { key: "industry", label: "Industry" },
        { key: "pipeline_stage", label: "Stage" },
        { key: "priority_score", label: "Priority" },
        { key: "rating", label: "Rating" },
        { key: "email", label: "Email" },
        { key: "demo_url", label: "Demo URL" },
      ],
    });
    addLog(`Exported ${data.length} leads`);
  };

  // ── Active Filters ──
  const activeFilters: { label: string; clear: () => void }[] = [];
  if (filterStages.length > 0) activeFilters.push({ label: `Stages: ${filterStages.join(", ")}`, clear: () => setFilterStages([]) });
  if (filterHasPhone) activeFilters.push({ label: "Has Phone", clear: () => setFilterHasPhone(false) });
  if (filterNoDemo) activeFilters.push({ label: "No Demo", clear: () => setFilterNoDemo(false) });
  if (filterScout) activeFilters.push({ label: "Scout Leads", clear: () => setFilterScout(false) });

  // ── Priority border helper ──
  const getRowClass = (lead: Lead) => {
    const classes: string[] = [];
    const score = lead.priority_score ?? 0;
    if (score >= 8) classes.push("border-l-2 border-l-green-500/60");
    else if (score <= 4) classes.push("border-l-2 border-l-red-500/60");
    if (lead.ai_paused) classes.push("bg-amber-500/5");
    if (lead.pipeline_stage === "closed") classes.push("bg-green-500/5");
    if (lead.pipeline_stage === "lost") classes.push("opacity-60");
    return classes.join(" ");
  };

  const formatPhone = (p: string | null) => {
    if (!p) return "—";
    const d = p.replace(/\D/g, "");
    if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    return p;
  };

  const isColVisible = (key: string) => extraCols.includes(key);
  const toggleCol = (key: string) => {
    setExtraCols((prev) => prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]);
  };

  // ── Empty State ──
  if (!isLoading && (statsData?.total ?? 0) === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="text-5xl">🚀</div>
        <h2 className="text-xl font-semibold text-foreground">Your pipeline is empty</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Import leads or run the Scout Agent to find businesses without websites
        </p>
        <div className="flex gap-3">
          <CsvLeadImporter onComplete={() => queryClient.invalidateQueries({ queryKey: ["brandaro-leads-table"] })} />
          <Button variant="outline" onClick={() => navigate("/brandaro/scout-agent")}>
            <Bot className="h-4 w-4 mr-2" /> Run Scout Agent
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={800}>
      <div className="space-y-4">
        {/* ── Header: Import/Export ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2 text-foreground">
              <Database className="h-5 w-5 text-primary" /> Lead Database
            </h1>
            <p className="text-sm text-muted-foreground">Master data table & autonomous execution center</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CsvLeadImporter onComplete={() => queryClient.invalidateQueries({ queryKey: ["brandaro-leads-table"] })} />
            <Button variant="outline" size="sm" onClick={() => navigate("/brandaro/scout-agent")}>
              <Bot className="h-4 w-4 mr-1" /> Run Scout
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={exporting}>
                  {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Export {selectedIds.size > 0 ? `(${selectedIds.size})` : "All"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportAll('csv')}>Export as CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportAll('excel')}>Export as Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportAll('json')}>Export as JSON</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {selectedIds.size > 0 && (
              <Button variant="destructive" size="sm" onClick={handleBulkLost}>
                <Trash2 className="h-4 w-4 mr-1" /> Mark {selectedIds.size} Lost
              </Button>
            )}
          </div>
        </div>

        {/* ── Stats Header ── */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Total", value: statsData?.total, filter: () => setFilterStages([]) },
            ...STAGES.map((s) => ({
              label: s.charAt(0).toUpperCase() + s.slice(1),
              value: statsData?.[s],
              filter: () => setFilterStages([s]),
            })),
            { label: "Has Phone", value: statsData?.hasPhone, filter: () => { setFilterHasPhone(true); setFilterStages([]); } },
            { label: "Has Demo", value: statsData?.hasDemo, filter: () => { setFilterNoDemo(false); setFilterStages([]); } },
            { label: "Scout", value: statsData?.scout, filter: () => { setFilterScout(true); setFilterStages([]); } },
            { label: "CSV", value: statsData?.csv, filter: () => { setFilterScout(false); setFilterStages([]); } },
          ].map((stat) => (
            <button
              key={stat.label}
              onClick={stat.filter}
              className="px-3 py-1.5 rounded-md bg-card border border-border text-xs hover:bg-accent transition-colors"
            >
              <span className="text-muted-foreground">{stat.label}:</span>{" "}
              <span className="font-semibold text-foreground">{stat.value ?? "..."}</span>
            </button>
          ))}
        </div>

        {/* ── Execution Center ── */}
        <Collapsible open={executionOpen} onOpenChange={setExecutionOpen}>
          <Card>
            <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/50 transition-colors">
              <span className="text-sm font-medium flex items-center gap-2 text-foreground">
                <Zap className="h-4 w-4 text-primary" /> Execution Center
              </span>
              {executionOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {/* Phone Number Selector */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium">Execute from:</span>
                  {phoneNumbers?.map((pn) => (
                    <button
                      key={pn.id}
                      onClick={() => { setFromNumber(pn.phone_number); localStorage.setItem("brandaro_from_number", pn.phone_number); }}
                      className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                        fromNumber === pn.phone_number
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-card text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <Radio className="h-3 w-3 inline mr-1" />
                      {formatPhone(pn.phone_number)}
                      {pn.label && <span className="ml-1 opacity-60">({pn.label})</span>}
                    </button>
                  ))}
                  {(!phoneNumbers || phoneNumbers.length === 0) && (
                    <span className="text-xs text-muted-foreground italic">No phone numbers configured</span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm" variant="outline"
                    disabled={!selectedIds.size || loadingAction === "bulk-sms"}
                    onClick={handleBulkSms}
                  >
                    {loadingAction === "bulk-sms" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <MessageSquare className="h-3 w-3 mr-1" />}
                    SMS {selectedIds.size ? `(${selectedIds.size})` : ""}
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    disabled={!selectedIds.size || loadingAction === "bulk-call"}
                    onClick={handleBulkAiCall}
                  >
                    {loadingAction === "bulk-call" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Phone className="h-3 w-3 mr-1" />}
                    AI Call {selectedIds.size ? `(${selectedIds.size})` : ""}
                  </Button>
                  <Button size="sm" variant="outline" disabled={!selectedIds.size} onClick={() => handleBulkStageMove("contacted")}>
                    ⬆️ Move to Contacted {selectedIds.size ? `(${selectedIds.size})` : ""}
                  </Button>
                  <Button size="sm" variant="outline" disabled={!selectedIds.size} onClick={() => handleBulkStageMove("interested")}>
                    🌟 Interested {selectedIds.size ? `(${selectedIds.size})` : ""}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={exporting}>
                        {exporting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
                        Export {selectedIds.size > 0 ? `(${selectedIds.size})` : "All"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExportAll('csv')}>CSV</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportAll('excel')}>Excel</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportAll('json')}>JSON</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Execution Log */}
                {executionLog.length > 0 && (
                  <div className="max-h-24 overflow-y-auto bg-muted rounded-md p-2">
                    {executionLog.map((log, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground font-mono">{log}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ── Search & Filters ── */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, city, industry..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 h-9"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
          <Select value={filterStages.length === 1 ? filterStages[0] : "all"} onValueChange={(v) => { setFilterStages(v === "all" ? [] : [v]); setPage(0); }}>
            <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {STAGES.map((s) => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant={filterHasPhone ? "default" : "outline"} size="sm" className="h-9" onClick={() => { setFilterHasPhone(!filterHasPhone); setPage(0); }}>
            <Phone className="h-3 w-3 mr-1" /> Has Phone
          </Button>
          <Button variant={filterNoDemo ? "default" : "outline"} size="sm" className="h-9" onClick={() => { setFilterNoDemo(!filterNoDemo); setPage(0); }}>
            <Globe className="h-3 w-3 mr-1" /> No Demo
          </Button>
          <Button variant={filterScout ? "default" : "outline"} size="sm" className="h-9" onClick={() => { setFilterScout(!filterScout); setPage(0); }}>
            <Bot className="h-3 w-3 mr-1" /> Scout
          </Button>
          {activeFilters.length > 0 && (
            <Button variant="ghost" size="sm" className="h-9" onClick={() => { setFilterStages([]); setFilterHasPhone(false); setFilterNoDemo(false); setFilterScout(false); }}>
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}

          {/* Column Toggle */}
          <DropdownMenu open={colDropdownOpen} onOpenChange={setColDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 ml-auto">
                <Columns className="h-3 w-3 mr-1" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {TOGGLEABLE_COLS.map((col) => (
                <DropdownMenuItem key={col.key} onSelect={(e) => { e.preventDefault(); toggleCol(col.key); }}>
                  <Checkbox checked={isColVisible(col.key)} className="mr-2" />
                  {col.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {activeFilters.map((f) => (
              <Badge key={f.label} variant="secondary" className="gap-1 cursor-pointer" onClick={f.clear}>
                {f.label} <X className="h-3 w-3" />
              </Badge>
            ))}
          </div>
        )}

        {/* ── Data Table ── */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allOnPageSelected} onCheckedChange={selectAllOnPage} />
                    </TableHead>
                    <TableHead className="min-w-[200px] cursor-pointer" onClick={() => handleSort("business_name")}>
                      <span className="flex items-center gap-1">Business <SortIcon col="business_name" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("phone_number")}>
                      <span className="flex items-center gap-1">Phone <SortIcon col="phone_number" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("city")}>
                      <span className="flex items-center gap-1">Location <SortIcon col="city" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("industry")}>
                      <span className="flex items-center gap-1">Industry <SortIcon col="industry" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("pipeline_stage")}>
                      <span className="flex items-center gap-1">Stage <SortIcon col="pipeline_stage" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("priority_score")}>
                      <span className="flex items-center gap-1">Priority <SortIcon col="priority_score" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("rating")}>
                      <span className="flex items-center gap-1">Rating <SortIcon col="rating" /></span>
                    </TableHead>
                    <TableHead>Demo</TableHead>
                    {isColVisible("address") && <TableHead>Address</TableHead>}
                    {isColVisible("email") && <TableHead>Email</TableHead>}
                    {isColVisible("engagement_score") && (
                      <TableHead className="cursor-pointer" onClick={() => handleSort("engagement_score")}>
                        <span className="flex items-center gap-1">Engage <SortIcon col="engagement_score" /></span>
                      </TableHead>
                    )}
                    {isColVisible("call_attempts") && (
                      <TableHead className="cursor-pointer" onClick={() => handleSort("call_attempts")}>
                        <span className="flex items-center gap-1">Calls <SortIcon col="call_attempts" /></span>
                      </TableHead>
                    )}
                    {isColVisible("last_call_at") && <TableHead>Last Contact</TableHead>}
                    {isColVisible("website_status") && <TableHead>Website</TableHead>}
                    {isColVisible("review_count") && <TableHead>Reviews</TableHead>}
                    {isColVisible("source") && <TableHead>Source</TableHead>}
                    {isColVisible("created_at") && (
                      <TableHead className="cursor-pointer" onClick={() => handleSort("created_at")}>
                        <span className="flex items-center gap-1">Added <SortIcon col="created_at" /></span>
                      </TableHead>
                    )}
                    {isColVisible("google_maps") && <TableHead>Map</TableHead>}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={20} className="text-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : leads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={20} className="text-center py-12 text-muted-foreground">
                        No leads match your filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    leads.map((lead, idx) => (
                      <Tooltip key={lead.id}>
                        <TooltipTrigger asChild>
                          <TableRow className={`${getRowClass(lead)} cursor-default`}>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedIds.has(lead.id)}
                                onCheckedChange={() => toggleSelect(lead.id, idx, false)}
                                onClick={(e: any) => { if (e.shiftKey) { e.preventDefault(); toggleSelect(lead.id, idx, true); } }}
                              />
                            </TableCell>
                            <TableCell>
                              <span className={`font-medium text-foreground ${lead.pipeline_stage === "lost" ? "line-through opacity-60" : ""}`}>
                                {lead.business_name}
                              </span>
                              {lead.ai_paused && <span className="ml-1 text-amber-400 text-[10px]">⏸</span>}
                              {lead.discovery_job_id && <span className="ml-1 text-blue-400 text-[10px]">🤖</span>}
                            </TableCell>
                            <TableCell>
                              {lead.phone_number ? (
                                <a href={`tel:${lead.phone_number}`} className="text-sm text-foreground hover:text-primary flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <Phone className="h-3 w-3" /> {formatPhone(lead.phone_number)}
                                </a>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {lead.city || "—"}{lead.state ? `, ${lead.state}` : ""}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{lead.industry || "—"}</TableCell>
                            <TableCell>
                              <Badge className={`text-[10px] ${STAGE_COLORS[lead.pipeline_stage] || STAGE_COLORS.new}`}>
                                {lead.pipeline_stage}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1 text-sm">
                                {(lead.priority_score ?? 0) >= 7 ? (
                                  <ArrowUp className="h-3 w-3 text-green-400" />
                                ) : (lead.priority_score ?? 0) <= 4 ? (
                                  <ArrowDown className="h-3 w-3 text-red-400" />
                                ) : null}
                                <span className="font-mono">{lead.priority_score ?? "—"}</span>
                              </span>
                            </TableCell>
                            <TableCell className="text-sm">
                              {lead.rating ? (
                                <span className="flex items-center gap-1">
                                  <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                                  {lead.rating}
                                </span>
                              ) : "—"}
                            </TableCell>
                            <TableCell>{lead.demo_url ? <span className="text-green-400">✅</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                            {isColVisible("address") && <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{lead.address || "—"}</TableCell>}
                            {isColVisible("email") && <TableCell className="text-xs text-muted-foreground">{lead.email || "—"}</TableCell>}
                            {isColVisible("engagement_score") && <TableCell className="text-xs font-mono">{lead.engagement_score ?? 0}</TableCell>}
                            {isColVisible("call_attempts") && <TableCell className="text-xs font-mono">{lead.call_attempts ?? 0}</TableCell>}
                            {isColVisible("last_call_at") && (
                              <TableCell className="text-xs text-muted-foreground">
                                {lead.last_call_at ? new Date(lead.last_call_at).toLocaleDateString() : "—"}
                              </TableCell>
                            )}
                            {isColVisible("website_status") && <TableCell className="text-xs">{lead.website_status || "—"}</TableCell>}
                            {isColVisible("review_count") && <TableCell className="text-xs font-mono">{lead.review_count ?? 0}</TableCell>}
                            {isColVisible("source") && (
                              <TableCell className="text-xs">
                                {lead.discovery_job_id ? <Badge variant="outline" className="text-[9px]">Scout</Badge> : <Badge variant="outline" className="text-[9px]">CSV</Badge>}
                              </TableCell>
                            )}
                            {isColVisible("created_at") && (
                              <TableCell className="text-xs text-muted-foreground">
                                {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "—"}
                              </TableCell>
                            )}
                            {isColVisible("google_maps") && (
                              <TableCell>
                                {lead.google_maps_url ? (
                                  <a href={lead.google_maps_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                    <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                  </a>
                                ) : "—"}
                              </TableCell>
                            )}
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1 justify-end">
                                <Button
                                  size="icon" variant="ghost" className="h-7 w-7"
                                  disabled={!lead.phone_number || loadingAction === `sms-${lead.id}`}
                                  onClick={() => handleSms(lead)}
                                  title="SMS"
                                >
                                  {loadingAction === `sms-${lead.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
                                </Button>
                                <Button
                                  size="icon" variant="ghost" className="h-7 w-7"
                                  disabled={!lead.phone_number || loadingAction === `call-${lead.id}`}
                                  onClick={() => handleAiCall(lead)}
                                  title="AI Call"
                                >
                                  {loadingAction === `call-${lead.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Phone className="h-3 w-3" />}
                                </Button>
                                <Button
                                  size="icon" variant="ghost" className="h-7 w-7"
                                  onClick={() => setDemoLead(lead)}
                                  title="Build Demo"
                                >
                                  <Globe className="h-3 w-3" />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-7 w-7">
                                      <MoreHorizontal className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    {lead.phone_number && (
                                      <DropdownMenuItem onClick={() => window.open(`tel:${lead.phone_number}`)}>
                                        <Phone className="h-3 w-3 mr-2" /> Manual Call
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => handleBookingLink(lead)} disabled={!lead.phone_number}>
                                      <Calendar className="h-3 w-3 mr-2" /> Send Booking Link
                                    </DropdownMenuItem>
                                    {lead.phone_number && (
                                      <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(lead.phone_number!); toast.success("Copied"); }}>
                                        <Copy className="h-3 w-3 mr-2" /> Copy Phone
                                      </DropdownMenuItem>
                                    )}
                                    {lead.google_maps_url && (
                                      <DropdownMenuItem onClick={() => window.open(lead.google_maps_url!, "_blank")}>
                                        <MapPin className="h-3 w-3 mr-2" /> Google Maps
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuSub>
                                      <DropdownMenuSubTrigger>Move to →</DropdownMenuSubTrigger>
                                      <DropdownMenuSubContent>
                                        {STAGES.filter((s) => s !== lead.pipeline_stage).map((s) => (
                                          <DropdownMenuItem key={s} onClick={() => handleMoveStage(lead, s)}>
                                            {s.charAt(0).toUpperCase() + s.slice(1)}
                                          </DropdownMenuItem>
                                        ))}
                                      </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleTogglePause(lead)}>
                                      {lead.ai_paused ? <Play className="h-3 w-3 mr-2" /> : <Pause className="h-3 w-3 mr-2" />}
                                      {lead.ai_paused ? "Resume AI" : "Pause AI"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleMoveStage(lead, "lost")}>
                                      <Trash2 className="h-3 w-3 mr-2" /> Mark as Lost
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs p-3 space-y-1">
                          <p className="font-semibold text-sm">{lead.business_name}</p>
                          <p className="text-xs text-muted-foreground">Phone: {formatPhone(lead.phone_number)}</p>
                          {lead.address && <p className="text-xs text-muted-foreground">{lead.address}</p>}
                          <p className="text-xs text-muted-foreground">Industry: {lead.industry || "—"}</p>
                          <p className="text-xs text-muted-foreground">Priority: {lead.priority_score ?? "—"}/10</p>
                          <Badge className={`text-[9px] ${STAGE_COLORS[lead.pipeline_stage] || ""}`}>{lead.pipeline_stage}</Badge>
                        </TooltipContent>
                      </Tooltip>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                {totalFiltered === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalFiltered)} of {totalFiltered}
              </span>
              {selectedIds.size > 0 && (
                <Badge variant="secondary">{selectedIds.size} selected</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
                <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[25, 50, 100, 250].map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(0)}>«</Button>
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</Button>
              <span className="text-xs text-muted-foreground px-2">
                {page + 1} / {totalPages || 1}
              </span>
              <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>›</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</Button>
            </div>
          </div>
        </Card>

        {/* ── Build Demo Modal ── */}
        <BuildDemoModal lead={demoLead} open={!!demoLead} onClose={() => setDemoLead(null)} />
      </div>
    </TooltipProvider>
  );
}
