// Dynasty Direct — admin actions on an ITEM NOT RECEIVED (INR) claim.
//
// actions: refresh_evidence | set_path | refund | file_carrier_claim | reship | decline | close
//
// The money rules follow the evidence, and they are NOT the same as a return:
//
//   Path A — tracking says DELIVERED
//     The wholesaler shipped correctly. Their split STANDS: no reversal, no
//     clawback, nothing on their scorecard. Dynasty absorbs the refund (booked
//     as a margin-only negative entry) or files a carrier claim if the value
//     justifies it. The event is recorded against the CUSTOMER.
//
//   Path B — LOST / STUCK / NO SCAN
//     Carrier's problem. File a claim; reship or refund funded by it. Again the
//     wholesaler's split and metrics are untouched.
//
//   Path C — WRONG ADDRESS / label ≠ order address
//     Warehouse error. This one DOES reverse the split, book a clawback if the
//     supplier was already paid, and count as a fulfilment error on their
//     scorecard.
import Stripe from "https://esm.sh/stripe@18.5.0";
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

const ACTIONS = new Set([
  "refresh_evidence",
  "set_path",
  "refund",
  "file_carrier_claim",
  "reship",
  "decline",
  "close",
]);

const PATHS = new Set(["a_delivered_absorb", "b_carrier_claim", "c_wholesaler_fault"]);

