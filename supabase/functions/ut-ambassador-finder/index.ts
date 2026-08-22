import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTwilioSms } from "../_shared/twilioSend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { action, prospects } = await req.json();

  if (action === "score_prospects") {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured. Scoring unavailable." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const scoringResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{
            role: "user",
            content: `You are scoring social media influencers as potential ambassadors for Unforgettable Times — a luxury event planning platform in NY, NJ, ATL, MIA, PHI.

Score each prospect and write a personalized DM message.

Scoring criteria:
- Followers 1K-100K = ideal (score higher than mega influencers)
- Engagement rate 3%+ = excellent
- Posts about events, parties, nightlife, birthdays = perfect match
- Location in target cities = bonus points
- Authentic looking profile = higher score

Grade A = score 75-100 (perfect fit, DM immediately)
Grade B = score 50-74 (good fit, email first)
Grade C = score 0-49 (weak fit, watchlist only)

Return ONLY a JSON array:
[{"username":"their_username","grade":"A","score":85,"ai_summary":"Why they fit in 1 sentence","ai_dm_message":"Personalized DM under 150 chars with [LINK] placeholder","ai_email_message":"Longer personalized email","brand_alignment_score":85,"audience_quality_score":78}]

Prospects to score:
${JSON.stringify(prospects)}`,
          }],
        }),
      });

      const scoringData = await scoringResponse.json();
      const scores = JSON.parse(
        scoringData.content[0].text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      );

      for (const s of scores) {
        await supabase
          .from("ut_ambassador_prospects")
          .update({
            grade: s.grade,
            score: s.score,
            ai_summary: s.ai_summary,
            ai_dm_message: s.ai_dm_message,
            ai_email_message: s.ai_email_message,
            brand_alignment_score: s.brand_alignment_score,
            audience_quality_score: s.audience_quality_score,
            updated_at: new Date().toISOString(),
          })
          .eq("username", s.username);
      }

      return new Response(
        JSON.stringify({ success: true, scored: scores.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Scoring failed", detail: e.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  if (action === "send_dm_alert") {
    const { data: topProspects } = await supabase
      .from("ut_ambassador_prospects")
      .select("username, platform, grade, score, city, followers_count")
      .eq("grade", "A")
      .eq("status", "prospect")
      .order("score", { ascending: false })
      .limit(5);

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER");

    if (accountSid && authToken && fromNumber && topProspects?.length) {
      const topList = topProspects
        .map((p: any) => `@${p.username} (${p.platform}) ${p.followers_count?.toLocaleString()} followers`)
        .join("\n");

      await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: "+19295007046",
            From: fromNumber,
            Body: `🔥 TOP AMBASSADOR PROSPECTS\n${topList}\nView all in Dynasty OS → Ambassador Finder`,
          }),
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ error: "Unknown action" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
