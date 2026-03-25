import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

  if (!lovableApiKey) {
    return new Response(
      JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { lead_id, attempt_number } = await req.json();
    if (!lead_id) throw new Error("lead_id required");

    // 1. Fetch lead info — try solar_leads
    const { data: lead } = await supabase
      .from("solar_leads")
      .select("id, full_name, phone, email, address, state, monthly_bill_range, lead_score, status")
      .eq("id", lead_id)
      .maybeSingle();

    if (!lead) throw new Error("Lead not found");

    // 2. Fetch last conversation transcript
    const { data: sessions } = await supabase
      .from("solar_closing_sessions")
      .select("transcript, objection_log, intent_score, created_at")
      .eq("lead_id", lead_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const lastSession = sessions?.[0] || null;

    // 3. Determine tone based on intent
    const intentScore = lead.lead_score || lastSession?.intent_score || 0;
    let toneDirective: string;
    let toneType: string;

    if (intentScore > 80) {
      toneDirective = "DIRECT CLOSE tone. Use urgency and push for immediate booking. Reference their specific savings potential.";
      toneType = "direct_close";
    } else if (intentScore >= 50) {
      toneDirective = "CONVERSATIONAL VALUE tone. Be warm, reference their situation, ask an engaging question about savings.";
      toneType = "value_driven";
    } else {
      toneDirective = "SOFT CURIOSITY tone. Low-pressure, plant a seed, make them curious without pushing.";
      toneType = "soft_curiosity";
    }

    // 4. Build context for AI
    const contextParts: string[] = [];
    if (lead.name) contextParts.push(`Lead name: ${lead.name}`);
    if (lead.monthly_bill) contextParts.push(`Monthly electric bill: $${lead.monthly_bill}`);
    if (lead.state) contextParts.push(`State: ${lead.state}`);
    if (lead.objections_detected) contextParts.push(`Known objections: ${JSON.stringify(lead.objections_detected)}`);
    if (lastSession?.objection_log) contextParts.push(`Recent objections from conversation: ${JSON.stringify(lastSession.objection_log)}`);
    if (lastSession?.transcript) {
      const transcript = typeof lastSession.transcript === 'string' 
        ? lastSession.transcript 
        : JSON.stringify(lastSession.transcript);
      contextParts.push(`Last conversation excerpt (last 500 chars): ${transcript.slice(-500)}`);
    }
    contextParts.push(`Attempt number: ${attempt_number || 1}`);
    contextParts.push(`Intent score: ${intentScore}`);

    const systemPrompt = `You are a top-performing solar sales closer writing a follow-up SMS message for Bright Sun Energy.

RULES:
- Write ONE short SMS message (under 160 characters preferred, max 300)
- Sound 100% human — like a real person texting
- NO emojis, NO caps lock, NO exclamation marks spam
- Reference the lead's specific situation when possible
- ${toneDirective}
- End with a soft question or clear next step
- Never mention "AI" or "automated"
- First name only when addressing them

CONTEXT:
${contextParts.join("\n")}`;

    // 5. Call Lovable AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate the follow-up SMS message now." },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const message = aiData.choices?.[0]?.message?.content?.trim();

    if (!message) throw new Error("AI returned empty message");

    return new Response(
      JSON.stringify({
        message,
        tone_type: toneType,
        intent_score: intentScore,
        confidence_score: intentScore > 80 ? 0.9 : intentScore > 50 ? 0.7 : 0.5,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("AI follow-up generator error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
