import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { BlandAgentWebhookDirectory } from "@/components/communication/BlandAgentWebhookDirectory";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ManualCampaignCallModal } from "@/components/communication/ManualCampaignCallModal";

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
  Trash2,
  ArrowRightLeft,
  Zap,
} from "lucide-react";

import BatchDialerPanel from "@/components/dialer/BatchDialerPanel";
import { CallTimelineDrawer } from "@/components/dialer/CallTimelineDrawer";

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
  dial_mode: "ai" | "manual";
  created_at: string;
  initial_script: string;
  agent_id: string;
  business_id: string;
}

interface CallItem {
  id: string;

  phone_number: string;

  contact_name: string;

  status:
    | "queued"
    | "dialing"
    | "ringing"
    | "intro_playing"
    | "awaiting_input"
    | "answered"
    | "connected"
    | "voicemail"
    | "voicemail_detected"
    | "voicemail_left"
    | "no_answer"
    | "no_input"
    | "declined"
    | "bridging"
    | "bridged"
    | "in_ai_conversation"
    | "transferred"
    | "failed_bridge"
    | "failed"
    | "completed";

  duration?: number;

  transcript?: string;

  updated_at: string;

  answered_by?: string | null;
  confirmation_method?: string | null;
  dial_status?: string | null;
  bridge_failed_reason?: string | null;
  attempt_count?: number | null;
}

// Bland AI agents are fetched from DB — see useQuery below
// Script templates mapped to their corresponding Bland AI agent_type
const SCRIPT_TEMPLATES = [
  {
    id: "intro_sales",
    label: "Sales-Outreach",
    agentType: "sales-outreach",
    script:
      "Hi, this is {{agent_name}} calling from {{business_name}}. I'm reaching out because we have some exciting new products that I think would be a great fit for your store. Do you have a quick moment to chat?",
  },
  {
    id: "follow_up",
    label: "Follow-up Call",
    agentType: "follow-up",
    script:
      "Hi, this is {{agent_name}} from {{business_name}}. I'm following up on our previous conversation. I wanted to check in and see if you had any questions or if you're ready to place an order.",
  },
  {
    id: "reactivation",
    label: "Reactivation / Win-back",
    agentType: "reactivation",
    script:
      "Hi, this is {{agent_name}} from {{business_name}}. We noticed it's been a while since your last order and wanted to reach out. We have some new offers and would love to get you back on board. Can I share what's new?",
  },
  {
    id: "inventory_check",
    label: "Inventory Check",
    agentType: "inventory-check",
    script:
      "Hi, this is {{agent_name}} from {{business_name}}. I'm calling to do a quick inventory check on our products. Do you have a moment to confirm your current stock levels?",
  },
];

const AUDIENCE_TYPE_CONFIG: Record<
  AudienceType,
  { label: string; table: string | null; nameCol: string; phoneCol: string; searchCols: string[] }
