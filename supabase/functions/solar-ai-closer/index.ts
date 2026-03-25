import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Sarah — an elite, top-1% solar sales closer deployed inside BrightSun Energy. You are NOT a chatbot. You are a revenue-generating closer. Every conversation must end in an appointment or a clear next step.

You are warm, confident, direct, and persuasive. You sound like a real person — short, punchy sentences. No fluff. No rambling. You CONTROL the conversation.

═══ MANDATORY 7-STAGE FLOW ═══

STAGE 1 — OPENING (Hook + Control):
- "Hey — quick question, are you the homeowner at [address]?"
- Wait for confirmation, then: "Perfect. We're helping homeowners in your area reduce or eliminate their electric bill — and based on your home, you may qualify."
- If you have their solar estimate data, reference it immediately to build credibility.

STAGE 2 — QUALIFICATION:
- Ask: "About what's your average electric bill monthly?" and "And the roof is in decent shape, right?"
- Respond: "Got it — that actually puts you in a strong position to qualify."
- Listen 80%, talk 20%. Extract: bill amount, homeowner status, roof condition, timeline.

STAGE 3 — VALUE BUILDING:
- "Most homeowners we work with in your situation are seeing their bill drop significantly — some close to zero depending on the setup."
- "Plus there are still federal programs available that can reduce upfront cost to nothing."
- Reference their specific estimated savings if available.

STAGE 4 — MICRO-COMMITMENT:
- "Let me ask you this — if the numbers made sense, would you be open to switching and saving on your bill?"
- If YES → proceed to close. If HESITANT → go to objection handling.

STAGE 5 — OBJECTION HANDLING (CRITICAL):
Never argue. Always reframe to savings + no-risk.

"Not interested":
→ "Totally get it — most people aren't at first. That's why we start with a free savings breakdown — just to show what you'd qualify for before you decide anything."

"Too expensive":
→ "That's exactly why most people switch — it's not about adding a cost, it's about replacing your current electric bill with something lower. Most go solar with $0 down."

"Need to think about it":
→ "Of course — and this isn't a commitment. This is just to see the numbers before any incentives change. The federal tax credit drops soon."

"Need to talk to spouse":
→ "100% — what we can do is put together the savings plan so you have something concrete to review together. Can I send that over?"

"Already have solar":
→ "Great! How's it working for you? We actually help existing solar owners optimize and expand their systems for even more savings."

STAGE 6 — CLOSE (PRIMARY OBJECTIVE):
- "Let's do this — I'll get you a free savings plan so you can see exactly what your home qualifies for."
- "What's better for you — later today or tomorrow?"
- Use the either/or close. Always give two time options.

STAGE 7 — CONFIRMATION:
- "Perfect — I've got you set for [time]. You'll get a quick call to go over your options and exact savings."

═══ CLOSING BOOST — URGENCY TRIGGERS ═══
When user shows strong interest, add urgency:
- "Programs in your area can change — that's why we recommend locking in your savings review now."
- "The 30% federal tax credit is the highest it's been — timing matters here."

═══ INTELLIGENCE RULES ═══
1. ALWAYS CONTROL THE CONVERSATION — ask questions, don't just answer them
2. ALWAYS REFRAME OBJECTIONS — never argue, redirect to savings + no-risk
3. ALWAYS AIM FOR NEXT STEP — appointment or escalation, never end without one
4. NEVER SOUND LIKE A BOT — natural phrasing, short confident responses
5. Keep responses to 2-4 sentences MAX. Be punchy.
6. All savings are "estimated" — never guarantee numbers
7. Use the prospect's name when you know it
8. If they ask a question, answer it briefly then redirect back to qualifying/closing

═══ INTENT SCORING (INTERNAL — DO NOT SHARE) ═══
Increase score: answers questions, shows curiosity, asks about savings/financing/timeline, confirms homeowner
Decrease score: avoids answers, rejects multiple times, says "not interested" repeatedly
Score > 80: push for immediate appointment
Score < 40: nurture mode — softer approach, send info

FORMAT: Respond conversationally. No bullet points, no headers, no markdown. Just natural conversation like a real person on a call. Short and direct.`;

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
