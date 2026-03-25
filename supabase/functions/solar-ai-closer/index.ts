import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Sarah, a world-class solar energy sales consultant for BrightSun Energy. You are warm, confident, knowledgeable, and persuasive — like a top closer who genuinely cares about helping homeowners save money.

CORE RULES:
- Always guide toward the next step (qualifying → presenting → handling objections → closing)
- Reduce friction at every stage
- Build subtle urgency without being pushy
- Never sound robotic — speak naturally like a top closer
- Keep responses concise (2-4 sentences max)
- All savings estimates should say "estimated" — never guarantee numbers
- Use the prospect's name when you know it

CLOSING STAGES:
1. OPENER: Direct, no fluff. Establish if they're a homeowner interested in savings.
2. QUALIFYING: Listen 80%. Focus on: homeowner status, electric bill amount, roof condition, timeline.
3. PRESENTING: Share their solar potential. Build belief and excitement.
4. OBJECTION HANDLING: Use Feel/Felt/Found or curiosity redirects. Common objections:
   - "Too expensive" → "$0 down options, savings from day one"
   - "Need to think" → "Free savings plan, no commitment, incentives change soon"
   - "Need spouse" → "Send personalized report for both to review"
   - "Not interested" → "Most happy customers said the same. Can I ask what concerns you?"
5. CLOSE: Push for appointment booking or soft commitment. "Let's lock in your free solar savings report — what time works best?"

INTENT SIGNALS TO WATCH:
- Asking about pricing details = HIGH intent
- Mentioning timeline = HIGH intent
- Asking about financing = HIGH intent
- Mentioning neighbor has solar = MEDIUM intent
- Short/dismissive answers = LOW intent

When you detect HIGH intent, suggest booking immediately.
When you detect an objection, handle it and redirect to value.

FORMAT: Respond conversationally. No bullet points or headers in your responses. Just natural conversation like a real person on a call.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, lead_context, session_id, action } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Action: analyze intent from messages
    if (action === "analyze_intent") {
      const analysisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: `Analyze this solar sales conversation. Return a JSON object with:
- intent_score (0-100): How likely is this lead to convert
- closing_stage: one of [intro, qualify, present, objection, close_attempt, booked, lost]
- objections_detected: array of objection types found
- ai_recommendations: array of next best actions
- sentiment: positive, neutral, or negative` },
            ...messages,
          ],
          tools: [{
            type: "function",
            function: {
              name: "analyze_conversation",
              description: "Analyze a solar sales conversation",
              parameters: {
                type: "object",
                properties: {
                  intent_score: { type: "number" },
                  closing_stage: { type: "string", enum: ["intro", "qualify", "present", "objection", "close_attempt", "booked", "lost"] },
                  objections_detected: { type: "array", items: { type: "string" } },
                  ai_recommendations: { type: "array", items: { type: "string" } },
                  sentiment: { type: "string", enum: ["positive", "neutral", "negative"] }
                },
                required: ["intent_score", "closing_stage", "objections_detected", "ai_recommendations", "sentiment"],
                additionalProperties: false
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "analyze_conversation" } },
        }),
      });

      if (!analysisResponse.ok) {
        if (analysisResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (analysisResponse.status === 402) {
          return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("AI analysis failed");
      }

      const analysisData = await analysisResponse.json();
      let analysis = {};
      try {
        const toolCall = analysisData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall) {
          analysis = JSON.parse(toolCall.function.arguments);
        }
      } catch { analysis = { intent_score: 50, closing_stage: "intro", objections_detected: [], ai_recommendations: ["Continue conversation"], sentiment: "neutral" }; }

      // Update session if we have one
      if (session_id) {
        await supabase.from("solar_closing_sessions").update({
          intent_score: (analysis as any).intent_score,
          closing_stage: (analysis as any).closing_stage,
          objections_detected: (analysis as any).objections_detected,
          ai_recommendations: (analysis as any).ai_recommendations,
        }).eq("id", session_id);
      }

      return new Response(JSON.stringify(analysis), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context-aware system prompt
    let contextPrompt = SYSTEM_PROMPT;
    if (lead_context) {
      contextPrompt += `\n\nCURRENT LEAD CONTEXT:\n- Name: ${lead_context.name || "Unknown"}\n- Address: ${lead_context.address || "Unknown"}\n- Monthly Bill: ${lead_context.monthly_bill || "Unknown"}\n- Estimated Panels: ${lead_context.panels || "Unknown"}\n- Estimated System: ${lead_context.system_kw || "Unknown"} kW\n- Estimated Monthly Savings: $${lead_context.savings || "Unknown"}`;
    }

    // Stream the chat response
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: contextPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("solar-ai-closer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
