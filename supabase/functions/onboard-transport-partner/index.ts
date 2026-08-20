// onboard-transport-partner
// Receives HMAC-signed webhook from Public Site after admin approves a
// transport partner application. Creates a tt_partners row (idempotent).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-webhook-signature, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function verifyHmac(payload: string, signature: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const expectedHex = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // constant-time compare
  if (expectedHex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    diff |= expectedHex.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

const TRANSPORT_CATEGORIES = new Set([
  "driver",
  "fleet_owner",
  "transport",
  "transport_partner",
]);

const SERVICE_TYPE_MAP: Record<string, string> = {
  sedan: "black_truck",
  suv: "black_truck",
  black_car: "black_truck",
  black_truck: "black_truck",
  sprinter: "sprinter",
  van: "sprinter",
  party_bus: "party_bus",
  coach: "coach_bus",
  coach_bus: "coach_bus",
  exotic: "exotic_cars",
  exotic_cars: "exotic_cars",
  helicopter: "helicopter",
  jet: "private_jet",
  private_jet: "private_jet",
  yacht: "yacht",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);

  try {
    const bodyText = await req.text();
    const signature = req.headers.get("x-webhook-signature");

    if (!signature) return json({ ok: false, error: "missing signature" }, 401);

    const secret = Deno.env.get("TOPTIER_ONBOARD_WEBHOOK_SECRET");
    if (!secret) {
      console.error("TOPTIER_ONBOARD_WEBHOOK_SECRET not configured");
      return json({ ok: false, error: "server misconfigured" }, 500);
    }

    const valid = await verifyHmac(bodyText, signature, secret);
    if (!valid) return json({ ok: false, error: "invalid signature" }, 401);

    let parsed: any;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      return json({ ok: false, error: "invalid json" }, 400);
    }

    const { application_data, public_site_application_id } = parsed ?? {};
    if (!application_data?.business_name || !application_data?.email) {
      return json({ ok: false, error: "invalid application_data" }, 400);
    }

    const category: string = String(application_data.partner_category ?? "").toLowerCase();
    if (!TRANSPORT_CATEGORIES.has(category)) {
      return json({ ok: false, error: "not a transport partner category" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotency by external application id
    if (public_site_application_id) {
      const { data: existingActivation } = await supabase
        .from("tt_partners")
        .select("id")
        .eq("application_id_external", public_site_application_id)
        .maybeSingle();

      if (existingActivation) {
        return json({
          ok: true,
          partner_id: existingActivation.id,
          message: "already activated",
        });
      }
    }

    // Duplicate by email
    const { data: existingEmail } = await supabase
      .from("tt_partners")
      .select("id")
      .eq("email", application_data.email)
      .maybeSingle();

    if (existingEmail) {
      return json(
        {
          ok: false,
          error: "partner with this email already exists",
          existing_partner_id: existingEmail.id,
        },
        409,
      );
    }

    const capabilities = application_data.capabilities ?? {};
    const vehicleTypes: string[] = Array.isArray(capabilities.vehicle_types)
      ? capabilities.vehicle_types
      : [];

    const serviceTypes = Array.from(
      new Set(
        vehicleTypes
          .map((v) => SERVICE_TYPE_MAP[String(v).toLowerCase()] ?? String(v).toLowerCase())
          .filter(Boolean),
      ),
    );

    const cities: string[] = Array.isArray(application_data.cities_served)
      ? application_data.cities_served
      : [];

    const { data: newPartner, error: insertErr } = await supabase
      .from("tt_partners")
      .insert({
        name: application_data.business_name,
        business_name: application_data.business_name,
        email: application_data.email,
        phone: application_data.phone ?? null,
        service_category: "transport",
        partner_type: category,
        service_regions: cities,
        status: "active",
        is_active: true,
        portal_status: "invited",
        application_id_external: public_site_application_id ?? null,
        metadata: {
          partner_category: category,
          contact_name: application_data.contact_name ?? null,
          years_in_business: application_data.years_in_business ?? null,
          service_types: serviceTypes,
          stripe_account_id: application_data.stripe_account_id ?? null,
          source: "public_site_application",
          original_capabilities: capabilities,
          activated_via_webhook_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Failed to insert tt_partners:", insertErr);
      return json({ ok: false, error: insertErr.message }, 500);
    }

    // Non-blocking admin notify
    try {
      await supabase.functions.invoke("admin-notify", {
        body: {
          event_type: "partner_activated",
          partner_id: newPartner.id,
          business_name: newPartner.business_name,
          service_types: serviceTypes,
        },
      });
    } catch (e) {
      console.warn("admin-notify failed (non-blocking):", e);
    }

    return json({ ok: true, partner_id: newPartner.id });
  } catch (err: any) {
    console.error("onboard-transport-partner error:", err);
    return json({ ok: false, error: err?.message ?? "unknown error" }, 500);
  }
});
