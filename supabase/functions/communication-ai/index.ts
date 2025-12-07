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
    const { type, data } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = "";
    let userPrompt = "";

    switch (type) {
      case "suggest_reply":
        systemPrompt = `You are an AI assistant for a business communication system. 
Generate professional, friendly SMS replies based on the context provided.
Keep messages concise (under 160 characters when possible).
Match the brand's tone and maintain professionalism.`;
        userPrompt = `Brand: ${data.brandName}
Store: ${data.storeName}
Previous message: ${data.previousMessage}
Context: ${data.context || "General follow-up"}

Generate a suggested reply that is professional and on-brand.`;
        break;

      case "rewrite_brand_tone":
        systemPrompt = `You are a brand voice specialist. Rewrite messages to match the brand's unique tone and style.
Keep the core message but adjust the language, energy, and personality.`;
        userPrompt = `Brand: ${data.brandName}
Brand tone: ${data.brandTone || "Professional and friendly"}
Original message: ${data.message}

Rewrite this message to perfectly match the brand voice.`;
        break;

      case "generate_sequence":
        systemPrompt = `You are a marketing automation expert. Create multi-step communication sequences.
Each step should have: type (sms/call/ai-sms/ai-call), content, delay (in hours), and purpose.
Return a JSON array of steps.`;
        userPrompt = `Brand: ${data.brandName}
Goal: ${data.goal}
Target: ${data.targetDescription}
Tone: ${data.tone || "Professional"}
Duration: ${data.duration || "7 days"}

Generate a ${data.stepCount || 5}-step communication sequence. Return as JSON array with format:
[{"step": 1, "type": "sms", "content": "...", "delay_hours": 0, "purpose": "..."}]`;
        break;

      case "generate_call_script":
        systemPrompt = `You are a professional call script writer. Create natural, conversational phone scripts.
Scripts should be warm, professional, and achieve the stated purpose.`;
        userPrompt = `Brand: ${data.brandName}
Purpose: ${data.purpose}
Key points to cover: ${data.keyPoints?.join(", ") || "General check-in"}
Tone: ${data.tone || "Friendly and professional"}

Generate a call script with:
1. Greeting
2. Introduction and purpose
3. 2-3 key questions
4. Response handling for common answers
5. Professional closing

Format as JSON with fields: greeting, introduction, questions (array), responses (object), closing`;
        break;

      case "analyze_sentiment":
        systemPrompt = `You are a sentiment analysis expert. Analyze the sentiment of customer messages.
Return: sentiment (positive/neutral/negative), confidence (0-1), and key indicators.`;
        userPrompt = `Analyze the sentiment of this message:
"${data.message}"

Return JSON: {"sentiment": "positive|neutral|negative", "confidence": 0.0-1.0, "indicators": ["key phrases"]}`;
        break;

      default:
        throw new Error(`Unknown type: ${type}`);
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
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    // Try to parse as JSON if applicable
    let parsed = content;
    if (type === "generate_sequence" || type === "generate_call_script" || type === "analyze_sentiment") {
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[1] : content);
      } catch {
        parsed = content;
      }
    }

    return new Response(JSON.stringify({ result: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Communication AI error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
