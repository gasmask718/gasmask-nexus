import { createContext, useContext, ReactNode, useState, useCallback, useRef, useEffect } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ──

export interface VoiceHealth {
  TWILIO_ACCOUNT_SID?: boolean;
  TWILIO_API_SID?: boolean;
  TWILIO_API_SECRET?: boolean;
  TWILIO_TWIML_APP_SID?: boolean;
}

export type DeviceLifecycleState = "idle" | "token_fetching" | "creating" | "registering" | "registered" | "error";

export interface VoiceDeviceContextValue {
  isReady: boolean;
  isConnecting: boolean;
  activeCall: Call | null;
  callStatus: string;
  isMuted: boolean;
  voiceHealth: VoiceHealth | null;
  tokenExpiresAt: string | null;
  deviceError: string | null;
  deviceState: DeviceLifecycleState;
  registeredAt: string | null;
  makeCall: (to: string, params?: Record<string, string>) => Promise<Call | null>;
  hangUp: () => void;
  toggleMute: () => void;
  destroy: () => void;
  refreshToken: () => Promise<void>;
}

// ── Context ──

const VoiceDeviceContext = createContext<VoiceDeviceContextValue | null>(null);

export function useVoiceDevice(): VoiceDeviceContextValue {
  const ctx = useContext(VoiceDeviceContext);
  if (!ctx) {
    throw new Error("useVoiceDevice must be used within <VoiceDeviceProvider>");
  }
  return ctx;
}

// ── Provider (single Device authority) ──

