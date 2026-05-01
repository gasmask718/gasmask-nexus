/**
 * Voice Provider Router
 *
 * Single entry point for all TTS voice output. AWS Polly is the only
 * supported synthesis provider — ElevenLabs has been removed from the stack.
 * Conversational voice flows now run through Bland AI (handled outside this
 * router on the telephony side).
 */

import { supabase } from "@/integrations/supabase/client";

export type VoiceProvider = "aws_polly";

interface VoiceRouterRequest {
  text: string;
  provider?: VoiceProvider;
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
    },
  );
  const latencyMs = Date.now() - start;

  if (!response.ok) {
    throw new Error(`AWS Polly TTS failed: ${response.status}`);
  }

  const blob = await response.blob();
  return { blob, latencyMs };
}

/**
 * Generate voice response. AWS Polly is the only provider; the `provider`
 * field is preserved for API compatibility with existing callers.
 */
export async function generateVoiceResponse(request: VoiceRouterRequest): Promise<VoiceRouterResponse> {
  const { text, voiceId, personaId, sessionId, businessId } = request;

  const result = await callAwsPolly(text, voiceId);
  logCostEvent("aws_polly", text.length, personaId, sessionId, businessId);

  return {
    audioBlob: result.blob,
    provider: "aws_polly",
    latencyMs: result.latencyMs,
    wasFallback: false,
  };
}

/** Fire-and-forget cost event logging */
function logCostEvent(
  provider: VoiceProvider,
  charCount: number,
  personaId?: string,
  sessionId?: string,
  businessId?: string,
) {
  const costPerChar = 0.000004; // AWS Polly approximate cost per char
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
