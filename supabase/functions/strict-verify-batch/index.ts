import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Strict tolerances
const DATE_TOLERANCE_DAYS = 3;
const AMOUNT_TOLERANCE = 5;
const LARGE_AMOUNT_THRESHOLD = 10; // require manual confirm if diff > $10
const QUANTITY_TOLERANCE_PCT = 0.10;
const MIN_CONFIDENCE = 70; // strict mode floor
const DISPLAY_CONFIDENCE = 80; // only show results ≥ this

interface LedgerEntry {
  date: string | null;
  delivery_event_id: string | null;
  delivery_quantity: number | null;
  delivery_amount: number | null;
  invoice_id: string | null;
  invoice_number: string | null;
  invoice_total: number | null;
  note_id: string | null;
  note_excerpt: string | null;
  payment_status: string | null;
  verification_status: "matched" | "confirmed_missing_invoice" | "confirmed_missing_note" | "payment_status_error" | "duplicate_risk";
  failure_reason: string | null;
  confidence: number;
  amount_difference: number | null;
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24);
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

    // ═══ HARD GATE ═══
    const { data: batch, error: batchErr } = await supabase
      .from("audit_batches")
      .select("id, status")
      .eq("id", batchId)
      .single();
    if (batchErr || !batch) throw new Error("Batch not found");
    if (batch.status !== "completed") throw new Error("Batch must be completed before verification");

    // ═══ LOAD DATA ═══
    const { data: events } = await supabase
      .from("audit_note_events")
      .select("*")
      .eq("batch_id", batchId);
    const allEvents = events || [];

    const storeIds = [...new Set(allEvents.filter(e => e.store_id).map(e => e.store_id))];

    let existingInvoices: any[] = [];
    let existingNotes: any[] = [];

    if (storeIds.length > 0) {
      const [invRes, noteRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, store_id, entity_id, entity_type, invoice_number, total_amount, total, payment_status, created_at, status")
          .in("store_id", storeIds)
          .neq("status", "voided"),
        supabase
          .from("store_notes")
          .select("id, store_id, note_text, created_at")
          .in("store_id", storeIds),
      ]);
      existingInvoices = invRes.data || [];
      existingNotes = noteRes.data || [];
    }

    // ═══ Delete previous snapshots for this batch ═══
    await supabase
      .from("audit_verification_snapshots")
      .delete()
      .eq("batch_id", batchId);

    // Also clear previous strict verification recon results
    await supabase
      .from("audit_reconciliation_results")
      .delete()
      .eq("batch_id", batchId);

    // ═══ STRICT VERIFICATION per store ═══
    const allSnapshots: any[] = [];
    const allResults: any[] = [];
    const globalSummary = {
      total_deliveries: 0,
      matched_deliveries: 0,
      confirmed_missing_invoices: 0,
      confirmed_missing_notes: 0,
      payment_errors: 0,
      duplicate_risks: 0,
      stores_verified: 0,
      stores_with_issues: 0,
    };

    for (const storeId of storeIds) {
      const storeEvents = allEvents.filter(e => e.store_id === storeId);
      const storeInvoices = existingInvoices.filter(i => i.store_id === storeId);
      const storeNotes = existingNotes.filter(n => n.store_id === storeId);
      const deliveryEvents = storeEvents.filter(e => e.event_type === "delivery");
      const paymentEvents = storeEvents.filter(e => e.event_type === "payment");

      const ledger: LedgerEntry[] = [];
      let storeHasIssues = false;

      // ═══ STEP 2: Match Delivery → Invoice ═══
      const usedInvoiceIds = new Set<string>();

      for (const evt of deliveryEvents) {
        globalSummary.total_deliveries++;
        const evtTotal = (evt.amount_paid || 0) + (evt.amount_unpaid || 0);

        // Find matching invoices
        const candidates = storeInvoices.filter(inv => {
          if (usedInvoiceIds.has(inv.id)) return false;
          const invDate = inv.created_at?.substring(0, 10);
          if (!evt.event_date || !invDate) return false;
          if (daysBetween(evt.event_date, invDate) > DATE_TOLERANCE_DAYS) return false;
          return true;
        });

        // Score candidates by amount proximity
        const scored = candidates.map(inv => {
          const invTotal = inv.total || inv.total_amount || 0;
          const amountDiff = evtTotal > 0 && invTotal > 0 ? Math.abs(evtTotal - invTotal) : 0;
          const amountMatch = evtTotal <= 0 || invTotal <= 0 || amountDiff <= AMOUNT_TOLERANCE;
          const qtyMatch = true; // qty matching would require line item comparison
          return { inv, amountDiff, amountMatch, score: amountMatch ? 90 : Math.max(50, 90 - amountDiff) };
        }).sort((a, b) => b.score - a.score);

        if (scored.length > 1 && scored[0].amountMatch && scored[1].amountMatch) {
          // Multiple matches = DUPLICATE_RISK
          storeHasIssues = true;
          globalSummary.duplicate_risks++;
          ledger.push({
            date: evt.event_date,
            delivery_event_id: evt.id,
            delivery_quantity: evt.quantity_numeric,
            delivery_amount: evtTotal || null,
            invoice_id: scored[0].inv.id,
            invoice_number: scored[0].inv.invoice_number,
            invoice_total: scored[0].inv.total || scored[0].inv.total_amount,
            note_id: null,
            note_excerpt: null,
            payment_status: scored[0].inv.payment_status,
            verification_status: "duplicate_risk",
            failure_reason: `${scored.length} invoices match this delivery within tolerance. Possible duplicates: ${scored.map(s => s.inv.invoice_number).join(", ")}`,
            confidence: 85,
            amount_difference: scored[0].amountDiff,
          });

          allResults.push({
            batch_id: batchId,
            store_id: storeId,
            reconciliation_type: "duplicate_risk",
            related_event_id: evt.id,
            related_invoice_id: scored[0].inv.id,
            recommended_action: "review",
            confidence_score: 85,
            event_summary: `Delivery ${evt.event_date}: ${evt.brand || ""} × ${evt.quantity_raw || evt.quantity_numeric || "?"} ($${evtTotal || "?"})`,
            invoice_summary: `Multiple matches: ${scored.map(s => `${s.inv.invoice_number} ($${s.inv.total || s.inv.total_amount})`).join(", ")}`,
            evidence: { matched_invoices: scored.map(s => ({ id: s.inv.id, number: s.inv.invoice_number, total: s.inv.total || s.inv.total_amount, diff: s.amountDiff })) },
          });

          usedInvoiceIds.add(scored[0].inv.id);
        } else if (scored.length > 0 && scored[0].score >= MIN_CONFIDENCE) {
          // Single match
          const best = scored[0];
          usedInvoiceIds.add(best.inv.id);
          globalSummary.matched_deliveries++;
          ledger.push({
            date: evt.event_date,
            delivery_event_id: evt.id,
            delivery_quantity: evt.quantity_numeric,
            delivery_amount: evtTotal || null,
            invoice_id: best.inv.id,
            invoice_number: best.inv.invoice_number,
            invoice_total: best.inv.total || best.inv.total_amount,
            note_id: null,
            note_excerpt: null,
            payment_status: best.inv.payment_status,
            verification_status: "matched",
            failure_reason: null,
            confidence: best.score,
            amount_difference: best.amountDiff,
          });
        } else {
          // No match = CONFIRMED_MISSING_INVOICE
          storeHasIssues = true;
          globalSummary.confirmed_missing_invoices++;
          ledger.push({
            date: evt.event_date,
            delivery_event_id: evt.id,
            delivery_quantity: evt.quantity_numeric,
            delivery_amount: evtTotal || null,
            invoice_id: null,
            invoice_number: null,
            invoice_total: null,
            note_id: null,
            note_excerpt: null,
            payment_status: null,
            verification_status: "confirmed_missing_invoice",
            failure_reason: `No invoice found for store within ±${DATE_TOLERANCE_DAYS} days${evtTotal > 0 ? ` and ±$${AMOUNT_TOLERANCE} of $${evtTotal}` : ""}. ${storeInvoices.length} total invoices checked.`,
            confidence: Math.max(MIN_CONFIDENCE, evt.confidence_score || 75),
            amount_difference: null,
          });

          allResults.push({
            batch_id: batchId,
            store_id: storeId,
            reconciliation_type: "missing_invoice",
            related_event_id: evt.id,
            recommended_action: "create_invoice",
            confidence_score: Math.max(MIN_CONFIDENCE, evt.confidence_score || 75),
            event_summary: `Delivery ${evt.event_date}: ${evt.brand || ""} ${evt.product || ""} × ${evt.quantity_raw || evt.quantity_numeric || "?"} ($${evtTotal || "?"})`,
            invoice_summary: null,
            evidence: {
              raw_line: evt.raw_line,
              invoices_checked: storeInvoices.length,
              date_tolerance: DATE_TOLERANCE_DAYS,
              amount_tolerance: AMOUNT_TOLERANCE,
              strict_mode: true,
            },
          });
        }
      }

      // ═══ STEP 3: Match Invoice → Note ═══
      for (const entry of ledger) {
        if (!entry.invoice_id) continue;
        const inv = storeInvoices.find(i => i.id === entry.invoice_id);
        if (!inv) continue;

        const invDate = inv.created_at?.substring(0, 10);
        const matchingNote = storeNotes.find(n => {
          const noteDate = n.created_at?.substring(0, 10);
          if (!invDate || !noteDate) return false;
          if (daysBetween(invDate, noteDate) > DATE_TOLERANCE_DAYS) return false;
          // Check content relevance
          const text = (n.note_text || "").toLowerCase();
          const invNum = (inv.invoice_number || "").toLowerCase();
          if (invNum && text.includes(invNum)) return true;
          // Check for delivery-related keywords
          if (text.includes("deliver") || text.includes("drop") || text.includes("brought")) return true;
          return false;
        });

        if (matchingNote) {
          entry.note_id = matchingNote.id;
          entry.note_excerpt = (matchingNote.note_text || "").substring(0, 100);
        } else {
          storeHasIssues = true;
          globalSummary.confirmed_missing_notes++;
          entry.verification_status = "confirmed_missing_note";
          entry.failure_reason = (entry.failure_reason ? entry.failure_reason + " | " : "") +
            `No CRM note found supporting invoice ${inv.invoice_number} within ±${DATE_TOLERANCE_DAYS} days. ${storeNotes.length} notes checked.`;

          allResults.push({
            batch_id: batchId,
            store_id: storeId,
            reconciliation_type: "missing_note",
            related_event_id: entry.delivery_event_id,
            related_invoice_id: entry.invoice_id,
            recommended_action: "create_note",
            confidence_score: 80,
            event_summary: `Delivery ${entry.date}: matched to ${entry.invoice_number}`,
            invoice_summary: `Invoice ${entry.invoice_number}: $${entry.invoice_total} (${entry.payment_status})`,
            evidence: {
              invoice_id: entry.invoice_id,
              invoice_number: entry.invoice_number,
              notes_checked: storeNotes.length,
              strict_mode: true,
            },
          });
        }
      }

      // ═══ STEP 4: Payment Verification ═══
      for (const evt of paymentEvents) {
        if (!evt.amount_paid || evt.amount_paid <= 0) continue;

        const unpaidInvoices = storeInvoices.filter(i =>
          ["unpaid", "partial", "overdue"].includes(i.payment_status || "")
        );

        if (unpaidInvoices.length === 0) continue;

        const bestMatch = unpaidInvoices.find(i => {
          const invTotal = i.total || i.total_amount || 0;
          return Math.abs(evt.amount_paid - invTotal) <= AMOUNT_TOLERANCE;
        }) || unpaidInvoices[0];

        const invTotal = bestMatch.total || bestMatch.total_amount || 0;
        const amountDiff = Math.abs(evt.amount_paid - invTotal);

        storeHasIssues = true;
        globalSummary.payment_errors++;

        allResults.push({
          batch_id: batchId,
          store_id: storeId,
          reconciliation_type: "payment_mismatch",
          related_event_id: evt.id,
          related_invoice_id: bestMatch.id,
          recommended_action: "mark_paid",
          confidence_score: amountDiff <= AMOUNT_TOLERANCE ? 85 : 65,
          event_summary: `Payment $${evt.amount_paid} on ${evt.event_date || "unknown"}`,
          invoice_summary: `Invoice ${bestMatch.invoice_number}: $${invTotal} (${bestMatch.payment_status})`,
          evidence: {
            payment_amount: evt.amount_paid,
            invoice_total: invTotal,
            amount_difference: amountDiff,
            requires_manual_confirm: amountDiff > LARGE_AMOUNT_THRESHOLD,
            strict_mode: true,
          },
        });
      }

      // Store snapshot
      globalSummary.stores_verified++;
      if (storeHasIssues) globalSummary.stores_with_issues++;

      allSnapshots.push({
        batch_id: batchId,
        store_id: storeId,
        snapshot: ledger,
        status: storeHasIssues ? "issues_found" : "verified",
        summary: {
          total_deliveries: deliveryEvents.length,
          matched: ledger.filter(l => l.verification_status === "matched").length,
          missing_invoices: ledger.filter(l => l.verification_status === "confirmed_missing_invoice").length,
          missing_notes: ledger.filter(l => l.verification_status === "confirmed_missing_note").length,
          duplicate_risks: ledger.filter(l => l.verification_status === "duplicate_risk").length,
          payment_events: paymentEvents.length,
        },
      });
    }

    // ═══ INSERT snapshots + results ═══
    if (allSnapshots.length > 0) {
      const { error: snapErr } = await supabase
        .from("audit_verification_snapshots")
        .insert(allSnapshots);
      if (snapErr) {
        console.error("Failed to insert snapshots:", snapErr);
        throw new Error(`Snapshot insert failed: ${snapErr.message}`);
      }
    }

    // Filter results: strict mode only shows ≥ MIN_CONFIDENCE
    const strictResults = allResults.filter(r => r.confidence_score >= MIN_CONFIDENCE);
    if (strictResults.length > 0) {
      const { error: resErr } = await supabase
        .from("audit_reconciliation_results")
        .insert(strictResults);
      if (resErr) {
        console.error("Failed to insert verification results:", resErr);
        throw new Error(`Results insert failed: ${resErr.message}`);
      }
    }

    const isClean = globalSummary.confirmed_missing_invoices === 0 &&
      globalSummary.confirmed_missing_notes === 0 &&
      globalSummary.payment_errors === 0 &&
      globalSummary.duplicate_risks === 0;

    console.log(`✅ Strict verification complete for batch ${batchId}: ${isClean ? "CLEAN" : "ISSUES FOUND"}`);

    return new Response(JSON.stringify({
      batch_id: batchId,
      status: isClean ? "verified_clean" : "issues_found",
      summary: globalSummary,
      total_results: strictResults.length,
      total_snapshots: allSnapshots.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("strict-verify-batch error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
