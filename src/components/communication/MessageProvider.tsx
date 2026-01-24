import { createContext, useContext, ReactNode, useState } from "react";
import { InternalMessageModal } from "./InternalMessageModal";

/**
 * GLOBAL MESSAGE PROVIDER
 * 
 * This context provider wraps the entire application and provides
 * a unified messaging interface. It manages the internal message modal
 * and exposes the initiateMessage function to all components.
 * 
 * This ensures ALL SMS/text actions go through Dynasty OS instead of
 * triggering native browser sms: links.
 */

export interface MessageParams {
  destinationPhone: string;
  businessId?: string;
  storeId?: string;
  entityType?: "store" | "customer" | "wholesaler" | "driver" | "ambassador" | "other";
  entityId?: string;
  entityName?: string;
  channel?: "sms" | "whatsapp";
  source?: string;
}

interface MessageContextValue {
  initiateMessage: (params: MessageParams) => void;
  isMessageModalOpen: boolean;
  pendingMessage: MessageParams | null;
}

const MessageContext = createContext<MessageContextValue | null>(null);

export function useMessage() {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error("useMessage must be used within MessageProvider");
  }
  return context;
}

interface MessageProviderProps {
  children: ReactNode;
}

export function MessageProvider({ children }: MessageProviderProps) {
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<MessageParams | null>(null);

  const initiateMessage = (params: MessageParams) => {
    setPendingMessage(params);
    setIsMessageModalOpen(true);
  };

  const handleClose = () => {
    setIsMessageModalOpen(false);
    setPendingMessage(null);
  };

  const handleMessageSent = () => {
    setIsMessageModalOpen(false);
    setPendingMessage(null);
  };

  return (
    <MessageContext.Provider
      value={{
        initiateMessage,
        isMessageModalOpen,
        pendingMessage,
      }}
    >
      {children}
      
      {/* Global Message Modal */}
      <InternalMessageModal
        isOpen={isMessageModalOpen}
        onClose={handleClose}
        onMessageSent={handleMessageSent}
        destinationPhone={pendingMessage?.destinationPhone || ""}
        entityName={pendingMessage?.entityName}
        entityType={pendingMessage?.entityType}
        entityId={pendingMessage?.entityId}
        storeId={pendingMessage?.storeId}
        businessId={pendingMessage?.businessId}
        channel={pendingMessage?.channel || "sms"}
      />
    </MessageContext.Provider>
  );
}
