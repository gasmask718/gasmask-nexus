import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { note_id, note_body, entity_type, entity_id } = await req.json();
    if (!note_body) throw new Error("note_body is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Call AI for analysis
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a financial analyst for Dynasty Funding. Analyze this account note and return JSON with three fields:
- summary: 1-2 sentence plain English summary of what happened
- action_items: array of specific next steps Dynasty should take
- risk_flags: array of any risks, red flags, or time-sensitive items detected
Be specific. Reference amounts, dates, and institution names when mentioned.`,
          },
          {
            role: "user",
            content: `Entity Type: ${entity_type || "unknown"}\nEntity ID: ${entity_id || "unknown"}\n\nNote:\n${note_body}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_note",
              description: "Return analysis of the account note",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  action_items: { type: "array", items: { type: "string" } },
                  risk_flags: { type: "array", items: { type: "string" } },
                },
                required: ["summary", "action_items", "risk_flags"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_note" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      throw new Error(`AI gateway error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let analysis = { summary: "", action_items: [], risk_flags: [] };

    if (toolCall?.function?.arguments) {
      try {
        analysis = JSON.parse(toolCall.function.arguments);
      } catch {
        analysis = { summary: "Analysis could not be parsed.", action_items: [], risk_flags: [] };
      }
    }

    // Update the note record if note_id provided
    if (note_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from("account_notes")
        .update({
          ai_summary: analysis.summary,
          ai_action_items: analysis.action_items,
          ai_risk_flags: analysis.risk_flags,
          updated_at: new Date().toISOString(),
        })
        .eq("id", note_id);
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-account-note error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
