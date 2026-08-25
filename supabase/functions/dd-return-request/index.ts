// Dynasty Direct — customer-facing RETURN (RMA) request intake.
//
// Works for BOTH guests and signed-in customers. Ownership of the order is
// proven the same way /track proves it: the caller must supply the exact email
// on the order (via the SECURITY DEFINER lookup_guest_order RPC, which also
// rate-limits per IP). Every non-match returns {} with a 200 so the surface is
// indistinguishable across outcomes — same contract as dd-lookup-guest-order.
//
// Structural policy (destination, who pays return shipping) is NOT decided
// here. It is resolved from dd_config + dd_wholesaler_return_settings so the
// owner can change it without a deploy.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FAULT_REASONS = new Set([
  "wrong_item",
  "damaged",
  "not_as_described",
  "missing_items",
  "defective",
]);
const REASON_CODES = new Set([
  ...FAULT_REASONS,
  "changed_mind",
  "arrived_late",
  "other",
]);

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
  const reasonCode = String(body?.reason_code ?? "");
  const reasonText = typeof body?.reason_text === "string" ? body.reason_text.slice(0, 2000) : null;
  const quantity = Math.max(1, Math.min(999, Number(body?.quantity ?? 1) || 1));
  const items = Array.isArray(body?.items) ? body.items.slice(0, 50) : [];
  const photos: string[] = Array.isArray(body?.photos) ? body.photos.slice(0, 4) : [];

  if (!isUuid(orderId) || typeof email !== "string" || email.length > 320) {
    return json({ error: "invalid_input" }, 400);
  }
  if (!REASON_CODES.has(reasonCode)) return json({ error: "invalid_reason_code" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1) Prove ownership (exact email match + per-IP rate limit)
    const { data: proof, error: proofErr } = await supabase.rpc("lookup_guest_order", {
      p_order_id: orderId,
      p_email: email,
      p_ip: clientIp(req),
    });
    if (proofErr) {
      console.error("[dd-return-request] lookup rpc error", proofErr.message);
      return json({});
    }
    if (!proof || Object.keys(proof as Record<string, unknown>).length === 0) return json({});

    // 2) Are returns open at all, and is the order inside the window?
    const { data: cfg } = await supabase
      .from("dd_config")
      .select(
        "returns_enabled, return_window_days, return_destination_default, return_payer_fault, return_payer_change_of_mind, dynasty_return_address, return_restocking_fee_pct",
      )
      .limit(1)
      .maybeSingle();

    if (cfg && cfg.returns_enabled === false) {
      return json({ error: "returns_disabled", message: "Returns are not being accepted right now." }, 200);
    }

    const { data: order } = await supabase
      .from("marketplace_orders")
      .select("id, user_id, wholesaler_id, customer_email, payment_status, created_at, total")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return json({});

    const windowDays = Number(cfg?.return_window_days ?? 30);
    const ageDays = (Date.now() - new Date(order.created_at as string).getTime()) / 86_400_000;
    if (windowDays > 0 && ageDays > windowDays) {
      return json({
        error: "window_closed",
        message: `This order is outside the ${windowDays}-day return window. Open a support ticket and we'll take a look.`,
      }, 200);
    }

    // one open return per order — avoids duplicate labels/refunds
    const { data: existing } = await supabase
      .from("dd_returns")
      .select("id, rma_number, status")
      .eq("order_id", orderId)
      .not("status", "in", '("declined","closed","cancelled")')
      .limit(1)
      .maybeSingle();
    if (existing) {
      return json({
        already_open: true,
        rma_number: existing.rma_number,
        status: existing.status,
        message: "There's already an open return on this order.",
      });
    }

    // 3) Resolve wholesaler + policy (config default, wholesaler override wins)
    let wholesalerId: string | null = (order as any).wholesaler_id ?? null;
    if (!wholesalerId) {
      const { data: oi } = await supabase
        .from("marketplace_order_items")
        .select("wholesaler_id")
        .eq("order_id", orderId)
        .not("wholesaler_id", "is", null)
        .limit(1);
      wholesalerId = oi?.[0]?.wholesaler_id ?? null;
    }

    let ws: any = null;
    if (wholesalerId) {
      const { data } = await supabase
        .from("dd_wholesaler_return_settings")
        .select("*")
        .eq("wholesaler_id", wholesalerId)
        .maybeSingle();
      ws = data;
    }

    const isFault = FAULT_REASONS.has(reasonCode);
    const destination = ws?.return_destination ?? cfg?.return_destination_default ?? "wholesaler";
    const payer = isFault
      ? (ws?.return_payer_fault ?? cfg?.return_payer_fault ?? "wholesaler")
      : (ws?.return_payer_change_of_mind ?? cfg?.return_payer_change_of_mind ?? "customer");

    // 4) Photos — guests can't write to a private bucket, so they arrive as
    //    base64 and are stored server-side. We keep the PATH, never a URL.
    const storedPhotoPaths: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      if (typeof p !== "string" || !p.startsWith("data:image/")) continue;
      const match = p.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) continue;
      const [, contentType, b64] = match;
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      if (bytes.byteLength > 8 * 1024 * 1024) continue;
      const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
      const path = `${orderId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("dd-return-photos")
        .upload(path, bytes, { contentType, upsert: false });
      if (upErr) {
        console.error("[dd-return-request] photo upload failed", upErr.message);
        continue;
      }
      storedPhotoPaths.push(path);
    }

    // 5) Create the return
    const { data: ret, error: insErr } = await supabase
      .from("dd_returns")
      .insert({
        order_id: orderId,
        user_id: (order as any).user_id ?? null,
        customer_email: (order as any).customer_email ?? email,
        wholesaler_id: wholesalerId,
        reason_code: reasonCode,
        reason_text: reasonText,
        photos: storedPhotoPaths,
        quantity,
        is_fault_return: isFault,
        fault_party: isFault ? "wholesaler" : "customer",
        status: "requested",
        destination,
        shipping_paid_by: payer,
      })
      .select("id, rma_number, status")
      .single();

    if (insErr || !ret) {
      console.error("[dd-return-request] insert failed", insErr?.message);
      return json({ error: "return_not_created", message: insErr?.message ?? "unknown" }, 500);
    }

    if (items.length) {
      const rows = items
        .filter((it: any) => isUuid(it?.order_item_id) || isUuid(it?.product_id))
        .map((it: any) => ({
          return_id: ret.id,
          order_item_id: isUuid(it?.order_item_id) ? it.order_item_id : null,
          product_id: isUuid(it?.product_id) ? it.product_id : null,
          product_name: typeof it?.product_name === "string" ? it.product_name.slice(0, 300) : null,
          qty: Math.max(1, Math.min(999, Number(it?.qty ?? 1) || 1)),
          unit_price_cents: Math.max(0, Math.round(Number(it?.unit_price ?? 0) * 100)),
        }));
      if (rows.length) {
        const { error: itemsErr } = await supabase.from("dd_return_items").insert(rows);
        if (itemsErr) console.error("[dd-return-request] items insert failed", itemsErr.message);
      }
    }

    return json({
      success: true,
      rma_number: ret.rma_number,
      status: ret.status,
      destination,
      shipping_paid_by: payer,
      is_fault_return: isFault,
      message:
        "Return request received. We'll review it and email you a return label if it's approved.",
    });
  } catch (e: any) {
    console.error("[dd-return-request]", e?.message ?? e);
    return json({ error: "request_failed" }, 500);
  }
});
