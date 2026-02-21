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

    // Auth client to verify user
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // Service client for DB ops
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"]);
    if (!roles || roles.length === 0) throw new Error("Insufficient permissions");

    const { rawText } = await req.json();
    if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
      throw new Error("rawText is required");
    }

    // 1. Create batch
    const { data: batch, error: batchError } = await supabase
      .from("audit_batches")
      .insert({ raw_input: rawText, input_type: "raw_text", created_by: user.id })
      .select()
      .single();
    if (batchError) throw batchError;

    // 2. Fetch store names for fuzzy matching context
    const { data: stores } = await supabase
      .from("store_master")
      .select("id, name, address, phone")
      .limit(500);

    const storeList = (stores || []).map((s: any) => `${s.name} | ${s.address || ''} | ${s.phone || ''} | ID:${s.id}`).join("\n");

    // 3. Call Lovable AI to parse notes
    const systemPrompt = `You are a forensic business auditor for a tube/bag distribution company. 
Parse the raw notes into structured events. Each event represents ONE atomic business action (delivery, payment, visit, order request, unpaid balance mention, etc.).

KNOWN STORES (name | address | phone | ID):
${storeList.substring(0, 8000)}

For each event, extract:
- store_name: The store name mentioned (exact text from notes)
- store_id: If you can match to a known store above, include the UUID. Otherwise null.
- event_date: Inferred date (YYYY-MM-DD format) or null
- event_type: One of: delivery, payment, visit, order_request, unpaid_balance, sticker_check, sample_drop, switch_tubes, other
- product: Product name mentioned (e.g., "GasMask Tubes", "Hot Mama Bags")
- quantity: Numeric quantity or null. Convert "1/2 box" to 25, "few tubes" to ~5, "box" to 50 unless specified.
- payment_amount: Dollar amount mentioned for payment or null
- unpaid_balance: Dollar amount mentioned as owed/unpaid or null  
- notes: Any additional context from the note
- confidence_score: 0-100 how confident you are in this parsing

Also generate:
- flags: Array of detected issues. Each flag has:
  - flag_type: MISSING_INVOICE, MISSING_NOTE, POSSIBLE_DUPLICATE, PAYMENT_UNMATCHED, QUANTITY_UNPRICED, STORE_NOT_LINKED, FOLLOW_UP_REQUIRED
  - description: What's wrong
  - severity: low, medium, high, critical
  - related_event_index: index in the events array

- invoice_drafts: Array of suggested invoice drafts when delivery activity has no matching invoice. Each draft:
  - store_name: Store name
  - store_id: UUID or null
  - inferred_date: YYYY-MM-DD
  - brand: Brand name
  - products: Array of {name, quantity, estimated_unit_price}
  - estimated_total: Calculated total
  - payment_status_inferred: paid, unpaid, partial, unknown
  - confidence_score: 0-100
  - source_notes: Original note text that triggered this draft

- summary: A 2-3 sentence summary of what was found

Return ONLY valid JSON with this structure:
{
  "events": [...],
  "flags": [...],
  "invoice_drafts": [...],
  "summary": "..."
}`;

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
      if (status === 429) {
        await supabase.from("audit_batches").update({ status: "error" }).eq("id", batch.id);
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        await supabase.from("audit_batches").update({ status: "error" }).eq("id", batch.id);
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", status, errText);
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response (handle markdown code blocks)
    let parsed: any;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsed = JSON.parse(jsonMatch[1]?.trim() || content.trim());
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      await supabase.from("audit_batches").update({ status: "error" }).eq("id", batch.id);
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
          raw_text: evt.notes || rawText.substring(0, 500),
          store_id: evt.store_id || null,
          store_name_raw: evt.store_name || null,
          event_date: evt.event_date || null,
          event_type: evt.event_type || "unknown",
          product: evt.product || null,
          quantity: evt.quantity || null,
          payment_amount: evt.payment_amount || null,
          unpaid_balance: evt.unpaid_balance || null,
          notes: evt.notes || null,
          confidence_score: evt.confidence_score || 0,
          linked: !!evt.store_id,
          created_by: user.id,
        })
        .select()
        .single();
      if (!error && inserted) insertedEvents.push(inserted);
    }

    // 5. Insert flags
    const flags = parsed.flags || [];
    for (const flag of flags) {
      const relatedEvent = typeof flag.related_event_index === "number" && insertedEvents[flag.related_event_index]
        ? insertedEvents[flag.related_event_index]
        : null;
      await supabase.from("audit_flags").insert({
        batch_id: batch.id,
        event_id: relatedEvent?.id || null,
        store_id: relatedEvent?.store_id || null,
        flag_type: flag.flag_type || "UNKNOWN",
        description: flag.description || "Unspecified issue",
        severity: flag.severity || "medium",
      });
    }

    // 6. Insert invoice drafts
    const drafts = parsed.invoice_drafts || [];
    for (const draft of drafts) {
      const sourceEventIds = insertedEvents
        .filter((e: any) => e.store_name_raw === draft.store_name)
        .map((e: any) => e.id);
      
      await supabase.from("audit_invoice_drafts").insert({
        batch_id: batch.id,
        store_id: draft.store_id || null,
        store_name_inferred: draft.store_name || null,
        inferred_date: draft.inferred_date || null,
        brand: draft.brand || null,
        products: draft.products || [],
        estimated_total: draft.estimated_total || 0,
        payment_status_inferred: draft.payment_status_inferred || "unknown",
        confidence_score: draft.confidence_score || 0,
        source_event_ids: sourceEventIds,
        source_notes: draft.source_notes || null,
        created_by: user.id,
      });
    }

    // 7. Update batch
    await supabase.from("audit_batches").update({
      total_events: insertedEvents.length,
      total_flags: flags.length,
      total_drafts: drafts.length,
      status: "completed",
      ai_summary: parsed.summary || null,
      processed_at: new Date().toISOString(),
    }).eq("id", batch.id);

    return new Response(JSON.stringify({
      batch_id: batch.id,
      total_events: insertedEvents.length,
      total_flags: flags.length,
      total_drafts: drafts.length,
      summary: parsed.summary || null,
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
