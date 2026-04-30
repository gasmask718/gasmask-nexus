/**
 * CampaignDialPage — /communication/campaign-dial
 *
 * Fresh, separate intake/launch surface for outbound dialing campaigns.
 * Reuses the proven backend: dialer_campaigns, outbound_call_queue,
 * bland_agent_webhooks, edge functions `bland-agent-trigger` and
 * `dispatch-campaign-tick` (server-side pg_cron dispatcher).
 *
 * Differs from /auto-dialer (CampaignWizardPage) by collapsing the 5-step
 * wizard into a single command-bridge layout: audience left, script/agent
 * center, live monitor right.  Built per memory rule "no silent failures"
 * and "UI reads from authoritative sources".
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Phone, Users, Bot, Rocket, Search, Upload, Plus, Trash2, Activity,
  CheckCircle2, XCircle, Clock, Mic, PhoneForwarded, MessageSquare,
  Pause, Play, Square, Target, FileText, RotateCcw, AlertTriangle,
  Building2, Bike, Truck, UserPlus, Store, Heart, Hash, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { CallTimelineDrawer } from "@/components/dialer/CallTimelineDrawer";

// ─────────────────────────────────────────────────────────────────────────────
// Audience source registry — all 7 categories wired to authoritative tables.
// ─────────────────────────────────────────────────────────────────────────────
type AudienceKey =
  | "prospects" | "stores" | "ambassadors" | "bikers"
  | "drivers" | "customers" | "csv";

interface AudienceSource {
  key: AudienceKey;
  label: string;
  icon: any;
  table: string | null;
  nameCol: string;
  phoneCol: string;
  searchCols: string[];
  softDeleteCol?: string;
  description: string;
}

const AUDIENCE_SOURCES: AudienceSource[] = [
  { key: "prospects",   label: "Prospects",       icon: Target,      table: "territory_addresses", nameCol: "store_name", phoneCol: "phone",         searchCols: ["store_name", "phone", "city"], description: "Discovered territory leads" },
  { key: "stores",      label: "Active Stores",   icon: Store,       table: "store_master",         nameCol: "store_name", phoneCol: "phone",         searchCols: ["store_name", "phone", "city"], softDeleteCol: "deleted_at", description: "Live retail accounts" },
  { key: "ambassadors", label: "Ambassadors",     icon: UserPlus,    table: "ambassadors",          nameCol: "name",       phoneCol: "phone_primary", searchCols: ["name", "phone_primary", "city"], description: "Field ambassadors" },
  { key: "bikers",      label: "Bikers",          icon: Bike,        table: "bikers",               nameCol: "full_name",  phoneCol: "phone",         searchCols: ["full_name", "phone"],            description: "Last-mile bikers" },
  { key: "drivers",     label: "Drivers",         icon: Truck,       table: "drivers",              nameCol: "full_name",  phoneCol: "phone",         searchCols: ["full_name", "phone"],            description: "Logistics drivers" },
  { key: "customers",   label: "Customers (CRM)", icon: Heart,       table: "crm_customers",        nameCol: "name",       phoneCol: "phone",         searchCols: ["name", "phone", "city"],         description: "CRM customer list" },
  { key: "csv",         label: "CSV / Manual",    icon: Upload,      table: null,                   nameCol: "",           phoneCol: "",              searchCols: [],                                 description: "Paste numbers or upload CSV" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Status visualisation — mirrors the agreed dialer state machine.
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; tone: string; icon: any }> = {
  queued:               { label: "Queued",          tone: "bg-muted text-muted-foreground",                    icon: Clock },
  dialing:              { label: "Dialing",         tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400",   icon: Phone },
  ringing:              { label: "Ringing",         tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400",   icon: Phone },
  intro_playing:        { label: "Intro",           tone: "bg-indigo-500/15 text-indigo-600",                  icon: MessageSquare },
  awaiting_input:       { label: "Awaiting",        tone: "bg-amber-500/15 text-amber-600",                    icon: Clock },
  answered:             { label: "Answered",        tone: "bg-green-500/15 text-green-600 dark:text-green-400",icon: Phone },
  connected:            { label: "Live",            tone: "bg-green-500/15 text-green-600 dark:text-green-400",icon: Bot },
  bridging:             { label: "Bridging",        tone: "bg-purple-500/15 text-purple-600",                  icon: PhoneForwarded },
  bridged:              { label: "Connected",       tone: "bg-green-500/15 text-green-600 dark:text-green-400",icon: PhoneForwarded },
  in_ai_conversation:   { label: "AI Active",       tone: "bg-emerald-500/15 text-emerald-600",                icon: Bot },
  transferred:          { label: "Transferred",     tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400",   icon: PhoneForwarded },
  completed:            { label: "Completed",       tone: "bg-green-500/10 text-green-600 dark:text-green-500",icon: CheckCircle2 },
  declined:             { label: "Declined",        tone: "bg-orange-500/15 text-orange-600",                  icon: XCircle },
  no_input:             { label: "No Input",        tone: "bg-amber-500/15 text-amber-600",                    icon: XCircle },
  no_answer:            { label: "No Answer",       tone: "bg-amber-500/15 text-amber-600",                    icon: XCircle },
  voicemail:            { label: "Voicemail",       tone: "bg-orange-500/15 text-orange-600",                  icon: Mic },
  voicemail_detected:   { label: "VM (detected)",   tone: "bg-orange-500/15 text-orange-600",                  icon: Mic },
  voicemail_left:       { label: "VM Left",         tone: "bg-orange-500/15 text-orange-600",                  icon: Mic },
  failed_bridge:        { label: "Bridge Failed",   tone: "bg-destructive/15 text-destructive",                icon: XCircle },
  failed:               { label: "Failed",          tone: "bg-destructive/15 text-destructive",                icon: XCircle },
};

const PAGE_SIZE = 25;

interface AudienceRow { id: string; name: string; phone: string | null; }
interface CsvRow { id: string; phone: string; name: string; }

// E.164 normalisation — defaults to +1 (NA) for 10-digit input.
function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export default function CampaignDialPage() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();

  // Resolve a usable business id even if BusinessContext isn't hydrated yet.
  const { data: fallbackBiz } = useQuery({
    queryKey: ["campaign-dial:fallback-business"],
    queryFn: async () => {
      const { data } = await supabase.from("businesses").select("id").limit(1).maybeSingle();
      return data;
    },
    enabled: !currentBusiness?.id,
  });
  const bizId = currentBusiness?.id || fallbackBiz?.id;

  // ─── form / selection state ────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [script, setScript] = useState(
    "Hi, this is calling from {{business_name}}. Do you have a quick moment to chat?",
  );
  const [agentId, setAgentId] = useState<string>("");
  const [maxConcurrent, setMaxConcurrent] = useState(5);
  const [maxAttempts, setMaxAttempts] = useState(3);

  const [audienceKey, setAudienceKey] = useState<AudienceKey>("prospects");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvPhone, setCsvPhone] = useState("");
  const [csvName, setCsvName] = useState("");

  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [timelineQueueId, setTimelineQueueId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const source = useMemo(
    () => AUDIENCE_SOURCES.find((s) => s.key === audienceKey)!,
    [audienceKey],
  );

  // ─── Bland AI agent picker ─────────────────────────────────────────────────
  const { data: agents = [] } = useQuery({
    queryKey: ["campaign-dial:bland-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bland_agent_webhooks" as any)
        .select("id, agent_name, agent_type, description, default_voice")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Auto-pick first agent once the list arrives.
  useEffect(() => {
    if (!agentId && agents.length > 0) setAgentId(agents[0].id as string);
  }, [agents, agentId]);

  // ─── Audience query (skipped for CSV) ──────────────────────────────────────
  const { data: audience, isLoading: audienceLoading } = useQuery({
    queryKey: ["campaign-dial:audience", audienceKey, page, search],
    enabled: audienceKey !== "csv" && !!source.table,
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from(source.table as any)
        .select(`id, ${source.nameCol}, ${source.phoneCol}`, { count: "exact" });
      if (source.softDeleteCol) q = q.is(source.softDeleteCol, null);
      if (search.trim()) {
        q = q.or(source.searchCols.map((c) => `${c}.ilike.%${search.trim()}%`).join(","));
      }
      const { data, error, count } = await q
        .order(source.nameCol, { ascending: true })
        .range(from, to);
      if (error) throw error;
      const rows: AudienceRow[] = (data || []).map((r: any) => ({
        id: r.id,
        name: r[source.nameCol] || "Unknown",
        phone: r[source.phoneCol] || null,
      }));
      return { rows, total: count || 0 };
    },
  });

  const rows = audience?.rows || [];
  const totalPages = Math.max(1, Math.ceil((audience?.total || 0) / PAGE_SIZE));
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  const toggleRow = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const togglePage = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });

  // ─── CSV / manual entry ────────────────────────────────────────────────────
  const addCsvNumber = () => {
    const e164 = toE164(csvPhone);
    if (!e164) return toast.error("Enter a valid phone number (10+ digits)");
    if (csvRows.some((r) => r.phone === e164)) return toast.error("Already added");
    setCsvRows((p) => [...p, { id: crypto.randomUUID(), phone: e164, name: csvName.trim() || e164 }]);
    setCsvPhone("");
    setCsvName("");
  };

  const handleCsvFile = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const newRows: CsvRow[] = [];
    const existing = new Set(csvRows.map((r) => r.phone));
    for (const line of lines) {
      // Accept "phone" or "phone,name" — skip header row containing "phone".
      const parts = line.split(",").map((p) => p.trim());
      if (parts[0].toLowerCase() === "phone") continue;
      const e164 = toE164(parts[0]);
      if (!e164 || existing.has(e164)) continue;
      existing.add(e164);
      newRows.push({ id: crypto.randomUUID(), phone: e164, name: (parts[1] || e164).slice(0, 120) });
    }
    if (newRows.length === 0) return toast.error("No valid new numbers found in file");
    setCsvRows((p) => [...p, ...newRows]);
    toast.success(`Imported ${newRows.length} numbers`);
  };

  // ─── Launch campaign ───────────────────────────────────────────────────────
  const launch = useMutation({
    mutationFn: async () => {
      if (!bizId) throw new Error("No business context");
      if (!script.trim()) throw new Error("Script is required");
      if (!agentId) throw new Error("Pick a Bland AI agent");

      const targetCount = audienceKey === "csv" ? csvRows.length : selectedIds.size;
      if (targetCount === 0) throw new Error("Select at least one contact");

      // 1. Create the campaign row — server dispatcher (`dispatch-campaign-tick`)
      //    will pick it up automatically.
      const { data: campaign, error: campErr } = await supabase
        .from("dialer_campaigns")
        .insert({
          business_id: bizId,
          name: name.trim() || `Campaign ${new Date().toISOString().slice(0, 16)}`,
          description: description.trim() || null,
          status: "active",
          dial_mode: "ai",
          max_attempts: maxAttempts,
          max_concurrent_calls: maxConcurrent,
          initial_script: script.trim(),
          agent_id: agentId,
          agent_provider: "bland",
          bland_agent_id: agentId,
        } as any)
        .select("id")
        .single();
      if (campErr) throw campErr;

      // 2. Resolve the actual phone numbers to enqueue.
      let queueItems: any[] = [];
      if (audienceKey === "csv") {
        queueItems = csvRows.map((r, i) => ({
          business_id: bizId,
          campaign_id: campaign.id,
          phone_number: r.phone,
          contact_name: r.name,
          priority_score: Math.max(1, 1000 - i),
          status: "queued",
        }));
      } else {
        const ids = Array.from(selectedIds);
        const fetched: AudienceRow[] = [];
        // Batch lookups so we don't blow the URL length on big selections.
        for (let i = 0; i < ids.length; i += 100) {
          const { data, error } = await supabase
            .from(source.table as any)
            .select(`id, ${source.nameCol}, ${source.phoneCol}`)
            .in("id", ids.slice(i, i + 100));
          if (error) throw error;
          for (const r of data || []) {
            fetched.push({
              id: (r as any).id,
              name: (r as any)[source.nameCol] || "Unknown",
              phone: (r as any)[source.phoneCol] || null,
            });
          }
        }
        queueItems = fetched
          .map((r) => ({ ...r, e164: r.phone ? toE164(r.phone) : null }))
          .filter((r) => r.e164)
          .map((r, i) => ({
            business_id: bizId,
            campaign_id: campaign.id,
            phone_number: r.e164!,
            contact_name: r.name,
            priority_score: Math.max(1, 1000 - i),
            status: "queued",
          }));
      }

      if (queueItems.length === 0) {
        // Roll back the empty campaign so we don't leave litter behind.
        await supabase.from("dialer_campaigns").delete().eq("id", campaign.id);
        throw new Error("No valid phone numbers found in selection");
      }

      // 3. Bulk enqueue in chunks (PostgREST payload safety).
      for (let i = 0; i < queueItems.length; i += 100) {
        const { error } = await supabase
          .from("outbound_call_queue")
          .insert(queueItems.slice(i, i + 100) as any);
        if (error) throw error;
      }

      return { campaignId: campaign.id, count: queueItems.length };
    },
    onSuccess: ({ campaignId, count }) => {
      toast.success(`Launched • ${count} contacts queued`);
      setActiveCampaignId(campaignId);
      setSelectedIds(new Set());
      setCsvRows([]);
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["campaign-dial:campaigns"] });
    },
    onError: (e: any) => toast.error(`Launch failed: ${e.message}`),
  });

  // ─── My recent campaigns ───────────────────────────────────────────────────
  const { data: myCampaigns = [] } = useQuery({
    queryKey: ["campaign-dial:campaigns", bizId],
    enabled: !!bizId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dialer_campaigns")
        .select("id, name, status, created_at, dial_mode")
        .eq("business_id", bizId!)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data || [];
    },
  });

  // ─── Live monitor for active campaign (with realtime) ──────────────────────
  const { data: liveCalls = [] } = useQuery({
    queryKey: ["campaign-dial:live", activeCampaignId],
    enabled: !!activeCampaignId,
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outbound_call_queue")
        .select("id, phone_number, contact_name, status, attempts, updated_at, twilio_call_sid")
        .eq("campaign_id", activeCampaignId!)
        .order("updated_at", { ascending: false })
        .limit(150);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!activeCampaignId) return;
    const ch = supabase
      .channel(`campaign-dial-${activeCampaignId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "outbound_call_queue", filter: `campaign_id=eq.${activeCampaignId}` },
        () => queryClient.invalidateQueries({ queryKey: ["campaign-dial:live", activeCampaignId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeCampaignId, queryClient]);

  const stats = useMemo(() => {
    const s = { total: liveCalls.length, queued: 0, active: 0, completed: 0, failed: 0 };
    const activeStates = ["dialing","ringing","intro_playing","awaiting_input","answered","connected","bridging","bridged","in_ai_conversation"];
    for (const c of liveCalls) {
      if (c.status === "queued") s.queued++;
      else if (activeStates.includes(c.status as string)) s.active++;
      else if (["completed","transferred","voicemail_left"].includes(c.status as string)) s.completed++;
      else if (["failed","failed_bridge","no_answer","declined","no_input"].includes(c.status as string)) s.failed++;
    }
    return s;
  }, [liveCalls]);

  const setCampaignStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("dialer_campaigns").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Campaign ${status}`);
    queryClient.invalidateQueries({ queryKey: ["campaign-dial:campaigns"] });
  };

  const recoverStuck = async () => {
    if (!bizId) return;
    const { data, error } = await supabase.functions.invoke("recover-dialer", { body: { business_id: bizId } });
    if (error) return toast.error(error.message);
    toast.success(`Recovered ${(data as any)?.queue_recovered || 0} stuck call(s)`);
    queryClient.invalidateQueries({ queryKey: ["campaign-dial:live"] });
  };

  const selectedCount = audienceKey === "csv" ? csvRows.length : selectedIds.size;
  const canLaunch = !!bizId && !!agentId && script.trim().length > 0 && selectedCount > 0 && !launch.isPending;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b bg-card/40 backdrop-blur sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Rocket className="h-6 w-6 text-primary" />
              Campaign Dial
            </h1>
            <p className="text-sm text-muted-foreground">
              Twilio + Bland AI · Server-side dispatcher · All 7 audience sources
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={recoverStuck}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Recover Stuck
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 p-4 flex-1 overflow-hidden">
        {/* ═══ LEFT: Audience picker ════════════════════════════════════════ */}
        <Card className="col-span-5 flex flex-col overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Audience
              <Badge variant="secondary" className="ml-auto">{selectedCount} selected</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col overflow-hidden gap-3">
            {/* Source picker */}
            <div className="grid grid-cols-7 gap-1">
              {AUDIENCE_SOURCES.map((s) => {
                const Icon = s.icon;
                const active = s.key === audienceKey;
                return (
                  <button
                    key={s.key}
                    onClick={() => { setAudienceKey(s.key); setPage(1); setSelectedIds(new Set()); }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-md text-xs border transition ${
                      active ? "bg-primary/10 border-primary text-primary" : "bg-muted/30 border-transparent hover:bg-muted/60"
                    }`}
                    title={s.description}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate w-full text-center leading-tight">{s.label.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>

            {audienceKey === "csv" ? (
              // CSV / Manual mode
              <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                <div className="flex gap-2">
                  <Input placeholder="Phone (10+ digits)" value={csvPhone} onChange={(e) => setCsvPhone(e.target.value)} />
                  <Input placeholder="Name (optional)" value={csvName} onChange={(e) => setCsvName(e.target.value)} className="w-40" />
                  <Button onClick={addCsvNumber} size="icon" variant="secondary"><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Import CSV
                  </Button>
                  <span className="text-xs text-muted-foreground self-center">
                    Format: <code>phone</code> or <code>phone,name</code> per line
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); e.target.value = ""; }}
                  />
                </div>
                <ScrollArea className="flex-1 border rounded-md">
                  {csvRows.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      No numbers yet. Add manually or import a CSV.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {csvRows.map((r) => (
                        <div key={r.id} className="flex items-center justify-between p-2 hover:bg-muted/40">
                          <div className="text-sm">
                            <div className="font-medium">{r.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{r.phone}</div>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => setCsvRows((p) => p.filter((x) => x.id !== r.id))}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            ) : (
              // Table-backed source mode
              <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder={`Search ${source.label.toLowerCase()}…`}
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>
                <ScrollArea className="flex-1 border rounded-md">
                  {audienceLoading ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                      Loading…
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">No records found</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card border-b">
                        <tr>
                          <th className="p-2 w-8"><Checkbox checked={allOnPageSelected} onCheckedChange={togglePage} /></th>
                          <th className="p-2 text-left">Name</th>
                          <th className="p-2 text-left">Phone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr
                            key={r.id}
                            onClick={() => r.phone && toggleRow(r.id)}
                            className={`border-b cursor-pointer hover:bg-muted/40 ${selectedIds.has(r.id) ? "bg-primary/5" : ""} ${!r.phone ? "opacity-40" : ""}`}
                          >
                            <td className="p-2"><Checkbox checked={selectedIds.has(r.id)} disabled={!r.phone} /></td>
                            <td className="p-2">{r.name}</td>
                            <td className="p-2 font-mono text-xs">{r.phone || <span className="text-destructive">no phone</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </ScrollArea>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {audience?.total ?? 0} total · page {page} / {totalPages}
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                    <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ MIDDLE: Script + Agent + Launch ══════════════════════════════ */}
        <Card className="col-span-4 flex flex-col overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Script & Agent
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-3">
            <div>
              <Label className="text-xs">Campaign Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Auto-named if empty" />
            </div>
            <div>
              <Label className="text-xs">Description (optional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Bot className="h-3 w-3" /> Bland AI Agent
              </Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger><SelectValue placeholder="Pick an agent…" /></SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.agent_name} <span className="text-muted-foreground text-xs ml-1">· {a.agent_type}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {agents.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No active agents found in bland_agent_webhooks.</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Initial Script</Label>
              <Textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={6}
                className="font-mono text-sm"
                placeholder="What the AI says when the call connects…"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tokens: <code>{"{{business_name}}"}</code> <code>{"{{agent_name}}"}</code>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Concurrency</Label>
                <Input type="number" min={1} max={50} value={maxConcurrent} onChange={(e) => setMaxConcurrent(+e.target.value || 1)} />
              </div>
              <div>
                <Label className="text-xs">Max Attempts</Label>
                <Input type="number" min={1} max={10} value={maxAttempts} onChange={(e) => setMaxAttempts(+e.target.value || 1)} />
              </div>
            </div>

            <Alert className="bg-primary/5 border-primary/30">
              <Activity className="h-4 w-4" />
              <AlertTitle className="text-sm">Server-side dispatch</AlertTitle>
              <AlertDescription className="text-xs">
                A pg_cron job ticks every 10s and dispatches via <code>bland-agent-trigger</code>. You can close this tab — calls keep going.
              </AlertDescription>
            </Alert>

            <Button
              size="lg"
              className="w-full"
              disabled={!canLaunch}
              onClick={() => launch.mutate()}
            >
              {launch.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Launching…</>
              ) : (
                <><Rocket className="h-4 w-4 mr-2" />Launch Campaign · {selectedCount} contacts</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* ═══ RIGHT: Live Monitor + History ════════════════════════════════ */}
        <Card className="col-span-3 flex flex-col overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Live Monitor
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden flex flex-col">
            <Tabs defaultValue={activeCampaignId ? "live" : "history"} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="live">Live</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="live" className="flex-1 overflow-hidden flex flex-col mt-2">
                {!activeCampaignId ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                    Launch a campaign or pick one from <strong>History</strong> to monitor live.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-4 gap-1 mb-2 text-center text-xs">
                      <div className="rounded bg-muted/40 p-1.5">
                        <div className="font-bold text-base">{stats.queued}</div>
                        <div className="text-muted-foreground">Queued</div>
                      </div>
                      <div className="rounded bg-blue-500/10 p-1.5">
                        <div className="font-bold text-base text-blue-600">{stats.active}</div>
                        <div className="text-muted-foreground">Active</div>
                      </div>
                      <div className="rounded bg-green-500/10 p-1.5">
                        <div className="font-bold text-base text-green-600">{stats.completed}</div>
                        <div className="text-muted-foreground">Done</div>
                      </div>
                      <div className="rounded bg-destructive/10 p-1.5">
                        <div className="font-bold text-base text-destructive">{stats.failed}</div>
                        <div className="text-muted-foreground">Failed</div>
                      </div>
                    </div>
                    <Progress value={stats.total ? ((stats.completed + stats.failed) / stats.total) * 100 : 0} className="h-1 mb-2" />
                    <div className="flex gap-1 mb-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setCampaignStatus(activeCampaignId, "paused")}>
                        <Pause className="h-3 w-3 mr-1" />Pause
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setCampaignStatus(activeCampaignId, "active")}>
                        <Play className="h-3 w-3 mr-1" />Resume
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setCampaignStatus(activeCampaignId, "completed")}>
                        <Square className="h-3 w-3 mr-1" />Stop
                      </Button>
                    </div>
                    <ScrollArea className="flex-1 border rounded-md">
                      {liveCalls.length === 0 ? (
                        <div className="p-6 text-center text-xs text-muted-foreground">No calls yet…</div>
                      ) : (
                        <div className="divide-y">
                          {liveCalls.map((c) => {
                            const meta = STATUS_META[c.status as string] || STATUS_META.queued;
                            const Icon = meta.icon;
                            return (
                              <button
                                key={c.id}
                                onClick={() => setTimelineQueueId(c.id)}
                                className="w-full p-2 flex items-center gap-2 text-left hover:bg-muted/40 text-xs"
                              >
                                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="truncate font-medium">{c.contact_name || c.phone_number}</div>
                                  <div className="text-muted-foreground font-mono truncate">{c.phone_number}</div>
                                </div>
                                <Badge className={`${meta.tone} text-[10px] py-0 px-1.5`}>{meta.label}</Badge>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </>
                )}
              </TabsContent>

              <TabsContent value="history" className="flex-1 overflow-hidden mt-2">
                <ScrollArea className="h-full border rounded-md">
                  {myCampaigns.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">No campaigns yet</div>
                  ) : (
                    <div className="divide-y">
                      {myCampaigns.map((c: any) => (
                        <button
                          key={c.id}
                          onClick={() => setActiveCampaignId(c.id)}
                          className={`w-full p-2 text-left hover:bg-muted/40 text-xs ${
                            activeCampaignId === c.id ? "bg-primary/5" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">{c.name}</span>
                            <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                          </div>
                          <div className="text-muted-foreground mt-0.5">
                            {format(new Date(c.created_at), "MMM d · HH:mm")} · {c.dial_mode}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <CallTimelineDrawer
        queueItemId={timelineQueueId}
        open={!!timelineQueueId}
        onClose={() => setTimelineQueueId(null)}
      />
    </div>
  );
}
