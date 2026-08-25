// dd-support-ticket: guest-safe support ticket create/thread/reply, mirroring
// dd-lookup-guest-order's rate-limit + opaque-miss contract.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

const CATEGORIES = ["wrong_item", "damaged", "never_arrived", "billing", "other"];

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function checkRateLimit(ip: string): Promise<boolean> {
  const v_ip_hash_source = ip || "";
  // Reuse the same attempts table as guest order lookup, scoped by a distinct
  // marker so support-ticket abuse doesn't share the order-lookup budget.
  const { count, error } = await supabase
    .from("guest_order_lookup_attempts" as any)
    .select("id", { count: "exact", head: true })
    .eq("email_provided", `__dd_support__:${v_ip_hash_source}`)
    .gte("attempted_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if (error) {
    console.error("[dd-support-ticket] rate limit check error", error.message);
    return true; // fail open on infra error to avoid blocking legit support requests
  }
  return (count ?? 0) < 20;
}

async function recordAttempt(ip: string, success: boolean, reason?: string) {
  await supabase.from("guest_order_lookup_attempts" as any).insert({
    ip_hash: ip || "unknown",
    order_id: null,
    email_provided: `__dd_support__:${ip || ""}`,
    success,
    rejected_reason: reason ?? null,
  });
}

async function findOrderByEmail(orderId: string, email: string) {
  const normEmail = String(email).toLowerCase().trim();
  const { data: order } = await supabase
    .from("marketplace_orders")
    .select("id, user_id, wholesaler_id, shipping_address")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return null;
  const shippingEmail = (order as any).shipping_address?.email;
  if (!shippingEmail || String(shippingEmail).toLowerCase().trim() !== normEmail) {
    return null;
  }
  return order;
}

async function resolveWholesalerId(orderId: string): Promise<string | null> {
  const { data: order } = await supabase
    .from("marketplace_orders")
    .select("wholesaler_id")
    .eq("id", orderId)
    .maybeSingle();
  if (order?.wholesaler_id) return order.wholesaler_id;
  const { data: item } = await supabase
    .from("marketplace_order_items")
    .select("wholesaler_id")
    .eq("order_id", orderId)
    .not("wholesaler_id", "is", null)
    .limit(1)
    .maybeSingle();
  return item?.wholesaler_id ?? null;
}

async function verifyTicketEmail(ticketNumber: string, email: string) {
  const normEmail = String(email).toLowerCase().trim();
  const { data: ticket, error } = await supabase
    .from("dd_support_tickets" as any)
    .select("*")
    .eq("ticket_number", ticketNumber)
    .maybeSingle();
  if (error || !ticket) return null;
  if (!(ticket as any).customer_email || String((ticket as any).customer_email).toLowerCase().trim() !== normEmail) {
    return null;
  }
  return ticket;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const ip = clientIp(req);
  const action = body.action;

  try {
    const okRate = await checkRateLimit(ip);
    if (!okRate) {
      await recordAttempt(ip, false, "rate_limited");
      return json({});
    }

    if (action === "create") {
      const { order_id, email, subject, category, body: msgBody, name } = body as any;
      if (
        !isUuid(order_id) ||
        typeof email !== "string" || email.length > 320 ||
        typeof subject !== "string" || subject.trim().length === 0 || subject.length > 300 ||
        typeof msgBody !== "string" || msgBody.trim().length === 0 || msgBody.length > 5000 ||
        (category && !CATEGORIES.includes(String(category)))
      ) {
        await recordAttempt(ip, false, "invalid_input");
        return json({});
      }

      const order = await findOrderByEmail(order_id, email);
      if (!order) {
        await recordAttempt(ip, false, "no_match");
        return json({});
      }

      const wholesalerId = await resolveWholesalerId(order_id);

      const { data: ticket, error: insertError } = await supabase
        .from("dd_support_tickets" as any)
        .insert({
          order_id,
          user_id: (order as any).user_id ?? null,
          customer_email: String(email).toLowerCase().trim(),
          customer_name: typeof name === "string" ? name.slice(0, 200) : null,
          subject: subject.trim().slice(0, 300),
          category: category ? String(category) : "other",
          wholesaler_id: wholesalerId,
          last_reply_role: "customer",
        })
        .select("id, ticket_number")
        .single();

      if (insertError || !ticket) {
        console.error("[dd-support-ticket] create insert error", insertError?.message);
        await recordAttempt(ip, false, "insert_failed");
        return json({});
      }

      const { error: msgError } = await supabase.from("dd_ticket_messages" as any).insert({
        ticket_id: (ticket as any).id,
        sender_role: "customer",
        sender_name: typeof name === "string" ? name.slice(0, 200) : null,
        body: msgBody.trim(),
        is_internal: false,
      });
      if (msgError) {
        console.error("[dd-support-ticket] create message error", msgError.message);
      }

      await recordAttempt(ip, true);
      return json({ ticket_number: (ticket as any).ticket_number, ticket_id: (ticket as any).id });
    }

    if (action === "thread") {
      const { ticket_number, email } = body as any;
      if (typeof ticket_number !== "string" || typeof email !== "string" || email.length > 320) {
        await recordAttempt(ip, false, "invalid_input");
        return json({});
      }
      const ticket = await verifyTicketEmail(ticket_number, email);
      if (!ticket) {
        await recordAttempt(ip, false, "no_match");
        return json({});
      }
      const { data: messages, error } = await supabase
        .from("dd_ticket_messages" as any)
        .select("id, sender_role, sender_name, body, attachment_url, created_at")
        .eq("ticket_id", (ticket as any).id)
        .eq("is_internal", false)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("[dd-support-ticket] thread fetch error", error.message);
        return json({});
      }
      await recordAttempt(ip, true);
      return json({
        ticket: {
          ticket_number: (ticket as any).ticket_number,
          subject: (ticket as any).subject,
          status: (ticket as any).status,
          category: (ticket as any).category,
          created_at: (ticket as any).created_at,
        },
        messages: messages ?? [],
      });
    }

    if (action === "reply") {
      const { ticket_number, email, body: msgBody } = body as any;
      if (
        typeof ticket_number !== "string" ||
        typeof email !== "string" || email.length > 320 ||
        typeof msgBody !== "string" || msgBody.trim().length === 0 || msgBody.length > 5000
      ) {
        await recordAttempt(ip, false, "invalid_input");
        return json({});
      }
      const ticket = await verifyTicketEmail(ticket_number, email);
      if (!ticket) {
        await recordAttempt(ip, false, "no_match");
        return json({});
      }
      const { error: msgError } = await supabase.from("dd_ticket_messages" as any).insert({
        ticket_id: (ticket as any).id,
        sender_role: "customer",
        sender_name: (ticket as any).customer_name,
        body: msgBody.trim(),
        is_internal: false,
      });
      if (msgError) {
        console.error("[dd-support-ticket] reply insert error", msgError.message);
        return json({});
      }
      const { error: updError } = await supabase
        .from("dd_support_tickets" as any)
        .update({ status: "open", last_reply_at: new Date().toISOString(), last_reply_role: "customer" })
        .eq("id", (ticket as any).id);
      if (updError) {
        console.error("[dd-support-ticket] reply ticket update error", updError.message);
      }
      await recordAttempt(ip, true);
      return json({ ok: true });
    }

    return json({ error: "invalid_action" }, 400);
  } catch (e) {
    console.error("[dd-support-ticket] unhandled error", (e as Error)?.message ?? e);
    return json({});
  }
});
