import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, tone, product, audience_type, audience_count, language_mix } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const toneInstructions: Record<string, string> = {
      friendly: "Warm, conversational, and personable. Like texting a friend.",
      professional: "Professional and business-like. Respectful and direct.",
      arabic: "Use Arabic cultural greetings naturally: Salam, Alhamdulillah, Inshallah, Mashallah. Warm and respectful.",
      urgent: "Create a sense of urgency. Limited time. Act now. But still respectful.",
      promotional: "Exciting product announcement. Highlight value and benefits.",
    };

    const systemPrompt = `You are an SMS copywriter for Dynasty OS, a tobacco and grabba distribution company serving stores in New York and New Jersey.

Products: GasMask Bags, GasMask Tubes, HotMama, Grabba R Us, Hot Scolatti Light, Hot Scolatti Dark, HotScalati Bros ($1 per unit).

You are writing a bulk SMS message to be sent to ${audience_count} ${audience_type}.
Language breakdown: ${language_mix?.arabic || 0} Arabic-speaking, ${language_mix?.spanish || 0} Spanish-speaking, ${language_mix?.english || 0} English-speaking contacts.

Tone: ${toneInstructions[tone] || toneInstructions.friendly}
${product ? `Featured product: ${product}` : ""}

SMS rules:
- Keep it under 160 characters if possible (max 320)
- No links unless necessary
- Include a clear call to action (Reply YES, Call us, Text back)
- Sound like a real person, not a corporate bot
- If sending to a mixed Arabic/English audience, write primarily in English but include a warm Arabic greeting at the start
- Never mention competitors
- Always end with a way to respond

Return ONLY the SMS message text. No explanation, no quotes, no preamble.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Add funds in Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
