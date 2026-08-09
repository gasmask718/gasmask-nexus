import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const BUREAU_ADDRESSES: Record<string, { name: string; line1: string; city: string; state: string; zip: string }> = {
  Equifax: { name: "Equifax Dispute Department", line1: "PO Box 740256", city: "Atlanta", state: "GA", zip: "30374" },
  Experian: { name: "Experian", line1: "PO Box 4500", city: "Allen", state: "TX", zip: "75013" },
  TransUnion: { name: "TransUnion Consumer Solutions", line1: "PO Box 2000", city: "Chester", state: "PA", zip: "19016" },
};

// FCRA disputes are mailed certified with return receipt so there is provable
// delivery. PostGrid exposes this as an extra service on the letter.
const EXTRA_SERVICE = "certified_return_receipt";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const POSTGRID_API_KEY = Deno.env.get("POSTGRID_API_KEY");
    const body = await req.json().catch(() => ({}));

    // Health ping: lets the settings screen report real configuration state
    // instead of inferring it from a database row that the runtime never reads.
    if (body?.ping === true) {
      if (!POSTGRID_API_KEY) {
        return json({ configured: false, reason: "POSTGRID_API_KEY is not set" });
      }
      const probe = await fetch("https://api.postgrid.com/print-mail/v1/letters?limit=1", {
        headers: { "x-api-key": POSTGRID_API_KEY },
      });
      if (!probe.ok) {
        return json({
          configured: false,
          reason: probe.status === 401 ? "PostGrid rejected the key (401)" : `PostGrid returned ${probe.status}`,
        });
      }
      // Live keys begin with live_, test keys with test_.
      return json({ configured: true, mode: POSTGRID_API_KEY.startsWith("test_") ? "test" : "live" });
    }

    if (!POSTGRID_API_KEY) {
      return json({
        error: true,
        code: "NO_API_KEY",
        message: "PostGrid API key not configured. Add the POSTGRID_API_KEY secret to enable certified mail dispatch.",
      });
    }

    const {
      letter_content, client_name, client_address, client_city, client_state, client_zip,
      bureau, mailing_log_id,
    } = body;

    const bureauAddr = BUREAU_ADDRESSES[bureau];
    if (!bureauAddr) throw new Error(`Unknown bureau: ${bureau}`);

    const missing = Object.entries({
      letter_content, client_name, client_address, client_city, client_state, client_zip, mailing_log_id,
    }).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) throw new Error(`Missing required fields: ${missing.join(", ")}`);

    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const pgRes = await fetch("https://api.postgrid.com/print-mail/v1/letters", {
      method: "POST",
      headers: {
        "x-api-key": POSTGRID_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: {
          firstName: bureauAddr.name,
          addressLine1: bureauAddr.line1,
          city: bureauAddr.city,
          provinceOrState: bureauAddr.state,
          postalOrZip: bureauAddr.zip,
          countryCode: "US",
        },
        from: {
          firstName: client_name,
          addressLine1: client_address,
          city: client_city,
          provinceOrState: client_state,
          postalOrZip: client_zip,
          countryCode: "US",
        },
        html: `<html><body><pre style="font-family: monospace; font-size: 12px; white-space: pre-wrap;">${escapeHtml(letter_content)}</pre></body></html>`,
        doubleSided: false,
        extraService: EXTRA_SERVICE,
        addressPlacement: "insert_blank_page",
      }),
    });

    const pgData = await pgRes.json();
    if (!pgRes.ok) throw new Error(pgData?.error?.message || `PostGrid API error (${pgRes.status})`);

    const letterId = pgData.id;
    const expectedDelivery = pgData.expectedDeliveryDate ?? null;
    // PostGrid returns cost in cents.
    const cost = typeof pgData.cost === "number" ? pgData.cost / 100 : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: updateError } = await supabase.from("funding_mailing_log").update({
      tracking_number: pgData.trackingNumber ?? letterId,
      postgrid_letter_id: letterId,
      delivery_status: "dispatched",
      mail_type: "certified",
      provider: "postgrid",
      sent_date: new Date().toISOString().slice(0, 10),
      ...(cost !== null ? { cost } : {}),
    }).eq("id", mailing_log_id);

    // The letter is already in PostGrid's queue at this point. Surface a failed
    // write loudly rather than reporting a clean success we cannot evidence.
    if (updateError) {
      return json({
        success: true,
        letter_id: letterId,
        expected_delivery: expectedDelivery,
        warning: `Letter dispatched but the mailing log was not updated: ${updateError.message}`,
      });
    }

    return json({
      success: true,
      letter_id: letterId,
      tracking_number: pgData.trackingNumber ?? letterId,
      expected_delivery: expectedDelivery,
      cost,
    });
  } catch (err) {
    return json({ error: true, message: err instanceof Error ? err.message : String(err) }, 500);
  }
});
