/**
 * Voice Resolution Engine
 * 
 * Resolves voice provider + mode using a 4-level hierarchy:
 *   Call Override → Campaign Override → Agent Setting → Global Default
 */

import { supabase } from "@/integrations/supabase/client";

export type VoiceProviderChoice = "aws_polly" | "auto";
export type VoiceMode = "balanced" | "cost_optimized" | "quality_optimized";

export interface ResolvedVoice {
  provider: VoiceProviderChoice;
  mode: VoiceMode;
  voiceId?: string;
  fallbackAllowed: boolean;
  source: "call_override" | "campaign" | "agent" | "global";
}

interface ResolutionInput {
  callOverrideProvider?: string | null;
  callOverrideMode?: string | null;
  campaignId?: string | null;
  agentId?: string | null;
  businessId?: string | null;
}

const VALID_PROVIDERS = new Set(["aws_polly", "auto"]);
const VALID_MODES = new Set(["balanced", "cost_optimized", "quality_optimized"]);

function asProvider(v?: string | null): VoiceProviderChoice | null {
  return v && VALID_PROVIDERS.has(v) ? (v as VoiceProviderChoice) : null;
}

function asMode(v?: string | null): VoiceMode | null {
  return v && VALID_MODES.has(v) ? (v as VoiceMode) : null;
}

/**
 * Resolve the voice provider using hierarchical override logic.
 * Call Override → Campaign → Agent → Global Default
 */
export async function resolveVoiceProvider(input: ResolutionInput): Promise<ResolvedVoice> {
  // 1. Call-level override (highest priority)
  const callProvider = asProvider(input.callOverrideProvider);
  const callMode = asMode(input.callOverrideMode);
  if (callProvider) {
    return {
      provider: callProvider,
      mode: callMode || "balanced",
      fallbackAllowed: callProvider === "auto",
      source: "call_override",
    };
  }

  // 2. Campaign-level override
  if (input.campaignId) {
    const { data: campaign } = await supabase
      .from("ai_call_campaigns")
      .select("voice_provider_override, voice_mode_override")
      .eq("id", input.campaignId)
      .maybeSingle();

    const campProvider = asProvider(campaign?.voice_provider_override);
    if (campProvider) {
      return {
        provider: campProvider,
        mode: asMode(campaign?.voice_mode_override) || "balanced",
        fallbackAllowed: campProvider === "auto",
        source: "campaign",
      };
    }
  }

  // 3. Agent-level setting
  if (input.agentId) {
    const { data: agent } = await supabase
      .from("ai_agents")
      .select("voice_provider, voice_mode")
      .eq("id", input.agentId)
      .maybeSingle();

    const agentProvider = asProvider(agent?.voice_provider);
    if (agentProvider) {
      return {
        provider: agentProvider,
        mode: asMode(agent?.voice_mode) || "balanced",
        fallbackAllowed: agentProvider === "auto",
        source: "agent",
      };
    }
  }

  // 4. Global business default
  if (input.businessId) {
    const { data: settings } = await supabase
      .from("dialer_settings")
      .select("default_voice_provider, default_voice_mode")
      .eq("business_id", input.businessId)
      .maybeSingle();

    const globalProvider = asProvider(settings?.default_voice_provider);
    if (globalProvider) {
      return {
        provider: globalProvider,
        mode: asMode(settings?.default_voice_mode) || "balanced",
        fallbackAllowed: true,
        source: "global",
      };
    }
  }

  // Ultimate fallback
  return {
    provider: "auto",
    mode: "balanced",
    fallbackAllowed: true,
    source: "global",
  };
}
