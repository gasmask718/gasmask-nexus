/**
 * Voice Provider Router
 * 
 * Single entry point for all TTS voice output.
 * Routes to ElevenLabs (primary) or AWS Polly (fallback/selectable).
 * Handles automatic fallback on latency threshold breach or provider error.
 */

import { supabase } from "@/integrations/supabase/client";

export type VoiceProvider = "elevenlabs" | "aws_polly";

interface VoiceRouterRequest {
  text: string;
  provider: VoiceProvider;
  voiceId?: string;
  personaId?: string;
  sessionId?: string;
  businessId?: string;
}

interface VoiceRouterResponse {
  audioBlob: Blob;
  provider: VoiceProvider;
  latencyMs: number;
  wasFallback: boolean;
}

interface ProviderSettings {
  default_tts_provider: VoiceProvider;
  fallback_tts_provider: VoiceProvider;
  max_tts_latency_ms: number;
  force_provider: string | null;
}

const DEFAULT_SETTINGS: ProviderSettings = {
  default_tts_provider: "elevenlabs",
  fallback_tts_provider: "aws_polly",
  max_tts_latency_ms: 1200,
  force_provider: null,
};

async function callElevenLabs(text: string, voiceId?: string): Promise<{ blob: Blob; latencyMs: number }> {
  const start = Date.now();
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ text, voice_id: voiceId }),
    }
  );
  const latencyMs = Date.now() - start;

  if (!response.ok) {
    throw new Error(`ElevenLabs TTS failed: ${response.status}`);
  }

  const blob = await response.blob();
  return { blob, latencyMs };
}

async function callAwsPolly(text: string, voiceId?: string): Promise<{ blob: Blob; latencyMs: number }> {
  const start = Date.now();
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aws-polly-tts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ text, voice_id: voiceId }),
    }
  );
  const latencyMs = Date.now() - start;

  if (!response.ok) {
    throw new Error(`AWS Polly TTS failed: ${response.status}`);
  }

  const blob = await response.blob();
  return { blob, latencyMs };
}

async function callProvider(provider: VoiceProvider, text: string, voiceId?: string) {
  return provider === "elevenlabs"
    ? callElevenLabs(text, voiceId)
    : callAwsPolly(text, voiceId);
}

/**
 * Fetch provider settings for a business, with sensible defaults.
 */
export async function getProviderSettings(businessId?: string): Promise<ProviderSettings> {
  if (!businessId) return DEFAULT_SETTINGS;

  const { data } = await supabase
    .from("voice_provider_settings")
    .select("default_tts_provider, fallback_tts_provider, max_tts_latency_ms, force_provider")
    .eq("business_id", businessId)
    .maybeSingle();

  if (!data) return DEFAULT_SETTINGS;

  return {
    default_tts_provider: (data.default_tts_provider as VoiceProvider) || DEFAULT_SETTINGS.default_tts_provider,
    fallback_tts_provider: (data.fallback_tts_provider as VoiceProvider) || DEFAULT_SETTINGS.fallback_tts_provider,
    max_tts_latency_ms: data.max_tts_latency_ms ?? DEFAULT_SETTINGS.max_tts_latency_ms,
    force_provider: data.force_provider,
  };
}

/**
 * Generate voice response through the provider router.
 * Handles automatic fallback on error or latency threshold breach.
 */
export async function generateVoiceResponse(request: VoiceRouterRequest): Promise<VoiceRouterResponse> {
  const { text, provider, voiceId, personaId, sessionId, businessId } = request;

  // Load settings for fallback logic
  const settings = await getProviderSettings(businessId);
  const effectiveProvider = settings.force_provider
    ? (settings.force_provider as VoiceProvider)
    : provider;

  let wasFallback = false;
  let usedProvider = effectiveProvider;

  try {
    const result = await callProvider(effectiveProvider, text, voiceId);

    // Check latency threshold — trigger fallback if exceeded
    if (
      result.latencyMs > settings.max_tts_latency_ms &&
      effectiveProvider !== settings.fallback_tts_provider &&
      !settings.force_provider
    ) {
      console.warn(
        `⚠️ ${effectiveProvider} latency ${result.latencyMs}ms > threshold ${settings.max_tts_latency_ms}ms — falling back`
      );
      const fallbackResult = await callProvider(settings.fallback_tts_provider, text, voiceId);
      wasFallback = true;
      usedProvider = settings.fallback_tts_provider;

      logCostEvent(usedProvider, text.length, personaId, sessionId, businessId);

      return {
        audioBlob: fallbackResult.blob,
        provider: usedProvider,
        latencyMs: fallbackResult.latencyMs,
        wasFallback: true,
      };
    }

    logCostEvent(usedProvider, text.length, personaId, sessionId, businessId);

    return {
      audioBlob: result.blob,
      provider: usedProvider,
      latencyMs: result.latencyMs,
      wasFallback: false,
    };
  } catch (error) {
    // Primary failed — attempt fallback
    if (!settings.force_provider && effectiveProvider !== settings.fallback_tts_provider) {
      console.warn(`❌ ${effectiveProvider} failed, falling back to ${settings.fallback_tts_provider}`);
      try {
        const fallbackResult = await callProvider(settings.fallback_tts_provider, text, voiceId);
        usedProvider = settings.fallback_tts_provider;

        logCostEvent(usedProvider, text.length, personaId, sessionId, businessId);

        return {
          audioBlob: fallbackResult.blob,
          provider: usedProvider,
          latencyMs: fallbackResult.latencyMs,
          wasFallback: true,
        };
      } catch (fallbackError) {
        throw new Error(`Both providers failed. Primary: ${error}. Fallback: ${fallbackError}`);
      }
    }
    throw error;
  }
}

/** Fire-and-forget cost event logging */
function logCostEvent(
  provider: VoiceProvider,
  charCount: number,
  personaId?: string,
  sessionId?: string,
  businessId?: string
) {
  // Rough cost estimates per character
  const costPerChar = provider === "elevenlabs" ? 0.00003 : 0.000004;
  const estimatedCost = charCount * costPerChar;

  supabase
    .from("voice_cost_events")
    .insert({
      provider,
      characters_generated: charCount,
      estimated_cost: estimatedCost,
      persona_id: personaId || null,
      session_id: sessionId || null,
      business_id: businessId || null,
    })
    .then(({ error }) => {
      if (error) console.warn("Failed to log voice cost event:", error);
    });
}