export function VoiceDeviceProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [callStatus, setCallStatus] = useState("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [voiceHealth, setVoiceHealth] = useState<VoiceHealth | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [deviceState, setDeviceState] = useState<DeviceLifecycleState>("idle");
  const [registeredAt, setRegisteredAt] = useState<string | null>(null);

  const deviceRef = useRef<Device | null>(null);
  const initializingRef = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Token fetch ──

  const fetchToken = useCallback(async (): Promise<string | null> => {
    try {
      setDeviceState("token_fetching");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error("❌ No auth session for voice token");
        setDeviceError("Not authenticated");
        setDeviceState("error");
        return null;
      }

      const { data, error: invokeError } = await supabase.functions.invoke("twilio-voice-token", {
        body: {},
      });

      if (invokeError || !data) {
        console.error("❌ Voice token error:", invokeError);
        const errData = data || {};
        if (errData.details) console.error("🔑 Credential issues:", errData.details);
        if (errData.hint) console.warn("💡", errData.hint);
        if (errData.health) setVoiceHealth(errData.health);
        setDeviceError(
          errData.code === "VOICE_CONFIG_INVALID"
            ? "Voice credentials misconfigured"
            : errData.error || invokeError?.message || "Token fetch failed"
        );
        setDeviceState("error");
        return null;
      }

      const { token, health, expires_at } = data;

      if (!token || token.length < 200 || token.split(".").length !== 3) {
        console.error("❌ Token pre-flight failed: invalid JWT format");
        setDeviceError("Invalid token format received");
        setDeviceState("error");
        return null;
      }

      if (health) setVoiceHealth(health);
      if (expires_at) setTokenExpiresAt(expires_at);
      setDeviceError(null);

      // Schedule auto-refresh 10 min before expiry
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      const ttlMs = expires_at
        ? new Date(expires_at).getTime() - Date.now() - 10 * 60 * 1000
        : 50 * 60 * 1000;
      if (ttlMs > 0) {
        refreshTimerRef.current = setTimeout(async () => {
          console.log("🔄 Auto-refreshing voice token...");
          const newToken = await fetchToken();
          if (newToken && deviceRef.current) {
            deviceRef.current.updateToken(newToken);
          }
        }, ttlMs);
      }

      return token;
    } catch (err) {
      console.error("❌ Failed to fetch voice token:", err);
      setDeviceError("Network error fetching token");
      setDeviceState("error");
      return null;
    }
  }, []);

  // ── Call handlers ──

  const setupCallHandlers = useCallback((call: Call) => {
    setActiveCall(call);
    setIsConnecting(false);

    call.on("accept", () => setCallStatus("in-progress"));
    call.on("ringing", () => setCallStatus("ringing"));
    call.on("disconnect", () => {
      setCallStatus("completed");
      setActiveCall(null);
      setIsMuted(false);
      setIsConnecting(false);
    });
    call.on("cancel", () => {
      setCallStatus("cancelled");
      setActiveCall(null);
      setIsMuted(false);
      setIsConnecting(false);
    });
    call.on("error", () => {
      setCallStatus("failed");
      setActiveCall(null);
      setIsMuted(false);
      setIsConnecting(false);
    });
    call.on("reconnecting", () => setCallStatus("reconnecting"));
    call.on("reconnected", () => setCallStatus("in-progress"));
  }, []);

  // ── Device init (runs once) ──

  const initDevice = useCallback(async () => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    try {
      const token = await fetchToken();
      if (!token) {
        initializingRef.current = false;
        return;
      }

      // If device already exists, just refresh token
      if (deviceRef.current) {
        deviceRef.current.updateToken(token);
        console.log("🔄 Twilio Device token refreshed");
        initializingRef.current = false;
        return;
      }

      setDeviceState("creating");
      const device = new Device(token, {
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        logLevel: 1,
      });

      device.on("registered", () => {
        console.log("✅ Twilio Device registered");
        setIsReady(true);
        setDeviceError(null);
        setDeviceState("registered");
        setRegisteredAt(new Date().toISOString());
      });

      device.on("unregistered", () => {
        console.log("⚠️ Twilio Device unregistered");
        setIsReady(false);
        setDeviceState("idle");
      });

      device.on("error", (err) => {
        console.error("❌ Twilio Device error:", err);
        setDeviceError(err.message);
        setDeviceState("error");
        setIsReady(false);
        toast.error(`Voice error: ${err.message}`);
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
        call.accept();
        setupCallHandlers(call);
      });

      setDeviceState("registering");
      await device.register();
      deviceRef.current = device;

      // Debug access
      (window as any).voiceDevice = device;
    } catch (err) {
      console.error("❌ Device init error:", err);
      setDeviceError(err instanceof Error ? err.message : String(err));
      setDeviceState("error");
    } finally {
      initializingRef.current = false;
    }
  }, [fetchToken, setupCallHandlers]);

  // ── Actions ──

  const makeCall = useCallback(async (to: string, params?: Record<string, string>): Promise<Call | null> => {
    if (!deviceRef.current) {
      await initDevice();
      if (!deviceRef.current) {
        toast.error("Voice calling not ready. Please try again.");
        return null;
      }
    }
    try {
      setIsConnecting(true);
      setCallStatus("connecting");
      const call = await deviceRef.current.connect({ params: { To: to, ...params } });
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

  const hangUp = useCallback(() => {
    if (activeCall) {
      activeCall.disconnect();
      setActiveCall(null);
      setCallStatus("completed");
      setIsMuted(false);
    }
  }, [activeCall]);

  const toggleMute = useCallback(() => {
    if (activeCall) {
      const newMuted = !isMuted;
      activeCall.mute(newMuted);
      setIsMuted(newMuted);
    }
  }, [activeCall, isMuted]);

  const destroy = useCallback(() => {
    if (deviceRef.current) {
      deviceRef.current.destroy();
      deviceRef.current = null;
      setIsReady(false);
      setActiveCall(null);
      setCallStatus("idle");
      setDeviceState("idle");
    }
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  const refreshToken = useCallback(async () => {
    const token = await fetchToken();
    if (token && deviceRef.current) {
      deviceRef.current.updateToken(token);
    }
  }, [fetchToken]);

  // ── Init on mount, cleanup on unmount ──

  useEffect(() => {
    initDevice();
    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      (window as any).voiceDevice = null;
    };
  }, [initDevice]);

  const value: VoiceDeviceContextValue = {
    isReady,
    isConnecting,
    activeCall,
    callStatus,
    isMuted,
    voiceHealth,
    tokenExpiresAt,
    deviceError,
    deviceState,
    registeredAt,
    makeCall,
    hangUp,
    toggleMute,
    destroy,
    refreshToken,
  };

  return (
    <VoiceDeviceContext.Provider value={value}>
      {children}
    </VoiceDeviceContext.Provider>
  );
}
