// Public guest-order lookup wrapper.
// Captures the caller IP from x-forwarded-for (browsers cannot supply a
// trustworthy IP) and proxies to the SECURITY DEFINER RPC lookup_guest_order,
// which enforces exact-email match and a 10-per-hour rate limit per IP.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    ""
  );
}

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { order_id?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!isUuid(body.order_id) || typeof body.email !== "string" || body.email.length > 320) {
    return new Response(JSON.stringify({ error: "invalid_input" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase.rpc("lookup_guest_order", {
    p_order_id: body.order_id,
    p_email: body.email,
    p_ip: clientIp(req),
  });

  if (error) {
    console.error("[dd-lookup-guest-order] rpc error", error.message);
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // RPC returns {} for any non-match / rate-limit / invalid — never reveals
  // whether the order id exists. Always 200 + JSON to keep the public surface
  // indistinguishable across outcomes.
  const result = (data ?? {}) as Record<string, unknown>;

  // Tracking is only attached once the RPC has already proven the caller owns
  // the order (non-empty result). Shipment-level fields only — never supplier
  // identity, cost, or margin.
  if (result && Object.keys(result).length > 0) {
    const { data: fulfillments } = await supabase
      .from("marketplace_fulfillments")
      .select("status, tracking_number, carrier, updated_at")
      .eq("order_id", body.order_id);
    result.shipments = (fulfillments ?? []).map((f) => ({
      status: f.status,
      carrier: f.carrier,
      tracking_number: f.tracking_number,
      updated_at: f.updated_at,
      tracking_url: f.tracking_number
        ? `https://www.google.com/search?q=${encodeURIComponent(String(f.tracking_number))}`
        : null,
    }));
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
