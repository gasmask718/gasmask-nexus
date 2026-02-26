import { createContext, useContext, ReactNode } from "react";
import { useOutboundCall } from "@/hooks/useOutboundCall";
import { CallModal } from "./CallModal";
import { ActiveCallOverlay } from "./ActiveCallOverlay";

/**
 * GLOBAL CALL PROVIDER
 * 
 * This context provider wraps the entire application and provides
 * a unified calling interface. It manages the call modal and
 * exposes the initiateCall function to all components.
 */

interface CallParams {
  destinationPhone: string;
  businessId?: string;
  entityType?: "store" | "customer" | "wholesaler" | "driver" | "ambassador" | "other";
  entityId?: string;
  entityName?: string;
  notes?: string;
  agentId?: string;
}

interface CallContextValue {
  initiateCall: (params: CallParams) => void;
  placeCallNow: (params: CallParams) => Promise<any>;
  isCallModalOpen: boolean;
  activeCall: {
    callSid: string;
    callLogId: string;
    destinationPhone: string;
    entityName?: string;
    status: string;
    startedAt: Date;
  } | null;
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

interface CallProviderProps {
  children: ReactNode;
}

export function CallProvider({ children }: CallProviderProps) {
  const {
    isCallModalOpen,
    pendingCall,
    activeCall,
    isPlacingCall,
    businessPhoneNumbers,
    initiateCall,
    placeCallNow,
    confirmCall,
    cancelCall,
    clearActiveCall,
    formatPhoneDisplay,
  } = useOutboundCall();

  return (
    <CallContext.Provider
      value={{
        initiateCall,
        placeCallNow,
        isCallModalOpen,
        activeCall,
        formatPhoneDisplay,
      }}
    >
      {children}
      
      {/* Global Call Modal */}
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

      {/* Active Call Overlay */}
      {activeCall && (
        <ActiveCallOverlay
          callSid={activeCall.callSid}
          callLogId={activeCall.callLogId}
          destinationPhone={activeCall.destinationPhone}
          entityName={activeCall.entityName}
          status={activeCall.status}
          startedAt={activeCall.startedAt}
          onEndCall={clearActiveCall}
          formatPhoneDisplay={formatPhoneDisplay}
        />
      )}
    </CallContext.Provider>
  );
}
