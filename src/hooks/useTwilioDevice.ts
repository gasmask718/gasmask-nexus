import { useState, useEffect, useCallback, useRef } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface VoiceHealth {
  TWILIO_ACCOUNT_SID?: boolean;
  TWILIO_API_SID?: boolean;
  TWILIO_API_SECRET?: boolean;
  TWILIO_TWIML_APP_SID?: boolean;
}

interface UseTwilioDeviceReturn {
  isReady: boolean;
  isConnecting: boolean;
  activeCall: Call | null;
  callStatus: string;
  isMuted: boolean;
  voiceHealth: VoiceHealth | null;
  tokenExpiresAt: string | null;
  deviceError: string | null;
  makeCall: (to: string, params?: Record<string, string>) => Promise<Call | null>;
  hangUp: () => void;
  toggleMute: () => void;
  destroy: () => void;
  refreshToken: () => Promise<void>;
}

export function useTwilioDevice(): UseTwilioDeviceReturn {
  const [isReady, setIsReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [callStatus, setCallStatus] = useState("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [voiceHealth, setVoiceHealth] = useState<VoiceHealth | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const initializingRef = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error("❌ No auth session for voice token");
        setDeviceError("Not authenticated");
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
        if (err.details) console.error("🔑 Credential issues:", err.details);
        if (err.hint) console.warn("💡", err.hint);
        if (err.health) setVoiceHealth(err.health);
        setDeviceError(err.code === "VOICE_CONFIG_INVALID"
          ? "Voice credentials misconfigured"
          : err.error || "Token fetch failed");
        return null;
      }

      const data = await response.json();
      const { token, health, expires_at } = data;

      // Pre-flight: token must be a real JWT (3 segments, > 200 chars)
      if (!token || token.length < 200 || token.split(".").length !== 3) {
        console.error("❌ Token pre-flight failed: invalid JWT format");
        setDeviceError("Invalid token format received");
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
      return null;
    }
  }, []);

  const initDevice = useCallback(async () => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    try {
      const token = await fetchToken();
      if (!token) {
        initializingRef.current = false;
        return;
      }

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
        setDeviceError(null);
      });

      device.on("error", (err) => {
        console.error("❌ Twilio Device error:", err);
        setDeviceError(err.message);
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
        call.accept();
        setupCallHandlers(call);
      });

      await device.register();
      deviceRef.current = device;
    } catch (err) {
      console.error("❌ Device init error:", err);
      setDeviceError(err instanceof Error ? err.message : String(err));
    } finally {
      initializingRef.current = false;
    }
  }, [fetchToken]);

  const setupCallHandlers = useCallback((call: Call) => {
    setActiveCall(call);
    setIsConnecting(false);

    call.on("accept", () => { setCallStatus("in-progress"); });
    call.on("ringing", () => { setCallStatus("ringing"); });
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
    call.on("reconnecting", () => { setCallStatus("reconnecting"); });
    call.on("reconnected", () => { setCallStatus("in-progress"); });
  }, []);

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
    }
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  const refreshToken = useCallback(async () => {
    const token = await fetchToken();
    if (token && deviceRef.current) {
      deviceRef.current.updateToken(token);
    }
  }, [fetchToken]);

  useEffect(() => {
    initDevice();
    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [initDevice]);

  return {
    isReady,
    isConnecting,
    activeCall,
    callStatus,
    isMuted,
    voiceHealth,
    tokenExpiresAt,
    deviceError,
    makeCall,
    hangUp,
    toggleMute,
    destroy,
    refreshToken,
  };
}
