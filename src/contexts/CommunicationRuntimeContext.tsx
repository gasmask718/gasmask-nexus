import { createContext, useContext, ReactNode, useState, useCallback, useEffect, useMemo } from "react";
import { useCall } from "@/components/communication/CallProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";

/**
 * COMMUNICATION RUNTIME — EXECUTION SPINE
 * 
 * Single source of truth for all communication state.
 * All call actions dispatch through runtime.startCall().
 * All pages read from useCommunicationRuntime().
 */

export type DialerMode = "idle" | "manual" | "predictive" | "ai";
export type EntityType = "store" | "prospect" | "customer" | "other";

interface RuntimeEntity {
  entityId: string;
  entityType: EntityType;
  entityName?: string;
  phone?: string;
}

interface QueueStats {
  queued: number;
  dialing: number;
  live: number;
}

interface AgentStats {
  available: number;
  total: number;
  myStatus: string;
}

interface SystemHealth {
  twilioReady: boolean;
  agentOnline: boolean;
  queueHasItems: boolean;
  withinBusinessHours: boolean;
}

interface StartCallParams {
  entityId?: string;
  entityType?: EntityType;
  entityName?: string;
  phone: string;
  businessId?: string;
  source: "inbox" | "manual" | "dialer" | "campaign" | "crm" | "other";
  campaignId?: string;
  mode?: "manual" | "predictive" | "ai";
}

interface CommunicationRuntimeValue {
  // Active entity context
  activeEntity: RuntimeEntity | null;
  setActiveEntity: (entity: RuntimeEntity | null) => void;

  // Dialer mode
  dialerMode: DialerMode;
  setDialerMode: (mode: DialerMode) => void;

  // Stats (read-only, auto-refreshing)
  queueStats: QueueStats;
  agentStats: AgentStats;
  systemHealth: SystemHealth;

  // Unified call entry point
  startCall: (params: StartCallParams) => void;

  // Current campaign context
  activeCampaignId: string | null;
  setActiveCampaignId: (id: string | null) => void;
}

const CommunicationRuntimeContext = createContext<CommunicationRuntimeValue | null>(null);

export function useCommunicationRuntime() {
  const context = useContext(CommunicationRuntimeContext);
  if (!context) {
    throw new Error("useCommunicationRuntime must be used within CommunicationRuntimeProvider");
  }
  return context;
}

export function CommunicationRuntimeProvider({ children }: { children: ReactNode }) {
  const { currentBusiness } = useBusiness();
  const bizId = currentBusiness?.id;
  const queryClient = useQueryClient();
  const { initiateCall, activeCall } = useCall();

  // ── State ──
  const [activeEntity, setActiveEntity] = useState<RuntimeEntity | null>(null);
  const [dialerMode, setDialerMode] = useState<DialerMode>("idle");
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  // ── Queue Stats (auto-refresh) ──
  const { data: queueData } = useQuery({
    queryKey: ["runtime-queue-stats", bizId],
    queryFn: async () => {
      const { data } = await supabase
        .from("outbound_call_queue")
        .select("status")
        .eq("business_id", bizId!)
        .in("status", ["queued", "dialing", "answered", "bridged"]);
      const items = data || [];
      return {
        queued: items.filter(i => i.status === "queued").length,
        dialing: items.filter(i => i.status === "dialing").length,
        live: items.filter(i => i.status === "bridged" || i.status === "answered").length,
      };
    },
    enabled: !!bizId,
    refetchInterval: 5000,
    staleTime: 3000,
  });

  // ── Agent Stats (auto-refresh) ──
  const { data: agentData } = useQuery({
    queryKey: ["runtime-agent-stats", bizId],
    queryFn: async () => {
      const { data } = await supabase
        .from("dialer_agent_availability")
        .select("status")
        .eq("business_id", bizId!);
      const agents = data || [];
      return {
        available: agents.filter(a => a.status === "available").length,
        total: agents.length,
        myStatus: "unknown",
      };
    },
    enabled: !!bizId,
    refetchInterval: 5000,
    staleTime: 3000,
  });

  // ── Twilio readiness from CallProvider ──
  // We infer from whether activeCall exists or call modal is accessible

  const queueStats: QueueStats = queueData || { queued: 0, dialing: 0, live: 0 };
  const agentStats: AgentStats = agentData || { available: 0, total: 0, myStatus: "unknown" };

  const systemHealth: SystemHealth = useMemo(() => ({
    twilioReady: true, // CallProvider handles init; assume ready if mounted
    agentOnline: agentStats.available > 0,
    queueHasItems: queueStats.queued > 0,
    withinBusinessHours: true, // TODO: wire to business_hours table
  }), [agentStats.available, queueStats.queued]);

  // ── Unified call entry point ──
  const startCall = useCallback((params: StartCallParams) => {
    // Set active entity context
    if (params.entityId) {
      setActiveEntity({
        entityId: params.entityId,
        entityType: params.entityType || "other",
        entityName: params.entityName,
        phone: params.phone,
      });
    }

    if (params.campaignId) {
      setActiveCampaignId(params.campaignId);
    }

    // Dispatch through the existing CallProvider
    initiateCall({
      destinationPhone: params.phone,
      entityType: params.entityType as any || "other",
      entityId: params.entityId,
      entityName: params.entityName,
      businessId: params.businessId,
    });
  }, [initiateCall]);

  // Sync active call → entity context
  useEffect(() => {
    if (!activeCall) {
      // Don't clear entity immediately — keep for disposition
    }
  }, [activeCall]);

  const value: CommunicationRuntimeValue = useMemo(() => ({
    activeEntity,
    setActiveEntity,
    dialerMode,
    setDialerMode,
    queueStats,
    agentStats,
    systemHealth,
    startCall,
    activeCampaignId,
    setActiveCampaignId,
  }), [activeEntity, dialerMode, queueStats, agentStats, systemHealth, startCall, activeCampaignId]);

  return (
    <CommunicationRuntimeContext.Provider value={value}>
      {children}
    </CommunicationRuntimeContext.Provider>
  );
}
