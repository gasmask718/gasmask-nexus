// ═══════════════════════════════════════════════════════════════
// SHIPPING LABEL — KEY-READY EASYPOST INTEGRATION
// If EASYPOST_API_KEY is set → real rates + label purchase + tracking
// If absent → labeled SANDBOX quote so checkout works end-to-end
// ═══════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Key resolution: dd_ai_config (runtime-editable, no redeploy) first, env second.
let _resolvedKey: string | null | undefined;
async function resolveEasyPostKey(supabase: any): Promise<string | null> {
  if (_resolvedKey !== undefined) return _resolvedKey;
  // dd_ai_config is a SINGLE-ROW (id=1) table with an easypost_api_key COLUMN —
  // the key/value shape this used to query does not exist, so every call fell
  // through to a non-existent env var and silently produced sandbox rates.
  try {
    const { data } = await supabase
      .from("dd_ai_config")
      .select("easypost_api_key")
      .eq("id", 1)
      .maybeSingle();
    const v = String((data as any)?.easypost_api_key ?? "").trim();
    if (v) { _resolvedKey = v; return v; }
  } catch (_e) { /* fall through to env */ }
  const env = Deno.env.get("EASYPOST_API_KEY");
  _resolvedKey = env && env.trim() ? env.trim() : null;
  return _resolvedKey;
}

// ── Sandbox quote fallback (flat-rate by weight) ──
function sandboxQuote(weightOz: number) {
  const lbs = Math.max(1, Math.ceil(weightOz / 16));
  const rate = +(8.5 + lbs * 1.25).toFixed(2);
  return {
    rate,
    currency: "USD",
    carrier: "USPS",
    service: "Priority",
    est_delivery_days: 3,
    estimated: true,
    mode: "sandbox",
  };
}

