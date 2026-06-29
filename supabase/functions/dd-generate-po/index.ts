// Dynasty Direct — Purchase Order generator.
// Creates a PO row from an order/wholesaler pair, stores HTML in Storage,
// and optionally emails it to the supplier via Resend (through the Lovable
// connector gateway).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface POItem {
  product_id?: string;
  product_name?: string;
  sku?: string;
  quantity?: number;
  unit_cost?: number;
  line_total?: number;
}

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function money(n: unknown): string {
  const v = Number(n ?? 0);
  return `$${v.toFixed(2)}`;
}

function renderHtml(po: any, supplier: any): string {
  const items: POItem[] = Array.isArray(po.items) ? po.items : [];
  const rows = items
    .map(
      (i) => `
      <tr>
        <td>${escapeHtml(i.sku || "—")}</td>
        <td>${escapeHtml(i.product_name || "")}</td>
        <td style="text-align:right">${escapeHtml(i.quantity ?? 0)}</td>
        <td style="text-align:right">${money(i.unit_cost)}</td>
        <td style="text-align:right">${money(i.line_total)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>Purchase Order ${escapeHtml(po.po_number)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;padding:32px;max-width:760px;margin:0 auto}
  h1{margin:0;font-size:22px;letter-spacing:1px}
  .brand{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:2px}
  .grid{display:flex;justify-content:space-between;gap:24px;margin-top:24px}
  .box{flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:12px}
  .box h3{font-size:11px;text-transform:uppercase;color:#666;margin:0 0 6px}
  table{width:100%;border-collapse:collapse;margin-top:20px;font-size:13px}
  th,td{padding:8px;border-bottom:1px solid #e5e7eb;text-align:left}
  th{background:#f8fafc;font-size:11px;text-transform:uppercase;color:#555}
  .totals{margin-top:16px;width:280px;margin-left:auto;font-size:13px}
  .totals div{display:flex;justify-content:space-between;padding:4px 0}
  .totals .grand{border-top:2px solid #111;font-weight:700;font-size:15px;margin-top:6px;padding-top:8px}
  .footer{margin-top:32px;font-size:12px;color:#444;border-top:1px solid #e5e7eb;padding-top:14px}
</style></head><body>
  <div class="brand">Dynasty Direct LLC</div>
  <h1>PURCHASE ORDER</h1>
  <div style="margin-top:6px;font-size:13px">
    <strong>PO #:</strong> ${escapeHtml(po.po_number)} &nbsp;·&nbsp;
    <strong>Date:</strong> ${escapeHtml(new Date(po.created_at).toLocaleDateString())} &nbsp;·&nbsp;
    <strong>Expected Ship:</strong> ${escapeHtml(po.expected_ship_date ?? "TBD")}
  </div>
  <div class="grid">
    <div class="box">
      <h3>Supplier</h3>
      <div><strong>${escapeHtml(supplier?.name ?? "Supplier")}</strong></div>
      <div>${escapeHtml(supplier?.email ?? "")}</div>
    </div>
    <div class="box">
      <h3>Ship To</h3>
      <div><strong>Dynasty Direct</strong></div>
      <div>Fulfillment Center</div>
      <div>orders@dynastydirect.com</div>
    </div>
  </div>
  <table>
    <thead><tr>
      <th>SKU</th><th>Description</th>
      <th style="text-align:right">Qty</th>
      <th style="text-align:right">Unit Cost</th>
      <th style="text-align:right">Total</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="5" style="color:#888;text-align:center;padding:18px">No line items</td></tr>`}</tbody>
  </table>
  <div class="totals">
    <div><span>Subtotal</span><span>${money(po.subtotal)}</span></div>
    <div><span>Shipping</span><span>${po.shipping_cost ? money(po.shipping_cost) : "TBD"}</span></div>
    <div class="grand"><span>Total</span><span>${money(po.total)}</span></div>
  </div>
  <div class="footer">
    <div><strong>Payment Terms:</strong> ${escapeHtml(po.payment_terms?.toUpperCase() ?? "NET30")}</div>
    <div><strong>Authorized by:</strong> Dynasty Direct LLC</div>
    <p>Please ship within 2 business days. Email tracking information to
       <strong>orders@dynastydirect.com</strong> referencing PO ${escapeHtml(po.po_number)}.</p>
    ${po.notes ? `<p><strong>Notes:</strong> ${escapeHtml(po.notes)}</p>` : ""}
  </div>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const order_id: string | undefined = body.order_id;
    const wholesaler_id: string | undefined = body.wholesaler_id;
    const grabba_sync_id: string | null = body.grabba_sync_id ?? null;
    const send_to_supplier: boolean = !!body.send_to_supplier;

    if (!wholesaler_id) {
      return json({ error: "wholesaler_id required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Create PO via RPC (order_id may be null for manual POs)
    const { data: poId, error: rpcErr } = await supabase.rpc(
      "dd_create_purchase_order",
      {
        p_wholesaler_id: wholesaler_id,
        p_order_id: order_id ?? null,
        p_grabba_sync_id: grabba_sync_id,
      } as any,
    );
    if (rpcErr) throw rpcErr;

    // 2) Fetch PO + supplier
    const { data: po, error: poErr } = await supabase
      .from("dd_purchase_orders")
      .select("*")
      .eq("id", poId as string)
      .single();
    if (poErr) throw poErr;

    const { data: supplier } = await supabase
      .from("wholesalers")
      .select("name, email")
      .eq("id", wholesaler_id)
      .maybeSingle();

    // 3) Render + 4) Store HTML in Storage
    const html = renderHtml(po, supplier);
    const path = `${po.po_number}/${po.po_number}.html`;
    const { error: uploadErr } = await supabase.storage
      .from("purchase-orders")
      .upload(path, new Blob([html], { type: "text/html" }), {
        contentType: "text/html",
        upsert: true,
      });
    if (uploadErr) console.error("[dd-generate-po] storage upload failed", uploadErr);

    // 5) Optionally email
    let emailed = false;
    let emailError: string | null = null;
    if (send_to_supplier && supplier?.email) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (LOVABLE_API_KEY && RESEND_API_KEY) {
        try {
          const resp = await fetch(
            "https://connector-gateway.lovable.dev/resend/emails",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "X-Connection-Api-Key": RESEND_API_KEY,
              },
              body: JSON.stringify({
                from: "Dynasty Direct <orders@dynastydirect.com>",
                to: [supplier.email],
                subject: `Purchase Order ${po.po_number}`,
                html,
              }),
            },
          );
          if (!resp.ok) {
            emailError = `resend ${resp.status}: ${(await resp.text()).slice(0, 300)}`;
          } else {
            emailed = true;
            await supabase
              .from("dd_purchase_orders")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("id", po.id);
          }
        } catch (e: any) {
          emailError = String(e?.message ?? e);
        }
      } else {
        emailError = "resend_not_configured";
      }
    }

    return json({
      success: true,
      po_id: po.id,
      po_number: po.po_number,
      total: Number(po.total ?? 0),
      storage_path: path,
      emailed,
      email_error: emailError,
    });
  } catch (err: any) {
    console.error("[dd-generate-po] error", err);
    return json({ error: err?.message ?? String(err) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
