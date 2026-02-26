import { useState, useEffect, useCallback, useRef } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * TWILIO VOICE DEVICE HOOK
 * 
 * Manages the Twilio Voice SDK Device for browser-based calling.
 * Handles token fetching, device initialization, and call management.
 */

interface UseTwilioDeviceReturn {
  isReady: boolean;
  isConnecting: boolean;
  activeCall: Call | null;
  callStatus: string;
  isMuted: boolean;
  makeCall: (to: string, params?: Record<string, string>) => Promise<Call | null>;
  hangUp: () => void;
  toggleMute: () => void;
  destroy: () => void;
}

export function useTwilioDevice(): UseTwilioDeviceReturn {
  const [isReady, setIsReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [callStatus, setCallStatus] = useState("idle");
  const [isMuted, setIsMuted] = useState(false);
  const deviceRef = useRef<Device | null>(null);
  const initializingRef = useRef(false);

  // Fetch a voice token from our edge function
  const fetchToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error("❌ No auth session for voice token");
        return null;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-voice-token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({}),
        },
      );

      if (!response.ok) {
        const err = await response.json();
        console.error("❌ Voice token error:", err);
        return null;
      }

      const { token } = await response.json();
      return token;
    } catch (err) {
      console.error("❌ Failed to fetch voice token:", err);
      return null;
    }
  }, []);

  // Initialize or refresh the Twilio Device
  const initDevice = useCallback(async () => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    try {
      const token = await fetchToken();
      if (!token) {
        initializingRef.current = false;
        return;
      }

      // If device exists, just update token
      if (deviceRef.current) {
        deviceRef.current.updateToken(token);
        console.log("🔄 Twilio Device token refreshed");
        initializingRef.current = false;
        return;
      }

      const device = new Device(token, {
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      });

      device.on("registered", () => {
        console.log("✅ Twilio Device registered");
        setIsReady(true);
      });

      device.on("error", (err) => {
        console.error("❌ Twilio Device error:", err);
        toast.error(`Call error: ${err.message}`);
      });

      device.on("tokenWillExpire", async () => {
        console.log("🔄 Token expiring, refreshing...");
        const newToken = await fetchToken();
        if (newToken && deviceRef.current) {
          deviceRef.current.updateToken(newToken);
        }
      });

      device.on("incoming", (call: Call) => {
        console.log("📞 Incoming call from:", call.parameters.From);
        // Auto-accept for now (can add UI later)
        call.accept();
        setupCallHandlers(call);
      });

      await device.register();
      deviceRef.current = device;
    } catch (err) {
      console.error("❌ Device init error:", err);
    } finally {
      initializingRef.current = false;
    }
  }, [fetchToken]);

  // Set up event handlers on a Call object
  const setupCallHandlers = useCallback((call: Call) => {
    setActiveCall(call);
    setIsConnecting(false);

    call.on("accept", () => {
      console.log("✅ Call accepted / connected");
      setCallStatus("in-progress");
    });

    call.on("ringing", () => {
      console.log("🔔 Call ringing");
      setCallStatus("ringing");
    });

    call.on("disconnect", () => {
      console.log("📞 Call disconnected");
      setCallStatus("completed");
      setActiveCall(null);
      setIsMuted(false);
      setIsConnecting(false);
    });

    call.on("cancel", () => {
      console.log("❌ Call cancelled");
      setCallStatus("cancelled");
      setActiveCall(null);
      setIsMuted(false);
      setIsConnecting(false);
    });

    call.on("error", (err) => {
      console.error("❌ Call error:", err);
      setCallStatus("failed");
      setActiveCall(null);
      setIsMuted(false);
      setIsConnecting(false);
    });

    call.on("reconnecting", () => {
      console.log("🔄 Call reconnecting...");
      setCallStatus("reconnecting");
    });

    call.on("reconnected", () => {
      console.log("✅ Call reconnected");
      setCallStatus("in-progress");
    });
  }, []);

  // Make an outbound call
  const makeCall = useCallback(async (to: string, params?: Record<string, string>): Promise<Call | null> => {
    if (!deviceRef.current) {
      // Try to init on-demand
      await initDevice();
      if (!deviceRef.current) {
        toast.error("Voice calling not ready. Please try again.");
        return null;
      }
    }

    try {
      setIsConnecting(true);
      setCallStatus("connecting");

      const connectOptions: Record<string, string> = {
        To: to,
        ...params,
      };

      const call = await deviceRef.current.connect({ params: connectOptions });
      setupCallHandlers(call);
      return call;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("❌ Connect error:", msg);
      toast.error(`Failed to connect call: ${msg}`);
      setIsConnecting(false);
      setCallStatus("failed");
      return null;
    }
  }, [initDevice, setupCallHandlers]);

  // Hang up current call
  const hangUp = useCallback(() => {
    if (activeCall) {
      activeCall.disconnect();
      setActiveCall(null);
      setCallStatus("completed");
      setIsMuted(false);
    }
  }, [activeCall]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (activeCall) {
      const newMuted = !isMuted;
      activeCall.mute(newMuted);
      setIsMuted(newMuted);
    }
  }, [activeCall, isMuted]);

  // Destroy device
  const destroy = useCallback(() => {
    if (deviceRef.current) {
      deviceRef.current.destroy();
      deviceRef.current = null;
      setIsReady(false);
      setActiveCall(null);
      setCallStatus("idle");
    }
  }, []);

  // Init device on mount
  useEffect(() => {
    initDevice();
    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
    };
  }, [initDevice]);

  return {
    isReady,
    isConnecting,
    activeCall,
    callStatus,
    isMuted,
    makeCall,
    hangUp,
    toggleMute,
    destroy,
  };
}
