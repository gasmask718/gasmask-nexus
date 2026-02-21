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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");

    // Auth: verify user
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // Service client for DB ops
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify role via has_audit_engine_access
    const { data: hasAccess } = await supabase.rpc("has_audit_engine_access", { _user_id: user.id });
    if (!hasAccess) throw new Error("Insufficient permissions — owner/admin only");

    const body = await req.json();
    const rawText = body.raw_text || body.rawText;
    const sourceType = body.source_type || "raw_text_paste";
    const options = body.options || {};
    const minConfidenceAutodraft = options.min_confidence_to_autodraft ?? 70;
    const storeMatchThreshold = options.store_match_threshold ?? 65;

    if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
      throw new Error("raw_text is required");
    }

    // 1. Create batch (status=processing)
    const { data: batch, error: batchError } = await supabase
      .from("audit_batches")
      .insert({
        created_by: user.id,
        source_type: sourceType,
        raw_text: rawText,
        model_name: "google/gemini-2.5-flash",
        status: "processing",
      })
      .select()
      .single();
    if (batchError) throw batchError;

    // 2. Fetch store names for fuzzy matching
    const { data: stores } = await supabase
      .from("store_master")
      .select("id, name, address, phone")
      .limit(500);

    const storeList = (stores || [])
      .map((s: any) => `${s.name} | ${s.address || ""} | ${s.phone || ""} | ID:${s.id}`)
      .join("\n");

    // 3. Call Lovable AI with deterministic output schema
    const systemPrompt = `You are a forensic business auditor for a tube/bag distribution company (brands: GasMask, Grabba R Us, Hot Scolatti, Hot Mama).
Parse raw notes into structured events. Each event = ONE atomic business action.

KNOWN STORES (name | address | phone | ID):
${storeList.substring(0, 8000)}

STORE MATCHING RULES:
- If store name matches a known store exactly → store_match_method: "exact", use the UUID
- If fuzzy match (similar name) → store_match_method: "fuzzy", include UUID if confidence ≥ ${storeMatchThreshold}
- If matched by address → store_match_method: "address"
- If matched by phone → store_match_method: "phone"
- If no match → store_match_method: "unlinked", store_id: null

QUANTITY CONVERSION:
- "1/2 box" = 25 tubes, "box" = 50 tubes unless specified
- "few tubes" ≈ 5, "couple" ≈ 2
- Always provide quantity_raw with the original text

Return ONLY valid JSON matching this exact schema:
{
  "events": [
    {
      "raw_line": "string (original text segment)",
      "store_hint": "string|null (store name from text)",
      "store_id": "uuid|null",
      "store_match_method": "exact|fuzzy|address|phone|unlinked",
      "store_match_confidence": 0-100,
      "event_date": "YYYY-MM-DD|null",
      "event_type": "visit|delivery|order_request|payment|unpaid_balance|inventory_check|note_only|unknown",
      "severity": "info|warning|critical",
      "brand": "string|null",
      "product": "string|null",
      "sku": "string|null",
      "quantity_raw": "string|null",
      "quantity_numeric": 0,
      "amount_paid": 0,
      "amount_unpaid": 0,
      "confidence_score": 0-100,
      "signals": {
        "mentions_bring_order": false,
        "mentions_unpaid": false,
        "mentions_delivery": false
      }
    }
  ],
  "draft_invoices": [
    {
      "store_hint": "string|null",
      "store_id": "uuid|null",
      "invoice_date": "YYYY-MM-DD|null",
      "line_items": [
        { "brand":"string|null", "product":"string|null", "sku":"string|null", "qty":0, "qty_raw":"string|null", "unit_price":0, "line_total":0 }
      ],
      "subtotal": 0,
      "taxes": 0,
      "total": 0,
      "payment_status": "unknown|unpaid|partial|paid",
      "source_raw_excerpt": "string|null",
      "source_event_indexes": [0],
      "confidence_score": 0-100
    }
  ],
  "flags": [
    {
      "store_hint": "string|null",
      "event_index": 0,
      "flag_type": "MISSING_INVOICE|MISSING_NOTE|POSSIBLE_DUPLICATE|PAYMENT_UNMATCHED|QUANTITY_UNPRICED|STORE_NOT_LINKED|FOLLOW_UP_REQUIRED|DATE_AMBIGUOUS|CONFLICTING_AMOUNTS",
      "severity": "low|medium|high|critical",
      "title": "string",
      "description": "string",
      "confidence_score": 0-100,
      "evidence": {}
    }
  ]
}

Only generate draft_invoices when delivery activity is detected but no invoice likely exists, and confidence ≥ ${minConfidenceAutodraft}.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Parse these raw business notes:\n\n${rawText}` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      await supabase.from("audit_batches").update({
        status: "failed",
        error_message: `AI gateway ${status}: ${errText.substring(0, 500)}`,
      }).eq("id", batch.id);

      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Extract JSON (handle markdown code blocks)
    let parsed: any;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsed = JSON.parse(jsonMatch[1]?.trim() || content.trim());
    } catch (e) {
      console.error("Failed to parse AI response:", content.substring(0, 1000));
      await supabase.from("audit_batches").update({
        status: "failed",
        error_message: "AI returned invalid JSON",
      }).eq("id", batch.id);
      throw new Error("AI returned invalid JSON");
    }

    // 4. Insert events
    const events = parsed.events || [];
    const insertedEvents: any[] = [];
    for (const evt of events) {
      const { data: inserted, error } = await supabase
        .from("audit_note_events")
        .insert({
          batch_id: batch.id,
          store_id: evt.store_id || null,
          store_match_method: evt.store_match_method || (evt.store_id ? "fuzzy" : "unlinked"),
          store_match_confidence: evt.store_match_confidence ?? null,
          event_date: evt.event_date || null,
          event_type: evt.event_type || "unknown",
          severity: evt.severity || "info",
          brand: evt.brand || null,
          product: evt.product || null,
          sku: evt.sku || null,
          quantity_numeric: evt.quantity_numeric || null,
          quantity_raw: evt.quantity_raw || null,
          amount_paid: evt.amount_paid || null,
          amount_unpaid: evt.amount_unpaid || null,
          raw_line: evt.raw_line || rawText.substring(0, 500),
          parsed: evt.signals || {},
          confidence_score: evt.confidence_score ?? 50,
        })
        .select()
        .single();
      if (!error && inserted) insertedEvents.push(inserted);
    }

    // 5. Insert flags
    const flags = parsed.flags || [];
    let flagsCreated = 0;
    for (const flag of flags) {
      const relatedEvent = typeof flag.event_index === "number" ? insertedEvents[flag.event_index] : null;
      const { error } = await supabase.from("audit_flags").insert({
        batch_id: batch.id,
        store_id: relatedEvent?.store_id || null,
        event_id: relatedEvent?.id || null,
        flag_type: flag.flag_type || "MISSING_INVOICE",
        severity: flag.severity || "medium",
        title: flag.title || flag.flag_type || "Untitled flag",
        description: flag.description || "No description",
        evidence: flag.evidence || {},
        confidence_score: flag.confidence_score ?? 50,
      });
      if (!error) flagsCreated++;
    }

    // 6. Insert invoice drafts
    const drafts = parsed.draft_invoices || [];
    let draftsCreated = 0;
    for (const draft of drafts) {
      const sourceEventIds = (draft.source_event_indexes || [])
        .map((i: number) => insertedEvents[i]?.id)
        .filter(Boolean);

      const { error } = await supabase.from("audit_invoice_drafts").insert({
        batch_id: batch.id,
        store_id: draft.store_id || null,
        invoice_date: draft.invoice_date || null,
        line_items: draft.line_items || [],
        subtotal: draft.subtotal || null,
        taxes: draft.taxes || null,
        total: draft.total || null,
        payment_status: draft.payment_status || "unknown",
        source_event_ids: sourceEventIds,
        source_raw_excerpt: draft.source_raw_excerpt || null,
        confidence_score: draft.confidence_score ?? 50,
        notes: draft.store_hint ? `Store: ${draft.store_hint}` : null,
      });
      if (!error) draftsCreated++;
    }

    // 7. Update batch → completed
    const totals = {
      events_created: insertedEvents.length,
      flags_created: flagsCreated,
      drafts_created: draftsCreated,
      unlinked_events: insertedEvents.filter((e: any) => !e.store_id).length,
    };
    await supabase.from("audit_batches").update({
      status: "completed",
      totals,
    }).eq("id", batch.id);

    return new Response(JSON.stringify({
      batch_id: batch.id,
      status: "completed",
      totals,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("audit-note-parser error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
