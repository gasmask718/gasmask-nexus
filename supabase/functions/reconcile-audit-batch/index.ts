import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Fuzzy tolerance constants
const DATE_TOLERANCE_DAYS = 3;
const AMOUNT_TOLERANCE = 5;
const QUANTITY_TOLERANCE_PCT = 0.10;

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.abs(da - db) / (1000 * 60 * 60 * 24);
}

function amountClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= AMOUNT_TOLERANCE;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: hasAccess } = await supabase.rpc("has_audit_engine_access", { _user_id: user.id });
    if (!hasAccess) throw new Error("Insufficient permissions — owner/admin only");

    const body = await req.json();
    const batchId = body.batch_id;
    if (!batchId) throw new Error("batch_id is required");

    // ═══ HARD GATE: Validate batch ═══
    const { data: batch, error: batchErr } = await supabase
      .from("audit_batches")
      .select("id, status")
      .eq("id", batchId)
      .single();
    if (batchErr || !batch) throw new Error("Batch not found");
    if (batch.status !== "completed") throw new Error("Batch must be completed before reconciliation");

    // ═══ LOAD: Events for this batch ═══
    const { data: events } = await supabase
      .from("audit_note_events")
      .select("*")
      .eq("batch_id", batchId);
    const allEvents = events || [];

    // Get unique store IDs from events
    const storeIds = [...new Set(allEvents.filter(e => e.store_id).map(e => e.store_id))];

    // ═══ LOAD: Existing invoices for matched stores ═══
    let existingInvoices: any[] = [];
    if (storeIds.length > 0) {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, store_id, invoice_number, total_amount, total, payment_status, created_at, status, notes")
        .in("store_id", storeIds)
        .neq("status", "voided");
      existingInvoices = invoices || [];
    }

    // ═══ LOAD: Existing store notes for matched stores ═══
    let existingNotes: any[] = [];
    if (storeIds.length > 0) {
      const { data: notes } = await supabase
        .from("store_notes")
        .select("id, store_id, note_text, note_date, created_at")
        .in("store_id", storeIds);
      existingNotes = notes || [];
    }

    // ═══ DELETE previous reconciliation results for this batch ═══
    await supabase
      .from("audit_reconciliation_results")
      .delete()
      .eq("batch_id", batchId);

    // ═══ RECONCILIATION LOGIC ═══
    const results: any[] = [];

    for (const evt of allEvents) {
      if (!evt.store_id) continue;

      const storeInvoices = existingInvoices.filter(i => i.store_id === evt.store_id);
      const storeNotes = existingNotes.filter(n => n.store_id === evt.store_id);

      // 1. DELIVERY with no matching invoice → MISSING_INVOICE
      if (evt.event_type === "delivery") {
        const matchingInvoice = storeInvoices.find(inv => {
          if (!evt.event_date) return false;
          const invDate = inv.created_at?.substring(0, 10);
          if (!invDate) return false;
          const daysApart = daysBetween(evt.event_date, invDate);
          if (daysApart > DATE_TOLERANCE_DAYS) return false;
          // Check amount if available
          const evtTotal = (evt.amount_paid || 0) + (evt.amount_unpaid || 0);
          if (evtTotal > 0 && inv.total) {
            return amountClose(evtTotal, inv.total);
          }
          return true; // date match is enough if no amount
        });

        if (!matchingInvoice) {
          const evtTotal = (evt.amount_paid || 0) + (evt.amount_unpaid || 0);
          results.push({
            batch_id: batchId,
            store_id: evt.store_id,
            reconciliation_type: "missing_invoice",
            related_event_id: evt.id,
            recommended_action: "create_invoice",
            confidence_score: evt.confidence_score || 70,
            event_summary: `Delivery on ${evt.event_date || "unknown date"}: ${evt.brand || ""} ${evt.product || ""} × ${evt.quantity_raw || evt.quantity_numeric || "?"} ${evtTotal > 0 ? `($${evtTotal})` : ""}`.trim(),
            invoice_summary: null,
            evidence: {
              event_type: evt.event_type,
              event_date: evt.event_date,
              brand: evt.brand,
              quantity: evt.quantity_numeric,
              amount: evtTotal || null,
              invoices_checked: storeInvoices.length,
            },
          });
        }
      }

      // 2. PAYMENT with invoice not marked paid → PAYMENT_MISMATCH
      if (evt.event_type === "payment" && evt.amount_paid && evt.amount_paid > 0) {
        const unpaidInvoices = storeInvoices.filter(i =>
          i.payment_status === "unpaid" || i.payment_status === "partial" || i.payment_status === "overdue"
        );

        if (unpaidInvoices.length > 0) {
          // Find best matching invoice by amount
          const bestMatch = unpaidInvoices.find(i => {
            const invTotal = i.total || i.total_amount || 0;
            return amountClose(evt.amount_paid, invTotal);
          }) || unpaidInvoices[0];

          results.push({
            batch_id: batchId,
            store_id: evt.store_id,
            reconciliation_type: "payment_mismatch",
            related_event_id: evt.id,
            related_invoice_id: bestMatch.id,
            recommended_action: "mark_paid",
            confidence_score: amountClose(evt.amount_paid, bestMatch.total || bestMatch.total_amount || 0) ? 85 : 60,
            event_summary: `Payment of $${evt.amount_paid} on ${evt.event_date || "unknown date"}`,
            invoice_summary: `Invoice ${bestMatch.invoice_number}: $${bestMatch.total || bestMatch.total_amount} (${bestMatch.payment_status})`,
            evidence: {
              payment_amount: evt.amount_paid,
              invoice_total: bestMatch.total || bestMatch.total_amount,
              invoice_status: bestMatch.payment_status,
              invoice_id: bestMatch.id,
            },
          });
        }
      }

      // 3. Event with no corresponding CRM note → MISSING_NOTE
      const hasMatchingNote = storeNotes.some(n => {
        const noteText = (n.note_text || "").toLowerCase();
        // Check if note contains relevant keywords from the event
        const keywords = [evt.brand, evt.product, evt.quantity_raw].filter(Boolean).map(k => k.toLowerCase());
        if (keywords.length === 0) return false;
        return keywords.some(kw => noteText.includes(kw));
      });

      if (!hasMatchingNote && evt.event_type !== "note_only" && evt.event_type !== "unknown") {
        results.push({
          batch_id: batchId,
          store_id: evt.store_id,
          reconciliation_type: "missing_note",
          related_event_id: evt.id,
          recommended_action: "create_note",
          confidence_score: Math.min(evt.confidence_score || 65, 80),
          event_summary: `${evt.event_type}: ${evt.brand || ""} ${evt.product || ""} on ${evt.event_date || "unknown date"}`.trim(),
          invoice_summary: null,
          evidence: {
            event_type: evt.event_type,
            raw_line: evt.raw_line,
            notes_checked: storeNotes.length,
          },
        });
      }
    }

    // 4. ORPHAN INVOICES: invoices with no matching delivery event
    for (const storeId of storeIds) {
      const storeInvoices = existingInvoices.filter(i => i.store_id === storeId);
      const storeEvents = allEvents.filter(e => e.store_id === storeId && e.event_type === "delivery");

      for (const inv of storeInvoices) {
        const invDate = inv.created_at?.substring(0, 10);
        const hasMatchingEvent = storeEvents.some(evt => {
          if (!evt.event_date || !invDate) return false;
          return daysBetween(evt.event_date, invDate) <= DATE_TOLERANCE_DAYS;
        });

        if (!hasMatchingEvent && storeEvents.length > 0) {
          results.push({
            batch_id: batchId,
            store_id: storeId,
            reconciliation_type: "orphan_invoice",
            related_invoice_id: inv.id,
            recommended_action: "review",
            confidence_score: 65,
            event_summary: null,
            invoice_summary: `Invoice ${inv.invoice_number}: $${inv.total || inv.total_amount} on ${invDate} (${inv.payment_status})`,
            evidence: {
              invoice_id: inv.id,
              invoice_number: inv.invoice_number,
              invoice_date: invDate,
              delivery_events_in_batch: storeEvents.length,
            },
          });
        }
      }
    }

    // 5. DUPLICATE RISK: multiple invoices for same store within tight window
    for (const storeId of storeIds) {
      const storeInvoices = existingInvoices
        .filter(i => i.store_id === storeId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      for (let i = 0; i < storeInvoices.length - 1; i++) {
        const a = storeInvoices[i];
        const b = storeInvoices[i + 1];
        const daysApart = daysBetween(a.created_at, b.created_at);
        const aTotal = a.total || a.total_amount || 0;
        const bTotal = b.total || b.total_amount || 0;

        if (daysApart <= 1 && amountClose(aTotal, bTotal) && aTotal > 0) {
          results.push({
            batch_id: batchId,
            store_id: storeId,
            reconciliation_type: "duplicate_risk",
            related_invoice_id: a.id,
            recommended_action: "merge",
            confidence_score: 75,
            event_summary: null,
            invoice_summary: `${a.invoice_number} ($${aTotal}) and ${b.invoice_number} ($${bTotal}) within ${daysApart.toFixed(0)} day(s)`,
            evidence: {
              invoice_a: { id: a.id, number: a.invoice_number, total: aTotal, date: a.created_at },
              invoice_b: { id: b.id, number: b.invoice_number, total: bTotal, date: b.created_at },
              days_apart: daysApart,
            },
          });
        }
      }
    }

    // ═══ INSERT all results ═══
    let inserted = 0;
    if (results.length > 0) {
      const { error: insertErr } = await supabase
        .from("audit_reconciliation_results")
        .insert(results);
      if (insertErr) {
        console.error("Failed to insert reconciliation results:", insertErr);
        throw new Error(`Insert failed: ${insertErr.message}`);
      }
      inserted = results.length;
    }

    // Count by type
    const summary: Record<string, number> = {};
    for (const r of results) {
      summary[r.reconciliation_type] = (summary[r.reconciliation_type] || 0) + 1;
    }

    console.log(`✅ Reconciliation complete for batch ${batchId}: ${inserted} results`);

    return new Response(JSON.stringify({
      batch_id: batchId,
      status: "completed",
      total_results: inserted,
      summary,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("reconcile-audit-batch error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
