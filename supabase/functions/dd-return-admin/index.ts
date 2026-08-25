// Dynasty Direct — admin actions on a return (RMA).
//
// actions: approve | decline | create_label | mark_received | refund | cancel
//
// The two that move money are `refund` and, indirectly, `mark_received`:
//   refund -> Stripe refund + a REVERSING row in dd_split_ledger so the
//             wholesaler's earnings and Dynasty's margin both unwind. If the
//             supplier transfer already went out (status paid/transferred) we
//             do NOT try to pull it back — we book a clawback against their
//             next payout instead.
//
// Structural policy (destination, who pays the return shipping) is read from
// dd_config + dd_wholesaler_return_settings, never hardcoded here.
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ACTIONS = new Set([
  "approve",
  "decline",
  "create_label",
  "mark_received",
  "refund",
  "cancel",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ── auth: signed-in admin/owner only ──────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const { data: userData, error: userErr } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    const user = userData?.user;
    if (userErr || !user) return json({ error: "unauthorized" }, 401);

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "owner");
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({} as any));
    const action = String(body?.action ?? "");
    const returnId = String(body?.return_id ?? "");
    if (!ACTIONS.has(action)) return json({ error: "invalid_action" }, 400);
    if (!returnId) return json({ error: "return_id required" }, 400);

    const { data: ret } = await admin
      .from("dd_returns")
      .select("*")
      .eq("id", returnId)
      .maybeSingle();
    if (!ret) return json({ error: "return_not_found" }, 404);

    const { data: order } = await admin
      .from("marketplace_orders")
      .select(
        "id, total, subtotal, shipping_cost, customer_email, shipping_address, stripe_payment_intent_id, payment_status, wholesaler_id",
      )
      .eq("id", (ret as any).order_id)
      .maybeSingle();

    const { data: cfg } = await admin
      .from("dd_config")
      .select("dynasty_return_address, return_restocking_fee_pct")
      .limit(1)
      .maybeSingle();

    // ─────────────────────────────────────────────────────────── approve ──
    if (action === "approve") {
      const patch: Record<string, unknown> = {
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      };
      if (body?.fault_party) patch.fault_party = body.fault_party;
      if (typeof body?.is_fault_return === "boolean") {
        patch.is_fault_return = body.is_fault_return;
      }
      if (body?.destination) patch.destination = body.destination;
      if (body?.shipping_paid_by) patch.shipping_paid_by = body.shipping_paid_by;
      if (body?.admin_notes) patch.admin_notes = String(body.admin_notes).slice(0, 4000);
      const { error } = await admin.from("dd_returns").update(patch).eq("id", returnId);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, status: "approved" });
    }

    // ─────────────────────────────────────────────────────────── decline ──
    if (action === "decline") {
      const { error } = await admin
        .from("dd_returns")
        .update({
          status: "declined",
          declined_reason: String(body?.reason ?? "").slice(0, 2000) || "Not eligible",
          approved_by: user.id,
        })
        .eq("id", returnId);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, status: "declined" });
    }

    if (action === "cancel") {
      const { error } = await admin
        .from("dd_returns")
        .update({ status: "cancelled", admin_notes: String(body?.reason ?? "").slice(0, 2000) })
        .eq("id", returnId);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, status: "cancelled" });
    }

    // ────────────────────────────────────────────────────── create_label ──
    if (action === "create_label") {
      // EasyPost key lives in dd_ai_config (env-var propagation workaround),
      // same source the outbound label path uses.
      const { data: epCfg } = await admin
        .from("dd_ai_config")
        .select("easypost_api_key, easypost_mode")
        .eq("id", 1)
        .maybeSingle();
      const key = epCfg?.easypost_api_key as string | null;
      const mode = (epCfg?.easypost_mode as string) ?? "test";
      const isTestKey = !key || key.startsWith("EZTK") || mode !== "production";

      // A return label ships FROM the customer TO the destination.
      const from = (order as any)?.shipping_address ?? null;
      if (!from) return json({ error: "order_has_no_shipping_address" }, 400);

      const destination = (ret as any).destination ?? "wholesaler";
      let to: any = null;
      if (destination === "wholesaler" && (ret as any).wholesaler_id) {
        const { data: wrs } = await admin
          .from("dd_wholesaler_return_settings")
          .select("return_address")
          .eq("wholesaler_id", (ret as any).wholesaler_id)
          .maybeSingle();
        to = wrs?.return_address ?? null;
        if (!to) {
          const { data: wp } = await admin
            .from("wholesaler_profiles")
            .select(
              "company_name, contact_name, phone, email, warehouse_street, warehouse_city, warehouse_state, warehouse_zip, warehouse_country, shipping_preferences",
            )
            .eq("id", (ret as any).wholesaler_id)
            .maybeSingle();
          if (wp?.warehouse_street && wp?.warehouse_city && wp?.warehouse_state && wp?.warehouse_zip) {
            to = {
              name: wp.contact_name ?? wp.company_name,
              company: wp.company_name,
              street1: wp.warehouse_street,
              city: wp.warehouse_city,
              state: wp.warehouse_state,
              zip: wp.warehouse_zip,
              country: wp.warehouse_country ?? "US",
              phone: wp.phone,
              email: wp.email,
            };
          } else {
            const prefs = (wp?.shipping_preferences ?? {}) as any;
            to = prefs.return_address ?? prefs.origin_address ?? prefs.pickup_address ?? null;
          }
        }
      } else {
        to = (cfg as any)?.dynasty_return_address ?? null;
      }

      if (!to || !to.street1 || !to.city || !to.state || !to.zip) {
        return json({
          error: "no_return_destination_address",
          message:
            destination === "wholesaler"
              ? "This wholesaler has no return address on file. Add one in Returns → Policy, or send the return to Dynasty instead."
              : "No Dynasty return address is configured. Set it in Returns → Policy.",
        }, 400);
      }

      if (isTestKey) {
        await admin
          .from("dd_returns")
          .update({
            status: "approved",
            label_error:
              "EasyPost is on a TEST key — a real return label cannot be purchased. Set a production key in DD → AI/Integrations config.",
          })
          .eq("id", returnId);
        return json({
          error: "easypost_test_key",
          message:
            "EasyPost is running on a TEST key (EZTK…). Return labels cannot be purchased until a production key is configured.",
          destination,
          to_address: to,
        }, 200);
      }

      const auth = "Basic " + btoa(key + ":");
      const epRes = await fetch("https://api.easypost.com/v2/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify({
          shipment: {
            to_address: to,
            from_address: {
              name: from.name ?? from.recipient ?? (order as any)?.customer_email,
              street1: from.street1 ?? from.address_line_1 ?? from.line1,
              street2: from.street2 ?? from.address_line_2 ?? null,
              city: from.city,
              state: from.state,
              zip: from.zip ?? from.postal_code,
              country: from.country ?? "US",
              phone: from.phone ?? null,
              email: (order as any)?.customer_email ?? null,
            },
            parcel: {
              length: Number(body?.length_in ?? 9),
              width: Number(body?.width_in ?? 6),
              height: Number(body?.height_in ?? 3),
              weight: Number(body?.weight_oz ?? 16),
            },
            is_return: true,
          },
        }),
      });
      const shipment = await epRes.json().catch(() => null);
      if (!epRes.ok || !shipment || shipment.error) {
        const msg = shipment?.error?.message ?? `EasyPost error ${epRes.status}`;
        await admin.from("dd_returns").update({ label_error: msg }).eq("id", returnId);
        return json({ error: "easypost_failed", message: msg }, 502);
      }
      const rates: any[] = shipment.rates ?? [];
      const chosen = rates.length
        ? rates.reduce((a, b) => (Number(a.rate) < Number(b.rate) ? a : b))
        : null;
      if (!chosen) {
        await admin.from("dd_returns").update({ label_error: "no_rates" }).eq("id", returnId);
        return json({ error: "no_rates" }, 502);
      }
      const buyRes = await fetch(`https://api.easypost.com/v2/shipments/${shipment.id}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify({ rate: { id: chosen.id } }),
      });
      const bought = await buyRes.json().catch(() => null);
      if (!buyRes.ok || !bought || bought.error) {
        const msg = bought?.error?.message ?? `EasyPost buy error ${buyRes.status}`;
        await admin.from("dd_returns").update({ label_error: msg }).eq("id", returnId);
        return json({ error: "easypost_buy_failed", message: msg }, 502);
      }

      const { error: updErr } = await admin
        .from("dd_returns")
        .update({
          status: "label_created",
          return_label_url: bought.postage_label?.label_url ?? null,
          return_tracking_number: bought.tracking_code ?? null,
          return_carrier: chosen.carrier ?? null,
          easypost_shipment_id: bought.id ?? shipment.id,
          label_cost_cents: Math.round(Number(chosen.rate ?? 0) * 100),
          label_error: null,
        })
        .eq("id", returnId);
      if (updErr) console.error("[dd-return-admin] label bought but not saved", updErr.message);

      return json({
        success: true,
        status: "label_created",
        label_url: bought.postage_label?.label_url ?? null,
        tracking_number: bought.tracking_code ?? null,
        cost: chosen.rate,
        paid_by: (ret as any).shipping_paid_by,
      });
    }

    // ────────────────────────────────────────────────────── mark_received ──
    if (action === "mark_received") {
      const { error } = await admin
        .from("dd_returns")
        .update({ status: "received", received_at: new Date().toISOString() })
        .eq("id", returnId);
      if (error) return json({ error: error.message }, 500);
      // Returns are a supplier signal — fold it into the scorecard.
      const { error: mErr } = await admin.rpc("dd_apply_return_to_metrics", {
        p_return_id: returnId,
      });
      if (mErr) console.error("[dd-return-admin] metrics update failed", mErr.message);
      return json({ success: true, status: "received" });
    }

    // ─────────────────────────────────────────────────────────── refund ──
    if (action === "refund") {
      if ((ret as any).stripe_refund_id) {
        return json({
          error: "already_refunded",
          refund_id: (ret as any).stripe_refund_id,
          message: "This return has already been refunded. Do not refund twice.",
        }, 409);
      }

      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_DD") ?? Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) return json({ error: "stripe_key_not_configured" }, 503);
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

      // amount: explicit, else the returned line items, else the order total
      let amountCents = Number(body?.amount_cents ?? 0);
      if (!amountCents) {
        const { data: items } = await admin
          .from("dd_return_items")
          .select("qty, unit_price_cents")
          .eq("return_id", returnId);
        amountCents = (items ?? []).reduce(
          (s: number, i: any) => s + Number(i.qty ?? 1) * Number(i.unit_price_cents ?? 0),
          0,
        );
      }
      if (!amountCents) amountCents = Math.round(Number((order as any)?.total ?? 0) * 100);
      if (amountCents <= 0) return json({ error: "nothing_to_refund" }, 400);

      // restocking fee only applies when it isn't our/supplier's fault
      const feePct = Number((cfg as any)?.return_restocking_fee_pct ?? 0);
      const restockCents = (ret as any).is_fault_return || feePct <= 0
        ? 0
        : Math.round((amountCents * feePct) / 100);
      const refundCents = Math.max(0, amountCents - restockCents);

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
            dd_return_id: returnId,
            rma: (ret as any).rma_number,
            order_id: (ret as any).order_id,
          },
        });
        refundId = refund.id;
      }

      // ── reverse the split ───────────────────────────────────────────────
      // Every DD order has a dd_split_ledger row. A refund without a
      // reversing entry leaves the wholesaler credited for money the customer
      // no longer paid, and Dynasty's margin overstated. Proportional to the
      // share of the order being refunded.
      const { data: ledger } = await admin
        .from("dd_split_ledger")
        .select("*")
        .eq("order_id", (ret as any).order_id)
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

        const { data: rev, error: revErr } = await admin
          .from("dd_split_ledger")
          .insert({
            order_id: (ledger as any).order_id,
            fulfillment_id: (ledger as any).fulfillment_id,
            wholesaler_id: (ledger as any).wholesaler_id,
            gross_amount_cents: neg((ledger as any).gross_amount_cents),
            stripe_fee_cents: neg((ledger as any).stripe_fee_cents),
            dd_margin_cents: neg((ledger as any).dd_margin_cents),
            supplier_transfer_cents: neg((ledger as any).supplier_transfer_cents),
            reserve_held_cents: neg((ledger as any).reserve_held_cents),
            reserve_released_cents: 0,
            margin_pct_applied: (ledger as any).margin_pct_applied,
            reserve_pct_applied: (ledger as any).reserve_pct_applied,
            stripe_charge_id: (ledger as any).stripe_charge_id,
            status: "reversed",
            entry_type: "return_reversal",
            return_id: returnId,
            reverses_ledger_id: (ledger as any).id,
            notes:
              `Reversal for ${(ret as any).rma_number} (${Math.round(ratio * 100)}% of the original split)` +
              (refundId ? ` — Stripe refund ${refundId}` : ""),
          })
          .select("id")
          .single();

        if (revErr) {
          console.error("[dd-return-admin] SPLIT REVERSAL FAILED", revErr.message);
          ledgerNote =
            `Refund issued${refundId ? ` (${refundId})` : ""} but the split reversal was NOT written: ${revErr.message}. Fix the ledger manually.`;
        } else {
          reversalId = rev?.id ?? null;
        }

        // Already paid out? Don't chase the money — book a clawback.
        const alreadyPaid = ["paid", "transferred", "released"].includes(
          String((ledger as any).status ?? "").toLowerCase(),
        ) || !!(ledger as any).stripe_transfer_id;
        const supplierShare = Math.round(Number((ledger as any).supplier_transfer_cents ?? 0) * ratio);
        if (alreadyPaid && supplierShare > 0 && (ledger as any).wholesaler_id) {
          const { data: cb, error: cbErr } = await admin
            .from("dd_wholesaler_clawbacks")
            .insert({
              wholesaler_id: (ledger as any).wholesaler_id,
              return_id: returnId,
              order_id: (ret as any).order_id,
              amount_cents: supplierShare,
              reason:
                `Return ${(ret as any).rma_number} refunded after the supplier transfer had already gone out — net off the next payout.`,
              status: "pending",
            })
            .select("id")
            .single();
          if (cbErr) console.error("[dd-return-admin] clawback insert failed", cbErr.message);
          else clawbackId = cb?.id ?? null;
        }
      } else {
        ledgerNote =
          "No dd_split_ledger sale row was found for this order, so no reversal was written. Check the split console.";
      }

      const { error: finErr } = await admin
        .from("dd_returns")
        .update({
          status: "refunded",
          refunded_at: new Date().toISOString(),
          refund_amount_cents: refundCents,
          restocking_fee_cents: restockCents,
          stripe_refund_id: refundId,
          split_reversal_id: reversalId,
          clawback_id: clawbackId,
          admin_notes: ledgerNote
            ? `${(ret as any).admin_notes ?? ""}\n${ledgerNote}`.trim()
            : (ret as any).admin_notes,
        })
        .eq("id", returnId);
      if (finErr) {
        console.error(
          `[dd-return-admin] REFUND ISSUED (${refundId}) but return ${returnId} not marked refunded:`,
          finErr.message,
        );
        return json({
          success: true,
          refund_id: refundId,
          bookkeeping_error:
            `Refund succeeded but the return row was not updated (${finErr.message}). Do NOT refund again — fix the record manually.`,
        });
      }

      return json({
        success: true,
        status: "refunded",
        refund_id: refundId,
        refunded_cents: refundCents,
        restocking_fee_cents: restockCents,
        split_reversal_id: reversalId,
        clawback_id: clawbackId,
        ledger_note: ledgerNote,
      });
    }

    return json({ error: "unhandled_action" }, 400);
  } catch (e: any) {
    console.error("[dd-return-admin]", e?.message ?? e);
    return json({ error: e?.message ?? "action_failed" }, 500);
  }
});
