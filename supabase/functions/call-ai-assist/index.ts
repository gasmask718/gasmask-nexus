import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AIAssistRequest {
  action: "summarize_voicemail" | "tag_intent" | "suggest_routing" | "draft_callback_sms" | "analyze_call_pattern";
  voicemail_id?: string;
  business_id?: string;
  transcript?: string;
  caller_number?: string;
  context?: Record<string, unknown>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const body: AIAssistRequest = await req.json();
    const { action, voicemail_id, business_id, transcript, caller_number, context } = body;

    let result: Record<string, unknown> = {};

    switch (action) {
      case "summarize_voicemail": {
        if (!voicemail_id) throw new Error("voicemail_id is required");

        const { data: voicemail } = await supabase
          .from("voicemails")
          .select("*, business:businesses(name)")
          .eq("id", voicemail_id)
          .single();

        if (!voicemail?.transcription) {
          result = { summary: "No transcription available", intent: "unknown" };
          break;
        }

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `You are an AI assistant analyzing voicemails for a business called "${voicemail.business?.name || 'Unknown'}". 
                
Analyze the voicemail and return a JSON response with:
- summary: A concise 1-2 sentence summary of what the caller wants
- intent: One of: sales, support, complaint, inquiry, urgent, general
- priority_score: 1-10 where 10 is most urgent
- suggested_action: What should be done (e.g., "Call back immediately", "Send pricing info", "Escalate to manager")
- key_details: Any important details like names, numbers, dates mentioned`,
              },
              {
                role: "user",
                content: `Analyze this voicemail transcription:\n\n"${voicemail.transcription}"`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "analyze_voicemail",
                  description: "Analyze the voicemail and extract key information",
                  parameters: {
                    type: "object",
                    properties: {
                      summary: { type: "string" },
                      intent: { type: "string", enum: ["sales", "support", "complaint", "inquiry", "urgent", "general"] },
                      priority_score: { type: "number" },
                      suggested_action: { type: "string" },
                      key_details: { type: "array", items: { type: "string" } },
                    },
                    required: ["summary", "intent", "priority_score", "suggested_action"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "analyze_voicemail" } },
          }),
        });

        if (!aiResponse.ok) {
          if (aiResponse.status === 429) {
            throw new Error("Rate limit exceeded, please try again later");
          }
          if (aiResponse.status === 402) {
            throw new Error("AI credits exhausted");
          }
          throw new Error("AI analysis failed");
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        
        if (toolCall?.function?.arguments) {
          const analysis = JSON.parse(toolCall.function.arguments);
          
          // Update the voicemail with AI analysis
          await supabase
            .from("voicemails")
            .update({
              ai_summary: analysis.summary,
              ai_intent: analysis.intent,
              ai_priority_score: analysis.priority_score,
              ai_suggested_action: analysis.suggested_action,
              ai_analyzed_at: new Date().toISOString(),
            })
            .eq("id", voicemail_id);

          result = analysis;
        }
        break;
      }

      case "draft_callback_sms": {
        const { data: voicemail } = await supabase
          .from("voicemails")
          .select("*, business:businesses(name)")
          .eq("id", voicemail_id)
          .maybeSingle();

        const businessName = voicemail?.business?.name || context?.businessName || "Our team";
        const callerName = voicemail?.caller_name || "there";

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `You are an assistant helping draft professional callback SMS messages for ${businessName}. 
Keep messages under 160 characters, friendly but professional. Reference the caller's voicemail if context provided.`,
              },
              {
                role: "user",
                content: voicemail?.transcription
                  ? `Draft a callback SMS for a caller who left this voicemail: "${voicemail.transcription.substring(0, 200)}"`
                  : `Draft a generic callback SMS for a missed call from ${callerName}`,
              },
            ],
          }),
        });

        if (!aiResponse.ok) throw new Error("Failed to draft SMS");

        const aiData = await aiResponse.json();
        const smsText = aiData.choices?.[0]?.message?.content || 
          `Hi ${callerName}, we received your message and will call you back shortly. - ${businessName}`;

        result = { 
          sms_draft: smsText.substring(0, 160),
          alternatives: [
            `Hi! We missed your call. We'll get back to you ASAP. - ${businessName}`,
            `Thanks for reaching out! A team member will call you shortly. - ${businessName}`,
          ]
        };
        break;
      }

      case "suggest_routing": {
        if (!business_id) throw new Error("business_id required");

        // Analyze recent call patterns
        const { data: recentOutcomes } = await supabase
          .from("call_outcomes")
          .select("outcome, outcome_reason, route_type, is_business_hours")
          .eq("business_id", business_id)
          .order("created_at", { ascending: false })
          .limit(50);

        const missedCount = recentOutcomes?.filter((o: { outcome: string }) => o.outcome === "missed").length || 0;
        const afterHoursMissed = recentOutcomes?.filter(
          (o: { outcome: string; is_business_hours: boolean | null }) => o.outcome === "missed" && o.is_business_hours === false
        ).length || 0;
        const voicemailCount = recentOutcomes?.filter((o: { outcome: string }) => o.outcome === "voicemail").length || 0;
        const totalCalls = recentOutcomes?.length || 0;

        const suggestions: string[] = [];
        
        if (missedCount / totalCalls > 0.3) {
          suggestions.push("High miss rate detected. Consider adding more callable users or extending ring timeout.");
        }
        if (afterHoursMissed > 5) {
          suggestions.push("Multiple after-hours misses. Configure voicemail or on-call rotation for after-hours.");
        }
        if (voicemailCount > 10 && voicemailCount / totalCalls > 0.2) {
          suggestions.push("Many calls going to voicemail. Review staffing levels during peak hours.");
        }

        result = {
          total_calls: totalCalls,
          missed_rate: totalCalls > 0 ? ((missedCount / totalCalls) * 100).toFixed(1) : 0,
          suggestions,
        };
        break;
      }

      case "analyze_call_pattern": {
        if (!caller_number) throw new Error("caller_number required");

        // Get history for this caller
        const { data: callerHistory } = await supabase
          .from("call_outcomes")
          .select("outcome, created_at")
          .eq("caller_number", caller_number)
          .order("created_at", { ascending: false })
          .limit(20);

        const { data: voicemails } = await supabase
          .from("voicemails")
          .select("id, ai_intent, created_at")
          .eq("caller_number", caller_number)
          .order("created_at", { ascending: false })
          .limit(5);

        const callCount = callerHistory?.length || 0;
        const missedCalls = callerHistory?.filter((c: { outcome: string }) => c.outcome === "missed").length || 0;
        const voicemailsLeft = voicemails?.length || 0;

        let priority = "normal";
        let recommendation = "Standard callback";

        if (voicemailsLeft >= 3) {
          priority = "critical";
          recommendation = "Repeat caller - prioritize immediate callback";
        } else if (missedCalls >= 2) {
          priority = "high";
          recommendation = "Multiple missed calls - schedule callback within 30 mins";
        } else if (voicemails?.[0]?.ai_intent === "complaint") {
          priority = "high";
          recommendation = "Complaint detected - escalate to manager";
        }

        result = {
          caller_number,
          total_calls: callCount,
          missed_calls: missedCalls,
          voicemails_left: voicemailsLeft,
          priority,
          recommendation,
          history: callerHistory?.slice(0, 5),
        };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Call AI assist error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
