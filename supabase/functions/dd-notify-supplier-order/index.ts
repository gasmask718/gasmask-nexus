// Dynasty Direct — Notify supplier of a newly routed order via email (Resend).
// Non-blocking: if RESEND_API_KEY missing or send fails, returns warning but does not crash.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { grabba_sync_id, wholesaler_id, order_id } = await req.json();
    if (!wholesaler_id || !order_id) {
      return json({ error: "wholesaler_id and order_id required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Wholesaler — the live catalog keys wholesaler_id to wholesaler_profiles;
    //    the legacy `wholesalers` table is tried first for backward compatibility.
    let recipient: string | null = null;
    let supplierName = "Supplier";
    const { data: wholesaler, error: wErr } = await supabase
      .from("wholesalers")
      .select("id, name, contact_email, email, whatsapp, preferred_contact")
      .eq("id", wholesaler_id)
      .maybeSingle();
    if (wErr) throw wErr;
    if (wholesaler) {
      recipient = wholesaler.contact_email || wholesaler.email;
      supplierName = wholesaler.name ?? supplierName;
    }
    if (!recipient) {
      const { data: prof } = await supabase
        .from("wholesaler_profiles")
        .select("id, company_name, contact_name, email, phone")
        .eq("id", wholesaler_id)
        .maybeSingle();
      if (prof?.email) {
        recipient = prof.email;
        supplierName = prof.company_name ?? supplierName;
      }
    }
    if (!recipient) {
      return json({ success: false, warning: "no recipient email on wholesaler" }, 200);
    }

    // 2) Order + items
    const { data: order, error: oErr } = await supabase
      .from("marketplace_orders")
      .select("*")
      .eq("id", order_id)
      .maybeSingle();
    if (oErr) throw oErr;
    if (!order) return json({ error: "order not found" }, 404);

    const { data: items, error: iErr } = await supabase
      .from("marketplace_order_items")
      .select("qty, price_each, product_id, wholesaler_id, products_all(product_name, sku)")
      .eq("order_id", order_id)
      .eq("wholesaler_id", wholesaler_id);
    if (iErr) throw iErr;

    // Prepaid label — when the fulfillment kickoff already bought postage,
    // the supplier gets the label link in this email and never pays shipping.
    const { data: shipment } = await supabase
      .from("dd_shipments")
      .select("tracking_number, carrier, label_url, label_pdf_url, status, box_name, billable_weight_oz")
      .eq("order_id", order_id)
      .eq("wholesaler_id", wholesaler_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lineItems = (items ?? []).map((it: any) => {
      const qty = Number(it.qty ?? 0);
      const unit = Number(it.price_each ?? 0);
      return {
        product_name: it.products_all?.product_name ?? "Item",
        sku: it.products_all?.sku ?? "—",
        quantity: qty,
        unit_price: unit,
        subtotal: qty * unit,
      };
    });
    const orderTotal = lineItems.reduce((s, i) => s + i.subtotal, 0);

    // 3) Shipping address
    const addr = (order.shipping_address ?? {}) as Record<string, any>;
    const shortId = String(order_id).slice(0, 8);
    const createdAt = order.created_at ? new Date(order.created_at).toLocaleString() : "—";

    const itemsHtml = lineItems
      .map(
        (i) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee">
            <strong>${esc(i.product_name)}</strong><br/>
            <span style="color:#666;font-size:12px">SKU: ${esc(i.sku)}</span>
          </td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${i.unit_price.toFixed(2)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${i.subtotal.toFixed(2)}</td>
        </tr>`,
      )
      .join("");

    const subject = `📦 New Order — #${shortId} Action Required`;
    const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f7f7f9;margin:0;padding:24px">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:#0f172a;color:#fff;padding:20px 24px">
      <h1 style="margin:0;font-size:20px">Dynasty Direct — New Order</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px">Order #${shortId} · ${esc(createdAt)}</p>
    </div>
    <div style="padding:24px">
      <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a">Items to Fulfill</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="background:#f3f4f6">
          <th style="padding:8px;text-align:left">Product</th>
          <th style="padding:8px">Qty</th>
          <th style="padding:8px;text-align:right">Unit</th>
          <th style="padding:8px;text-align:right">Subtotal</th>
        </tr></thead>
        <tbody>${itemsHtml}</tbody>
        <tfoot><tr>
          <td colspan="3" style="padding:12px 8px;text-align:right;font-weight:bold">Order Total</td>
          <td style="padding:12px 8px;text-align:right;font-weight:bold">$${orderTotal.toFixed(2)}</td>
        </tr></tfoot>
      </table>

      <h2 style="margin:24px 0 8px;font-size:16px;color:#0f172a">Ship To</h2>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px;font-size:14px;line-height:1.5">
        ${esc(addr.name ?? order.customer_email ?? "Customer")}<br/>
        ${esc(addr.line1 ?? addr.street ?? addr.address ?? "")}<br/>
        ${esc(addr.line2 ?? "")}${addr.line2 ? "<br/>" : ""}
        ${esc(addr.city ?? "")}, ${esc(addr.state ?? "")} ${esc(addr.postal_code ?? addr.zip ?? "")}
      </div>

      ${shipment?.label_url ? `
      <h2 style="margin:24px 0 8px;font-size:16px;color:#0f172a">Prepaid Shipping Label — already paid</h2>
      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;padding:12px;font-size:14px;line-height:1.6">
        <p style="margin:0 0 6px">Postage is <strong>already purchased</strong> by Dynasty Direct. Print the label, attach it to the package, and hand it to the carrier — you pay nothing.</p>
        ${shipment?.box_name ? `<p style="margin:0 0 6px;font-size:16px"><strong>📦 Use ${esc(shipment.box_name)}</strong>${shipment.billable_weight_oz ? ` — rated at ${Number(shipment.billable_weight_oz).toFixed(1)} oz billable` : ''}. Using a different box may cause a carrier re-weigh charge.</p>` : ''}
        <p style="margin:0 0 6px"><a href="${esc(shipment.label_pdf_url ?? shipment.label_url)}" style="color:#047857;font-weight:bold">📄 Download prepaid label</a></p>
        ${shipment.tracking_number ? `<p style="margin:0">Tracking: <strong>${esc(shipment.tracking_number)}</strong>${shipment.carrier ? ` (${esc(shipment.carrier)})` : ""}</p>` : ""}
      </div>` : ""}

      <h2 style="margin:24px 0 8px;font-size:16px;color:#0f172a">Instructions</h2>
      <ul style="font-size:14px;line-height:1.7;color:#334155;margin:0;padding-left:18px">
        <li>Pack securely</li>
        <li>Include packing slip</li>
        <li>Ship within 2 business days</li>
        ${shipment?.label_url
          ? "<li>Tracking flows to the customer automatically — no action needed</li>"
          : `<li>Email tracking to <a href="mailto:orders@dynastydirect.com">orders@dynastydirect.com</a></li>`}
      </ul>

      <p style="margin-top:24px;font-size:13px;color:#64748b">Questions? Reply to this email.</p>
      <p style="margin:4px 0 0;font-size:13px;color:#64748b">— Dynasty Direct Team</p>
    </div>
  </div>
</body></html>`;

    // 4) Send via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    let sent = false;
    let sendError: string | null = null;
    if (!RESEND_API_KEY) {
      console.warn("[dd-notify-supplier-order] RESEND_API_KEY not set — skipping email send");
      sendError = "RESEND_API_KEY not configured";
    } else {
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Dynasty Direct <orders@dynastydirect.com>",
            to: [recipient],
            subject,
            html,
            reply_to: "orders@dynastydirect.com",
          }),
        });
        if (!r.ok) {
          const t = await r.text();
          sendError = `Resend ${r.status}: ${t}`;
          console.error("[dd-notify-supplier-order]", sendError);
        } else {
          sent = true;
        }
      } catch (e: any) {
        sendError = e?.message ?? String(e);
        console.error("[dd-notify-supplier-order] send error", sendError);
      }
    }

    // 5) WhatsApp (best-effort) — fires when supplier prefers whatsapp or both
    const wa = (wholesaler as { whatsapp?: string | null }).whatsapp ?? null;
    const pref = ((wholesaler as { preferred_contact?: string | null }).preferred_contact ?? "email").toLowerCase();
    let whatsapp_sent = false;
    if (wa && (pref === "whatsapp" || pref === "both")) {
      const customerName = addr.name ?? order.customer_email ?? "Customer";
      const waMsg =
        `📦 *New Order — Dynasty Direct*\n\n` +
        `Order: #${shortId}\n` +
        `Items: ${lineItems.length} products\n` +
        `Total: $${orderTotal.toFixed(2)}\n\n` +
        `Ship to:\n${customerName}\n` +
        `${addr.city ?? ""}, ${addr.state ?? ""}\n\n` +
        `Ship within *2 business days*.\n` +
        `Reply DONE <tracking#> when shipped.`;
      try {
        const { data: waRes } = await supabase.functions.invoke("dd-whatsapp-notify", {
          body: { to_whatsapp: wa, message: waMsg, wholesaler_id },
        });
        whatsapp_sent = !!(waRes as { success?: boolean } | null)?.success;
      } catch (e) {
        console.error("[dd-notify-supplier-order] WhatsApp failed", e);
      }
    }

    // 6) Log notification on the grabba sync row (best effort)
    if (grabba_sync_id) {
      await supabase
        .from("dd_grabba_sync")
        .update({ supplier_notified: sent, supplier_notified_at: sent ? new Date().toISOString() : null })
        .eq("id", grabba_sync_id);
    } else if (sent) {
      await supabase
        .from("dd_grabba_sync")
        .update({ supplier_notified: true, supplier_notified_at: new Date().toISOString() })
        .eq("marketplace_order_id", order_id)
        .eq("wholesaler_id", wholesaler_id);
    }

    return json({ success: true, sent, whatsapp_sent, notified: recipient, error: sendError });
  } catch (err: any) {
    console.error("[dd-notify-supplier-order] error", err);
    return json({ error: err?.message ?? String(err) }, 500);
  }
});

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
