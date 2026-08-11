// dd-log-error — client-side error reporter for Dynasty Direct paths that run
// in the browser (wholesaler product save / upload wizard).
// Validates input, then funnels into the same dd_error_log + SMS escalation
// pipeline used by the DD edge functions.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { logDdError } from "../_shared/ddAlert.ts";

const ALLOWED_SOURCES = new Set([
  "wholesaler-product-save",
  "wholesaler-bulk-upload",
  "dd-checkout-client",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const source = typeof body.source === "string" ? body.source : "";
    const message = typeof body.message === "string" ? body.message : "";
    const severity = body.severity === "warn" ? "warn" : "error";

    if (!ALLOWED_SOURCES.has(source)) {
      return new Response(
        JSON.stringify({ error: `source must be one of: ${[...ALLOWED_SOURCES].join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!message || message.length > 2000) {
      return new Response(
        JSON.stringify({ error: "message is required (1-2000 chars)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const context = (body.context && typeof body.context === "object")
      ? body.context as Record<string, unknown>
      : {};

    const id = await logDdError({ source, message, severity, context });
    return new Response(JSON.stringify({ ok: true, id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
