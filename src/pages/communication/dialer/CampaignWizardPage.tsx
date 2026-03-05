import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
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
  Activity,
  RotateCcw,
  Phone,
  PhoneForwarded,
  Clock,
  XCircle,
  Mic,
  LayoutDashboard,
  Plus,
  CheckSquare,
  Pause,
  Play,
  Square,
  X,
  UserPlus,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { DataTablePagination } from "@/components/crud/DataTablePagination";

type AudienceType = "prospects" | "stores" | "ambassadors" | "bikers" | "drivers" | "customers" | "custom";

interface AudienceRow {
  id: string;
  store_name: string;
  phone: string | null;
  city: string | null;
  state: string | null;
}

interface Campaign {
  id: string;
  name: string;
  status: "active" | "paused" | "completed" | "draft";
  dial_mode: "ai"; // Forced to AI
  created_at: string;
  initial_script: string;
  agent_id: string;
  business_id: string;
}

interface CallItem {
  id: string;
  phone_number: string;
  contact_name: string;
  status: string;
  twilio_call_sid?: string;
  duration?: number;
  transcript?: string;
  updated_at: string;
}

const VOICE_OPTIONS = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "Adam (Male, Deep)" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel (Female, Warm)" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella (Female, Soft)" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni (Male, Calm)" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli (Female, Young)" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh (Male, Deep)" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold (Male, Strong)" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Sam (Male, Raspy)" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam (Female, Raspy)" },
];

