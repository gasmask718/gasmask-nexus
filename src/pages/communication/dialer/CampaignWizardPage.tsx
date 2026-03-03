import { useState, useMemo, useCallback } from "react";
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
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { DataTablePagination } from "@/components/crud/DataTablePagination";

const STEPS = [
  { label: "Campaign Info", icon: Target },
  { label: "Audience", icon: Users },
  { label: "Dialing Rules", icon: Settings },
  { label: "Script & AI Agent", icon: FileText },
  { label: "Launch", icon: Rocket },
];

const PAGE_SIZE = 25;

interface AudienceRow {
  id: string;
  store_name: string;
  phone: string | null;
  city: string | null;
  state: string | null;
}

// Define interface manually to fix TS errors since table might not exist in types yet
interface VoiceAgent {
  id: string;
  name: string;
  description: string | null;
  provider: string;
}

export default function CampaignWizardPage() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const bizId = currentBusiness?.id;

  const [step, setStep] = useState(0);

  // Audience selection state
  const [audienceType, setAudienceType] = useState<"prospects" | "stores">("prospects");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [audiencePage, setAudiencePage] = useState(1);
  const [audienceSearch, setAudienceSearch] = useState("");

  // Auto-generate campaign name
  const { data: campaignCount } = useQuery({
    queryKey: ["dialer-campaign-count"],
    queryFn: async () => {
      const { count } = await supabase.from("dialer_campaigns").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  // Fetch available ElevenLabs Agents
  const { data: availableAgents } = useQuery({
    queryKey: ["voice-agents"],
    queryFn: async () => {
      // Cast the table name to any to bypass strict schema checks
      const { data, error } = await supabase
        .from("voice_agents" as any)
        .select("id, name, description, provider")
        .eq("provider", "elevenlabs");

      if (error) {
        console.warn("Could not fetch agents", error);
        return [] as VoiceAgent[];
      }

      // FIXED: Double cast (unknown -> VoiceAgent[]) to suppress the conversion error
      return data as unknown as VoiceAgent[];
    },
  });

  const defaultName = useMemo(() => {
    const seq = (campaignCount ?? 0) + 1;
    return `CMPN-${String(seq).padStart(4, "0")}-OUTREACH`;
  }, [campaignCount]);

  const [form, setForm] = useState({
    name: "",
    description: "",
    max_attempts: 3,
    retry_backoff_minutes: 30,
    amd_enabled: true,
    call_window_start: "09:00",
    call_window_end: "17:00",
    max_concurrent: 5,
    // Scripting
    initial_script: "", // Twilio TTS
    agent_id: "", // ElevenLabs Agent
    voice_provider: "auto",
    voice_mode: "balanced",
  });

  // Set default name once loaded
  const effectiveName = form.name || defaultName;

  // Audience query with server-side pagination
  const { data: audienceData, isLoading: audienceLoading } = useQuery({
    queryKey: ["campaign-audience", audienceType, audiencePage, audienceSearch],
    queryFn: async () => {
      const from = (audiencePage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const table = audienceType === "prospects" ? "territory_addresses" : "store_master";

      let query = supabase.from(table).select("id, store_name, phone, city, state", { count: "exact" });

      if (audienceType === "stores") {
        query = query.is("deleted_at", null);
      }

      if (audienceSearch.trim()) {
        const s = audienceSearch.trim();
        query = query.or(`store_name.ilike.%${s}%,phone.ilike.%${s}%,city.ilike.%${s}%`);
      }

      query = query.order("store_name", { ascending: true }).range(from, to);
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as AudienceRow[], totalCount: count ?? 0 };
    },
  });

  const audienceRows = audienceData?.rows ?? [];
  const audienceTotalCount = audienceData?.totalCount ?? 0;
  const audienceTotalPages = Math.max(1, Math.ceil(audienceTotalCount / PAGE_SIZE));

  // Selection helpers
  const allPageSelected = audienceRows.length > 0 && audienceRows.every((r) => selectedIds.has(r.id));

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
      if (allPageSelected) {
        audienceRows.forEach((r) => next.delete(r.id));
      } else {
        audienceRows.forEach((r) => next.add(r.id));
      }
      return next;
    });
  }, [allPageSelected, audienceRows]);

  const handleAudienceTypeChange = (val: string) => {
    setAudienceType(val as "prospects" | "stores");
    setSelectedIds(new Set());
    setAudiencePage(1);
    setAudienceSearch("");
  };

  // Launch campaign mutation
  const launchMutation = useMutation({
    mutationFn: async () => {
      if (!bizId) throw new Error("No business");
      if (selectedIds.size === 0) throw new Error("No audience selected");

      // Create campaign
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
          // Save script config
          initial_script: form.initial_script,
          agent_id: form.agent_id,
        } as any)
        .select("id")
        .single();
      if (campErr) throw campErr;

      // Fetch selected records in batches for queue seeding
      const ids = Array.from(selectedIds);
      const table = audienceType === "prospects" ? "territory_addresses" : "store_master";
      const allRecords: AudienceRow[] = [];
      const batchSize = 100;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const { data } = await supabase.from(table).select("id, store_name, phone, city, state").in("id", batch);
        if (data) allRecords.push(...(data as AudienceRow[]));
      }

      const items = allRecords
        .filter((r) => r.phone)
        .map((r, i) => ({
          business_id: bizId,
          phone_number: r.phone,
          contact_name: r.store_name,
          store_id: audienceType === "stores" ? r.id : null,
          entity_type: audienceType === "prospects" ? "prospect" : "store",
          entity_id: r.id,
          source_reason: audienceType === "stores" ? "active_store" : "prospect",
          campaign_id: campaign.id,
          priority_score: Math.max(1, 100 - i),
          status: "queued",
        }));

      if (items.length === 0) throw new Error("No selected records have phone numbers");

      for (let i = 0; i < items.length; i += 50) {
        await supabase.from("outbound_call_queue").insert(items.slice(i, i + 50) as any);
      }

      return { campaignId: campaign.id, seeded: items.length };
    },
    onSuccess: (data) => {
      toast.success(`Campaign launched! ${data.seeded} contacts seeded to queue.`);
      queryClient.invalidateQueries({ queryKey: ["outbound-call-queue"] });
      queryClient.invalidateQueries({ queryKey: ["dialer-campaign-count"] });
      navigate("/communication/dialer-console");
    },
    onError: (err: any) => toast.error(`Launch failed: ${err.message}`),
  });

  const progress = ((step + 1) / STEPS.length) * 100;
  const update = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="w-full min-h-full max-w-4xl mx-auto space-y-6 pb-12">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Rocket className="h-6 w-6" /> Campaign Wizard
        </h2>
        <p className="text-sm text-muted-foreground">Create a dialer campaign, select your audience, and launch.</p>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`flex flex-col md:flex-row items-center gap-1.5 text-xs font-medium transition-colors ${
                i === step ? "text-primary" : i < step ? "text-green-600" : "text-muted-foreground"
              }`}
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

      {/* Step Content */}
      <div className="min-h-[400px]">
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Campaign Basics</CardTitle>
              <CardDescription>Name your campaign to easily identify it later.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Campaign Name *</Label>
                <Input
                  value={effectiveName}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder={defaultName}
                />
                <p className="text-xs text-muted-foreground">Auto-generated. Edit if needed.</p>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="Outreach for..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Audience Type</Label>
                <RadioGroup value={audienceType} onValueChange={handleAudienceTypeChange} className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="prospects" id="aud-prospects" />
                    <Label htmlFor="aud-prospects" className="cursor-pointer text-sm">
                      Prospects
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="stores" id="aud-stores" />
                    <Label htmlFor="aud-stores" className="cursor-pointer text-sm">
                      Active Stores
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by name, phone, or city..."
                  value={audienceSearch}
                  onChange={(e) => {
                    setAudienceSearch(e.target.value);
                    setAudiencePage(1);
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-sm">
                  {selectedIds.size} selected
                </Badge>
                {selectedIds.size > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                    Clear selection
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
                      <th className="p-3 text-left font-medium">Name</th>
                      <th className="p-3 text-left font-medium">Phone</th>
                      <th className="p-3 text-left font-medium">City</th>
                      <th className="p-3 text-left font-medium">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audienceLoading ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          Loading...
                        </td>
                      </tr>
                    ) : audienceRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          No records found
                        </td>
                      </tr>
                    ) : (
                      audienceRows.map((row) => (
                        <tr
                          key={row.id}
                          className={`border-t cursor-pointer hover:bg-muted/30 transition-colors ${selectedIds.has(row.id) ? "bg-primary/5" : ""}`}
                          onClick={() => toggleRow(row.id)}
                        >
                          <td className="p-3">
                            <Checkbox
                              checked={selectedIds.has(row.id)}
                              onCheckedChange={() => toggleRow(row.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="p-3 font-medium">{row.store_name || "—"}</td>
                          <td className="p-3 text-muted-foreground">{row.phone || "—"}</td>
                          <td className="p-3 text-muted-foreground">{row.city || "—"}</td>
                          <td className="p-3 text-muted-foreground">{row.state || "—"}</td>
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
              <CardTitle>Dialing Configuration</CardTitle>
              <CardDescription>Configure how the dialer behaves and connects calls.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Attempts</Label>
                  <Input
                    type="number"
                    value={form.max_attempts}
                    onChange={(e) => update("max_attempts", parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Retry Backoff (min)</Label>
                  <Input
                    type="number"
                    value={form.retry_backoff_minutes}
                    onChange={(e) => update("retry_backoff_minutes", parseInt(e.target.value) || 15)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Call Window Start</Label>
                  <Input
                    type="time"
                    value={form.call_window_start}
                    onChange={(e) => update("call_window_start", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Call Window End</Label>
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
                  onChange={(e) => update("max_concurrent", parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Switch checked={form.amd_enabled} onCheckedChange={(v) => update("amd_enabled", v)} />
                <Label className="text-sm">AMD (Answering Machine Detection)</Label>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold">Interaction Flow</h3>
              <p className="text-sm text-muted-foreground">
                Define how the call starts and who handles the conversation.
              </p>
            </div>

            {/* Step A: The Opener */}
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="mt-1">
                    <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h4 className="font-semibold text-base">1. The Opener (Twilio TTS)</h4>
                      <p className="text-xs text-muted-foreground">
                        This text is converted to speech by Twilio and played immediately when the contact picks up.
                      </p>
                    </div>
                    <Textarea
                      value={form.initial_script}
                      onChange={(e) => update("initial_script", e.target.value)}
                      rows={3}
                      className="resize-none"
                      placeholder="e.g., Hello, this is Alex from Company X. I'm calling to verify your store hours. Do you have a moment?"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Visual Flow Connector */}
            <div className="flex justify-center -my-3 relative z-10">
              <div className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 border">
                <ArrowDown className="h-3 w-3" /> If Human Responds
              </div>
            </div>

            {/* Step B: The Agent */}
            <Card className="border-l-4 border-l-purple-500 shadow-sm">
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="mt-1">
                    <div className="h-10 w-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                      <Bot className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h4 className="font-semibold text-base">2. The Closer (ElevenLabs Agent)</h4>
                      <p className="text-xs text-muted-foreground">
                        Once the contact responds to the opener, this AI Agent takes over the conversation flow.
                      </p>
                    </div>

                    <Select value={form.agent_id} onValueChange={(v) => update("agent_id", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an AI Agent..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableAgents?.map((agent: VoiceAgent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            <span className="font-medium">{agent.name}</span>
                            {agent.description && (
                              <span className="text-muted-foreground ml-2 text-xs">- {agent.description}</span>
                            )}
                          </SelectItem>
                        ))}
                        {(!availableAgents || availableAgents.length === 0) && (
                          <SelectItem value="default_agent" disabled>
                            No active agents found
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Launch Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 border rounded-lg bg-muted/20">
                  <p className="text-muted-foreground text-xs">Campaign</p>
                  <p className="font-medium">{effectiveName}</p>
                </div>
                <div className="p-3 border rounded-lg bg-muted/20">
                  <p className="text-muted-foreground text-xs">Audience</p>
                  <p className="font-medium">
                    {selectedIds.size} {audienceType}
                  </p>
                </div>
                <div className="p-3 border rounded-lg bg-blue-50/50 border-blue-100">
                  <p className="text-blue-600 text-xs font-medium">Initial Script (Twilio)</p>
                  <p className="font-medium truncate" title={form.initial_script}>
                    {form.initial_script || "—"}
                  </p>
                </div>
                <div className="p-3 border rounded-lg bg-purple-50/50 border-purple-100">
                  <p className="text-purple-600 text-xs font-medium">Handover Agent</p>
                  <p className="font-medium">
                    {availableAgents?.find((a: VoiceAgent) => a.id === form.agent_id)?.name ||
                      form.agent_id ||
                      "Not selected"}
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-muted-foreground text-xs">Max Attempts</p>
                  <p className="font-medium">{form.max_attempts}</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-muted-foreground text-xs">Concurrency</p>
                  <p className="font-medium">{form.max_concurrent}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => {
              if (step === 0 && !effectiveName.trim()) {
                toast.error("Campaign name is required");
                return;
              }
              if (step === 1 && selectedIds.size === 0) {
                toast.error("Select at least one record");
                return;
              }
              if (step === 3) {
                if (!form.initial_script.trim()) {
                  toast.error("Please enter an initial opening script");
                  return;
                }
                if (!form.agent_id) {
                  toast.error("Please select an AI Agent for handover");
                  return;
                }
              }
              setStep((s) => s + 1);
            }}
            className="gap-1"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={() => launchMutation.mutate()}
            disabled={launchMutation.isPending || !effectiveName.trim() || selectedIds.size === 0}
            className="gap-1 bg-green-600 hover:bg-green-700 text-white"
          >
            <Rocket className="h-4 w-4" />
            {launchMutation.isPending ? "Launching..." : `Launch Campaign`}
          </Button>
        )}
      </div>
    </div>
  );
}
