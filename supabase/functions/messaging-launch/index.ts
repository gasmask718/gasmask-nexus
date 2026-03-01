import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaign_id } = await req.json();
    if (!campaign_id) throw new Error("campaign_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("messaging_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Campaign not found: ${campaignError?.message}`);
    }

    console.log(`📱 Launching messaging campaign: ${campaign.name} (mode: ${campaign.mode})`);

    // 2. Resolve audience via unified customer identity RPC
    // NEVER query store_master directly — always use the resolver
    let stores: any[] = [];
    let storeError: any = null;

    const audienceId = campaign.target_filter?.audience_id;

    if (audienceId) {
      console.log(`🎯 Resolving audience segment: ${audienceId}`);
      const { data, error } = await supabase.rpc("resolve_audience_segment", {
        p_segment_id: audienceId,
      });
      stores = (data || []).map((r: any) => ({
        id: r.store_id,
        store_name: r.store_name,
        phone: r.phone,
        contact_name: r.store_name,
      }));
      storeError = error;
    } else {
      // Fallback: resolve all previous customers
      console.log(`🎯 Resolving all previous customers`);
      const { data, error } = await supabase.rpc("resolve_previous_customers");
      stores = (data || []).map((r: any) => ({
        id: r.store_id,
        store_name: r.store_name,
        phone: r.phone,
        contact_name: r.store_name,
      }));
      storeError = error;
    }

    if (storeError) {
      throw new Error(`Failed to resolve audience: ${storeError.message}`);
    }

    if (!stores || stores.length === 0) {
      await supabase.from("messaging_campaigns").update({
        status: "completed",
        total_targets: 0,
        updated_at: new Date().toISOString(),
      }).eq("id", campaign_id);

      return new Response(JSON.stringify({ success: true, targets: 0 }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 3. Insert targets
    const targets = stores.map(store => ({
      campaign_id,
      store_id: store.id,
      phone: store.phone,
      contact_name: store.contact_name || store.store_name,
      status: "pending" as const,
      personalized_message: campaign.mode === "manual_bulk"
        ? (campaign.script || "")
            .replace(/\{\{store_name\}\}/g, store.store_name || "")
            .replace(/\{\{contact_name\}\}/g, store.contact_name || "there")
        : null,
    }));

    // Batch insert in chunks
    const CHUNK_SIZE = 500;
    let insertedCount = 0;
    for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
      const chunk = targets.slice(i, i + CHUNK_SIZE);
      const { error: insertError } = await supabase
        .from("messaging_targets")
        .insert(chunk);
      if (insertError) {
        console.error(`❌ Failed to insert targets chunk ${i}:`, insertError);
      } else {
        insertedCount += chunk.length;
      }
    }

    // 4. Update campaign with target count
    await supabase.from("messaging_campaigns").update({
      total_targets: insertedCount,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", campaign_id);

    console.log(`✅ Campaign launched with ${insertedCount} targets`);

    return new Response(
      JSON.stringify({
        success: true,
        campaign_id,
        targets: insertedCount,
        mode: campaign.mode,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("❌ messaging-launch error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
