// Bland AI shared call history API.
// Sara queries this endpoint with the caller's phone to get store + recent
// interaction context. Authenticated via BLAND_API_KEY query param or header.
// verify_jwt = false (Bland authenticates with its own API key)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/dialer.ts";

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const phone = url.searchParams.get("phone") || "";
  const apiKey =
    url.searchParams.get("api_key") ||
    req.headers.get("x-api-key") ||
    "";

  const expected = Deno.env.get("BLAND_API_KEY");
  if (!expected) return json({ error: "BLAND_API_KEY not configured" }, 500);
  if (apiKey !== expected) return json({ error: "Unauthorized" }, 401);
  if (!phone) return json({ error: "phone query param required" }, 400);

  const sb = svc();

  // Find contact
  const { data: contact } = await sb
    .from("store_contacts")
    .select("id, name, store_id, opted_out")
    .eq("phone", phone)
    .limit(1)
    .maybeSingle();

  if (!contact?.store_id) {
    return json({ matched: false, message: "Unknown caller" });
  }

  const { data: store } = await sb
    .from("stores")
    .select("id, name")
    .eq("id", contact.store_id)
    .maybeSingle();

  // Recent comm logs for this store
  const { data: logs } = await sb
    .from("communication_logs")
    .select("channel, direction, message_content, summary, created_at, operator_id, bland_ai_handled")
    .eq("store_id", contact.store_id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Resolve operator names in one batch
  const operatorIds = Array.from(
    new Set((logs || []).map((l: any) => l.operator_id).filter(Boolean)),
  );
  let operatorMap: Record<string, string> = {};
  if (operatorIds.length) {
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, full_name")
      .in("id", operatorIds);
    operatorMap = Object.fromEntries(
      (profiles || []).map((p: any) => [p.id, p.full_name || ""]),
    );
  }

  const recent_interactions = (logs || []).map((l: any) => ({
    channel: l.channel,
    direction: l.direction,
    operator_name: l.operator_id ? operatorMap[l.operator_id] || null : (l.bland_ai_handled ? "Sara (AI)" : null),
    message: l.message_content || l.summary || "",
    created_at: l.created_at,
  }));

  return json({
    matched: true,
    store_id: contact.store_id,
    store_name: store?.name || null,
    contact_id: contact.id,
    contact_name: contact.name || null,
    opted_out: !!contact.opted_out,
    recent_interactions,
  });
});
