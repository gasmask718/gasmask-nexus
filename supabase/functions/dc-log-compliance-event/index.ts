// Dynasty Connect — client-callable relay to append rows to
// public.dc_compliance_events (INSERT is service_role only, so the
// browser cannot write directly). Fire-and-forget from the client's
// perspective: this function always returns 200 with { logged: bool }.

import { createClient } from "npm:@supabase/supabase-js@2";
import { logComplianceEvent } from "../_shared/dc_sync_log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_EVENT_TYPES = new Set([
  "consent_capture",
  "opt_out",
  "disclosure_played",
  "kill_switch_engaged",
  "kill_switch_released",
  "dnc_added",
  "dnc_removed",
  "manual_disposition_override",
  "regulatory_export_requested",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ logged: false, error: "Invalid JSON body" }, 400);
    }

    const {
      event_type,
      business_unit_key,
      lead_id,
      source_table,
      call_id,
      actor,
      event_data,
      occurred_at,
    } = body as Record<string, unknown>;

    if (typeof event_type !== "string" || !ALLOWED_EVENT_TYPES.has(event_type)) {
      return json({ logged: false, error: `Invalid event_type: ${event_type}` }, 400);
    }

    // Resolve actor_user_id from the caller's JWT if available (don't trust body).
    let actor_user_id: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const userClient = createClient(SUPABASE_URL, ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: userData } = await userClient.auth.getUser();
        actor_user_id = userData?.user?.id ?? null;
      } catch {
        actor_user_id = null;
      }
    }

    const service = createClient(SUPABASE_URL, SERVICE_KEY);

    await logComplianceEvent(service, {
      event_type,
      business_unit_key: typeof business_unit_key === "string" ? business_unit_key : null,
      lead_id: typeof lead_id === "string" ? lead_id : null,
      source_table: typeof source_table === "string" ? source_table : null,
      call_id: typeof call_id === "string" ? call_id : null,
      actor: typeof actor === "string" ? actor : "manual_admin",
      actor_user_id,
      event_data: (event_data && typeof event_data === "object") ? event_data as Record<string, unknown> : {},
      occurred_at: typeof occurred_at === "string" ? occurred_at : undefined,
    });

    return json({ logged: true });
  } catch (e) {
    return json({ logged: false, error: (e as Error).message ?? "Unknown error" }, 500);
  }
});
