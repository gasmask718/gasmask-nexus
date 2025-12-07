import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storeId, insightText, category, profileSummary } = await req.json();
    
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const categoryContext = {
      red_flag: "risk flag or warning signal",
      opportunity: "growth opportunity or upsell potential",
      pattern: "behavioral pattern or operational insight",
    };

    const systemPrompt = `You are an expert CRM advisor for a retail/wholesale distribution business.
Your role is to help sales reps and account managers understand customer insights and take action.

When given a customer insight, provide:
1. A clear explanation of why this matters for the business relationship
2. 2-3 recommended conversation scripts to use with the customer
3. 2-3 concrete next actions to assign to team members

Respond in JSON format:
{
  "explanation": "Clear explanation of the insight's significance",
  "scripts": ["Script 1", "Script 2", "Script 3"],
  "actions": ["Action 1", "Action 2", "Action 3"]
}`;

    const userPrompt = `Analyze this ${categoryContext[category as keyof typeof categoryContext] || "insight"} for store ${storeId}:

Insight: "${insightText}"
${profileSummary ? `\nCustomer context: ${profileSummary}` : ""}

Provide actionable guidance for the sales team.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI error:", errorText);
      return new Response(
        JSON.stringify({ error: "AI processing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse the JSON response
    let result = {
      explanation: "",
      scripts: [] as string[],
      actions: [] as string[],
    };

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      result = {
        explanation: content,
        scripts: ["Ask clarifying questions about their situation."],
        actions: ["Schedule a follow-up meeting."],
      };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in explain-customer-insight:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
