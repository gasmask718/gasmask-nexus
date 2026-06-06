// Order delivery receipt — sends SMS to store on order delivery,
// includes tokenized portal signup link for stores without an owner user.
// Respects opt_out_events, 12h dedupe on (store_id, order_id).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body { order_id: string; }

function randomToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as Body;
    if (!body?.order_id) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load order
    const { data: order, error: oErr } = await supabase
      .from("marketplace_orders")
      .select("id, ordering_store_id, total, fulfillment_status, shipping_address, user_id, created_at")
      .eq("id", body.order_id)
      .maybeSingle();
    if (oErr || !order) {
      return new Response(JSON.stringify({ error: "order not found", detail: oErr?.message }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const storeId: string | null = order.ordering_store_id;
    if (!storeId) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_store_id" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load store + phone
    const { data: store } = await supabase
      .from("store_master")
      .select("id, store_name, phone")
      .eq("id", storeId)
      .maybeSingle();
    const phoneRaw: string | undefined =
      store?.phone || order.shipping_address?.phone || order.shipping_address?.phoneNumber;
    if (!phoneRaw) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_phone" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const phone = phoneRaw.startsWith("+") ? phoneRaw : `+1${phoneRaw.replace(/\D/g, "")}`;

    // Opt-out check
    const { data: opt } = await supabase
      .from("opt_out_events").select("id").eq("phone", phone).limit(1).maybeSingle();
    if (opt) {
      return new Response(JSON.stringify({ skipped: true, reason: "opted_out" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 12h dedupe: previous receipt for this order
    const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const { data: dup } = await supabase
      .from("communication_logs")
      .select("id")
      .eq("outcome", "order_receipt")
      .eq("related_order_id", order.id)
      .gte("created_at", since)
      .limit(1);
    if (dup && dup.length > 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "dedupe" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Does store have a linked owner user? Heuristic: any prior order with user_id whose email matches store email, OR a stored claim.
    // For now treat "no signup link present" if order.user_id is null OR store_signup_tokens never used.
    const { data: priorClaim } = await supabase
      .from("store_signup_tokens")
      .select("id").eq("store_id", storeId).not("used_at", "is", null).limit(1);
    const needsSignup = !priorClaim || priorClaim.length === 0;

    let signupLine = "";
    if (needsSignup) {
      const token = randomToken();
      await supabase.from("store_signup_tokens").insert({
        token, store_id: storeId, store_name: store?.store_name, phone,
      });
      const origin = Deno.env.get("PUBLIC_APP_ORIGIN") || "https://gasmask-os-nexus.lovable.app";
      signupLine = ` Create your portal account: ${origin}/store-signup?token=${token}`;
    }

    const total = Number(order.total ?? 0).toFixed(2);
    const text =
      `Receipt — ${store?.store_name ?? "your store"}: order delivered. Total $${total}.${signupLine} Reply STOP to opt out.`;

    // Send via send-sms (uses guarded From)
    const sendResp = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ to: phone, body: text, provider: "twilio" }),
      },
    );
    const sendJson = await sendResp.json().catch(() => ({}));

    // Log
    await supabase.from("communication_logs").insert({
      direction: "outbound",
      channel: "sms",
      to_phone: phone,
      message_body: text,
      outcome: "order_receipt",
      store_id: storeId,
      related_order_id: order.id,
      success: !!sendJson?.success,
      provider: "twilio",
    });

    return new Response(JSON.stringify({
      success: true, sent: !!sendJson?.success, signup_link: needsSignup, send: sendJson,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