async function fetchTracker(key: string, shipment: any) {
  const auth = "Basic " + btoa(key + ":");
  let tracker: any = null;
  if (shipment?.easypost_shipment_id) {
    const r = await fetch(`https://api.easypost.com/v2/shipments/${shipment.easypost_shipment_id}`, {
      headers: { Authorization: auth },
    });
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
  }
  return tracker;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const { data: userData, error: userErr } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    const user = userData?.user;
    if (userErr || !user) return json({ error: "unauthorized" }, 401);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "owner");
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({} as any));
    const action = String(body?.action ?? "");
    const claimId = String(body?.claim_id ?? "");
    if (!ACTIONS.has(action)) return json({ error: "invalid_action" }, 400);
    if (!claimId) return json({ error: "claim_id required" }, 400);

    const { data: claim } = await admin
      .from("dd_inr_claims")
      .select("*")
      .eq("id", claimId)
      .maybeSingle();
    if (!claim) return json({ error: "claim_not_found" }, 404);

    const { data: order } = await admin
      .from("marketplace_orders")
      .select("id, total, customer_email, stripe_payment_intent_id, payment_status, wholesaler_id")
      .eq("id", (claim as any).order_id)
      .maybeSingle();

    const { data: shipment } = (claim as any).shipment_id
      ? await admin.from("dd_shipments").select("*").eq("id", (claim as any).shipment_id).maybeSingle()
      : { data: null as any };

    // ─────────────────────────────────────────────── refresh_evidence ──
    if (action === "refresh_evidence") {
      const { data: epCfg } = await admin
        .from("dd_ai_config").select("easypost_api_key").eq("id", 1).maybeSingle();
      const key = (epCfg as any)?.easypost_api_key;
      if (!key) return json({ error: "easypost_key_not_configured" }, 503);
      const tracker = await fetchTracker(key, shipment ?? claim);
      if (!tracker) return json({ error: "no_tracking_record" }, 404);

      const details: any[] = Array.isArray(tracker.tracking_details) ? tracker.tracking_details : [];
      const last = details[details.length - 1] ?? null;
      const delivered = [...details].reverse().find((d) => String(d?.status) === "delivered") ?? null;
      const loc = (d: any) =>
        d?.tracking_location
          ? [d.tracking_location.city, d.tracking_location.state, d.tracking_location.zip]
            .filter(Boolean).join(", ")
          : null;

      const { error } = await admin.from("dd_inr_claims").update({
        tracking_status: tracker.status ?? null,
        tracking_last_scan_at: last?.datetime ?? null,
        tracking_last_scan_location: last ? loc(last) : null,
        tracking_delivered_at: delivered?.datetime ?? null,
        signature_on_file: Boolean(tracker.signed_by),
        tracking_history: details.map((d) => ({
          status: d?.status ?? null,
          message: d?.message ?? null,
          datetime: d?.datetime ?? null,
          location: loc(d),
        })),
        tracking_raw: {
          id: tracker.id,
          status: tracker.status,
          status_detail: tracker.status_detail,
          signed_by: tracker.signed_by ?? null,
          public_url: tracker.public_url ?? null,
        },
        tracking_fetch_error: null,
        evidence_gathered_at: new Date().toISOString(),
      }).eq("id", claimId);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, tracking_status: tracker.status });
    }

    // ─────────────────────────────────────────────────────── set_path ──
    if (action === "set_path") {
      const path = String(body?.path ?? "");
      if (!PATHS.has(path)) return json({ error: "invalid_path" }, 400);
      const fault = path === "c_wholesaler_fault"
        ? "wholesaler"
        : path === "b_carrier_claim"
        ? "carrier"
        : "unassigned";
      const { error } = await admin.from("dd_inr_claims").update({
        chosen_path: path,
        fault_party: fault,
        admin_notes: body?.admin_notes
          ? `${(claim as any).admin_notes ?? ""}\n${String(body.admin_notes).slice(0, 4000)}`.trim()
          : (claim as any).admin_notes,
      }).eq("id", claimId);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, chosen_path: path });
    }

    // ──────────────────────────────────────────────────────── decline ──
    if (action === "decline") {
      const { error } = await admin.from("dd_inr_claims").update({
        status: "declined",
        declined_reason: String(body?.reason ?? "").slice(0, 2000) || "Declined",
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      }).eq("id", claimId);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, status: "declined" });
    }

    if (action === "close") {
      const { error } = await admin.from("dd_inr_claims").update({
        status: "closed",
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      }).eq("id", claimId);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, status: "closed" });
    }

    // ───────────────────────────────────────────────────────── reship ──
    if (action === "reship") {
      const { error } = await admin.from("dd_inr_claims").update({
        status: "reshipped",
        reship_order_id: body?.reship_order_id ?? null,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        admin_notes: `${(claim as any).admin_notes ?? ""}\nReship authorised by admin${
          body?.reship_order_id ? ` — replacement order ${body.reship_order_id}` : ""
        }.`.trim(),
      }).eq("id", claimId);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, status: "reshipped" });
    }

    // ───────────────────────────────────────────── file_carrier_claim ──
    if (action === "file_carrier_claim") {
      const declaredCents = Math.round(Number(shipment?.declared_value ?? 0) * 100);
      const insuredCents = Math.round(Number(shipment?.insured_amount ?? 0) * 100);
      const amountCents = Number(body?.amount_cents ?? 0) ||
        Number((claim as any).order_total_cents ?? 0);
      const freeCoverCents = 10_000; // $100 declared value included on USPS Priority / UPS / FedEx

      const { data: cc, error } = await admin.from("dd_inr_carrier_claims").insert({
        inr_claim_id: claimId,
        order_id: (claim as any).order_id,
        shipment_id: (claim as any).shipment_id,
        carrier: (claim as any).carrier,
        tracking_number: (claim as any).tracking_number,
        claim_reference: body?.claim_reference ? String(body.claim_reference).slice(0, 200) : null,
        declared_value_cents: declaredCents || freeCoverCents,
        amount_claimed_cents: amountCents,
        insurance_purchased: insuredCents > 0,
        status: "filed",
        filed_by: user.id,
        notes: body?.notes ? String(body.notes).slice(0, 4000) : null,
      }).select("id").single();
      if (error) return json({ error: error.message }, 500);

      await admin.from("dd_inr_claims").update({
        status: "carrier_claim_filed",
        chosen_path: (claim as any).chosen_path ?? "b_carrier_claim",
      }).eq("id", claimId);

      const uncovered = amountCents > Math.max(insuredCents, freeCoverCents);
      return json({
        success: true,
        carrier_claim_id: cc?.id,
        coverage_warning: uncovered
          ? `Claiming $${(amountCents / 100).toFixed(2)} but only $${
            (Math.max(insuredCents, freeCoverCents) / 100).toFixed(2)
          } is covered — no insurance was bought at label time, so the excess is unrecoverable.`
          : null,
      });
    }

    // ───────────────────────────────────────────────────────── refund ──
    if (action === "refund") {
      if ((claim as any).stripe_refund_id) {
        return json({
          error: "already_refunded",
          refund_id: (claim as any).stripe_refund_id,
          message: "This claim has already been refunded. Do not refund twice.",
        }, 409);
      }

      const path = String(body?.path ?? (claim as any).chosen_path ?? (claim as any).recommended_path);
      if (!PATHS.has(path)) {
        return json({
          error: "path_required",
          message: "Choose a path before refunding — it decides whether the wholesaler's split is reversed.",
        }, 400);
      }

      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_DD") ?? Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) return json({ error: "stripe_key_not_configured" }, 503);
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

      const refundCents = Number(body?.amount_cents ?? 0) ||
        Number((claim as any).order_total_cents ?? 0) ||
        Math.round(Number((order as any)?.total ?? 0) * 100);
      if (refundCents <= 0) return json({ error: "nothing_to_refund" }, 400);

      let refundId: string | null = null;
      const pi = (order as any)?.stripe_payment_intent_id as string | null;
      if (pi && (order as any)?.payment_status === "paid") {
        let paymentIntent = pi;
        if (!pi.startsWith("pi_") && pi.startsWith("cs_")) {
          const session = await stripe.checkout.sessions.retrieve(pi);
          paymentIntent = session.payment_intent as string;
        }
        const refund = await stripe.refunds.create({
          payment_intent: paymentIntent,
          amount: refundCents,
          reason: "requested_by_customer",
          metadata: {
            dd_inr_claim_id: claimId,
            claim: (claim as any).claim_number,
            order_id: (claim as any).order_id,
            inr_path: path,
          },
        });
        refundId = refund.id;
      }

      // ── ledger: the split only unwinds on path C ──────────────────────
      const { data: ledger } = await admin
        .from("dd_split_ledger")
        .select("*")
        .eq("order_id", (claim as any).order_id)
        .eq("entry_type", "sale")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let reversalId: string | null = null;
      let clawbackId: string | null = null;
      let ledgerNote: string | null = null;

      if (ledger) {
        const gross = Number((ledger as any).gross_amount_cents ?? 0);
        const ratio = gross > 0 ? Math.min(1, refundCents / gross) : 1;
        const neg = (v: unknown) => -Math.round(Number(v ?? 0) * ratio);
        const fullReversal = path === "c_wholesaler_fault";

        const { data: rev, error: revErr } = await admin.from("dd_split_ledger").insert({
          order_id: (ledger as any).order_id,
          fulfillment_id: (ledger as any).fulfillment_id,
          wholesaler_id: (ledger as any).wholesaler_id,
          gross_amount_cents: neg((ledger as any).gross_amount_cents),
          stripe_fee_cents: fullReversal ? neg((ledger as any).stripe_fee_cents) : 0,
          // Paths A and B: the wholesaler shipped correctly. Their transfer is
          // untouched and Dynasty eats the whole refund out of margin.
          dd_margin_cents: fullReversal ? neg((ledger as any).dd_margin_cents) : -refundCents,
          supplier_transfer_cents: fullReversal ? neg((ledger as any).supplier_transfer_cents) : 0,
          reserve_held_cents: fullReversal ? neg((ledger as any).reserve_held_cents) : 0,
          reserve_released_cents: 0,
          margin_pct_applied: (ledger as any).margin_pct_applied,
          reserve_pct_applied: (ledger as any).reserve_pct_applied,
          stripe_charge_id: (ledger as any).stripe_charge_id,
          status: "reversed",
          entry_type: fullReversal ? "inr_wholesaler_fault_reversal" : "inr_absorbed",
          reverses_ledger_id: (ledger as any).id,
          notes: fullReversal
            ? `${(claim as any).claim_number}: label address did not match the order address — full split reversed (${
              Math.round(ratio * 100)
            }%)${refundId ? ` — Stripe refund ${refundId}` : ""}`
            : `${(claim as any).claim_number}: ${
              path === "a_delivered_absorb" ? "carrier scanned delivered" : "lost/stuck in transit"
            } — wholesaler split STANDS, Dynasty absorbs $${(refundCents / 100).toFixed(2)}${
              refundId ? ` — Stripe refund ${refundId}` : ""
            }`,
        }).select("id").single();

        if (revErr) {
          console.error("[dd-inr-admin] LEDGER ENTRY FAILED", revErr.message);
          ledgerNote = `Refund issued${
            refundId ? ` (${refundId})` : ""
          } but the ledger entry was NOT written: ${revErr.message}. Fix the ledger manually.`;
        } else {
          reversalId = rev?.id ?? null;
        }

        // Clawback only ever applies to path C, and only if already paid out.
        if (fullReversal) {
          const alreadyPaid = ["paid", "transferred", "released"].includes(
            String((ledger as any).status ?? "").toLowerCase(),
          ) || !!(ledger as any).stripe_transfer_id;
          const supplierShare = Math.round(
            Number((ledger as any).supplier_transfer_cents ?? 0) * ratio,
          );
          if (alreadyPaid && supplierShare > 0 && (ledger as any).wholesaler_id) {
            const { data: cb, error: cbErr } = await admin.from("dd_wholesaler_clawbacks").insert({
              wholesaler_id: (ledger as any).wholesaler_id,
              order_id: (claim as any).order_id,
              amount_cents: supplierShare,
              reason:
                `${(claim as any).claim_number}: shipped to the wrong address and refunded after the supplier transfer had already gone out — net off the next payout.`,
              status: "pending",
            }).select("id").single();
            if (cbErr) console.error("[dd-inr-admin] clawback insert failed", cbErr.message);
            else clawbackId = cb?.id ?? null;
          }
        }
      } else {
        ledgerNote = "No dd_split_ledger sale row for this order — no entry written. Check the split console.";
      }

      // ── supplier scorecard: ONLY a warehouse error counts against them ──
      const wsId = (claim as any).wholesaler_id ?? (order as any)?.wholesaler_id ?? null;
      if (wsId) {
        const { data: metric } = await admin
          .from("dd_supplier_metrics")
          .select("id, fulfillment_errors, inr_claims_total, issue_count")
          .eq("wholesaler_id", wsId)
          .order("period_start", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (metric) {
          await admin.from("dd_supplier_metrics").update({
            inr_claims_total: Number((metric as any).inr_claims_total ?? 0) + 1,
            ...(path === "c_wholesaler_fault"
              ? {
                fulfillment_errors: Number((metric as any).fulfillment_errors ?? 0) + 1,
                issue_count: Number((metric as any).issue_count ?? 0) + 1,
              }
              : {}),
          }).eq("id", (metric as any).id);
        }
      }

      const { error: finErr } = await admin.from("dd_inr_claims").update({
        status: "refunded",
        chosen_path: path,
        fault_party: path === "c_wholesaler_fault"
          ? "wholesaler"
          : path === "b_carrier_claim"
          ? "carrier"
          : "dynasty",
        refund_amount_cents: refundCents,
        stripe_refund_id: refundId,
        split_reversal_id: reversalId,
        clawback_id: clawbackId,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        admin_notes: ledgerNote
          ? `${(claim as any).admin_notes ?? ""}\n${ledgerNote}`.trim()
          : (claim as any).admin_notes,
      }).eq("id", claimId);

      if (finErr) {
        console.error(
          `[dd-inr-admin] REFUND ISSUED (${refundId}) but claim ${claimId} not marked refunded:`,
          finErr.message,
        );
        return json({
          success: true,
          refund_id: refundId,
          bookkeeping_error:
            `Refund succeeded but the claim row was not updated (${finErr.message}). Do NOT refund again — fix the record manually.`,
        });
      }

      return json({
        success: true,
        status: "refunded",
        path,
        refund_id: refundId,
        refunded_cents: refundCents,
        split_reversed: path === "c_wholesaler_fault",
        split_reversal_id: reversalId,
        clawback_id: clawbackId,
        ledger_note: ledgerNote,
      });
    }

    return json({ error: "unhandled_action" }, 400);
  } catch (e: any) {
    console.error("[dd-inr-admin]", e?.message ?? e);
    return json({ error: e?.message ?? "action_failed" }, 500);
  }
});
