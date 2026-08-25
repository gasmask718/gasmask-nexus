// Dynasty Direct — ITEM NOT RECEIVED (INR) claim intake.
//
// A return is "I got it and want to send it back". This is "I never got it" —
// different evidence, different money, different fault, so it is deliberately
// a separate path from dd-return-request.
//
// Ownership is proven exactly as /track proves it: order id + the exact email
// on the order, through the rate-limited SECURITY DEFINER lookup_guest_order
// RPC. Every miss returns {} with a 200 so the surface can't be probed.
//
// Step 2 of the spec happens HERE, at intake, before any human judgement:
// carrier evidence is pulled from EasyPost and stored on the claim. The
// evidence decides the path, so it is gathered first and never re-derived
// later from memory.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "";
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function norm(s: unknown): string {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export interface TrackingEvidence {
  tracking_number: string | null;
  carrier: string | null;
  tracking_status: string | null;
  tracking_last_scan_at: string | null;
  tracking_last_scan_location: string | null;
  tracking_delivered_at: string | null;
  tracking_history: unknown[];
  tracking_raw: unknown;
  tracking_fetch_error: string | null;
  signature_on_file: boolean;
  delivery_city: string | null;
  delivery_zip: string | null;
}

const EMPTY_EVIDENCE: TrackingEvidence = {
  tracking_number: null,
  carrier: null,
  tracking_status: null,
  tracking_last_scan_at: null,
  tracking_last_scan_location: null,
  tracking_delivered_at: null,
  tracking_history: [],
  tracking_raw: null,
  tracking_fetch_error: null,
  signature_on_file: false,
  delivery_city: null,
  delivery_zip: null,
};

/** Pull the carrier's own record for this parcel. Never throws. */
async function fetchCarrierEvidence(
  key: string | null,
  shipment: any,
): Promise<TrackingEvidence> {
  const ev: TrackingEvidence = {
    ...EMPTY_EVIDENCE,
    tracking_number: shipment?.tracking_number ?? null,
    carrier: shipment?.carrier ?? null,
  };
  if (!key) {
    ev.tracking_fetch_error = "EasyPost key not configured — no carrier evidence available.";
    return ev;
  }
  if (!shipment?.tracking_number && !shipment?.easypost_shipment_id) {
    ev.tracking_fetch_error = "No tracking number on this order — nothing to look up.";
    return ev;
  }

  const auth = "Basic " + btoa(key + ":");
  try {
    let tracker: any = null;

    if (shipment?.easypost_shipment_id) {
      const r = await fetch(
        `https://api.easypost.com/v2/shipments/${shipment.easypost_shipment_id}`,
        { headers: { Authorization: auth } },
      );
      const s = await r.json().catch(() => null);
      if (r.ok && s?.tracker) tracker = s.tracker;
    }

    if (!tracker && shipment?.tracking_number) {
      const q = new URLSearchParams({ tracking_code: shipment.tracking_number });
      const r = await fetch(`https://api.easypost.com/v2/trackers?${q}`, {
        headers: { Authorization: auth },
      });
      const list = await r.json().catch(() => null);
      tracker = list?.trackers?.[0] ?? null;

      // Nothing on file yet — ask EasyPost to start tracking it.
      if (!tracker) {
        const c = await fetch("https://api.easypost.com/v2/trackers", {
          method: "POST",
          headers: { Authorization: auth, "Content-Type": "application/json" },
          body: JSON.stringify({
            tracker: {
              tracking_code: shipment.tracking_number,
              carrier: shipment.carrier || undefined,
            },
          }),
        });
        const created = await c.json().catch(() => null);
        if (c.ok && created?.id) tracker = created;
      }
    }

    if (!tracker) {
      ev.tracking_fetch_error = "Carrier returned no tracking record for this number.";
      return ev;
    }

    const details: any[] = Array.isArray(tracker.tracking_details) ? tracker.tracking_details : [];
    const last = details[details.length - 1] ?? null;
    const delivered = [...details].reverse().find((d) => String(d?.status) === "delivered") ?? null;
    const loc = (d: any) =>
      d?.tracking_location
        ? [d.tracking_location.city, d.tracking_location.state, d.tracking_location.zip]
          .filter(Boolean).join(", ")
        : null;

    ev.tracking_number = tracker.tracking_code ?? ev.tracking_number;
    ev.carrier = tracker.carrier ?? ev.carrier;
    ev.tracking_status = tracker.status ?? null;
    ev.tracking_last_scan_at = last?.datetime ?? null;
    ev.tracking_last_scan_location = last ? loc(last) : null;
    ev.tracking_delivered_at = delivered?.datetime ?? null;
    ev.delivery_city = delivered?.tracking_location?.city ?? last?.tracking_location?.city ?? null;
    ev.delivery_zip = delivered?.tracking_location?.zip ?? last?.tracking_location?.zip ?? null;
    ev.signature_on_file = Boolean(tracker.signed_by);
    ev.tracking_history = details.map((d) => ({
      status: d?.status ?? null,
      message: d?.message ?? null,
      datetime: d?.datetime ?? null,
      location: loc(d),
    }));
    ev.tracking_raw = {
      id: tracker.id,
      status: tracker.status,
      status_detail: tracker.status_detail,
      signed_by: tracker.signed_by ?? null,
      est_delivery_date: tracker.est_delivery_date ?? null,
      public_url: tracker.public_url ?? null,
      carrier: tracker.carrier ?? null,
    };
  } catch (e: any) {
    ev.tracking_fetch_error = e?.message ?? "carrier lookup failed";
  }
  return ev;
}

/**
 * Three paths, decided by the evidence — not by who shouted loudest.
 *   A delivered      -> Dynasty absorbs; wholesaler's split STANDS.
 *   B lost/stuck/no scan -> carrier claim; wholesaler untouched.
 *   C wrong address / label ≠ order address -> warehouse error, wholesaler's fault.
 */
export function decidePath(
  ev: TrackingEvidence,
  labelAddress: any,
  orderAddress: any,
  noScanDays: number,
) {
  const mismatchFields: string[] = [];
  if (labelAddress && orderAddress) {
    for (const f of ["street1", "zip", "city"]) {
      const a = norm(labelAddress[f] ?? labelAddress[f === "street1" ? "address_line_1" : f]);
      const b = norm(orderAddress[f] ?? orderAddress[f === "street1" ? "address_line_1" : f]);
      if (a && b && a !== b) mismatchFields.push(f);
    }
  }
  const labelMismatch = mismatchFields.length > 0;

  const status = String(ev.tracking_status ?? "").toLowerCase();
  const lastScan = ev.tracking_last_scan_at ? new Date(ev.tracking_last_scan_at).getTime() : null;
  const daysSinceScan = lastScan ? (Date.now() - lastScan) / 86_400_000 : null;

  // C first: a warehouse error outranks whatever the scan says.
  if (labelMismatch) {
    return {
      verdict: "wrong_address" as const,
      recommended_path: "c_wholesaler_fault" as const,
      fault_party: "wholesaler" as const,
      address_mismatch: true,
      mismatch_fields: mismatchFields,
      rationale:
        `The label address does not match the order address (${mismatchFields.join(", ")}). ` +
        "That is a fulfilment error: refund the customer, reverse the split, and record it against the wholesaler.",
    };
  }

  if (status === "delivered") {
    return {
      verdict: "delivered" as const,
      recommended_path: "a_delivered_absorb" as const,
      fault_party: "unassigned" as const,
      address_mismatch: false,
      mismatch_fields: [],
      rationale:
        "The carrier scanned this delivered" +
        (ev.tracking_last_scan_location ? ` at ${ev.tracking_last_scan_location}` : "") +
        (ev.signature_on_file ? " and captured a signature" : " with no signature") +
        ". The wholesaler shipped correctly, so their split stands. Dynasty absorbs the refund, " +
        "or files a carrier claim where the value justifies it. Record this against the customer.",
    };
  }

  if (["return_to_sender", "failure", "error", "cancelled"].includes(status)) {
    return {
      verdict: "lost_or_stuck" as const,
      recommended_path: "b_carrier_claim" as const,
      fault_party: "carrier" as const,
      address_mismatch: false,
      mismatch_fields: [],
      rationale: `Carrier status is "${status}". File a carrier claim; reship or refund from it. No wholesaler fault.`,
    };
  }

  if (!ev.tracking_status || !lastScan) {
    return {
      verdict: "no_scan" as const,
      recommended_path: "b_carrier_claim" as const,
      fault_party: "carrier" as const,
      address_mismatch: false,
      mismatch_fields: [],
      rationale:
        "No carrier scan on record — the parcel may never have been handed over. " +
        "File a carrier claim and check with the wholesaler that it physically shipped.",
    };
  }

  if (daysSinceScan !== null && daysSinceScan >= noScanDays) {
    return {
      verdict: "lost_or_stuck" as const,
      recommended_path: "b_carrier_claim" as const,
      fault_party: "carrier" as const,
      address_mismatch: false,
      mismatch_fields: [],
      rationale:
        `No new scan in ${Math.floor(daysSinceScan)} days (threshold ${noScanDays}). ` +
        "Treat as lost in transit: file a carrier claim, reship or refund. No wholesaler fault.",
    };
  }

  return {
    verdict: "unknown" as const,
    recommended_path: "review" as const,
    fault_party: "unassigned" as const,
    address_mismatch: false,
    mismatch_fields: [],
    rationale:
      `The parcel is still moving (status "${status || "unknown"}", last scan ` +
      `${daysSinceScan !== null ? Math.floor(daysSinceScan) : "?"} days ago). It is too early to call it lost — ` +
      "hold the claim and re-check after the no-scan threshold.",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const orderId = body?.order_id;
  const email = body?.email;
  if (!isUuid(orderId) || typeof email !== "string" || email.length > 320) {
    return json({ error: "invalid_input" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1) prove ownership — same contract as /track
    const { data: proof, error: proofErr } = await supabase.rpc("lookup_guest_order", {
      p_order_id: orderId,
      p_email: email,
      p_ip: clientIp(req),
    });
    if (proofErr) {
      console.error("[dd-inr-claim] lookup rpc error", proofErr.message);
      return json({});
    }
    if (!proof || Object.keys(proof as Record<string, unknown>).length === 0) return json({});

    const { data: order } = await supabase
      .from("marketplace_orders")
      .select("id, user_id, wholesaler_id, customer_email, shipping_address, total, created_at, payment_status")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return json({});

    // one open claim per order
    const { data: existing } = await supabase
      .from("dd_inr_claims")
      .select("id, claim_number, status, recommended_path")
      .eq("order_id", orderId)
      .not("status", "in", '("declined","closed")')
      .limit(1)
      .maybeSingle();
    if (existing) {
      return json({
        already_open: true,
        claim_number: (existing as any).claim_number,
        status: (existing as any).status,
        message: "There's already an open not-received claim on this order — we're on it.",
      });
    }

    const { data: cfg } = await supabase
      .from("dd_config")
      .select("inr_no_scan_days")
      .limit(1)
      .maybeSingle();
    const noScanDays = Number((cfg as any)?.inr_no_scan_days ?? 7);

    // 2) carrier evidence FIRST — before anyone forms a view
    const { data: shipment } = await supabase
      .from("dd_shipments")
      .select("id, wholesaler_id, tracking_number, carrier, easypost_shipment_id, to_address, signature_required, insured_amount")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: epCfg } = await supabase
      .from("dd_ai_config")
      .select("easypost_api_key")
      .eq("id", 1)
      .maybeSingle();

    const evidence = await fetchCarrierEvidence((epCfg as any)?.easypost_api_key ?? null, shipment);

    const decision = decidePath(
      evidence,
      (shipment as any)?.to_address ?? null,
      (order as any)?.shipping_address ?? null,
      noScanDays,
    );

    // repeat-claim signal for the admin
    const { count: priorClaims } = await supabase
      .from("dd_inr_claims")
      .select("id", { count: "exact", head: true })
      .ilike("customer_email", (order as any).customer_email ?? email);

    const { data: claim, error: insErr } = await supabase
      .from("dd_inr_claims")
      .insert({
        order_id: orderId,
        shipment_id: (shipment as any)?.id ?? null,
        user_id: (order as any).user_id ?? null,
        customer_email: (order as any).customer_email ?? email,
        wholesaler_id: (order as any).wholesaler_id ?? (shipment as any)?.wholesaler_id ?? null,
        expected_delivery_date: typeof body?.expected_delivery_date === "string"
          ? body.expected_delivery_date.slice(0, 10)
          : null,
        checked_with_neighbours: Boolean(body?.checked_with_neighbours),
        checked_notes: typeof body?.checked_notes === "string" ? body.checked_notes.slice(0, 2000) : null,
        customer_stated_address: body?.stated_address ?? null,
        customer_note: typeof body?.note === "string" ? body.note.slice(0, 2000) : null,
        tracking_number: evidence.tracking_number,
        carrier: evidence.carrier,
        tracking_status: evidence.tracking_status,
        tracking_last_scan_at: evidence.tracking_last_scan_at,
        tracking_last_scan_location: evidence.tracking_last_scan_location,
        tracking_delivered_at: evidence.tracking_delivered_at,
        tracking_history: evidence.tracking_history,
        tracking_raw: evidence.tracking_raw,
        tracking_fetch_error: evidence.tracking_fetch_error,
        evidence_gathered_at: new Date().toISOString(),
        signature_on_file: evidence.signature_on_file,
        verdict: decision.verdict,
        recommended_path: decision.recommended_path,
        fault_party: decision.fault_party,
        address_mismatch: decision.address_mismatch,
        address_mismatch_detail: decision.address_mismatch
          ? {
            fields: decision.mismatch_fields,
            label_address: (shipment as any)?.to_address ?? null,
            order_address: (order as any)?.shipping_address ?? null,
          }
          : null,
        status: "evidence_gathered",
        order_total_cents: Math.round(Number((order as any).total ?? 0) * 100),
        admin_notes: decision.rationale +
          (priorClaims && priorClaims > 0
            ? `\n\n⚠ REPEAT CLAIMANT — this email has ${priorClaims} prior not-received claim(s).`
            : ""),
      })
      .select("id, claim_number, status")
      .single();

    if (insErr || !claim) {
      console.error("[dd-inr-claim] insert failed", insErr?.message);
      return json({ error: "claim_not_created", message: insErr?.message ?? "unknown" }, 500);
    }

    // The customer is never told the verdict — that's an internal decision.
    return json({
      success: true,
      claim_number: (claim as any).claim_number,
      status: (claim as any).status,
      message:
        "Claim received. We've pulled the carrier's tracking record for your parcel and a person is " +
        "reviewing it now. You'll hear back by email — usually within one business day.",
    });
  } catch (e: any) {
    console.error("[dd-inr-claim]", e?.message ?? e);
    return json({ error: "request_failed" }, 500);
  }
});
