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
    const { type, brandName, data } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "brand_summary") {
      systemPrompt = `You are an AI business analyst for a distribution/retail company. 
      Analyze brand performance data and provide actionable insights.
      Be concise, specific, and focus on practical recommendations.
      Format your response as JSON with two fields:
      - summary: A 2-3 sentence overview of brand health
      - topActions: An array of 3-5 specific action items (short strings)`;
      
      userPrompt = `Analyze this brand's performance data for "${brandName}":
      
      - Total Stores: ${data.totalStores}
      - Sticker Compliance: ${data.stickerCompliance}%
      - Stores with door stickers: ${data.doorStickers}
      - Stores with inside stickers: ${data.insideStickers}
      - Open Tasks: ${data.openTasks}
      - Total Contacts: ${data.totalContacts}
      - Stores by Borough: ${JSON.stringify(data.storesByBoro)}
      
      Provide a health summary and top action items.`;
    } else if (type === "smart_tasks") {
      systemPrompt = `You are an AI task generator for a field sales/distribution team.
      Generate specific, actionable tasks based on store and contact data.
      Each task should be clear about what action to take and why.
      Format your response as a JSON array of objects with fields:
      - title: Short task title
      - description: Brief explanation of why this task is important
      - storeId: The store ID if applicable (from provided data), or null
      - contactId: The contact ID if applicable, or null
      - priority: "high", "medium", or "low"`;
      
      userPrompt = `Generate 3-8 smart tasks for brand "${brandName}" based on this data:
      
      Low-scoring stores needing attention:
      ${JSON.stringify(data.lowScoreStores)}
      
      Stores with missing stickers:
      ${JSON.stringify(data.missingStickerStores)}
      
      Contacts with follow-up notes:
      ${JSON.stringify(data.contactsNeedingFollowUp)}
      
      Generate specific, actionable tasks for the field team.`;
    } else {
      throw new Error("Invalid type specified");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    // Try to parse as JSON, handling markdown code blocks
    let parsed;
    try {
      let jsonStr = content;
      // Remove markdown code blocks if present
      if (jsonStr.includes("```json")) {
        jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      } else if (jsonStr.includes("```")) {
        jsonStr = jsonStr.replace(/```\n?/g, "");
      }
      parsed = JSON.parse(jsonStr.trim());
    } catch {
      // If JSON parsing fails, return raw content
      parsed = { raw: content };
    }

    return new Response(JSON.stringify({ result: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("brand-ai-insights error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