const AUDIENCE_TYPE_CONFIG: Record<AudienceType, any> = {
  prospects: {
    label: "Prospects",
    table: "territory_addresses",
    nameCol: "store_name",
    phoneCol: "phone",
    searchCols: ["store_name", "phone", "city"],
  },
  stores: {
    label: "Active Stores",
    table: "store_master",
    nameCol: "store_name",
    phoneCol: "phone",
    searchCols: ["store_name", "phone", "city"],
  },
  ambassadors: {
    label: "Ambassadors",
    table: "ambassadors",
    nameCol: "name",
    phoneCol: "phone_primary",
    searchCols: ["name", "phone_primary", "city"],
  },
  bikers: {
    label: "Bikers",
    table: "bikers",
    nameCol: "full_name",
    phoneCol: "phone",
    searchCols: ["full_name", "phone"],
  },
  drivers: {
    label: "Drivers",
    table: "drivers",
    nameCol: "full_name",
    phoneCol: "phone",
    searchCols: ["full_name", "phone"],
  },
  customers: {
    label: "Customers (CRM)",
    table: "crm_customers",
    nameCol: "name",
    phoneCol: "phone",
    searchCols: ["name", "phone", "city"],
  },
  custom: { label: "Custom Numbers", table: null, nameCol: "", phoneCol: "", searchCols: [] },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  queued: { label: "Queued", color: "bg-muted text-muted-foreground", icon: Clock },
  dialing: { label: "Dialing", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400", icon: Phone },
  connected: { label: "Live (AI)", color: "bg-green-500/15 text-green-600 dark:text-green-400", icon: Bot },
  completed: { label: "Completed", color: "bg-green-500/10 text-green-600 dark:text-green-500", icon: CheckCircle2 },
  no_answer: { label: "No Answer", color: "bg-amber-500/15 text-amber-600", icon: XCircle },
  failed: { label: "Failed", color: "bg-destructive/15 text-destructive", icon: XCircle },
  voicemail: { label: "Voicemail", color: "bg-orange-500/15 text-orange-600", icon: Mic },
};

const STEPS = [
  { label: "Campaign Info", icon: Target },
  { label: "Audience", icon: Users },
  { label: "Settings", icon: Settings },
  { label: "Script & AI", icon: FileText },
  { label: "Launch", icon: Rocket },
];

const PAGE_SIZE = 25;

export default function CampaignWizardPage() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const effectiveBizId = currentBusiness?.id;

  const [viewMode, setViewMode] = useState<"wizard" | "console">("wizard");
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [audienceType, setAudienceType] = useState<AudienceType>("prospects");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [audiencePage, setAudiencePage] = useState(1);
  const [audienceSearch, setAudienceSearch] = useState("");
  const [isAudienceConfirmed, setIsAudienceConfirmed] = useState(false);
  const [customNumbers, setCustomNumbers] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    dial_mode: "ai",
    max_attempts: 3,
    retry_backoff_minutes: 30,
    amd_enabled: false,
    call_window_start: "09:00",
    call_window_end: "17:00",
    max_concurrent: 5,
    initial_script: "",
    agent_id: VOICE_OPTIONS[0].id,
  });

  const processQueue = useCallback(
    async (campaignId: string) => {
      const { data: queueItem } = await supabase
        .from("outbound_call_queue")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("status", "queued")
        .limit(1)
        .maybeSingle();
      if (!queueItem) return;
      await supabase
        .from("outbound_call_queue")
        .update({ status: "dialing", dialing_started_at: new Date().toISOString() })
        .eq("id", queueItem.id);
      await supabase.functions.invoke("twilio-outbound-call", {
        body: { queue_item_id: queueItem.id, business_id: effectiveBizId },
      });
      queryClient.invalidateQueries({ queryKey: ["campaign-calls", campaignId] });
    },
    [effectiveBizId, queryClient],
  );

  useEffect(() => {
    let interval: any;
    if (viewMode === "console" && activeCampaignId) {
      interval = setInterval(() => {
        supabase
          .from("dialer_campaigns")
          .select("status")
          .eq("id", activeCampaignId)
          .single()
          .then(({ data }) => {
            if (data?.status === "active") processQueue(activeCampaignId);
          });
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [viewMode, activeCampaignId, processQueue]);

  // --- Data Queries ---
  const { data: campaignsList } = useQuery({
    queryKey: ["dialer-campaigns", effectiveBizId],
    queryFn: async () => {
      const { data } = await supabase
        .from("dialer_campaigns")
        .select("*")
        .eq("business_id", effectiveBizId!)
        .order("created_at", { ascending: false });
      return (data as Campaign[]) || [];
    },
    enabled: !!effectiveBizId,
  });

  const { data: callItems } = useQuery({
    queryKey: ["campaign-calls", activeCampaignId],
    queryFn: async () => {
      const { data } = await supabase
        .from("outbound_call_queue")
        .select("*")
        .eq("campaign_id", activeCampaignId!)
        .order("updated_at", { ascending: false });
      return (data as CallItem[]) || [];
    },
    enabled: !!activeCampaignId,
    refetchInterval: 3000,
  });

  const callSids = useMemo(
    () => (callItems?.map((i) => i.twilio_call_sid?.trim()).filter(Boolean) as string[]) || [],
    [callItems],
  );

  const { data: transcripts } = useQuery({
    queryKey: ["campaign-transcripts", activeCampaignId, callSids],
    queryFn: async () => {
      if (callSids.length === 0) return [];
      const { data } = await supabase
        .from("live_call_transcripts")
        .select("*")
        .in("call_sid", callSids)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: callSids.length > 0,
    refetchInterval: 2000,
  });

  const transcriptsByCall = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    if (!transcripts) return grouped;
    transcripts.forEach((t: any) => {
      const sid = t.call_sid.trim();
      if (!grouped[sid]) grouped[sid] = [];

      let displaySpeaker = t.speaker;
      if (t.speaker === "ai" || t.speaker === "agent") displaySpeaker = "ai";
      if (t.speaker === "caller" || t.speaker === "user") displaySpeaker = "caller";

      grouped[sid].push({ ...t, speaker: displaySpeaker });
    });
    return grouped;
  }, [transcripts]);

  const updateCampaignStatus = async (status: string) => {
    await supabase.from("dialer_campaigns").update({ status }).eq("id", activeCampaignId);
    queryClient.invalidateQueries({ queryKey: ["dialer-campaigns"] });
  };

  const activeCampaign = campaignsList?.find((c) => c.id === activeCampaignId);
  const stats = {
    total: callItems?.length || 0,
    queued: callItems?.filter((i) => i.status === "queued").length || 0,
    live: callItems?.filter((i) => i.status === "dialing" || i.status === "connected").length || 0,
    completed:
      callItems?.filter((i) => ["completed", "failed", "no_answer", "voicemail"].includes(i.status)).length || 0,
  };

  if (viewMode === "console") {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row gap-6 p-4 md:p-6 bg-background text-foreground">
        <Card className="w-full md:w-80 flex flex-col h-full border shadow-sm bg-card">
          <CardHeader className="pb-3 border-b">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-primary" /> History
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setViewMode("wizard")}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <ScrollArea className="h-full">
              <div className="flex flex-col p-2 gap-2">
                {campaignsList?.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCampaignId(c.id)}
                    className={`flex flex-col items-start gap-1 p-3 rounded-lg text-left transition-all border ${activeCampaignId === c.id ? "bg-primary/10 border-primary" : "hover:bg-muted/50 border-transparent"}`}
                  >
                    <span className="font-semibold text-sm truncate">{c.name}</span>
                    <Badge variant="outline" className="text-[10px] h-5">
                      {c.status}
                    </Badge>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="flex-1 flex flex-col gap-6 h-full overflow-hidden">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold tracking-tight">{activeCampaign?.name || "Campaign Dashboard"}</h1>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => updateCampaignStatus("paused")}>
                  <Pause className="h-4 w-4 mr-1" /> Pause
                </Button>
                <Button variant="default" size="sm" onClick={() => updateCampaignStatus("active")}>
                  <Play className="h-4 w-4 mr-1" /> Resume
                </Button>
                <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Refresh
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Leads" value={stats.total} icon={Users} />
              <StatCard label="In Queue" value={stats.queued} icon={Clock} color="text-muted-foreground" />
              <StatCard label="Live Calls" value={stats.live} icon={Activity} color="text-blue-600" active />
              <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} color="text-green-600" />
            </div>
          </div>

          <Card className="flex-1 border shadow-sm flex flex-col overflow-hidden bg-card">
            <Tabs defaultValue="monitor" className="h-full flex flex-col">
              <div className="px-6 pt-4 pb-0 border-b bg-muted/20">
                <TabsList className="bg-muted">
                  <TabsTrigger value="monitor">Live Monitor</TabsTrigger>
                  <TabsTrigger value="transcripts">Logs</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="monitor" className="flex-1 p-0 m-0 overflow-hidden bg-background">
                <ScrollArea className="h-full p-4">
                  {callItems?.map((item) => {
                    const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.queued;
                    const Icon = config.icon;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors mb-2"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full bg-muted/50 ${config.color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{item.contact_name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground font-mono">{item.phone_number}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={`${config.color} border-0`}>
                          {config.label}
                        </Badge>
                      </div>
                    );
                  })}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="transcripts" className="flex-1 p-4 m-0 overflow-hidden bg-muted/10">
                <ScrollArea className="h-full">
                  {/* NEW IMPLEMENTED CODE BLOCK START */}
                  {callItems
                    ?.filter((i: any) => i.twilio_call_sid)
                    .map((item: any) => {
                      const sid = item.twilio_call_sid.trim();
                      const msgs = transcriptsByCall[sid] || [];

                      return (
                        <Card key={item.id} className="border bg-card mb-4">
                          <div className="p-3 border-b flex items-center justify-between bg-muted/30">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-primary" />
                              <span className="font-bold text-sm">{item.contact_name || "Unknown"}</span>
                              <Badge variant="secondary" className="font-mono text-[10px]">
                                {sid.substring(0, 8)}...
                              </Badge>
                            </div>
                            <Badge className={STATUS_CONFIG[item.status]?.color}>{item.status}</Badge>
                          </div>
                          <div className="p-4 space-y-3 max-h-64 overflow-y-auto bg-background/50">
                            {msgs.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-4 opacity-50">
                                <Clock className="h-8 w-8 animate-spin mb-2" />
                                <p className="text-xs italic">Waiting for connection logs...</p>
                              </div>
                            ) : (
                              msgs.map((msg, idx) => (
                                <div
                                  key={idx}
                                  className={`flex ${msg.speaker === "ai" ? "justify-start" : "justify-end"}`}
                                >
                                  <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-2 shadow-sm ${
                                      msg.speaker === "ai"
                                        ? "bg-primary text-primary-foreground rounded-tl-none"
                                        : "bg-muted text-foreground rounded-tr-none border"
                                    }`}
                                  >
                                    <p className="text-[10px] font-bold uppercase mb-1 opacity-70">
                                      {msg.speaker === "ai" ? "Agent" : "Customer"}
                                    </p>
                                    <p className="text-sm leading-relaxed">{msg.text}</p>
                                    <p className="text-[9px] mt-1 opacity-50 text-right">
                                      {format(new Date(msg.created_at), "HH:mm:ss")}
                                    </p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  {/* NEW IMPLEMENTED CODE BLOCK END */}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    );
  }

  // --- Wizard Logic ---
  const addCustomNumber = () => {
    /* Logic from your code */
  };
  const toggleRow = (id: string) => {
    /* Logic from your code */
  };
  const toggleAllPage = () => {
    /* Logic from your code */
  };
  const update = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const launchMutation = useMutation({
    mutationFn: async () => {
      const { data: campaign } = await supabase
        .from("dialer_campaigns")
        .insert({
          business_id: effectiveBizId,
          name: form.name || `CMPN-${Date.now()}`,
          status: "active",
          dial_mode: "ai",
          initial_script: form.initial_script,
          agent_id: form.agent_id,
          amd_enabled: form.amd_enabled,
        } as any)
        .select("id")
        .single();
      if (!campaign) throw new Error("Launch failed");
      const items =
        audienceType === "custom"
          ? customNumbers.map((n) => ({
              business_id: effectiveBizId,
              phone_number: n.phone,
              contact_name: n.name,
              campaign_id: campaign.id,
              status: "queued",
            }))
          : [];
      await supabase.from("outbound_call_queue").insert(items as any);
      return campaign.id;
    },
    onSuccess: (id) => {
      setActiveCampaignId(id);
      setViewMode("console");
      toast.success("Launched!");
    },
  });

  return (
    <div className="w-full min-h-full max-w-4xl mx-auto space-y-6 pb-12 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Rocket className="h-6 w-6" /> AI Campaign Wizard
        </h2>
        <Button variant="outline" onClick={() => setViewMode("console")}>
          Dashboard
        </Button>
      </div>
      <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />
      <div className="min-h-[400px]">
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Campaign Basics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} />
            </CardContent>
          </Card>
        )}
        {step === 3 && (
          <div className="space-y-6">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-6 space-y-3">
                <Label>AI Introductory Script</Label>
                <Textarea
                  value={form.initial_script}
                  onChange={(e) => update("initial_script", e.target.value)}
                  rows={4}
                />
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="pt-6 space-y-3">
                <Label>AI Voice Setting</Label>
                <Select value={form.agent_id} onValueChange={(v) => update("agent_id", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_OPTIONS.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
          Back
        </Button>
        <Button onClick={() => (step === 4 ? launchMutation.mutate() : setStep((s) => s + 1))}>
          {step === 4 ? "Launch & Monitor" : "Next"}
        </Button>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color = "text-foreground", active = false }: any) {
  return (
    <Card className={`border shadow-sm bg-card ${active ? "bg-primary/5 border-primary/20" : ""}`}>
      <CardContent className="p-4 flex flex-col items-center justify-center text-center">
        <div className={`p-2 rounded-full mb-2 bg-muted ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</div>
      </CardContent>
    </Card>
  );
}