> = {
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
  ringing: { label: "Ringing", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400", icon: Phone },
  intro_playing: { label: "Intro", color: "bg-indigo-500/15 text-indigo-600", icon: MessageSquare },
  awaiting_input: { label: "Awaiting Input", color: "bg-amber-500/15 text-amber-600", icon: Clock },
  answered: { label: "Answered", color: "bg-green-500/15 text-green-600 dark:text-green-400", icon: Phone },
  connected: { label: "Live", color: "bg-green-500/15 text-green-600 dark:text-green-400", icon: Bot },
  bridging: { label: "Bridging…", color: "bg-purple-500/15 text-purple-600", icon: PhoneForwarded },
  bridged: { label: "Connected", color: "bg-green-500/15 text-green-600 dark:text-green-400", icon: PhoneForwarded },
  in_ai_conversation: { label: "AI Active", color: "bg-emerald-500/15 text-emerald-600", icon: Bot },
  transferred: { label: "Transferred", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400", icon: PhoneForwarded },
  completed: { label: "Completed", color: "bg-green-500/10 text-green-600 dark:text-green-500", icon: CheckCircle2 },
  declined: { label: "Declined", color: "bg-orange-500/15 text-orange-600", icon: XCircle },
  no_input: { label: "No Input", color: "bg-amber-500/15 text-amber-600", icon: XCircle },
  no_answer: { label: "No Answer", color: "bg-amber-500/15 text-amber-600", icon: XCircle },
  voicemail: { label: "Voicemail", color: "bg-orange-500/15 text-orange-600", icon: Mic },
  voicemail_detected: { label: "Voicemail (detected)", color: "bg-orange-500/15 text-orange-600", icon: Mic },
  voicemail_left: { label: "Voicemail Left", color: "bg-orange-500/15 text-orange-600", icon: Mic },
  failed_bridge: { label: "Bridge Failed", color: "bg-destructive/15 text-destructive", icon: XCircle },
  failed: { label: "Failed", color: "bg-destructive/15 text-destructive", icon: XCircle },
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

  const contextBizId = currentBusiness?.id;

  const { data: fallbackBiz } = useQuery({
    queryKey: ["fallback-business"],

    queryFn: async () => {
      const { data } = await supabase.from("businesses").select("id").limit(1).maybeSingle();

      return data;
    },

    enabled: !contextBizId,
  });

  // Fetch Bland AI agents from DB for AI agent picker
  const { data: blandAgents = [] } = useQuery({
    queryKey: ["bland-agents-campaign"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bland_agent_webhooks" as any)
        .select("id, agent_name, agent_type, description, is_active, default_voice")
        .eq("is_active", true)
        .order("sort_order");
      return (data || []) as unknown as Array<{
        id: string;
        agent_name: string;
        agent_type: string;
        description: string | null;
        is_active: boolean;
        default_voice: string | null;
      }>;
    },
  });

  const effectiveBizId = contextBizId || fallbackBiz?.id;

  const [viewMode, setViewMode] = useState<"wizard" | "console">("wizard");

  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  const [isManualCallModalOpen, setIsManualCallModalOpen] = useState(false);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(new Set());
  const [isArchiving, setIsArchiving] = useState(false);
  const [timelineQueueItemId, setTimelineQueueItemId] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  const recoverStuckCalls = useCallback(async () => {
    if (!effectiveBizId) return;
    setIsRecovering(true);
    try {
      const { data, error } = await supabase.functions.invoke("recover-dialer", {
        body: { business_id: effectiveBizId },
      });
      if (error) throw error;
      const recovered = (data as any)?.queue_recovered || 0;
      toast.success(`Recovered ${recovered} stuck call${recovered === 1 ? "" : "s"}`);
      queryClient.invalidateQueries({ queryKey: ["campaign-calls"] });
    } catch (e: any) {
      toast.error(`Recover failed: ${e.message}`);
    } finally {
      setIsRecovering(false);
    }
  }, [effectiveBizId, queryClient]);

  const [step, setStep] = useState(0);

  const [audienceType, setAudienceType] = useState<AudienceType>("prospects");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [audiencePage, setAudiencePage] = useState(1);

  const [audienceSearch, setAudienceSearch] = useState("");

  const [isAudienceConfirmed, setIsAudienceConfirmed] = useState(false);

  const [customNumbers, setCustomNumbers] = useState<{ id: string; phone: string; name: string }[]>([]);

  const [customPhoneInput, setCustomPhoneInput] = useState("");

  const [customNameInput, setCustomNameInput] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    dial_mode: "ai" as "ai" | "manual",
    max_attempts: 3,
    retry_backoff_minutes: 30,
    amd_enabled: false,

    call_window_start: "09:00",

    call_window_end: "17:00",

    max_concurrent: 5,

    initial_script: "",

    agent_id: "",
  });

  const dispatchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Active in-flight calls (used for concurrency cap).
  const inFlightStates = [
    "dialing", "ringing", "intro_playing", "awaiting_input",
    "answered", "connected", "bridging", "bridged", "in_ai_conversation",
  ];

  const processQueue = useCallback(
    async (campaignId: string) => {
      // Read full dispatcher config in one shot.
      const { data: campData } = await supabase
        .from("dialer_campaigns")
        .select(
          "dial_mode, agent_id, initial_script, bland_agent_id, agent_provider, " +
          "max_concurrent_calls, cps_limit, dispatch_jitter_ms",
        )
        .eq("id", campaignId)
        .single();
      if (!campData) return;
      const dialMode = (campData as any).dial_mode || "ai";
      const maxConcurrent = Math.max(1, (campData as any).max_concurrent_calls || 1);
      const cps = Math.max(1, (campData as any).cps_limit || 2);
      const jitterMs = Math.max(0, (campData as any).dispatch_jitter_ms || 500);

      // Concurrency cap: how many calls are currently in-flight?
      const { count: inFlight } = await supabase
        .from("outbound_call_queue")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .in("status", inFlightStates);
      const slots = Math.max(0, maxConcurrent - (inFlight || 0));
      if (slots === 0) return;

      // Throughput cap (CPS): how many calls were dispatched in the last 1s?
      // We approximate by counting dialing_started_at in the last second.
      const oneSecAgo = new Date(Date.now() - 1000).toISOString();
      const { count: lastSec } = await supabase
        .from("outbound_call_queue")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .gte("dialing_started_at", oneSecAgo);
      const cpsBudget = Math.max(0, cps - (lastSec || 0));
      const toDispatch = Math.min(slots, cpsBudget);
      if (toDispatch === 0) return;

      // Pull queued + retry-eligible rows, oldest first.
      const nowIso = new Date().toISOString();
      const { data: candidates } = await supabase
        .from("outbound_call_queue")
        .select("id, phone_number, contact_name, status, next_retry_at")
        .eq("campaign_id", campaignId)
        .in("status", ["queued", "failed_bridge"])
        .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
        .order("priority_score", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(toDispatch);

      if (!candidates || candidates.length === 0) return;

      // Resolve agent_type once per pass.
      let agentType = "sales-outreach";
      if (dialMode !== "manual") {
        const blandAgentRowId = (campData as any).bland_agent_id || (campData as any).agent_id;
        if (blandAgentRowId) {
          const { data: a } = await supabase
            .from("bland_agent_webhooks" as any)
            .select("agent_type")
            .eq("id", blandAgentRowId)
            .maybeSingle();
          if (a && (a as any).agent_type) agentType = (a as any).agent_type;
        }
      }

      // Dispatch sequentially with jitter so we never burst above CPS.
      for (const queueItem of candidates) {
        // Optimistic lock — only succeeds if row is still queued/failed_bridge.
        const { data: locked, error: updateErr } = await supabase
          .from("outbound_call_queue")
          .update({
            status: "dialing",
            dialing_started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", queueItem.id)
          .in("status", ["queued", "failed_bridge"])
          .select("id")
          .maybeSingle();
        if (updateErr || !locked) continue; // someone else grabbed it

        try {
          let response: any;
          if (dialMode === "manual") {
            response = await supabase.functions.invoke("twilio-manual-call", {
              body: { queue_item_id: queueItem.id, business_id: effectiveBizId },
            });
          } else {
            response = await supabase.functions.invoke("bland-agent-trigger", {
              body: {
                phone_number: queueItem.phone_number,
                agent_type: agentType,
                prompt: (campData as any)?.initial_script || undefined,
                queue_item_id: queueItem.id,
                campaign_id: campaignId,
              },
            });
          }
          if (response.error || (response.data && response.data.error)) {
            throw new Error(response.error?.message || response.data?.error);
          }
        } catch (err: any) {
          console.error("Dispatcher Exception:", err);
          toast.error(`Call logic failed: ${err.message}`);
          await supabase
            .from("outbound_call_queue")
            .update({
              status: "failed",
              last_error_severity: "error",
              updated_at: new Date().toISOString(),
            })
            .eq("id", queueItem.id);
        }

        // Jitter so we never burst the API.
        if (jitterMs > 0) {
          await new Promise((r) => setTimeout(r, jitterMs + Math.random() * jitterMs));
        }
      }

      queryClient.invalidateQueries({ queryKey: ["campaign-calls", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["dialer-campaigns"] });
    },
    [effectiveBizId, queryClient],
  );

  // NOTE (2026-04-29): The browser-side dispatcher loop has been retired.
  // Dispatching is now driven server-side by the `dispatch-campaign-tick` edge
  // function, scheduled via pg_cron. This file keeps a no-op effect so realtime
  // subscriptions still mount when the console opens.
  useEffect(() => {
    if (viewMode === "console" && activeCampaignId) {
      // No client polling — server handles dispatch.
    }
    return () => {
      if (dispatchIntervalRef.current) clearInterval(dispatchIntervalRef.current);
    };
  }, [viewMode, activeCampaignId]);

  // Realtime: keep the live monitor in sync with Twilio + Bland webhook updates.
  useEffect(() => {
    if (viewMode !== "console" || !activeCampaignId) return;
    const channel = supabase
      .channel(`campaign-live-${activeCampaignId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "outbound_call_queue", filter: `campaign_id=eq.${activeCampaignId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["campaign-calls", activeCampaignId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dialer_call_events", filter: `campaign_id=eq.${activeCampaignId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["campaign-calls", activeCampaignId] });
          queryClient.invalidateQueries({ queryKey: ["campaign-transcripts", activeCampaignId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewMode, activeCampaignId, queryClient]);

  const updateCampaignStatus = async (status: "active" | "paused" | "completed") => {
    if (!activeCampaignId) return;

    const { error } = await supabase.from("dialer_campaigns").update({ status }).eq("id", activeCampaignId);

    if (error) toast.error("Failed to update status");
    else {
      toast.success(`Campaign ${status}`);

      queryClient.invalidateQueries({ queryKey: ["dialer-campaigns"] });
    }
  };

  const { data: campaignCount } = useQuery({
    queryKey: ["dialer-campaign-count"],

    queryFn: async () => {
      const { count } = await supabase.from("dialer_campaigns").select("id", { count: "exact", head: true });

      return count ?? 0;
    },
  });

  const defaultName = useMemo(() => {
    const seq = (campaignCount ?? 0) + 1;

    return `CMPN-${String(seq).padStart(4, "0")}-OUTREACH`;
  }, [campaignCount]);

  const effectiveName = form.name || defaultName;

  const audienceConfig = AUDIENCE_TYPE_CONFIG[audienceType];

  const { data: audienceData, isLoading: audienceLoading } = useQuery({
    queryKey: ["campaign-audience", audienceType, audiencePage, audienceSearch],

    queryFn: async () => {
      if (!audienceConfig.table) return { rows: [], totalCount: 0 };

      const from = (audiencePage - 1) * PAGE_SIZE,
        to = from + PAGE_SIZE - 1;

      let query = supabase

        .from(audienceConfig.table as any)

        .select(`id, ${audienceConfig.nameCol}, ${audienceConfig.phoneCol}`, { count: "exact" });

      if (audienceType === "stores") query = query.is("deleted_at", null);

      if (audienceSearch.trim())
        query = query.or(audienceConfig.searchCols.map((c) => `${c}.ilike.%${audienceSearch.trim()}%`).join(","));

      const { data, error, count } = await query.order(audienceConfig.nameCol, { ascending: true }).range(from, to);

      if (error) throw error;

      const rows: AudienceRow[] = (data ?? []).map((r: any) => ({
        id: r.id,

        store_name: r[audienceConfig.nameCol] || "Unknown",

        phone: r[audienceConfig.phoneCol] || null,

        city: null,

        state: null,
      }));

      return { rows, totalCount: count ?? 0 };
    },

    enabled: viewMode === "wizard" && audienceType !== "custom",
  });

  const audienceRows = audienceType === "custom" ? [] : (audienceData?.rows ?? []);

  const audienceTotalCount = audienceType === "custom" ? customNumbers.length : (audienceData?.totalCount ?? 0);

  const audienceTotalPages = Math.max(1, Math.ceil(audienceTotalCount / PAGE_SIZE));

  const allPageSelected = audienceRows.length > 0 && audienceRows.every((r) => selectedIds.has(r.id));

  const addCustomNumber = () => {
    const phone = customPhoneInput.trim().replace(/\D/g, "");

    if (phone.length < 10) return toast.error("Enter a valid phone number (10+ digits)");

    const formatted =
      phone.length === 10 ? `+1${phone}` : phone.startsWith("1") && phone.length === 11 ? `+${phone}` : `+${phone}`;

    if (customNumbers.some((n) => n.phone === formatted)) return toast.error("Number already added");

    setCustomNumbers((prev) => [
      ...prev,

      { id: crypto.randomUUID(), phone: formatted, name: customNameInput.trim() || formatted },
    ]);

    setCustomPhoneInput("");

    setCustomNameInput("");

    setIsAudienceConfirmed(false);
  };

  const removeCustomNumber = (id: string) => {
    setCustomNumbers((prev) => prev.filter((n) => n.id !== id));

    setIsAudienceConfirmed(false);
  };

  const handleBulkPaste = (text: string) => {
    const lines = text

      .split(/[\n,]+/)

      .map((l) => l.trim())

      .filter(Boolean);

    const newNumbers: typeof customNumbers = [];

    for (const line of lines) {
      const phone = line.replace(/\D/g, "");

      if (phone.length < 10) continue;

      const formatted =
        phone.length === 10 ? `+1${phone}` : phone.startsWith("1") && phone.length === 11 ? `+${phone}` : `+${phone}`;

      if (!customNumbers.some((n) => n.phone === formatted) && !newNumbers.some((n) => n.phone === formatted))
        newNumbers.push({ id: crypto.randomUUID(), phone: formatted, name: formatted });
    }

    if (newNumbers.length > 0) {
      setCustomNumbers((prev) => [...prev, ...newNumbers]);

      toast.success(`Added ${newNumbers.length} numbers`);
    } else toast.error("No valid new numbers found");

    setIsAudienceConfirmed(false);
  };

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });

    setIsAudienceConfirmed(false);
  }, []);

  const toggleAllPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (allPageSelected) audienceRows.forEach((r) => next.delete(r.id));
      else audienceRows.forEach((r) => next.add(r.id));

      return next;
    });

    setIsAudienceConfirmed(false);
  }, [allPageSelected, audienceRows]);

  const handleConfirmSelection = () => {
    const t = audienceType === "custom" ? customNumbers.length : selectedIds.size;

    if (t === 0) return toast.error("Please select at least one record.");

    setIsAudienceConfirmed(true);

    toast.success(`${t} records confirmed.`);
  };

  const update = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const launchMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveBizId) throw new Error("No Business ID found.");

      if ((audienceType === "custom" ? customNumbers.length : selectedIds.size) === 0)
        throw new Error("No audience selected");

      const { data: campaign, error: campErr } = await supabase

        .from("dialer_campaigns")

        .insert({
          business_id: effectiveBizId,

          name: effectiveName,

          description: form.description || null,

          status: "active",

          dial_mode: form.dial_mode,

          max_attempts: form.max_attempts,

          amd_enabled: form.amd_enabled,

          max_concurrent_calls: form.max_concurrent,

          initial_script: form.initial_script,

          agent_id: form.agent_id,
          agent_provider: form.dial_mode === "ai" ? "bland" : "elevenlabs",
          bland_agent_id: form.dial_mode === "ai" ? form.agent_id || null : null,
        } as any)

        .select("id")

        .single();

      if (campErr) throw campErr;

      let items: any[] = [];

      if (audienceType === "custom") {
        items = customNumbers.map((n, i) => ({
          business_id: effectiveBizId!,

          phone_number: n.phone,

          contact_name: n.name,

          campaign_id: campaign.id,

          priority_score: Math.max(1, 100 - i),

          status: "queued",
        }));
      } else {
        const ids = Array.from(selectedIds),
          allRecords: any[] = [];

        for (let i = 0; i < ids.length; i += 100) {
          const { data } = await supabase

            .from(audienceConfig.table as any)

            .select(`id, ${audienceConfig.nameCol}, ${audienceConfig.phoneCol}`)

            .in("id", ids.slice(i, i + 100));

          if (data)
            allRecords.push(
              ...data.map((r: any) => ({
                id: r.id,

                store_name: r[audienceConfig.nameCol] || "Unknown",

                phone: r[audienceConfig.phoneCol] || null,
              })),
            );
        }

        items = allRecords

          .filter((r) => r.phone)

          .map((r, i) => ({
            business_id: effectiveBizId!,

            phone_number: r.phone!,

            contact_name: r.store_name,

            campaign_id: campaign.id,

            priority_score: Math.max(1, 100 - i),

            status: "queued",
          }));
      }

      if (items.length === 0) throw new Error("No valid phones found");

      for (let i = 0; i < items.length; i += 50) {
        const { error } = await supabase.from("outbound_call_queue").insert(items.slice(i, i + 50) as any);

        if (error) throw error;
      }

      return { campaignId: campaign.id, count: items.length };
    },

    onSuccess: (data) => {
      toast.success(`Launched with ${data.count} contacts!`);

      queryClient.invalidateQueries({ queryKey: ["dialer-campaigns"] });

      setActiveCampaignId(data.campaignId);

      setViewMode("console");

      setStep(0);

      setSelectedIds(new Set());

      setCustomNumbers([]);

      setIsAudienceConfirmed(false);

      setForm((prev) => ({ ...prev, name: "" }));
    },

    onError: (err: any) => toast.error(`Failed: ${err.message}`),
  });

  const { data: campaignsList } = useQuery({
    queryKey: ["dialer-campaigns", effectiveBizId],

    queryFn: async () => {
      const { data } = await supabase
        .from("dialer_campaigns")
        .select("*")
        .eq("business_id", effectiveBizId!)
        .is("archived_at" as any, null)
        .order("created_at", { ascending: false });

      return (data as unknown as Campaign[]) || [];
    },

    enabled: viewMode === "console" && !!effectiveBizId,
  });

  const { data: callItems, isLoading: callsLoading } = useQuery({
    queryKey: ["campaign-calls", activeCampaignId],

    queryFn: async () => {
      const { data } = await supabase

        .from("outbound_call_queue")

        .select("*")

        .eq("campaign_id", activeCampaignId!)

        .order("updated_at", { ascending: false });

      return (data as CallItem[]) || [];
    },

    enabled: viewMode === "console" && !!activeCampaignId,

    refetchInterval: 3000,
  });

  // Fetch transcripts for all calls in the active campaign

  const callSids = useMemo(() => {
    if (!callItems) return [];

    return callItems

      .map((i: any) => i.twilio_call_sid)

      .filter(Boolean) as string[];
  }, [callItems]);

  const { data: transcripts } = useQuery({
    queryKey: ["campaign-transcripts", activeCampaignId, callSids],
    queryFn: async () => {
      if (callSids.length === 0) return [];
      const { data } = await (supabase as any)
        .from("live_call_transcripts")
        .select("*")
        .in("call_sid", callSids)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: viewMode === "console" && !!activeCampaignId && callSids.length > 0,
    refetchInterval: 3000,
  });

  // Fetch call recordings for this campaign's calls
  const { data: callRecordings = [] } = useQuery({
    queryKey: ["campaign-recordings", activeCampaignId, callSids],
    queryFn: async () => {
      if (callSids.length === 0) return [];
      const { data } = await supabase
        .from("call_recordings")
        .select("provider_call_sid, recording_url, recording_duration, status, has_transcript, elevenlabs_conversation_id")
        .in("provider_call_sid", callSids);
      return data || [];
    },
    enabled: viewMode === "console" && !!activeCampaignId && callSids.length > 0,
    refetchInterval: 5000,
  });

  // Fetch AI call logs for summaries
  const campaignPhones = useMemo(() => {
    if (!callItems) return [];
    return callItems.map((i: any) => i.phone_number).filter(Boolean) as string[];
  }, [callItems]);

  const { data: aiCallLogs = [] } = useQuery({
    queryKey: ["campaign-ai-logs", activeCampaignId, campaignPhones],
    queryFn: async () => {
      if (campaignPhones.length === 0) return [];
      const { data } = await supabase
        .from("ai_call_logs")
        .select("phone_number, outcome, ai_summary, duration_seconds, created_at")
        .in("phone_number", campaignPhones)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: viewMode === "console" && !!activeCampaignId && campaignPhones.length > 0,
    refetchInterval: 10000,
  });

  // Index AI logs by phone
  const aiLogsByPhone = useMemo(() => {
    const map: Record<string, any> = {};
    (aiCallLogs as any[]).forEach((l: any) => {
      if (l.phone_number && !map[l.phone_number]) map[l.phone_number] = l;
    });
    return map;
  }, [aiCallLogs]);

  // Index recordings by call_sid
  const recordingsByCall = useMemo(() => {
    const map: Record<string, any> = {};
    (callRecordings as any[]).forEach((r: any) => {
      if (r.provider_call_sid) map[r.provider_call_sid.trim()] = r;
    });
    return map;
  }, [callRecordings]);

  // Group transcripts by call_sid with enhanced speaker labels

  const transcriptsByCall = useMemo(() => {
    if (!transcripts) return {};

    const grouped: Record<string, { speaker: string; text: string; created_at: string }[]> = {};

    (transcripts as any[]).forEach((t) => {
      const sid = t.call_sid.trim();

      if (!grouped[sid]) grouped[sid] = [];

      // Normalize speaker names for the UI

      let displaySpeaker = t.speaker;

      if (t.speaker === "ai" || t.speaker === "agent") displaySpeaker = "ai";

      if (t.speaker === "caller" || t.speaker === "user") displaySpeaker = "caller";

      grouped[sid].push({
        speaker: displaySpeaker,

        text: t.text,

        created_at: t.created_at,
      });
    });

    return grouped;
  }, [transcripts]);

  useEffect(() => {
    if (viewMode === "console" && !activeCampaignId && campaignsList && campaignsList.length > 0)
      setActiveCampaignId(campaignsList[0].id);
  }, [viewMode, campaignsList, activeCampaignId]);

  const activeCampaign = campaignsList?.find((c) => c.id === activeCampaignId);

  const stats = {
    total: callItems?.length || 0,

    queued: callItems?.filter((i) => i.status === "queued").length || 0,

    live: callItems?.filter((i) => ["dialing", "connected", "bridged"].includes(i.status)).length || 0,

    completed:
      callItems?.filter((i) => ["completed", "transferred", "failed", "no_answer", "voicemail", "declined", "no_input"].includes(i.status)).length || 0,
  };

  if (viewMode === "console") {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row gap-6 p-4 md:p-6 bg-background text-foreground">
        {/* SIDEBAR */}

        <Card className="w-full md:w-80 flex flex-col h-full border shadow-sm bg-card text-card-foreground">
          <CardHeader className="pb-3 border-b">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-primary" /> History
              </CardTitle>

              <div className="flex gap-1">
                {selectedCampaignIds.size > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1 h-8"
                    disabled={isArchiving}
                    onClick={async () => {
                      setIsArchiving(true);
                      try {
                        const ids = Array.from(selectedCampaignIds);
                        for (const id of ids) {
                          await supabase
                            .from("dialer_campaigns")
                            .update({ archived_at: new Date().toISOString(), status: "completed" } as any)
                            .eq("id", id);
                        }
                        toast.success(`Archived ${ids.length} campaign(s)`);
                        setSelectedCampaignIds(new Set());
                        if (selectedCampaignIds.has(activeCampaignId || "")) setActiveCampaignId(null);
                        queryClient.invalidateQueries({ queryKey: ["dialer-campaigns"] });
                      } catch (e: any) {
                        toast.error(`Archive failed: ${e.message}`);
                      } finally {
                        setIsArchiving(false);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Archive ({selectedCampaignIds.size})
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setViewMode("wizard")} className="gap-1 h-8">
                  <Plus className="h-3.5 w-3.5" /> New
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <CardDescription>Select campaign to monitor</CardDescription>
              {campaignsList && campaignsList.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    checked={campaignsList.length > 0 && campaignsList.every((c) => selectedCampaignIds.has(c.id))}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedCampaignIds(new Set(campaignsList.map((c) => c.id)));
                      } else {
                        setSelectedCampaignIds(new Set());
                      }
                    }}
                  />
                  <span className="text-xs text-muted-foreground">All</span>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1">
            <ScrollArea className="h-full">
              <div className="flex flex-col p-2 gap-2">
                {!campaignsList || campaignsList.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">No campaigns yet.</p>
                ) : (
                  campaignsList.map((c) => (
                    <div
                      key={c.id}
                      className={`flex items-start gap-2 p-3 rounded-lg text-left transition-all border ${activeCampaignId === c.id ? "bg-primary/10 border-primary shadow-sm text-primary" : "hover:bg-muted/50 border-transparent hover:border-border text-foreground"}`}
                    >
                      <Checkbox
                        checked={selectedCampaignIds.has(c.id)}
                        onCheckedChange={(checked) => {
                          setSelectedCampaignIds((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(c.id);
                            else next.delete(c.id);
                            return next;
                          });
                        }}
                        className="mt-0.5"
                      />
                      <button
                        onClick={() => setActiveCampaignId(c.id)}
                        className="flex-1 flex flex-col items-start gap-1"
                      >
                        <div className="flex w-full justify-between items-center">
                          <span className="font-semibold text-sm truncate">{c.name}</span>

                          <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-[10px] h-5">
                            {c.status}
                          </Badge>
                        </div>

                        <div className="flex w-full justify-between items-center mt-1">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(c.created_at), "MMM d, h:mm a")}
                          </span>

                          <Badge variant="outline" className="text-[9px] h-4 px-1">
                            {(c as any).dial_mode === "manual" ? "Manual" : "AI Agent"}
                          </Badge>
                        </div>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* MAIN DASHBOARD */}

        <div className="flex-1 flex flex-col gap-6 h-full overflow-hidden">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{activeCampaign?.name || "Campaign Dashboard"}</h1>

                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Badge variant="outline" className="gap-1 bg-background">
                    {(activeCampaign as any)?.dial_mode === "manual" ? <Phone className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                    Mode: {(activeCampaign as any)?.dial_mode === "manual" ? "Manual Cold Call" : "AI Agent"}
                  </Badge>

                  {/* Connection Status Indicators */}
                  <Badge variant="outline" className="gap-1.5 text-[10px] h-5 border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    Twilio Connected
                  </Badge>
                  {(activeCampaign as any)?.dial_mode !== "manual" && (
                    <Badge variant="outline" className="gap-1.5 text-[10px] h-5 border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <div className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
                      ElevenLabs Connected
                    </Badge>
                  )}

                  {activeCampaign?.status === "active" && (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400 animate-pulse text-xs font-medium">
                      <Activity className="h-3 w-3" /> Dialing Active
                    </span>
                  )}

                  {activeCampaign?.status === "paused" && (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-medium">
                      <Pause className="h-3 w-3" /> Paused
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {/* Manual cold call button */}
                {(activeCampaign as any)?.dial_mode === "manual" && activeCampaign?.status !== "completed" && (
                  <Button
                    size="sm"
                    className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => setIsManualCallModalOpen(true)}
                  >
                    <Phone className="h-4 w-4" /> Start Calling
                  </Button>
                )}

                {activeCampaign?.status === "active" ? (
                  <Button variant="outline" size="sm" onClick={() => updateCampaignStatus("paused")}>
                    <Pause className="h-4 w-4 mr-1" /> Pause
                  </Button>
                ) : activeCampaign?.status === "paused" ? (
                  <Button variant="default" size="sm" onClick={() => updateCampaignStatus("active")}>
                    <Play className="h-4 w-4 mr-1" /> Resume
                  </Button>
                ) : null}

                {activeCampaign?.status !== "completed" && (
                  <Button variant="destructive" size="sm" onClick={() => updateCampaignStatus("completed")}>
                    <Square className="h-4 w-4 mr-1" /> Stop
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={recoverStuckCalls}
                  disabled={isRecovering}
                  title="Mark calls stuck > 5 min as failed"
                >
                  <Zap className="h-4 w-4 mr-1" /> {isRecovering ? "Recovering…" : "Recover Stuck"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Refresh
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Leads" value={stats.total} icon={Users} />

              <StatCard label="In Queue" value={stats.queued} icon={Clock} color="text-muted-foreground" />

              <StatCard
                label="Live Calls"
                value={stats.live}
                icon={Activity}
                color="text-blue-600 dark:text-blue-400"
                active
              />

              <StatCard
                label="Completed"
                value={stats.completed}
                icon={CheckCircle2}
                color="text-green-600 dark:text-green-400"
              />
            </div>
          </div>

          <Card className="flex-1 border shadow-sm flex flex-col overflow-hidden bg-card">
            <Tabs defaultValue="monitor" className="h-full flex flex-col">
              <div className="px-6 pt-4 pb-0 border-b bg-muted/20">
                <TabsList className="bg-muted">
                  <TabsTrigger value="monitor" className="gap-2">
                    <Activity className="h-4 w-4" /> Live Monitor
                  </TabsTrigger>

                  <TabsTrigger value="transcripts" className="gap-2">
                    <MessageSquare className="h-4 w-4" /> Logs
                  </TabsTrigger>

                  <TabsTrigger value="batch" className="gap-2">
                    <Zap className="h-4 w-4" /> Batch Dialer
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="monitor" className="flex-1 p-0 m-0 overflow-hidden bg-background">
                <ScrollArea className="h-full p-4">
                  <div className="space-y-2">
                    {callsLoading ? (
                      <p className="text-center py-4 text-muted-foreground">Loading calls...</p>
                    ) : !callItems || callItems.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground">
                        No calls generated for this campaign yet.
                      </div>
                    ) : (
                      callItems.map((item) => {
                        const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.queued;

                        const Icon = config.icon;

                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors"
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className={`p-2 rounded-full bg-muted/50 ${config.color}`}>
                                <Icon className="h-4 w-4" />
                              </div>

                              <div className="min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">{item.contact_name || "Unknown"}</p>
                                <p className="text-xs text-muted-foreground font-mono">{item.phone_number}</p>
                                <div className="flex flex-wrap items-center gap-1 mt-1">
                                  {(item as any).answered_by && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                                      AMD: {(item as any).answered_by}
                                    </Badge>
                                  )}
                                  {(item as any).confirmation_method && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                                      via {(item as any).confirmation_method}
                                    </Badge>
                                  )}
                                  {(item as any).dial_status && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                                      bridge: {(item as any).dial_status}
                                    </Badge>
                                  )}
                                  {(item as any).bridge_failed_reason && (
                                    <Badge variant="destructive" className="text-[10px] h-4 px-1">
                                      {(item as any).bridge_failed_reason}
                                    </Badge>
                                  )}
                                  {((item as any).attempt_count ?? 0) > 1 && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                                      attempt {(item as any).attempt_count}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            <Badge variant="outline" className={`${config.color} border-0 bg-transparent`}>
                              {config.label}
                            </Badge>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="transcripts" className="flex-1 p-0 m-0 overflow-hidden bg-muted/10">
                <ScrollArea className="h-[calc(100vh-22rem)]">
                  <div className="p-4 space-y-4">
                    {!callItems || callItems.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-8">
                        No calls yet. Launch a campaign to see transcripts.
                      </p>
                    ) : callItems.filter((i: any) => i.twilio_call_sid || ["completed", "failed", "no_answer", "connected", "transferred"].includes(i.status)).length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-8">Waiting for calls to connect...</p>
                    ) : (
                      callItems
                        .filter((i: any) => i.twilio_call_sid || ["completed", "failed", "no_answer", "connected", "transferred"].includes(i.status))
                        .map((item: any) => {
                          const sid = item.twilio_call_sid?.trim();
                          const msgs = sid ? (transcriptsByCall[sid] || []) : [];
                          const recording = sid ? recordingsByCall[sid] : null;
                          const aiLog = aiLogsByPhone[item.phone_number];
                          const hasElevenLabs = !!recording?.elevenlabs_conversation_id;

                          return (
                            <Card key={item.id} className="border bg-card">
                              <div className="p-3 border-b flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium text-sm">{item.contact_name || "Unknown"}</span>
                                  <span className="text-xs text-muted-foreground font-mono">{item.phone_number}</span>
                                  {hasElevenLabs && (
                                    <Badge variant="outline" className="gap-1 text-[10px] h-5 border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10">
                                      <Bot className="h-3 w-3" />
                                      ElevenLabs
                                    </Badge>
                                  )}
                                  {item.status === "transferred" && (
                                    <Badge variant="outline" className="gap-1 text-[10px] h-5 border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10">
                                      <ArrowRightLeft className="h-3 w-3" />
                                      Transferred
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {recording?.outcome && (
                                    <Badge variant="outline" className="text-[10px] capitalize">
                                      {recording.outcome}
                                    </Badge>
                                  )}
                                  {recording?.recording_duration && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {Math.floor(recording.recording_duration / 60)}:{String(recording.recording_duration % 60).padStart(2, "0")}
                                    </span>
                                  )}
                                  <Badge variant="outline" className="text-[10px]">
                                    {item.status}
                                  </Badge>
                                </div>
                              </div>

                              {/* AI Summary Banner */}
                              {aiLog?.ai_summary && (
                                <div className="px-3 py-2 bg-primary/5 border-b text-xs">
                                  <span className="font-semibold text-primary">AI Summary: </span>
                                  <span className="text-foreground">{aiLog.ai_summary}</span>
                                </div>
                              )}

                              {/* Call Flow Indicator */}
                              {sid && (
                                <div className="px-3 py-1.5 bg-muted/30 border-b flex items-center gap-2 text-[10px] text-muted-foreground">
                                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> Twilio TTS</span>
                                  <ChevronRight className="h-3 w-3" />
                                  <span className="flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" /> Gather
                                  </span>
                                  {hasElevenLabs && (
                                    <>
                                      <ChevronRight className="h-3 w-3" />
                                      <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
                                        <Bot className="h-3 w-3" /> AI Agent
                                      </span>
                                    </>
                                  )}
                                  {recording?.recording_url && (
                                    <>
                                      <span className="ml-auto" />
                                      <audio
                                        controls
                                        preload="none"
                                        src={`https://qalaaroashbggynpvqct.supabase.co/functions/v1/play-twilio-recording?url=${encodeURIComponent(recording.recording_url)}`}
                                        className="h-7 max-w-[260px]"
                                      />
                                    </>
                                  )}
                                </div>
                              )}

                              <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
                                {msgs.length === 0 ? (
                                  <div>
                                    <p className="text-xs text-muted-foreground italic">
                                      {item.status === "completed" || item.status === "failed" || item.status === "no_answer"
                                        ? "No transcript captured for this call."
                                        : item.status === "dialing" || item.status === "connected" || item.status === "bridging"
                                        ? "⏳ Call in progress — transcript will appear when complete..."
                                        : "Waiting for transcript..."}
                                    </p>
                                  </div>
                                ) : (
                                  <>
                                    {msgs.map((msg: any, idx: number) => {
                                      const isSystem = msg.speaker === "system";
                                      const isTransfer = isSystem && (msg.text.includes("[TRANSFER") || msg.text.includes("[FAST TRANSFER") || msg.text.includes("transferring"));
                                      
                                      if (isSystem) {
                                        return (
                                          <div key={idx} className="flex justify-center">
                                            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium ${isTransfer ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" : "bg-muted text-muted-foreground"}`}>
                                              {isTransfer && <ArrowRightLeft className="h-3 w-3" />}
                                              {msg.text.replace(/\[|\]/g, "")}
                                            </div>
                                          </div>
                                        );
                                      }
                                      
                                      return (
                                        <div
                                          key={idx}
                                          className={`flex gap-2 text-xs ${msg.speaker === "ai" || msg.speaker === "human" ? "justify-start" : "justify-end"}`}
                                        >
                                          <div
                                            className={`max-w-[80%] rounded-lg px-3 py-1.5 ${msg.speaker === "ai" || msg.speaker === "human" ? "bg-primary/10 text-foreground" : "bg-muted text-foreground"}`}
                                          >
                                            <span className="font-semibold capitalize text-[10px] text-muted-foreground">
                                              {msg.speaker === "ai" ? "AI Agent" : msg.speaker === "human" ? "Human Agent" : "Caller"}
                                            </span>
                                            <p className="mt-0.5">{msg.text}</p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </>
                                )}
                              </div>
                            </Card>
                          );
                        })
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="batch" className="flex-1 p-0 m-0 overflow-hidden bg-background">
                <ScrollArea className="h-[calc(100vh-22rem)]">
                  <div className="p-4">
                    <BatchDialerPanel campaignId={activeCampaignId} />
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Manual Call Modal */}
        {activeCampaignId && (
          <ManualCampaignCallModal
            open={isManualCallModalOpen}
            onOpenChange={setIsManualCallModalOpen}
            campaignId={activeCampaignId}
            campaignName={activeCampaign?.name || "Campaign"}
          />
        )}
      </div>
    );
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  const totalSelected = audienceType === "custom" ? customNumbers.length : selectedIds.size;

  return (
    <div className="w-full min-h-full max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Rocket className="h-6 w-6" /> AI Campaign Wizard
          </h2>

          <p className="text-sm text-muted-foreground">
            Create an AI dialer campaign, select your audience, and launch.
          </p>
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
        {/* STEP 0: Campaign Info */}

        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Campaign Basics</CardTitle>

              <CardDescription>Name your AI campaign.</CardDescription>
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

        {/* STEP 1: Audience */}

        {step === 1 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Audience Type</Label>

                <RadioGroup
                  value={audienceType}
                  onValueChange={(v: any) => {
                    setAudienceType(v as AudienceType);

                    setSelectedIds(new Set());

                    setAudiencePage(1);

                    setIsAudienceConfirmed(false);
                  }}
                  className="grid grid-cols-2 md:grid-cols-4 gap-3"
                >
                  {(Object.entries(AUDIENCE_TYPE_CONFIG) as [AudienceType, (typeof AUDIENCE_TYPE_CONFIG)[AudienceType]][]).map(([key, cfg]) => (
                    <div
                      key={key}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${audienceType === key ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                    >
                      <RadioGroupItem value={key} id={`aud-${key}`} />

                      <Label htmlFor={`aud-${key}`} className="cursor-pointer text-sm">
                        {cfg.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Custom Numbers Input */}

              {audienceType === "custom" && (
                <div className="space-y-4">
                  <Alert>
                    <UserPlus className="h-4 w-4" />

                    <AlertTitle>Custom Numbers</AlertTitle>

                    <AlertDescription>Add phone numbers manually or paste a list.</AlertDescription>
                  </Alert>

                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Phone Number</Label>

                      <Input
                        placeholder="(555) 123-4567"
                        value={customPhoneInput}
                        onChange={(e) => setCustomPhoneInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addCustomNumber()}
                      />
                    </div>

                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Name (optional)</Label>

                      <Input
                        placeholder="Contact name"
                        value={customNameInput}
                        onChange={(e) => setCustomNameInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addCustomNumber()}
                      />
                    </div>

                    <div className="flex items-end">
                      <Button size="sm" onClick={addCustomNumber} className="gap-1">
                        <Plus className="h-4 w-4" /> Add
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Bulk Paste (comma or newline separated numbers)</Label>

                    <Textarea
                      placeholder="5551234567&#10;5559876543"
                      rows={3}
                      onBlur={(e) => {
                        if (e.target.value.trim()) {
                          handleBulkPaste(e.target.value);

                          e.target.value = "";
                        }
                      }}
                    />
                  </div>

                  {customNumbers.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="p-3 text-left">Name</th>

                            <th className="p-3 text-left">Phone</th>

                            <th className="p-3 w-10"></th>
                          </tr>
                        </thead>

                        <tbody>
                          {customNumbers.map((n) => (
                            <tr key={n.id} className="border-t hover:bg-muted/30">
                              <td className="p-3">{n.name}</td>

                              <td className="p-3 text-muted-foreground font-mono text-xs">{n.phone}</td>

                              <td className="p-3">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => removeCustomNumber(n.id)}
                                >
                                  <X className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Table-based audience */}

              {audienceType !== "custom" && (
                <>
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
                        ) : audienceRows.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-4 text-center text-muted-foreground">
                              No records found.
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

                              <td className="p-3 text-muted-foreground">{row.phone || "—"}</td>
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
                </>
              )}

              <div className="flex justify-between items-center">
                <Badge variant={isAudienceConfirmed ? "default" : "secondary"}>
                  {totalSelected} selected {isAudienceConfirmed && "(Confirmed)"}
                </Badge>

                <div className="flex gap-2">
                  {totalSelected > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedIds(new Set());

                        if (audienceType === "custom") setCustomNumbers([]);

                        setIsAudienceConfirmed(false);
                      }}
                    >
                      Clear
                    </Button>
                  )}

                  <Button
                    variant={isAudienceConfirmed ? "outline" : "default"}
                    size="sm"
                    onClick={handleConfirmSelection}
                    disabled={totalSelected === 0}
                    className="gap-2"
                  >
                    <CheckSquare className="h-4 w-4" />

                    {isAudienceConfirmed ? "Selection Confirmed" : "Confirm Selection"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: Dialing Rules */}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Dialing Configuration</CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
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

              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <Switch checked={form.amd_enabled} onCheckedChange={(v) => update("amd_enabled", v)} />

                  <Label>AMD Enabled (Voicemail Detection)</Label>
                </div>

                {form.amd_enabled && (
                  <p className="text-xs text-amber-600 dark:text-amber-500 max-w-sm">
                    Warning: AMD adds a 3 to 5 second silence at the beginning of the call while it listens to detect a
                    human. Turn this OFF for instant Text-to-Speech testing.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: Script & AI Agent */}

        {step === 3 && (
          <div className="space-y-6">
            {/* Call Mode Toggle */}
            <Card className="border-l-4 border-l-primary">
              <CardContent className="pt-6 space-y-4">
                <div>
                  <h4 className="font-semibold">Call Mode</h4>
                  <p className="text-xs text-muted-foreground">Choose how calls are handled when answered.</p>
                </div>
                <RadioGroup
                  value={form.dial_mode}
                  onValueChange={(v: any) => update("dial_mode", v)}
                  className="grid grid-cols-2 gap-4"
                >
                  <div className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${form.dial_mode === "ai" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                    <RadioGroupItem value="ai" id="mode-ai" />
                    <Label htmlFor="mode-ai" className="cursor-pointer flex-1">
                      <div className="flex items-center gap-2 font-semibold"><Bot className="h-4 w-4" /> AI Voice Agent</div>
                      <p className="text-xs text-muted-foreground mt-1">TTS opener → AI handoff via ElevenLabs</p>
                    </Label>
                  </div>
                  <div className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${form.dial_mode === "manual" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                    <RadioGroupItem value="manual" id="mode-manual" />
                    <Label htmlFor="mode-manual" className="cursor-pointer flex-1">
                      <div className="flex items-center gap-2 font-semibold"><Phone className="h-4 w-4" /> Manual Cold Call</div>
                      <p className="text-xs text-muted-foreground mt-1">Direct human call — no AI, no TTS. Recorded.</p>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Script — shown for AI mode */}
            {form.dial_mode === "ai" && (
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="pt-6 flex gap-4">
                  <div className="mt-1">
                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h4 className="font-semibold">AI Agent Script</h4>
                      <p className="text-xs text-muted-foreground">The AI speaks this immediately when the customer answers.</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Quick Templates</Label>
                      <div className="flex flex-wrap gap-2">
                        {SCRIPT_TEMPLATES.map((tpl) => (
                          <Button key={tpl.id} variant="outline" size="sm" className="text-xs h-7" onClick={() => {
                            update("initial_script", tpl.script);
                            // Auto-select the mapped Bland AI agent
                            const matched = blandAgents.find(a => a.agent_type === tpl.agentType);
                            if (matched) update("agent_id", matched.id);
                          }}>
                            {tpl.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Textarea value={form.initial_script} onChange={(e) => update("initial_script", e.target.value)} rows={4} placeholder="Hi, this is..." />
                    <p className="text-xs text-muted-foreground">
                      Use <code className="bg-muted px-1 rounded text-xs">{"{{contact_name}}"}</code>, <code className="bg-muted px-1 rounded text-xs">{"{{agent_name}}"}</code> variables.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Voice — shown for AI mode */}
            {form.dial_mode === "ai" && (
              <Card className="border-l-4 border-l-purple-500">
                <CardContent className="pt-6 flex gap-4">
                  <div className="mt-1">
                    <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <Bot className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h4 className="font-semibold">Bland AI Agent</h4>
                      <p className="text-xs text-muted-foreground">Select which Bland AI agent handles the conversation.</p>
                    </div>
                    <Select value={form.agent_id} onValueChange={(v) => update("agent_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Select Bland AI Agent..." /></SelectTrigger>
                      <SelectContent>
                        {blandAgents.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            <div className="flex flex-col">
                              <span>{a.agent_name}</span>
                              <span className="text-xs text-muted-foreground">{a.agent_type}{a.description ? ` — ${a.description}` : ""}</span>
                            </div>
                          </SelectItem>
                        ))}
                        {blandAgents.length === 0 && (
                          <SelectItem value="__none" disabled>No agents configured</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {form.agent_id && (
                      <p className="text-xs text-muted-foreground font-mono">
                        Agent: {blandAgents.find(a => a.id === form.agent_id)?.agent_name || form.agent_id}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Manual mode info */}
            {form.dial_mode === "manual" && (
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="pt-6 flex gap-4">
                  <div className="mt-1">
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 flex items-center justify-center">
                      <Phone className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h4 className="font-semibold">Manual Cold Call Mode</h4>
                      <p className="text-xs text-muted-foreground">Calls will be placed directly via Twilio without any AI voice agent. All calls are recorded and transcripts are logged automatically.</p>
                    </div>
                    <Alert>
                      <Phone className="h-4 w-4" />
                      <AlertTitle>How it works</AlertTitle>
                      <AlertDescription className="text-xs">
                        1. System dials the contact via Twilio<br/>
                        2. Call is recorded from the moment it's answered<br/>
                        3. Transcripts and recordings appear in the Logs tab
                      </AlertDescription>
                    </Alert>
                    <Textarea
                      value={form.initial_script}
                      onChange={(e) => update("initial_script", e.target.value)}
                      rows={4}
                      placeholder="Call notes / talking points for reference (not spoken by AI)..."
                    />
                    <p className="text-xs text-muted-foreground">These notes are for your reference only — they won't be read aloud.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* STEP 4: Launch */}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Review Launch</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 border rounded bg-muted/20">
                  <p className="text-xs text-muted-foreground">Campaign</p>

                  <p className="font-medium">{effectiveName}</p>
                </div>

                <div className="p-3 border rounded bg-muted/20">
                  <p className="text-xs text-muted-foreground">Mode</p>
                  <p className="font-medium flex items-center gap-1">
                    {form.dial_mode === "manual" ? <><Phone className="h-3 w-3" /> Manual Cold Call</> : <><Bot className="h-3 w-3" /> AI Agent</>}
                  </p>
                </div>

                <div className="p-3 border rounded bg-muted/20">
                  <p className="text-xs text-muted-foreground">Audience</p>
                  <p className="font-medium">{totalSelected} records</p>
                </div>

                {form.dial_mode === "ai" && (
                  <>
                    <div className="p-3 border rounded bg-muted/20">
                      <p className="text-xs text-muted-foreground">AI Agent</p>
                      <p className="font-medium flex items-center gap-1">
                        <Bot className="h-3 w-3" />
                        {blandAgents.find(a => a.id === form.agent_id)?.agent_name || form.agent_id || "Not selected"}
                      </p>
                    </div>
                    <div className="p-3 border rounded bg-muted/20">
                      <p className="text-xs text-muted-foreground">Twilio TTS Script</p>
                      <p className="truncate">{form.initial_script || "Missing"}</p>
                    </div>
                  </>
                )}
                {form.dial_mode === "manual" && form.initial_script && (
                  <div className="p-3 border rounded bg-muted/20">
                    <p className="text-xs text-muted-foreground">Call Notes</p>
                    <p className="truncate">{form.initial_script}</p>
                  </div>
                )}
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
              if (step === 3 && form.dial_mode === "ai" && !form.initial_script) return toast.error("Complete script setup");

              if (step === 1 && totalSelected === 0) return toast.error("Select audience");

              if (step === 1 && !isAudienceConfirmed) return toast.error("Please confirm your selection first.");

              setStep((s) => s + 1);
            }}
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={() => launchMutation.mutate()}
            disabled={launchMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Rocket className="h-4 w-4 mr-1" /> {launchMutation.isPending ? "Launching..." : "Launch & Monitor"}
          </Button>
        )}
      </div>

      {/* Bland AI Agent Webhook Directory — appears at very bottom of Campaigns tab */}
      <BlandAgentWebhookDirectory />
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
