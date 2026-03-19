import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lead_id, sms_text, phone_number } = await req.json();
    if (!lead_id || !sms_text) {
      return new Response(JSON.stringify({ error: "lead_id and sms_text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        system: `You are an intent classification engine for a sales CRM called Brandaro Digital.
Analyze the SMS reply from a small business owner and return ONLY a valid JSON object.
No explanation. No preamble. Just JSON.

Positive signals: yes, interested, how much, tell me more, send info, when, sounds good, sure, ok let's do it, what's included, pricing, cost, how does it work
Negative signals: stop, not interested, remove me, unsubscribe, no thanks, wrong number, don't contact, do not contact
Neutral: ok, maybe, call me, what is this, who is this, not sure

Return exactly: {"intent":"positive|negative|neutral","score":1-10,"suggested_stage":"interested|lost|responded","reason":"one sentence max"}`,
        messages: [{ role: "user", content: `SMS reply: "${sms_text}"` }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error [${response.status}]: ${errText}`);
    }

    const aiData = await response.json();
    const resultText = aiData.content[0].text.trim();
    let result: { intent: string; score: number; suggested_stage: string; reason: string };

    try {
      result = JSON.parse(resultText);
    } catch {
      // Fallback if AI returns non-JSON
      result = { intent: "neutral", score: 5, suggested_stage: "responded", reason: "Could not parse AI response" };
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auto-move pipeline based on classification
    if (result.suggested_stage !== "responded") {
      await supabase.functions.invoke("brandaro-pipeline-automator", {
        body: {
          action: "record_event",
          lead_id,
          event_type: result.intent === "positive" ? "interest_detected" : "negative_response",
          message_content: sms_text,
        },
      });
    }

    // Update engagement score on qualified leads
    await supabase
      .from("brandaro_qualified_leads")
      .update({ engagement_score: result.score })
      .eq("id", lead_id);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Intent classifier error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
