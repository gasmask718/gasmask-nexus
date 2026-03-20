import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  const trimmed = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return trimmed.length >= 10 ? trimmed : null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaign_id, dry_run } = await req.json();
    if (!campaign_id) throw new Error("campaign_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: campaign, error: campaignError } = await supabase
      .from("messaging_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) throw new Error(`Campaign not found: ${campaignError?.message}`);

    console.log(`📱 Launching messaging campaign: ${campaign.name} (mode: ${campaign.mode})`);

    // Check if UI provided explicit contacts in target_filter
    const targetFilter = campaign.target_filter as any;
    const explicitContacts: any[] = targetFilter?.contacts || [];
    const customNumbers: string[] = targetFilter?.custom_numbers || [];

    let resolvedTargets: { store_id: string | null; phone: string; contact_name: string; contact_type: string; contact_id: string | null }[] = [];

    if (explicitContacts.length > 0) {
      // USE UI-SELECTED CONTACTS DIRECTLY
      console.log(`🎯 Using ${explicitContacts.length} UI-selected contacts`);
      for (const c of explicitContacts) {
        const normalized = normalizePhone(c.phone);
        if (normalized) {
          resolvedTargets.push({
            store_id: c.type === "store" ? c.id : null,
            phone: c.phone,
            contact_name: c.name || "Unknown",
            contact_type: c.type,
            contact_id: c.id,
          });
        }
      }
    } else {
      // FALLBACK: resolve via RPC (legacy path)
      console.log(`🎯 No explicit contacts — resolving via RPC`);
      const audienceId = targetFilter?.audience_id;
      let stores: any[] = [];
      let storeError: any = null;

      if (audienceId) {
        const { data, error } = await supabase.rpc("resolve_audience_segment", { p_segment_id: audienceId });
        stores = data || [];
        storeError = error;
      } else {
        const { data, error } = await supabase.rpc("resolve_previous_customers", { p_days: 3650 });
        stores = data || [];
        storeError = error;
      }
      if (storeError) throw new Error(`Failed to resolve audience: ${storeError.message}`);

      for (const r of stores) {
        const normalized = normalizePhone(r.phone);
        if (normalized) {
          resolvedTargets.push({
            store_id: r.store_id || null,
            phone: r.phone,
            contact_name: r.store_name || "Unknown",
            contact_type: "store",
            contact_id: r.store_id || null,
          });
        }
      }
    }

    // Add custom numbers
    for (const num of customNumbers) {
      const normalized = normalizePhone(num);
      if (normalized) {
        resolvedTargets.push({
          store_id: null,
          phone: num,
          contact_name: "Custom",
          contact_type: "custom",
          contact_id: null,
        });
      }
    }

    // Dedup by normalized phone
    const phoneMap = new Map<string, typeof resolvedTargets[0]>();
    for (const t of resolvedTargets) {
      const norm = normalizePhone(t.phone);
      if (norm && !phoneMap.has(norm)) phoneMap.set(norm, t);
    }
    const deduped = Array.from(phoneMap.values());
    console.log(`TARGETS_AFTER_DEDUP: ${deduped.length}`);

    if (deduped.length === 0) {
      await supabase.from("messaging_campaigns").update({ status: "completed", total_targets: 0, updated_at: new Date().toISOString() }).eq("id", campaign_id);
      return new Response(JSON.stringify({ success: true, targets: 0 }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    if (dry_run) {
      return new Response(JSON.stringify({ success: true, dry_run: true, targets: deduped.length }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Insert targets
    const targets = deduped.map((t) => ({
      campaign_id,
      store_id: t.store_id,
      phone: t.phone,
      contact_name: t.contact_name,
      contact_type: t.contact_type,
      contact_id: t.contact_id,
      status: "pending" as const,
      personalized_message: campaign.mode === "manual_bulk"
        ? (campaign.script || "")
            .replace(/\{\{store_name\}\}/g, t.contact_name || "")
            .replace(/\{\{contact_name\}\}/g, t.contact_name || "there")
        : null,
    }));

    const CHUNK_SIZE = 500;
    let insertedCount = 0;
    for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
      const chunk = targets.slice(i, i + CHUNK_SIZE);
      const { error: insertError } = await supabase.from("messaging_targets").insert(chunk);
      if (insertError) console.error(`❌ Insert chunk ${i} failed:`, insertError);
      else insertedCount += chunk.length;
    }

    await supabase.from("messaging_campaigns").update({
      total_targets: insertedCount,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", campaign_id);

    console.log(`✅ Campaign launched: ${insertedCount} targets inserted`);

    // Trigger the send worker to actually dispatch SMS
    console.log(`📤 Triggering messaging-send-worker for campaign ${campaign_id}`);
    try {
      const workerResponse = await fetch(
        `${supabaseUrl}/functions/v1/messaging-send-worker`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ campaign_id, batch_size: Math.min(insertedCount, 200) }),
        }
      );
      const workerResult = await workerResponse.json();
      console.log(`📤 Send worker result:`, workerResult);
    } catch (workerError: any) {
      console.error(`⚠️ Send worker trigger failed (targets still queued):`, workerError.message);
    }

    return new Response(
      JSON.stringify({ success: true, campaign_id, targets: insertedCount }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("❌ messaging-launch error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
