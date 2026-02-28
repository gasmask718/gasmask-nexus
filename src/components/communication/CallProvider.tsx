import { createContext, useContext, ReactNode, useState, useCallback, useEffect } from "react";
import { useVoiceDevice } from "@/contexts/VoiceDeviceProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CallModal } from "./CallModal";
import { ActiveCallOverlay } from "./ActiveCallOverlay";
import { GlobalCallHUD } from "./GlobalCallHUD";

/**
 * GLOBAL CALL PROVIDER (Twilio Voice SDK)
 * 
 * Uses the Twilio Voice JS SDK for real two-way browser-to-phone calls.
 */

interface CallParams {
  destinationPhone: string;
  businessId?: string;
  entityType?: "store" | "customer" | "wholesaler" | "driver" | "ambassador" | "other";
  entityId?: string;
  entityName?: string;
  notes?: string;
  agentId?: string;
  isTestCall?: boolean;
}

interface ActiveCallInfo {
  callSid: string;
  callLogId: string;
  destinationPhone: string;
  entityName?: string;
  status: string;
  startedAt: Date;
}

interface CallContextValue {
  initiateCall: (params: CallParams) => void;
  placeCallNow: (params: CallParams) => Promise<any>;
  isCallModalOpen: boolean;
  activeCall: ActiveCallInfo | null;
  formatPhoneDisplay: (phone: string) => string;
}

const CallContext = createContext<CallContextValue | null>(null);

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within CallProvider");
  }
  return context;
}

export function CallProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const twilioDevice = useVoiceDevice();

  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [pendingCall, setPendingCall] = useState<CallParams | null>(null);
  const [activeCallInfo, setActiveCallInfo] = useState<ActiveCallInfo | null>(null);
  const [isPlacingCall, setIsPlacingCall] = useState(false);

  // Fetch business phone numbers for caller ID selection
  const { data: businessPhoneNumbers = [] } = useQuery({
    queryKey: ["business-phone-numbers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_phone_numbers")
        .select(`id, phone_number, type, label, is_default, business_id, businesses (id, name, primary_color)`)
        .eq("is_active", true)
        .in("type", ["call", "both"])
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Sync Twilio Device call status → activeCallInfo
  useEffect(() => {
    if (activeCallInfo && twilioDevice.callStatus) {
      const statusMap: Record<string, string> = {
        connecting: "initiated",
        ringing: "ringing",
        "in-progress": "in-progress",
        completed: "completed",
        cancelled: "completed",
        failed: "failed",
        reconnecting: "ringing",
      };
      const mapped = statusMap[twilioDevice.callStatus] || activeCallInfo.status;
      if (mapped !== activeCallInfo.status) {
        setActiveCallInfo((prev) => prev ? { ...prev, status: mapped } : null);
      }
    }

    // Clear if call ended
    if (
      activeCallInfo &&
      (twilioDevice.callStatus === "completed" || twilioDevice.callStatus === "cancelled")
    ) {
      // Keep showing for 2s so user sees "Call Ended"
      setTimeout(() => {
        setActiveCallInfo(null);
        queryClient.invalidateQueries({ queryKey: ["manual-call-logs"] });
      }, 2000);
    }
  }, [twilioDevice.callStatus, activeCallInfo, queryClient]);

  const formatPhoneDisplay = useCallback((phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  }, []);

  const getDefaultBusiness = useCallback(() => {
    return businessPhoneNumbers.find((bp) => bp.is_default) || businessPhoneNumbers[0];
  }, [businessPhoneNumbers]);

  // Format phone for E.164
  const formatE164 = (phone: string) => {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) cleaned = `+1${cleaned}`;
    else if (cleaned.length >= 11 && !cleaned.startsWith("+")) cleaned = `+${cleaned}`;
    else if (!phone.startsWith("+")) cleaned = `+${cleaned}`;
    return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
  };

  // Place call using Twilio Voice SDK (browser WebRTC)
  const placeCall = useCallback(async (params: CallParams) => {
    const formattedPhone = formatE164(params.destinationPhone);

    setIsPlacingCall(true);
    try {
      const call = await twilioDevice.makeCall(formattedPhone, params.isTestCall ? { test_call: "true" } : undefined);
      if (call) {
        setActiveCallInfo({
          callSid: (call as any).parameters?.CallSid || `browser-${Date.now()}`,
          callLogId: "",
          destinationPhone: params.destinationPhone,
          entityName: params.entityName,
          status: "initiated",
          startedAt: new Date(),
        });
        toast.success("Call connecting...");
      }
    } catch (err: any) {
      toast.error(`Call failed: ${err.message}`);
    } finally {
      setIsPlacingCall(false);
    }
  }, [twilioDevice]);

  const initiateCall = useCallback((params: CallParams) => {
    if (!params.businessId) {
      const def = getDefaultBusiness();
      params.businessId = def?.business_id;
    }
    setPendingCall(params);
    setIsCallModalOpen(true);
  }, [getDefaultBusiness]);

  const placeCallNow = useCallback(async (params: CallParams) => {
    await placeCall(params);
  }, [placeCall]);

  const confirmCall = useCallback(async () => {
    if (!pendingCall) return;
    await placeCall(pendingCall);
    setIsCallModalOpen(false);
    setPendingCall(null);
  }, [pendingCall, placeCall]);

  const cancelCall = useCallback(() => {
    setIsCallModalOpen(false);
    setPendingCall(null);
  }, []);

  const handleEndCall = useCallback(() => {
    twilioDevice.hangUp();
    setActiveCallInfo(null);
    queryClient.invalidateQueries({ queryKey: ["manual-call-logs"] });
  }, [twilioDevice, queryClient]);

  const handleToggleMute = useCallback(() => {
    twilioDevice.toggleMute();
  }, [twilioDevice]);

  return (
    <CallContext.Provider
      value={{
        initiateCall,
        placeCallNow,
        isCallModalOpen,
        activeCall: activeCallInfo,
        formatPhoneDisplay,
      }}
    >
      {children}

      <CallModal
        isOpen={isCallModalOpen}
        onClose={cancelCall}
        onConfirm={confirmCall}
        destinationPhone={pendingCall?.destinationPhone || ""}
        entityName={pendingCall?.entityName}
        entityType={pendingCall?.entityType}
        businessPhoneNumbers={businessPhoneNumbers}
        defaultBusinessId={pendingCall?.businessId}
        isLoading={isPlacingCall}
      />

      {activeCallInfo && (
        <ActiveCallOverlay
          callSid={activeCallInfo.callSid}
          callLogId={activeCallInfo.callLogId}
          destinationPhone={activeCallInfo.destinationPhone}
          entityName={activeCallInfo.entityName}
          status={activeCallInfo.status}
          startedAt={activeCallInfo.startedAt}
          onEndCall={handleEndCall}
          onToggleMute={handleToggleMute}
          isMuted={twilioDevice.isMuted}
          formatPhoneDisplay={formatPhoneDisplay}
        />
      )}

      <GlobalCallHUD />
    </CallContext.Provider>
  );
}
