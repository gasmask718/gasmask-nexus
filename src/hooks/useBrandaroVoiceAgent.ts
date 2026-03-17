import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VoiceAgentScript {
  id: string;
  script_name: string;
  script_version: number;
  is_active: boolean;
  voice_style: Record<string, string>;
  call_structure: string[];
  opening_lines: string[];
  qualification_questions: string[];
  value_positioning: string;
  demo_offer: string;
  soft_close: string;
  hard_close: string;
  failsafe: string;
  behavior_rules: string[];
}

export interface VoiceAgentCall {
  id: string;
  lead_id: string | null;
  script_id: string | null;
  call_sid: string | null;
  campaign_id: string | null;
  call_stage_reached: string;
  objections_encountered: string[];
  objections_handled: string[];
  contact_captured: boolean;
  demo_requested: boolean;
  transferred_to_human: boolean;
  handoff_score: number;
  intent_level: string;
  call_duration_seconds: number | null;
  outcome: string;
  ai_notes: string | null;
  created_at: string;
}

export interface VoiceObjectionStats {
  id: string;
  objection_key: string;
  ai_response: string;
  times_used: number;
  times_converted: number;
  effectiveness_rate: number;
}

export function useVoiceAgentScripts() {
  return useQuery({
    queryKey: ["brandaro-voice-scripts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_voice_agent_scripts")
        .select("*")
        .order("script_version", { ascending: false });
      if (error) throw error;
      return data as VoiceAgentScript[];
    },
  });
}

export function useVoiceAgentCalls(limit = 50) {
  return useQuery({
    queryKey: ["brandaro-voice-agent-calls", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_voice_agent_calls")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as VoiceAgentCall[];
    },
  });
}

export function useVoiceObjectionStats() {
  return useQuery({
    queryKey: ["brandaro-voice-objection-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_voice_objections")
        .select("id, objection_key, ai_response, times_used, times_converted, effectiveness_rate")
        .order("times_used", { ascending: false });
      if (error) throw error;
      return data as VoiceObjectionStats[];
    },
  });
}

export function useVoiceAgentMetrics() {
  return useQuery({
    queryKey: ["brandaro-voice-agent-metrics"],
    queryFn: async () => {
      const { data: calls, error } = await supabase
        .from("brandaro_voice_agent_calls")
        .select("outcome, demo_requested, contact_captured, transferred_to_human, handoff_score, call_duration_seconds");
      if (error) throw error;

      const total = calls?.length || 0;
      const demos = calls?.filter((c: any) => c.demo_requested).length || 0;
      const contacts = calls?.filter((c: any) => c.contact_captured).length || 0;
      const transfers = calls?.filter((c: any) => c.transferred_to_human).length || 0;
      const avgDuration = total > 0
        ? Math.round((calls?.reduce((s: number, c: any) => s + (c.call_duration_seconds || 0), 0) || 0) / total)
        : 0;
      const avgHandoff = total > 0
        ? Math.round((calls?.reduce((s: number, c: any) => s + (c.handoff_score || 0), 0) || 0) / total)
        : 0;

      return {
        total_calls: total,
        demo_rate: total > 0 ? Math.round((demos / total) * 100) : 0,
        contact_capture_rate: total > 0 ? Math.round((contacts / total) * 100) : 0,
        transfer_rate: total > 0 ? Math.round((transfers / total) * 100) : 0,
        avg_duration_seconds: avgDuration,
        avg_handoff_score: avgHandoff,
      };
    },
  });
}
