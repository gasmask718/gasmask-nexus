// dd-personalize-invite
// POST { wholesaler_id, channel: 'sms'|'email' }
// Returns { subject?, body, ai_generated, fallback_used, context_used }
// One Gemini call; template fallback on any failure.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MODEL = "google/gemini-3-flash-preview";

function templateFallback(channel: string, name: string, company: string) {
  const body = channel === "sms"
    ? `Hi ${name || company}, this is Dynasty Direct. We'd love to bring ${company} onto our wholesale marketplace — quick setup, no listing fees. Reply YES for the invite link.`
    : `Hi ${name || company},\n\nDynasty Direct is a wholesale-direct marketplace connecting verified suppliers like ${company} with retail stores nationwide. Setup takes 10 minutes and there are no listing fees.\n\nIf you're open to a look, I'll send the invite link.\n\n— Dynasty Direct`;
  const subject = channel === "email" ? `${company} on Dynasty Direct?` : undefined;
  return { body, subject };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const j = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { wholesaler_id, channel = "email" } = await req.json();
    if (!wholesaler_id) return j({ error: "wholesaler_id required" }, 400);
    if (!["sms", "email"].includes(channel)) return j({ error: "bad channel" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: w, error: wErr } = await admin
      .from("wholesaler_profiles")
      .select("id, company_name, contact_name, warehouse_city, warehouse_state, status")
      .eq("id", wholesaler_id)
      .maybeSingle();
    if (wErr || !w) return j({ error: wErr?.message ?? "supplier not found" }, 404);

    const fallback = templateFallback(channel, w.contact_name ?? "", w.company_name ?? "");
    const context = {
      company: w.company_name,
      contact: w.contact_name,
      city: w.warehouse_city,
      state: w.warehouse_state,
      status: w.status,
      status: w.status,
    };

    if (!LOVABLE_API_KEY) {
      return j({ ...fallback, ai_generated: false, fallback_used: true, context_used: context });
    }

    try {
      const system = `You write the first-touch invite from Dynasty Direct (a wholesale-direct marketplace) to a prospective supplier. Channel: ${channel.toUpperCase()}. Voice: warm, plain, B2B, no emoji, no exclamation marks. Operator will edit before sending. ${
        channel === "sms" ? "Plain text. Aim for 1 SMS segment (~160 chars), max 320." : "Short email, 3–5 lines. Include a one-line subject."
      } Reference the context naturally (city, category) only when it fits — never list everything. ${
        channel === "email" ? `Return JSON: {"subject":"...","body":"..."}` : `Return JSON: {"body":"..."}`
      }`;
      const userPrompt = `Compose the invite for:\n${JSON.stringify(context, null, 2)}`;

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "system", content: system }, { role: "user", content: userPrompt }],
          response_format: { type: "json_object" },
        }),
      });
      if (!resp.ok) throw new Error(`ai ${resp.status}`);
      const data = await resp.json();
      const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
      const body = String(parsed.body ?? "").trim();
      if (!body) throw new Error("empty ai body");
      return j({
        body,
        subject: parsed.subject ? String(parsed.subject).trim() : fallback.subject,
        ai_generated: true,
        fallback_used: false,
        model: MODEL,
        context_used: context,
      });
    } catch (aiErr) {
      return j({ ...fallback, ai_generated: false, fallback_used: true, fallback_reason: String((aiErr as Error).message), context_used: context });
    }
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});
