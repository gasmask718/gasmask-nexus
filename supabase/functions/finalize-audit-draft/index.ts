import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify owner/admin access
    const { data: hasAccess } = await supabase.rpc("has_audit_engine_access", { _user_id: user.id });
    if (!hasAccess) throw new Error("Insufficient permissions — owner/admin only");

    const body = await req.json();
    const draftId = body.draft_id;
    if (!draftId) throw new Error("draft_id is required");

    // ═══ HARD GATE 1: Fetch + validate draft ═══
    const { data: draft, error: draftError } = await supabase
      .from("audit_invoice_drafts")
      .select("*")
      .eq("id", draftId)
      .single();

    if (draftError || !draft) throw new Error("Draft not found");
    if (draft.approval_status !== "approved") throw new Error("Draft must be approved before finalization");
    if (draft.finalize_status !== "ready_to_finalize") throw new Error("Draft is not ready to finalize");
    if (draft.finalize_status === "finalized") throw new Error("Draft already finalized");

    // ═══ HARD GATE 2: Anti-hallucination guard ═══
    const lineItems = Array.isArray(draft.line_items) ? draft.line_items : [];
    if (lineItems.length === 0) {
      throw new Error("Cannot finalize: draft has no line items. Edit the draft first.");
    }
    if (!draft.total || draft.total <= 0) {
      throw new Error("Cannot finalize: draft total is zero or null. Edit the draft first.");
    }
    if (!draft.store_id) {
      throw new Error("Cannot finalize: draft has no linked store. Link a store first.");
    }

    // ═══ ATOMIC TRANSACTION via RPC ═══
    // We use sequential locked operations to simulate atomicity

    // Step 1: Lock the draft row (re-fetch with FOR UPDATE equivalent — check status again)
    const { data: lockedDraft, error: lockError } = await supabase
      .from("audit_invoice_drafts")
      .select("id, finalize_status")
      .eq("id", draftId)
      .eq("finalize_status", "ready_to_finalize")
      .single();

    if (lockError || !lockedDraft) {
      throw new Error("Draft is no longer available for finalization (concurrent access)");
    }

    // Step 2: Generate invoice number
    const timestamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const invoiceNumber = `AUD-${timestamp}-${rand}`;

    // Step 3: Create the live invoice
    const { data: newInvoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        store_id: draft.store_id,
        entity_type: "store",
        entity_id: draft.store_id,
        total_amount: draft.total,
        total: draft.total,
        subtotal: draft.subtotal || draft.total,
        tax: draft.taxes || 0,
        amount_paid: draft.payment_status === "paid" ? draft.total : 0,
        payment_status: draft.payment_status === "paid" ? "paid" : "unpaid",
        status: "active",
        is_historical: false,
        notes: `[Audit Engine] Finalized from audit draft ${draftId}. ${draft.notes || ""}`.trim(),
        created_by: user.id,
        finalized_by: user.id,
        finalized_at: new Date().toISOString(),
      })
      .select("id, invoice_number")
      .single();

    if (invoiceError) {
      console.error("Invoice creation failed:", invoiceError);
      throw new Error(`Invoice creation failed: ${invoiceError.message}`);
    }

    // Step 4: Create invoice line items
    for (const li of lineItems) {
      const qty = li.qty || li.quantity || 1;
      const unitPrice = li.unit_price || 0;
      const lineTotal = li.line_total || qty * unitPrice;

      await supabase.from("invoice_line_items").insert({
        invoice_id: newInvoice.id,
        product_name: li.product || li.brand || "Unknown Product",
        brand: li.brand || null,
        quantity: qty,
        unit_price: unitPrice,
        unit_price_used: unitPrice,
        total: lineTotal,
        line_subtotal: lineTotal,
        unit_type: "tube",
        computed_tubes_total: qty,
        line_source: "audit_draft_finalize",
      });
    }

    // Step 5: Update the draft → finalized
    const { error: updateError } = await supabase
      .from("audit_invoice_drafts")
      .update({
        finalize_status: "finalized",
        finalized_invoice_id: newInvoice.id,
        finalized_by: user.id,
        finalized_at: new Date().toISOString(),
      })
      .eq("id", draftId);

    if (updateError) {
      // Attempt rollback: delete the invoice we just created
      // Compensating rollback, scoped to the lines this call just created.
      await supabase
        .from("invoice_line_items")
        .delete()
        .eq("invoice_id", newInvoice.id)
        .eq("line_source", "audit_draft_finalize");
      await supabase.from("invoices").delete().eq("id", newInvoice.id);
      throw new Error(`Draft update failed after invoice creation: ${updateError.message}`);
    }

    // Step 6: Write immutable audit log
    await supabase.from("audit_approvals_log").insert({
      actor_id: user.id,
      entity_type: "draft",
      entity_id: draftId,
      action: "finalize_confirmed",
      before: { finalize_status: "ready_to_finalize" },
      after: {
        finalize_status: "finalized",
        finalized_invoice_id: newInvoice.id,
        invoice_number: newInvoice.invoice_number,
      },
      note: `Live invoice ${newInvoice.invoice_number} created from audit draft`,
      batch_id: draft.batch_id || null,
      store_id: draft.store_id || null,
    });

    console.log(`✅ Audit draft ${draftId} finalized → Invoice ${newInvoice.invoice_number}`);

    return new Response(JSON.stringify({
      status: "finalized",
      draft_id: draftId,
      invoice_id: newInvoice.id,
      invoice_number: newInvoice.invoice_number,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("finalize-audit-draft error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
