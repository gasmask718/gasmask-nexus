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

// --- Config ---
type AudienceType = "prospects" | "stores" | "ambassadors" | "bikers" | "drivers" | "customers" | "custom";

interface Campaign {
  id: string;
  name: string;
  status: "active" | "paused" | "completed" | "draft";
  created_at: string;
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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  queued: { label: "Queued", color: "bg-muted text-muted-foreground", icon: Clock },
  dialing: { label: "Dialing", color: "bg-blue-500/15 text-blue-600", icon: Phone },
  connected: { label: "Live (AI)", color: "bg-green-500/15 text-green-600", icon: Bot },
  completed: { label: "Completed", color: "bg-green-500/10 text-green-600", icon: CheckCircle2 },
  failed: { label: "Failed", color: "bg-destructive/15 text-destructive", icon: XCircle },
};

const STEPS = [
  { label: "Campaign Info", icon: Target },
  { label: "Audience", icon: Users },
  { label: "Settings", icon: Settings },
  { label: "Script & AI", icon: FileText },
  { label: "Launch", icon: Rocket },
];

export default function CampaignWizardPage() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const effectiveBizId = currentBusiness?.id;

  // 1. ALL Hooks must be at the very top
  const [viewMode, setViewMode] = useState<"wizard" | "console">("wizard");
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [audienceType, setAudienceType] = useState<AudienceType>("prospects");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customNumbers, setCustomNumbers] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    initial_script: "",
    agent_id: VOICE_OPTIONS[0].id,
    amd_enabled: false,
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
      return data || [];
    },
    enabled: !!activeCampaignId,
    refetchInterval: 3000,
  });

  const callSids = useMemo(
    () => (callItems?.map((i: any) => i.twilio_call_sid?.trim()).filter(Boolean) as string[]) || [],
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
      let displaySpeaker = t.speaker === "ai" || t.speaker === "agent" ? "ai" : "caller";
      grouped[sid].push({ ...t, speaker: displaySpeaker });
    });
    return grouped;
  }, [transcripts]);

  const updateCampaignStatus = async (status: string) => {
    await supabase.from("dialer_campaigns").update({ status }).eq("id", activeCampaignId);
    queryClient.invalidateQueries({ queryKey: ["dialer-campaigns"] });
  };

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
      const items = customNumbers.map((n) => ({
        business_id: effectiveBizId,
        phone_number: n.phone,
        contact_name: n.name,
        campaign_id: campaign.id,
        status: "queued",
      }));
      await supabase.from("outbound_call_queue").insert(items as any);
      return campaign.id;
    },
    onSuccess: (id) => {
      setActiveCampaignId(id);
      setViewMode("console");
      toast.success("Launched!");
    },
  });

  const activeCampaign = campaignsList?.find((c) => c.id === activeCampaignId);

  // 2. NOW we can start the conditional UI returns
  if (viewMode === "console") {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row gap-6 p-6 bg-background">
        <Card className="w-full md:w-80 border shadow-sm bg-card">
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
          <CardContent className="p-2">
            {campaignsList?.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCampaignId(c.id)}
                className={`w-full flex flex-col items-start gap-1 p-3 rounded-lg text-left border mb-2 transition-all ${activeCampaignId === c.id ? "bg-primary/10 border-primary" : "hover:bg-muted/50 border-transparent"}`}
              >
                <span className="font-semibold text-sm truncate">{c.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {c.status}
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{activeCampaign?.name || "Dashboard"}</h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => updateCampaignStatus("paused")}>
                <Pause className="h-4 w-4 mr-1" /> Pause
              </Button>
              <Button variant="default" size="sm" onClick={() => updateCampaignStatus("active")}>
                <Play className="h-4 w-4 mr-1" /> Resume
              </Button>
            </div>
          </div>

          <Tabs defaultValue="transcripts" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="bg-muted w-fit">
              <TabsTrigger value="monitor">Queue</TabsTrigger>
              <TabsTrigger value="transcripts">Live Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="transcripts" className="flex-1 p-4 overflow-y-auto bg-muted/10">
              {callItems
                ?.filter((i: any) => i.twilio_call_sid)
                .map((item: any) => {
                  const sid = item.twilio_call_sid.trim();
                  const msgs = transcriptsByCall[sid] || [];
                  return (
                    <Card key={item.id} className="border bg-card mb-4 overflow-hidden">
                      <div className="p-3 border-b flex items-center justify-between bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-primary" />
                          <span className="font-bold text-sm">{item.contact_name}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          {item.status}
                        </Badge>
                      </div>
                      <div className="p-4 space-y-3 max-h-64 overflow-y-auto bg-background/50">
                        {msgs.length === 0 ? (
                          <p className="text-center text-xs italic opacity-50">Waiting for logs...</p>
                        ) : (
                          msgs.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.speaker === "ai" ? "justify-start" : "justify-end"}`}>
                              <div
                                className={`max-w-[85%] rounded-2xl px-4 py-2 text-xs shadow-sm ${msg.speaker === "ai" ? "bg-primary text-primary-foreground rounded-tl-none" : "bg-muted text-foreground rounded-tr-none border"}`}
                              >
                                <p className="text-[8px] font-bold uppercase mb-1 opacity-70">
                                  {msg.speaker === "ai" ? "Agent" : "Customer"}
                                </p>
                                {msg.text}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>
                  );
                })}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-10 space-y-8">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <Rocket className="h-8 w-8 text-primary" /> AI Campaign Wizard
      </h1>
      <Progress value={((step + 1) / STEPS.length) * 100} className="h-2" />

      {step === 0 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Label>Campaign Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Main Outreach 2026"
            />
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Goal: Book meetings."
            />
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-6 space-y-4">
              <h4 className="font-bold">AI Introductory Script</h4>
              <Textarea
                value={form.initial_script}
                onChange={(e) => setForm({ ...form, initial_script: e.target.value })}
                rows={4}
              />
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-6 space-y-4">
              <h4 className="font-bold">Voice Persona</h4>
              <Select value={form.agent_id} onValueChange={(v) => setForm({ ...form, agent_id: v })}>
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

      <footer className="flex justify-between pt-6 border-t">
        <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
          Back
        </Button>
        <Button
          onClick={() => (step === 4 ? launchMutation.mutate() : setStep((s) => s + 1))}
          disabled={launchMutation.isPending}
        >
          {step === 4 ? (launchMutation.isPending ? "Launching..." : "Launch Campaign") : "Next"}
        </Button>
      </footer>
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
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-[10px] uppercase font-bold opacity-50">{label}</div>
      </CardContent>
    </Card>
  );
}
