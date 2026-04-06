import { ReactNode, useState, useCallback, useEffect, useRef } from "react";
import { useVoiceDevice } from "@/contexts/VoiceDeviceProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CallModal } from "./CallModal";
import { ActiveCallOverlay } from "./ActiveCallOverlay";
import { GlobalCallHUD } from "./GlobalCallHUD";
import { useLocation } from "react-router-dom";
import { CallContext } from "./CallContext";
import type { CallParams, ActiveCallInfo } from "./CallContext";

// Re-export for backward compatibility
export { useCall } from "./CallContext";
export type { VACallMetadata, CallParams, ActiveCallInfo } from "./CallContext";

export function CallProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const twilioDevice = useVoiceDevice();
  const location = useLocation();

  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [pendingCall, setPendingCall] = useState<CallParams | null>(null);
  const [activeCallInfo, setActiveCallInfo] = useState<ActiveCallInfo | null>(null);
  const [isPlacingCall, setIsPlacingCall] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [vaCallMetadata, setVACallMetadata] = useState<import("./CallContext").VACallMetadata | null>(null);

  // Global duration counter
  const [callDuration, setCallDuration] = useState(0);
  const durationRef = useRef<NodeJS.Timeout | null>(null);

  // Start/stop duration timer based on active call
  useEffect(() => {
    if (activeCallInfo && (activeCallInfo.status === "in-progress" || activeCallInfo.status === "ringing" || activeCallInfo.status === "initiated")) {
      if (!durationRef.current) {
        durationRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
      }
    } else {
      if (durationRef.current) {
        clearInterval(durationRef.current);
        durationRef.current = null;
      }
    }
    return () => {
      if (durationRef.current) {
        clearInterval(durationRef.current);
        durationRef.current = null;
      }
    };
  }, [activeCallInfo?.status]);

  // Reset duration when a new call starts
  useEffect(() => {
    if (!activeCallInfo) {
      setCallDuration(0);
    }
  }, [activeCallInfo]);

  // Auto-minimize when navigating away from VA dashboard during an active call
  const isOnVADashboard = location.pathname === "/va/dashboard";
  useEffect(() => {
    if (activeCallInfo && vaCallMetadata?.isVACall && !isOnVADashboard) {
      setIsMinimized(true);
    }
    if (isOnVADashboard) {
      setIsMinimized(false);
    }
  }, [isOnVADashboard, activeCallInfo, vaCallMetadata]);

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
      setTimeout(() => {
        setActiveCallInfo(null);
        setVACallMetadata(null);
        setIsMinimized(false);
        queryClient.invalidateQueries({ queryKey: ["manual-call-logs"] });
        queryClient.invalidateQueries({ queryKey: ["va-today-stats"] });
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

  const formatE164 = (phone: string) => {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) cleaned = `+1${cleaned}`;
    else if (cleaned.length >= 11 && !cleaned.startsWith("+")) cleaned = `+${cleaned}`;
    else if (!phone.startsWith("+")) cleaned = `+${cleaned}`;
    return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
  };

  // Place call using Twilio Voice SDK
  const placeCall = useCallback(async (params: CallParams) => {
    const formattedPhone = formatE164(params.destinationPhone);

    setIsPlacingCall(true);
    setCallDuration(0);
    try {
      const connectParams: Record<string, string> = {};
      if (params.isTestCall) connectParams.test_call = "true";
      connectParams.Record = "true";

      const call = await twilioDevice.makeCall(formattedPhone, Object.keys(connectParams).length > 0 ? connectParams : undefined);
      if (call) {
        const newCallInfo: ActiveCallInfo = {
          callSid: (call as any).parameters?.CallSid || `browser-${Date.now()}`,
          callLogId: "",
          destinationPhone: params.destinationPhone,
          entityName: params.entityName,
          status: "initiated",
          startedAt: new Date(),
        };
        setActiveCallInfo(newCallInfo);
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

  const endActiveCall = useCallback(() => {
    twilioDevice.hangUp();
    setActiveCallInfo(null);
    setVACallMetadata(null);
    setIsMinimized(false);
    queryClient.invalidateQueries({ queryKey: ["manual-call-logs"] });
    queryClient.invalidateQueries({ queryKey: ["va-today-stats"] });
  }, [twilioDevice, queryClient]);

  const toggleMuteGlobal = useCallback(() => {
    twilioDevice.toggleMute();
  }, [twilioDevice]);

  const minimizeCall = useCallback(() => setIsMinimized(true), []);
  const expandCall = useCallback(() => setIsMinimized(false), []);

  const showActiveCallOverlay = activeCallInfo && !vaCallMetadata?.isVACall;

  return (
    <CallContext.Provider
      value={{
        initiateCall,
        placeCallNow,
        isCallModalOpen,
        activeCall: activeCallInfo,
        formatPhoneDisplay,
        callDuration,
        isMuted: twilioDevice.isMuted,
        isMinimized,
        vaCallMetadata,
        setVACallMetadata,
        minimizeCall,
        expandCall,
        endActiveCall,
        toggleMuteGlobal,
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

      {showActiveCallOverlay && (
        <ActiveCallOverlay
          callSid={activeCallInfo.callSid}
          callLogId={activeCallInfo.callLogId}
          destinationPhone={activeCallInfo.destinationPhone}
          entityName={activeCallInfo.entityName}
          status={activeCallInfo.status}
          startedAt={activeCallInfo.startedAt}
          onEndCall={endActiveCall}
          onToggleMute={toggleMuteGlobal}
          isMuted={twilioDevice.isMuted}
          formatPhoneDisplay={formatPhoneDisplay}
        />
      )}

      <GlobalCallHUD />
    </CallContext.Provider>
  );
}
