import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { raw_input, store_name } = await req.json();
    if (!raw_input?.trim()) {
      return new Response(JSON.stringify({ error: "No input provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const today = new Date().toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: `You are a professional note writer for Dynasty OS, a tobacco/grabba retail platform.
Convert the raw input into a clean, professional store visit note.
Store: ${store_name || "Unknown Store"}
Today's date: ${today}

Format:
${today} — Store Visit

Then use labeled sections as needed: Contact, Availability, Product Interest, Follow-up, Notes.
Keep it concise. Preserve all facts. Do not add information not in the original.
Return ONLY the formatted note, no explanation or preamble.`,
        messages: [{ role: "user", content: raw_input }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const cleaned = data.content?.[0]?.text?.trim() || "";

    return new Response(JSON.stringify({ composed_note: cleaned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Note composer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
