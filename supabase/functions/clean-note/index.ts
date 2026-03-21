import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a business notes editor for Dynasty OS, a retail intelligence platform.

The following account note was imported from a legacy system and contains raw HTML tags, HTML-encoded characters (like &amp; &nbsp; &lt; &gt;), and broken UTF-8 characters (like â\u0080\u009c for smart quotes, donâ\u0080\u0099t for doesn't).

Your job:
1. Strip ALL HTML tags completely
2. Decode all HTML entities: &amp; → &, &nbsp; → space, &lt; → <, &gt; → >, &#39; → '
3. Fix all broken characters: â\u0080\u009c → ", â\u0080\u009d → ", â\u0080\u0099 → ', donâ\u0080\u0099t → doesn't, canâ\u0080\u0099t → can't, isnâ\u0080\u0099t → isn't, wonâ\u0080\u0099t → won't, didnâ\u0080\u0099t → didn't
4. Rewrite the content in clear, professional English
5. Preserve ALL factual information — names, phone numbers, dates, addresses, dollar amounts
6. If there is a structured OVERVIEW section (boss name, manager name, store number, etc.), format it as a clean labeled list
7. If there are visit notes with dates, format each as: [DATE] — [Clean note text]
8. Do not add information that was not in the original
9. Do not remove any factual details
10. Return ONLY the cleaned note text — no explanation, no preamble`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rawNote } = await req.json();
    if (!rawNote) {
      return new Response(JSON.stringify({ error: "rawNote is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `RAW NOTE:\n${rawNote}\n\nCLEANED NOTE:`,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited — please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add funds in Settings > Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const cleanedNote =
      data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ cleanedNote }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("clean-note error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
