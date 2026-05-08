import { createContext, useContext, ReactNode, useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
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

export type DeviceLifecycleState = "idle" | "token_fetching" | "creating" | "registering" | "registered" | "error" | "not_configured";

export type MicPermission = "granted" | "denied" | "prompt" | "checking";

export interface VoiceDeviceContextValue {
  isReady: boolean;
  canMakeCalls: boolean;
  disabledReason: string | null;
  isConnecting: boolean;
  activeCall: Call | null;
  callStatus: string;
  isMuted: boolean;
  voiceHealth: VoiceHealth | null;
  tokenExpiresAt: string | null;
  deviceError: string | null;
  deviceState: DeviceLifecycleState;
  registeredAt: string | null;
  micPermission: MicPermission;
  browserCallingConfigured: boolean;
  makeCall: (to: string, params?: Record<string, string>) => Promise<Call | null>;
  hangUp: () => void;
  toggleMute: () => void;
  destroy: () => void;
  refreshToken: () => Promise<void>;
  reinitialize: () => Promise<void>;
  requestMicPermission: () => Promise<void>;
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
// Browser calling is LAZY — Device only initializes when makeCall() is invoked.
// This prevents AccessTokenInvalid (20101), UnknownError (31000), and
// TransportError (31009) from firing on every page load.

export function VoiceDeviceProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
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
  const [micPermission, setMicPermission] = useState<MicPermission>("checking");
  const [browserCallingConfigured, setBrowserCallingConfigured] = useState(false);
  const tokenFunctionName = location.pathname.startsWith("/va") ? "brandaro-voice-token" : "twilio-voice-token";

  const deviceRef = useRef<Device | null>(null);
  const initializingRef = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configCheckedRef = useRef(false);

  const getErrorMessage = useCallback((err: unknown, fallback: string) => {
    if (err instanceof Error && err.message?.trim()) return err.message.trim();
    if (typeof err === "string" && err.trim()) return err.trim();
    if (err && typeof err === "object") {
      const maybeMessage = (err as { message?: unknown }).message;
      if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage.trim();
    }
    return fallback;
  }, []);

  // ── Microphone permission ──
  const checkMicPermission = useCallback(async () => {
    try {
      const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
      setMicPermission(result.state as MicPermission);
      result.onchange = () => setMicPermission(result.state as MicPermission);
    } catch {
      setMicPermission("prompt");
    }
  }, []);

  const requestMicPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setMicPermission("granted");
    } catch {
      setMicPermission("denied");
    }
  }, []);

  // ── Token fetch ──

  const fetchToken = useCallback(async (): Promise<string | null> => {
    try {
      setDeviceState("token_fetching");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.warn("[VoiceDevice] No auth session, skipping token fetch");
        setDeviceState("idle");
        return null;
      }

      const { data, error: invokeError } = await supabase.functions.invoke(tokenFunctionName, {
        body: {},
      });

      if (invokeError || !data) {
        const errData = data || {};
        if (errData.health) setVoiceHealth(errData.health);

        // If not configured, silently set state — don't show errors
        if (errData.configured === false || errData.code === "VOICE_CONFIG_INVALID") {
          console.info("[VoiceDevice] Browser calling not configured — this is fine, AI calling is primary");
          setBrowserCallingConfigured(false);
          setDeviceState("not_configured");
          return null;
        }

        const detailedError = errData.error || invokeError?.message || "Token fetch failed";
        console.warn("[VoiceDevice] Token error:", detailedError);
        setVoiceHealth(errData.health ?? null);
        setBrowserCallingConfigured(errData.configured !== false);
        setDeviceError(detailedError);
        setDeviceState("error");
        return null;
      }

      // Handle explicit "not configured" response
      if (data.configured === false) {
        console.info("[VoiceDevice] Browser calling not configured");
        setBrowserCallingConfigured(false);
        setDeviceState("not_configured");
        return null;
      }

      const { token, health, expires_at } = data;

      if (!token || token.length < 200 || token.split(".").length !== 3) {
        console.warn("[VoiceDevice] Invalid token format received");
        setDeviceState("not_configured");
        return null;
      }

      if (health) setVoiceHealth(health);
      if (expires_at) setTokenExpiresAt(expires_at);
      setBrowserCallingConfigured(true);
      setDeviceError(null);

      // Schedule auto-refresh 10 min before expiry
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      const ttlMs = expires_at
        ? new Date(expires_at).getTime() - Date.now() - 10 * 60 * 1000
        : 50 * 60 * 1000;
      if (ttlMs > 0) {
        refreshTimerRef.current = setTimeout(async () => {
          const newToken = await fetchToken();
          if (newToken && deviceRef.current) {
            deviceRef.current.updateToken(newToken);
          }
        }, ttlMs);
      }

      return token;
    } catch (err) {
      console.warn("[VoiceDevice] Network error fetching token:", err);
      setDeviceState("idle");
      return null;
    }
  }, [tokenFunctionName]);

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

  // ── Device init (LAZY — only called from makeCall) ──

  const lastErrorRef = useRef<string | null>(null);

  const initDevice = useCallback(async () => {
    if (initializingRef.current) return;
    if (deviceRef.current && deviceState === "registered") return;
    initializingRef.current = true;

    try {
      const token = await fetchToken();
      if (!token) {
        lastErrorRef.current = deviceState === "not_configured"
          ? "Browser calling not configured (missing Twilio credentials)"
          : "Could not fetch Twilio voice token";
        initializingRef.current = false;
        return;
      }

      // If device already exists, just refresh token
      if (deviceRef.current) {
        deviceRef.current.updateToken(token);
        initializingRef.current = false;
        return;
      }

      setDeviceState("creating");
      const device = new Device(token, {
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        logLevel: 1,
        // Edge fallback chain bypasses localized DNS/routing failures (53000)
        edge: ["roaming", "ashburn", "dublin", "sydney"],
        // Prioritize signaling traffic via DSCP tagging when supported
        // @ts-expect-error - option exists in @twilio/voice-sdk runtime
        dscp: true,
        closeProtection: true,
        allowIncomingWhileBusy: false,
        maxCallSignalingTimeoutMs: 30000,
        // @ts-expect-error - improves precision of signaling errors (incl. 53000)
        enableImprovedSignalingErrorPrecision: true,
      });

      device.on("registered", () => {
        setIsReady(true);
        setDeviceError(null);
        lastErrorRef.current = null;
        setDeviceState("registered");
        setRegisteredAt(new Date().toISOString());
        signalingRetryRef.current = 0;
      });

      device.on("unregistered", () => {
        setIsReady(false);
        setDeviceState("idle");
      });

      device.on("error", async (err: any) => {
        const code: number | undefined = err?.code;
        const message = getErrorMessage(err, "Voice device error");
        console.warn("[VoiceDevice] Device error:", code, message);

        // 53000 = signaling ConnectionError. Auto-retry once with token refresh
        // before surfacing to the VA.
        if (code === 53000 && signalingRetryRef.current < 1) {
          signalingRetryRef.current += 1;
          console.warn("[VoiceDevice] 53000 detected — auto-retrying signaling (attempt 1)");
          toast.warning("Voice signaling glitch — reconnecting…");
          try {
            const fresh = await fetchToken();
            if (fresh && deviceRef.current) {
              deviceRef.current.updateToken(fresh);
              await deviceRef.current.register();
              return;
            }
          } catch (retryErr) {
            console.warn("[VoiceDevice] 53000 retry failed:", retryErr);
          }
        }

        setDeviceError(message);
        lastErrorRef.current = message;
        setDeviceState("error");
        setIsReady(false);
        if (code === 53000) {
          toast.error("Voice connection lost (53000). Check network/firewall and click Reinit.", { duration: 8000 });
        } else if (activeCall || isConnecting) {
          toast.error(`Voice error: ${message}`);
        }
      });

      device.on("tokenWillExpire", async () => {
        const newToken = await fetchToken();
        if (newToken && deviceRef.current) {
          deviceRef.current.updateToken(newToken);
        }
      });

      device.on("incoming", (call: Call) => {
        call.accept();
        setupCallHandlers(call);
      });

      setDeviceState("registering");
      await device.register();
      deviceRef.current = device;
    } catch (err) {
      const msg = getErrorMessage(err, lastErrorRef.current || deviceError || "Voice device failed to initialize");
      console.warn("[VoiceDevice] Device init error:", msg);
      setDeviceError(msg);
      lastErrorRef.current = msg;
      setDeviceState("error");
    } finally {
      initializingRef.current = false;
    }
  }, [fetchToken, setupCallHandlers, deviceState, activeCall, isConnecting, deviceError, getErrorMessage]);

  // ── Actions ──

  const makeCall = useCallback(async (to: string, params?: Record<string, string>): Promise<Call | null> => {
    lastErrorRef.current = null;
    // Lazy init — only create Device when user actually tries to call
    if (!deviceRef.current) {
      await initDevice();
      if (!deviceRef.current) {
        const reason = lastErrorRef.current
          || (deviceState === "not_configured"
            ? "Browser calling not configured. Use AI Call or Manual Call instead."
            : "Voice device not ready. Please try again.");
        toast.error(reason);
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
      const msg = getErrorMessage(err, lastErrorRef.current || deviceError || "Failed to connect call");
      console.error("[VoiceDevice] Connect error:", msg);
      toast.error(`Failed to connect call: ${msg}`);
      setDeviceError(msg);
      lastErrorRef.current = msg;
      setIsConnecting(false);
      setCallStatus("failed");
      return null;
    }
  }, [initDevice, setupCallHandlers, deviceState, deviceError, getErrorMessage]);

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

  const reinitialize = useCallback(async () => {
    destroy();
    initializingRef.current = false;
    await initDevice();
  }, [destroy, initDevice]);

  const refreshToken = useCallback(async () => {
    const token = await fetchToken();
    if (token && deviceRef.current) {
      deviceRef.current.updateToken(token);
    }
  }, [fetchToken]);

  // ── On mount: only check mic permission, do NOT init Device ──
  useEffect(() => {
    checkMicPermission();
    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [checkMicPermission]);

  const canMakeCalls = deviceState === "registered" && micPermission === "granted";
  const disabledReason = deviceState === "not_configured"
    ? "Browser calling not configured — use AI Call or Manual Call"
    : deviceState !== "registered"
      ? "Voice device not registered"
      : micPermission !== "granted"
        ? "Microphone permission required"
        : null;

  const value: VoiceDeviceContextValue = {
    isReady,
    canMakeCalls,
    disabledReason,
    isConnecting,
    activeCall,
    callStatus,
    isMuted,
    voiceHealth,
    tokenExpiresAt,
    deviceError,
    deviceState,
    registeredAt,
    micPermission,
    browserCallingConfigured,
    makeCall,
    hangUp,
    toggleMute,
    destroy,
    refreshToken,
    reinitialize,
    requestMicPermission,
  };

  return (
    <VoiceDeviceContext.Provider value={value}>
      {children}
    </VoiceDeviceContext.Provider>
  );
}