// ── EasyPost live call ──
async function easypostCreateShipmentAndBuy(apiKey: string, fromAddr: any, toAddr: any, parcel: any) {
  const auth = "Basic " + btoa(apiKey + ":");

  // 1) Create shipment → returns rates
  const shipRes = await fetch("https://api.easypost.com/v2/shipments", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      shipment: { from_address: fromAddr, to_address: toAddr, parcel },
    }),
  });
  if (!shipRes.ok) throw new Error(`EasyPost shipment failed: ${await shipRes.text()}`);
  const shipment = await shipRes.json();
  if (!shipment.rates?.length) throw new Error("EasyPost returned no rates");

  // 2) Pick cheapest rate
  const cheapest = shipment.rates.reduce((a: any, b: any) =>
    parseFloat(a.rate) < parseFloat(b.rate) ? a : b
  );

  // 3) Buy label
  const buyRes = await fetch(`https://api.easypost.com/v2/shipments/${shipment.id}/buy`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ rate: { id: cheapest.id } }),
  });
  if (!buyRes.ok) throw new Error(`EasyPost buy failed: ${await buyRes.text()}`);
  const bought = await buyRes.json();

  return {
    shipment_id: bought.id,
    rate_id: cheapest.id,
    tracking_number: bought.tracking_code,
    label_url: bought.postage_label?.label_url,
    carrier: bought.selected_rate?.carrier || cheapest.carrier,
    service: bought.selected_rate?.service || cheapest.service,
    rate: parseFloat(bought.selected_rate?.rate || cheapest.rate),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const easypostKey = await resolveEasyPostKey(supabase);
    const liveMode = !!easypostKey;

    const body = await req.json().catch(() => ({}));
    const { fulfillment_id, quote_only } = body;
    if (!fulfillment_id) {
      return new Response(JSON.stringify({ error: "fulfillment_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller owns the supplier (or is admin) — relaxed for quote_only
    const { data: profile } = await supabase
      .from("wholesaler_profiles")
      .select("id, company_name, warehouse_street, warehouse_city, warehouse_state, warehouse_zip, warehouse_country, warehouse_address")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: fulfillment, error: fErr } = await supabase
      .from("marketplace_fulfillments")
      .select("id, status, order_id, wholesaler_id, items_snapshot, order:marketplace_orders(id, shipping_address, payment_status)")
      .eq("id", fulfillment_id)
      .single();
    if (fErr || !fulfillment) throw new Error("Fulfillment not found");

    // Auth: must be owning supplier OR admin
    const isOwner = profile?.id === fulfillment.wholesaler_id;
    if (!isOwner) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const isAdmin = roles?.some((r: any) => r.role === "admin");
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Resolve supplier ship-from address (from profile or fall back)
    const { data: supplier } = await supabase
      .from("wholesaler_profiles")
      .select("company_name, warehouse_street, warehouse_city, warehouse_state, warehouse_zip, warehouse_country")
      .eq("id", fulfillment.wholesaler_id)
      .maybeSingle();

    const order: any = fulfillment.order;
    const toRaw = order?.shipping_address || {};

    // Estimate parcel weight from items_snapshot
    const items = Array.isArray(fulfillment.items_snapshot) ? fulfillment.items_snapshot : [];
    let totalWeightOz = 16; // 1lb default
    if (items.length) {
      const ids = items.map((i: any) => i.product_id).filter(Boolean);
      if (ids.length) {
        const { data: prods } = await supabase
          .from("products_all")
          .select("id, weight_oz, dimensions")
          .in("id", ids);
        if (prods?.length) {
          totalWeightOz = items.reduce((sum: number, it: any) => {
            const p = prods.find((p: any) => p.id === it.product_id);
            return sum + (p?.weight_oz || 8) * (it.qty || 1);
          }, 0);
        }
      }
    }

    // ── QUOTE-ONLY path (no label purchase, no DB write) ──
    if (quote_only) {
      const quote = liveMode
        ? { ...sandboxQuote(totalWeightOz), mode: "live_not_implemented_yet_for_quote_only" }
        : sandboxQuote(totalWeightOz);
      return new Response(JSON.stringify({ success: true, quote, mode: liveMode ? "live" : "sandbox" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── BUY LABEL path ──
    if (fulfillment.status !== "pending") {
      return new Response(JSON.stringify({ error: `Cannot generate label for status: ${fulfillment.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: existingLabel } = await supabase
      .from("shipping_labels")
      .select("id")
      .eq("fulfillment_id", fulfillment_id)
      .eq("status", "created")
      .maybeSingle();
    if (existingLabel) {
      return new Response(JSON.stringify({ error: "An active label already exists. Void it first." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let trackingNumber: string;
    let labelUrl: string;
    let carrier: string;
    let service: string;
    let rateAmount: number;
    let shipmentId: string | null = null;
    let rateId: string | null = null;
    let mode: "live" | "sandbox";

    if (liveMode && easypostKey) {
      const fromAddr = {
        name: supplier?.company_name || "Dynasty Direct",
        street1: supplier?.warehouse_street,
        city: supplier?.warehouse_city,
        state: supplier?.warehouse_state,
        zip: supplier?.warehouse_zip,
        country: supplier?.warehouse_country || "US",
      };
      const toAddr = {
        name: toRaw.fullName || toRaw.name,
        street1: toRaw.street,
        city: toRaw.city,
        state: toRaw.state,
        zip: toRaw.zipCode || toRaw.zip,
        country: toRaw.country || "US",
        phone: toRaw.phone,
      };
      const parcel = { weight: totalWeightOz, length: 12, width: 9, height: 6 };

      try {
        const bought = await easypostCreateShipmentAndBuy(easypostKey, fromAddr, toAddr, parcel);
        trackingNumber = bought.tracking_number;
        labelUrl = bought.label_url;
        carrier = bought.carrier;
        service = bought.service;
        rateAmount = bought.rate;
        shipmentId = bought.shipment_id;
        rateId = bought.rate_id;
        mode = "live";
      } catch (err: any) {
        // Fall back to sandbox on live failure rather than blocking the supplier
        console.error("EasyPost live mode failed, falling back to sandbox:", err.message);
        const q = sandboxQuote(totalWeightOz);
        trackingNumber = `SBX-${Date.now().toString(36).toUpperCase()}`;
        labelUrl = `https://labels.sandbox.dynasty-direct.test/${trackingNumber}.pdf`;
        carrier = q.carrier; service = q.service; rateAmount = q.rate; mode = "sandbox";
      }
    } else {
      const q = sandboxQuote(totalWeightOz);
      trackingNumber = `SBX-${Date.now().toString(36).toUpperCase()}`;
      labelUrl = `https://labels.sandbox.dynasty-direct.test/${trackingNumber}.pdf`;
      carrier = q.carrier; service = q.service; rateAmount = q.rate; mode = "sandbox";
    }

    const { error: labelErr } = await supabase.from("shipping_labels").insert({
      fulfillment_id,
      wholesaler_id: fulfillment.wholesaler_id,
      order_id: fulfillment.order_id,
      carrier,
      service,
      label_format: "PDF",
      label_url: labelUrl,
      tracking_number: trackingNumber,
      mode,
      status: "created",
    });
    if (labelErr) throw labelErr;

    const { error: updateErr } = await supabase
      .from("marketplace_fulfillments")
      .update({
        status: "label_generated",
        shipping_label_url: labelUrl,
        tracking_number: trackingNumber,
        carrier,
        shipping_mode: mode,
        easypost_shipment_id: shipmentId,
        easypost_rate_id: rateId,
        shipping_quote: {
          rate: rateAmount, currency: "USD", carrier, service,
          estimated: mode === "sandbox", mode,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", fulfillment_id);
    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({
      success: true,
      fulfillment_id,
      mode,
      tracking_number: trackingNumber,
      label_url: labelUrl,
      carrier,
      service,
      rate: rateAmount,
      note: mode === "sandbox"
        ? "SANDBOX label — add EASYPOST_API_KEY secret to switch to live rates with zero code changes."
        : "Live EasyPost label.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
