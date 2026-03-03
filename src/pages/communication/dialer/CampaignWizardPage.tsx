import { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Target,
  Users,
  Settings,
  FileText,
  Rocket,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Search,
  Bot,
  MessageSquare,
  ArrowDown,
  Activity,
  RotateCcw,
  Phone,
  PhoneForwarded,
  PhoneCall,
  Clock,
  XCircle,
  Mic,
  LayoutDashboard,
  Plus,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { DataTablePagination } from "@/components/crud/DataTablePagination";

// --- Shared Types ---

interface AudienceRow {
  id: string;
  store_name: string;
  phone: string | null;
  city: string | null;
  state: string | null;
}

interface VoiceAgent {
  id: string;
  name: string;
  description: string | null;
  provider: string;
}

interface Campaign {
  id: string;
  name: string;
  status: "active" | "paused" | "completed" | "draft";
  created_at: string;
  initial_script: string;
  agent_id: string;
  business_id: string;
}

interface CallItem {
  id: string;
  phone_number: string;
  contact_name: string;
  status: "queued" | "dialing" | "connected" | "completed" | "failed" | "no_answer" | "voicemail" | "transferred";
  duration?: number;
  transcript?: string;
  updated_at: string;
}

// --- Status Config for Console ---
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  queued: { label: "Queued", color: "bg-muted text-muted-foreground", icon: Clock },
  dialing: { label: "Dialing", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400", icon: Phone },
  connected: { label: "Live", color: "bg-green-500/15 text-green-700 dark:text-green-400", icon: PhoneCall },
  completed: { label: "Completed", color: "bg-green-500/10 text-green-600", icon: CheckCircle2 },
  transferred: { label: "Transferred", color: "bg-purple-500/15 text-purple-700", icon: PhoneForwarded },
  no_answer: { label: "No Answer", color: "bg-amber-500/15 text-amber-700", icon: XCircle },
  failed: { label: "Failed", color: "bg-destructive/15 text-destructive", icon: XCircle },
  voicemail: { label: "Voicemail", color: "bg-orange-500/15 text-orange-700", icon: Mic },
};

const STEPS = [
  { label: "Campaign Info", icon: Target },
  { label: "Audience", icon: Users },
  { label: "Dialing Rules", icon: Settings },
  { label: "Script & AI Agent", icon: FileText },
  { label: "Launch", icon: Rocket },
];

const PAGE_SIZE = 25;

export default function CampaignWizardPage() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const bizId = currentBusiness?.id;

  // VIEW STATE: Toggle between Wizard and Console
  const [viewMode, setViewMode] = useState<"wizard" | "console">("wizard");
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  // --- WIZARD STATE ---
  const [step, setStep] = useState(0);
  const [audienceType, setAudienceType] = useState<"prospects" | "stores">("prospects");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [audiencePage, setAudiencePage] = useState(1);
  const [audienceSearch, setAudienceSearch] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    max_attempts: 3,
    retry_backoff_minutes: 30,
    amd_enabled: true,
    call_window_start: "09:00",
    call_window_end: "17:00",
    max_concurrent: 5,
    initial_script: "",
    agent_id: "",
  });

  // --- DATA FETCHING (WIZARD) ---
  const { data: campaignCount } = useQuery({
    queryKey: ["dialer-campaign-count"],
    queryFn: async () => {
      const { count } = await supabase.from("dialer_campaigns").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  // Fetch Agents (Cast as VoiceAgent[] to avoid TS errors on missing table types)
  const { data: availableAgents } = useQuery({
    queryKey: ["voice-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_agents" as any)
        .select("id, name, description, provider")
        .eq("provider", "elevenlabs");
      if (error) return [] as VoiceAgent[];
      return data as unknown as VoiceAgent[];
    },
  });

  const defaultName = useMemo(() => {
    const seq = (campaignCount ?? 0) + 1;
    return `CMPN-${String(seq).padStart(4, "0")}-OUTREACH`;
  }, [campaignCount]);

  const effectiveName = form.name || defaultName;

  // Audience Query
  const { data: audienceData, isLoading: audienceLoading } = useQuery({
    queryKey: ["campaign-audience", audienceType, audiencePage, audienceSearch],
    queryFn: async () => {
      const from = (audiencePage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const table = audienceType === "prospects" ? "territory_addresses" : "store_master";
      let query = supabase.from(table).select("id, store_name, phone, city, state", { count: "exact" });

      if (audienceType === "stores") query = query.is("deleted_at", null);
      if (audienceSearch.trim()) {
        const s = audienceSearch.trim();
        query = query.or(`store_name.ilike.%${s}%,phone.ilike.%${s}%,city.ilike.%${s}%`);
      }
      query = query.order("store_name", { ascending: true }).range(from, to);
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as AudienceRow[], totalCount: count ?? 0 };
    },
    enabled: viewMode === "wizard", // Only fetch in wizard mode
  });

  const audienceRows = audienceData?.rows ?? [];
  const audienceTotalCount = audienceData?.totalCount ?? 0;
  const audienceTotalPages = Math.max(1, Math.ceil(audienceTotalCount / PAGE_SIZE));
  const allPageSelected = audienceRows.length > 0 && audienceRows.every((r) => selectedIds.has(r.id));

  // Selection Logic
  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) audienceRows.forEach((r) => next.delete(r.id));
      else audienceRows.forEach((r) => next.add(r.id));
      return next;
    });
  }, [allPageSelected, audienceRows]);

  const update = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  // --- MUTATION: LAUNCH CAMPAIGN ---
  const launchMutation = useMutation({
    mutationFn: async () => {
      if (!bizId) throw new Error("No business");
      if (selectedIds.size === 0) throw new Error("No audience selected");

      // 1. Create Campaign
      const { data: campaign, error: campErr } = await supabase
        .from("dialer_campaigns")
        .insert({
          business_id: bizId,
          name: effectiveName,
          description: form.description || null,
          status: "active",
          max_attempts: form.max_attempts,
          amd_enabled: form.amd_enabled,
          max_concurrent_calls: form.max_concurrent,
          initial_script: form.initial_script,
          agent_id: form.agent_id,
        } as any)
        .select("id")
        .single();

      if (campErr) throw campErr;

      // 2. Fetch Selected Phones
      const ids = Array.from(selectedIds);
      const table = audienceType === "prospects" ? "territory_addresses" : "store_master";
      const allRecords: AudienceRow[] = [];
      const batchSize = 100;

      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const { data } = await supabase.from(table).select("id, store_name, phone").in("id", batch);
        if (data) allRecords.push(...(data as AudienceRow[]));
      }

      // 3. Seed Queue
      const items = allRecords
        .filter((r) => r.phone)
        .map((r, i) => ({
          business_id: bizId,
          phone_number: r.phone,
          contact_name: r.store_name,
          campaign_id: campaign.id,
          priority_score: Math.max(1, 100 - i),
          status: "queued",
        }));

      if (items.length === 0) throw new Error("No valid phones");

      for (let i = 0; i < items.length; i += 50) {
        await supabase.from("outbound_call_queue").insert(items.slice(i, i + 50) as any);
      }

      return { campaignId: campaign.id, count: items.length };
    },
    onSuccess: (data) => {
      toast.success(`Launched with ${data.count} contacts!`);
      queryClient.invalidateQueries({ queryKey: ["dialer-campaigns"] });
      // INTEGRATION: Switch to Console Mode immediately
      setActiveCampaignId(data.campaignId);
      setViewMode("console");
      // Reset Wizard
      setStep(0);
      setSelectedIds(new Set());
      setForm((prev) => ({ ...prev, name: "" }));
    },
    onError: (err: any) => toast.error(`Failed: ${err.message}`),
  });

  // --- CONSOLE (DASHBOARD) DATA ---
  const { data: campaignsList } = useQuery({
    queryKey: ["dialer-campaigns", bizId],
    queryFn: async () => {
      const { data } = await supabase
        .from("dialer_campaigns")
        .select("*")
        .eq("business_id", bizId)
        .order("created_at", { ascending: false });
      return (data as Campaign[]) || [];
    },
    enabled: viewMode === "console" && !!bizId,
  });

  const { data: callItems, isLoading: callsLoading } = useQuery({
    queryKey: ["campaign-calls", activeCampaignId],
    queryFn: async () => {
      if (!activeCampaignId) return [];
      const { data } = await supabase
        .from("outbound_call_queue")
        .select("*")
        .eq("campaign_id", activeCampaignId)
        .order("updated_at", { ascending: false });
      return (data as CallItem[]) || [];
    },
    enabled: viewMode === "console" && !!activeCampaignId,
    refetchInterval: 3000, // Live poll
  });

  // Auto-select most recent campaign if none selected
  useEffect(() => {
    if (viewMode === "console" && !activeCampaignId && campaignsList?.length) {
      setActiveCampaignId(campaignsList[0].id);
    }
  }, [viewMode, campaignsList, activeCampaignId]);

  const activeCampaign = campaignsList?.find((c) => c.id === activeCampaignId);
  const activeAgentName = availableAgents?.find((a) => a.id === activeCampaign?.agent_id)?.name;

  // Console Stats
  const stats = {
    total: callItems?.length || 0,
    queued: callItems?.filter((i) => i.status === "queued").length || 0,
    live: callItems?.filter((i) => i.status === "dialing" || i.status === "connected").length || 0,
    transferred: callItems?.filter((i) => i.status === "transferred").length || 0,
    completed:
      callItems?.filter((i) => ["completed", "failed", "no_answer", "voicemail"].includes(i.status)).length || 0,
  };

  // --- RENDER ---

  if (viewMode === "console") {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row gap-6 p-4 md:p-6 bg-slate-50/50 dark:bg-slate-950/50">
        {/* SIDEBAR: HISTORY */}
        <Card className="w-full md:w-80 flex flex-col h-full border-none shadow-md">
          <CardHeader className="pb-3 border-b bg-white dark:bg-slate-900 rounded-t-xl">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-primary" />
                History
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setViewMode("wizard")} className="gap-1 h-8">
                <Plus className="h-3.5 w-3.5" /> New
              </Button>
            </div>
            <CardDescription>Select campaign to monitor</CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 bg-white dark:bg-slate-900 rounded-b-xl">
            <ScrollArea className="h-full">
              <div className="flex flex-col p-2 gap-2">
                {campaignsList?.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">No campaigns yet.</p>
                ) : (
                  campaignsList?.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveCampaignId(c.id)}
                      className={`flex flex-col items-start gap-1 p-3 rounded-lg text-left transition-all border ${
                        activeCampaignId === c.id
                          ? "bg-primary/5 border-primary shadow-sm"
                          : "hover:bg-muted border-transparent hover:border-border"
                      }`}
                    >
                      <div className="flex w-full justify-between items-center">
                        <span
                          className={`font-semibold text-sm truncate ${activeCampaignId === c.id ? "text-primary" : ""}`}
                        >
                          {c.name}
                        </span>
                        <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-[10px] h-5">
                          {c.status}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(c.created_at), "MMM d, h:mm a")}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* MAIN: CONSOLE */}
        <div className="flex-1 flex flex-col gap-6 h-full overflow-hidden">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {activeCampaign?.name || "Campaign Dashboard"}
                </h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Badge variant="outline" className="gap-1">
                    <Bot className="h-3 w-3" /> Agent: {activeAgentName || "Default"}
                  </Badge>
                  {activeCampaign?.status === "active" && (
                    <span className="flex items-center gap-1 text-green-600 animate-pulse text-xs font-medium">
                      <Activity className="h-3 w-3" /> Live
                    </span>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()}>
                <RotateCcw className="h-4 w-4 mr-1" /> Refresh
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard label="Total Leads" value={stats.total} icon={Users} />
              <StatCard label="In Queue" value={stats.queued} icon={Clock} color="text-slate-600" />
              <StatCard label="Live Calls" value={stats.live} icon={Activity} color="text-blue-600" active />
              <StatCard label="Transferred" value={stats.transferred} icon={PhoneForwarded} color="text-purple-600" />
              <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} color="text-green-600" />
            </div>
          </div>

          <Card className="flex-1 border-none shadow-md flex flex-col overflow-hidden">
            <Tabs defaultValue="monitor" className="h-full flex flex-col">
              <div className="px-6 pt-4 pb-0 border-b">
                <TabsList>
                  <TabsTrigger value="monitor" className="gap-2">
                    <Activity className="h-4 w-4" /> Live Monitor
                  </TabsTrigger>
                  <TabsTrigger value="transcripts" className="gap-2">
                    <MessageSquare className="h-4 w-4" /> Transcripts & Logs
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="monitor" className="flex-1 p-0 m-0 overflow-hidden">
                <ScrollArea className="h-full p-4">
                  <div className="space-y-2">
                    {callsLoading ? (
                      <p className="text-center py-4 text-muted-foreground">Loading calls...</p>
                    ) : callItems?.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground">
                        No calls generated for this campaign yet.
                      </div>
                    ) : (
                      callItems?.map((item) => {
                        const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.queued;
                        const Icon = config.icon;
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <div className={`p-2 rounded-full ${config.color.split(" ")[0]}`}>
                                <Icon className={`h-4 w-4 ${config.color.split(" ")[1]}`} />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{item.contact_name || "Unknown"}</p>
                                <p className="text-xs text-muted-foreground font-mono">{item.phone_number}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {item.duration && (
                                <span className="text-xs text-muted-foreground font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                  {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, "0")}
                                </span>
                              )}
                              <Badge variant="outline" className={`${config.color} border-0`}>
                                {config.label}
                              </Badge>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent
                value="transcripts"
                className="flex-1 p-0 m-0 overflow-hidden bg-slate-50 dark:bg-slate-950/30"
              >
                <ScrollArea className="h-full p-4 md:p-6">
                  <div className="max-w-4xl mx-auto space-y-4">
                    {callItems
                      ?.filter((i) => ["completed", "transferred", "connected"].includes(i.status))
                      .map((item) => (
                        <Card key={item.id} className="overflow-hidden">
                          <CardHeader className="bg-muted/30 py-3 px-4 flex flex-row items-center justify-between space-y-0">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="bg-white">
                                {STATUS_CONFIG[item.status]?.label}
                              </Badge>
                              <span className="font-medium text-sm">{item.contact_name}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(item.updated_at), "h:mm a")}
                            </span>
                          </CardHeader>
                          <CardContent className="p-4 space-y-3 text-sm">
                            {/* Twilio Opener */}
                            <div className="flex gap-3">
                              <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                <Bot className="h-3 w-3 text-blue-600" />
                              </div>
                              <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-r-lg rounded-bl-lg max-w-[80%]">
                                <p className="text-xs text-blue-500 font-semibold mb-1">Twilio Opener</p>
                                <p>{activeCampaign?.initial_script}</p>
                              </div>
                            </div>
                            {/* Agent Handoff Visual */}
                            {item.status === "transferred" && (
                              <div className="flex gap-3">
                                <div className="h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                                  <Bot className="h-3 w-3 text-purple-600" />
                                </div>
                                <div className="bg-purple-50 dark:bg-purple-900/20 p-2.5 rounded-r-lg rounded-bl-lg max-w-[80%] border border-purple-100">
                                  <p className="text-xs text-purple-600 font-semibold mb-1">AI Agent</p>
                                  <p className="italic">Call successfully transferred to human agent.</p>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    {!callItems?.some((i) => ["completed", "transferred", "connected"].includes(i.status)) && (
                      <div className="text-center py-20 text-muted-foreground">No transcripts available yet.</div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    );
  }

  // --- WIZARD VIEW ---
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="w-full min-h-full max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Rocket className="h-6 w-6" /> Campaign Wizard
          </h2>
          <p className="text-sm text-muted-foreground">Create a dialer campaign, select your audience, and launch.</p>
        </div>
        <Button variant="outline" onClick={() => setViewMode("console")}>
          View Dashboard
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`flex flex-col md:flex-row items-center gap-1.5 text-xs font-medium transition-colors ${i === step ? "text-primary" : i < step ? "text-green-600" : "text-muted-foreground"}`}
            >
              <div className={`p-1.5 rounded-full ${i === step ? "bg-primary/10" : ""}`}>
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <div className="min-h-[400px]">
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Campaign Basics</CardTitle>
              <CardDescription>Name your campaign.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={effectiveName}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder={defaultName}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={3} />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Audience Type</Label>
                <RadioGroup
                  value={audienceType}
                  onValueChange={(v: any) => {
                    setAudienceType(v);
                    setSelectedIds(new Set());
                    setAudiencePage(1);
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="prospects" id="p" />
                    <Label htmlFor="p">Prospects</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="stores" id="s" />
                    <Label htmlFor="s">Active Stores</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search..."
                  value={audienceSearch}
                  onChange={(e) => {
                    setAudienceSearch(e.target.value);
                    setAudiencePage(1);
                  }}
                />
              </div>
              <div className="flex justify-between items-center">
                <Badge variant="secondary">{selectedIds.size} selected</Badge>{" "}
                {selectedIds.size > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                    Clear
                  </Button>
                )}
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 w-10">
                        <Checkbox checked={allPageSelected} onCheckedChange={toggleAllPage} />
                      </th>
                      <th className="p-3 text-left">Name</th>
                      <th className="p-3 text-left">Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audienceLoading ? (
                      <tr>
                        <td colSpan={3} className="p-4 text-center">
                          Loading...
                        </td>
                      </tr>
                    ) : (
                      audienceRows.map((row) => (
                        <tr
                          key={row.id}
                          className={`border-t hover:bg-muted/30 cursor-pointer ${selectedIds.has(row.id) ? "bg-primary/5" : ""}`}
                          onClick={() => toggleRow(row.id)}
                        >
                          <td className="p-3">
                            <Checkbox checked={selectedIds.has(row.id)} />
                          </td>
                          <td className="p-3">{row.store_name}</td>
                          <td className="p-3 text-muted-foreground">{row.phone}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <DataTablePagination
                currentPage={audiencePage}
                totalPages={audienceTotalPages}
                pageSize={PAGE_SIZE}
                totalItems={audienceTotalCount}
                onPageChange={setAudiencePage}
              />
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Dialing Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Attempts</Label>
                  <Input
                    type="number"
                    value={form.max_attempts}
                    onChange={(e) => update("max_attempts", parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Retry Backoff (min)</Label>
                  <Input
                    type="number"
                    value={form.retry_backoff_minutes}
                    onChange={(e) => update("retry_backoff_minutes", parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={form.call_window_start}
                    onChange={(e) => update("call_window_start", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={form.call_window_end}
                    onChange={(e) => update("call_window_end", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Max Concurrent Calls</Label>
                <Input
                  type="number"
                  value={form.max_concurrent}
                  onChange={(e) => update("max_concurrent", parseInt(e.target.value))}
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Switch checked={form.amd_enabled} onCheckedChange={(v) => update("amd_enabled", v)} />
                <Label>AMD Enabled</Label>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-6 flex gap-4">
                <div className="mt-1">
                  <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h4 className="font-semibold">1. Twilio Opener (TTS)</h4>
                    <p className="text-xs text-muted-foreground">Spoken immediately when answered.</p>
                  </div>
                  <Textarea
                    value={form.initial_script}
                    onChange={(e) => update("initial_script", e.target.value)}
                    rows={3}
                    placeholder="Hi, this is..."
                  />
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-center -my-3 relative z-10">
              <div className="bg-muted px-3 py-1 rounded-full text-xs border flex gap-1">
                <ArrowDown className="h-3 w-3" /> If Human Responds
              </div>
            </div>
            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="pt-6 flex gap-4">
                <div className="mt-1">
                  <div className="h-10 w-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                    <Bot className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h4 className="font-semibold">2. ElevenLabs Agent</h4>
                    <p className="text-xs text-muted-foreground">Handles the conversation.</p>
                  </div>
                  <Select value={form.agent_id} onValueChange={(v) => update("agent_id", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Agent..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAgents?.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Review Launch</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 border rounded bg-muted/20">
                  <p className="text-xs text-muted-foreground">Campaign</p>
                  <p className="font-medium">{effectiveName}</p>
                </div>
                <div className="p-3 border rounded bg-muted/20">
                  <p className="text-xs text-muted-foreground">Audience</p>
                  <p className="font-medium">{selectedIds.size} records</p>
                </div>
                <div className="p-3 border rounded bg-blue-50">
                  <p className="text-xs text-blue-600">Script</p>
                  <p className="truncate">{form.initial_script || "Missing"}</p>
                </div>
                <div className="p-3 border rounded bg-purple-50">
                  <p className="text-xs text-purple-600">Agent</p>
                  <p>{availableAgents?.find((a) => a.id === form.agent_id)?.name || "Missing"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => {
              if (step === 3 && (!form.initial_script || !form.agent_id)) return toast.error("Complete script setup");
              if (step === 1 && selectedIds.size === 0) return toast.error("Select audience");
              setStep((s) => s + 1);
            }}
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={() => launchMutation.mutate()}
            disabled={launchMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            <Rocket className="h-4 w-4 mr-1" /> {launchMutation.isPending ? "Launching..." : "Launch & Monitor"}
          </Button>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color = "text-foreground", active = false }: any) {
  return (
    <Card
      className={`border-none shadow-sm ${active ? "bg-primary/5 ring-1 ring-primary/20" : "bg-white dark:bg-slate-900"}`}
    >
      <CardContent className="p-4 flex flex-col items-center justify-center text-center">
        <div
          className={`p-2 rounded-full bg-slate-100 dark:bg-slate-800 mb-2 ${color.replace("text-", "bg-").replace("600", "100")}`}
        >
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</div>
      </CardContent>
    </Card>
  );
}
