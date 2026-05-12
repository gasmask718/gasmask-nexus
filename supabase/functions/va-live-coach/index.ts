// Live VA Call Coach — analyzes rolling transcript chunks with Claude (Anthropic)
// Returns sentiment / buyer intent / coaching tip / next best action / objection
// Persists each analysis to va_live_call_analysis (linked to va_call_logs)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const vaId = userData?.user?.id;
    if (!vaId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      callLogId,
      leadId,
      leadName,
      transcriptChunk,
      cumulativeTranscript,
      durationSeconds,
    } = await req.json();

    if (!transcriptChunk || typeof transcriptChunk !== "string") {
      return new Response(JSON.stringify({ error: "transcriptChunk required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are a real-time sales coach helping a Virtual Assistant on a LIVE phone call with ${leadName || "a prospect"}.
Call duration so far: ${durationSeconds || 0}s.

CUMULATIVE TRANSCRIPT (most recent at bottom):
${(cumulativeTranscript || transcriptChunk).slice(-4000)}

LATEST CHUNK (just spoken):
"${transcriptChunk}"

Analyze and respond with ONLY a compact JSON object — no prose, no markdown:
{
  "sentiment": "positive" | "neutral" | "negative",
  "buyer_intent": "hot" | "warm" | "cold",
  "coaching_tip": "<one short directive the VA should do RIGHT NOW, max 18 words>",
  "next_best_action": "<single concrete next sentence to say, max 25 words>",
  "objection_detected": "<the objection, or null>",
  "key_signal": "<short observation about what just happened>"
}`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 220,
        temperature: 0.1,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      // Fallback to sonnet model name if haiku id rejected
      const errText = await claudeRes.text();
      console.error("Claude err:", claudeRes.status, errText);
      const retry = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 220,
          temperature: 0.1,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!retry.ok) {
        const t = await retry.text();
        throw new Error(`Claude failed: ${retry.status} ${t}`);
      }
      const data = await retry.json();
      return await persistAndReturn(data);
    }

    const data = await claudeRes.json();
    return await persistAndReturn(data);

    async function persistAndReturn(data: any) {
      const raw = data?.content?.[0]?.text ?? "";
      const match = raw.match(/\{[\s\S]*\}/);
      const analysis = match ? safeParse(match[0]) : null;

      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      await admin.from("va_live_call_analysis").insert({
        call_log_id: callLogId || null,
        va_id: vaId,
        lead_id: leadId || null,
        transcript_chunk: transcriptChunk,
        cumulative_transcript: cumulativeTranscript || null,
        sentiment: analysis?.sentiment || null,
        buyer_intent: analysis?.buyer_intent || null,
        coaching_tip: analysis?.coaching_tip || null,
        next_best_action: analysis?.next_best_action || null,
        objection_detected: analysis?.objection_detected || null,
        raw_analysis: analysis || { raw },
      });

      return new Response(JSON.stringify({ analysis }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("va-live-coach error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function safeParse(s: string) {
  try { return JSON.parse(s); } catch { return null; }
}
