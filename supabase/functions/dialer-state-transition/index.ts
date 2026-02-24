import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  queued: ["dialing"],
  dialing: ["answered", "voicemail", "no_answer", "failed"],
  answered: ["bridged"],
  bridged: ["completed"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { queue_item_id, new_status, agent_id, session_data } = await req.json();

    if (!queue_item_id || !new_status) {
      return new Response(
        JSON.stringify({ error: "queue_item_id and new_status required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch current status
    const { data: item, error: fetchErr } = await supabase
      .from("outbound_call_queue")
      .select("id, status, store_id, phone_number, contact_name, business_id, attempt_count, campaign_id")
      .eq("id", queue_item_id)
      .single();

    if (fetchErr || !item) {
      return new Response(
        JSON.stringify({ error: "Queue item not found", details: fetchErr?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currentStatus = item.status;
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(new_status)) {
      return new Response(
        JSON.stringify({
          error: `Invalid transition: ${currentStatus} → ${new_status}`,
          allowed_transitions: allowed,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      status: new_status,
      updated_at: new Date().toISOString(),
    };

    if (new_status === "answered") {
      updatePayload.answered_at = new Date().toISOString();
    }

    // Update queue item
    const { error: updateErr } = await supabase
      .from("outbound_call_queue")
      .update(updatePayload)
      .eq("id", queue_item_id);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: "Failed to update status", details: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If answered → bridged, create live_call_session and update agent
    let session_id: string | null = null;

    if (new_status === "bridged" && agent_id) {
      const { data: session, error: sessionErr } = await supabase
        .from("live_call_sessions")
        .insert({
          business_id: item.business_id,
          store_id: item.store_id,
          queue_item_id: queue_item_id,
          contact_name: item.contact_name,
          phone_number: item.phone_number,
          rep_user_id: agent_id,
          provider: "simulation",
          connected_at: new Date().toISOString(),
          outcome: "no_disposition",
          campaign_id: item.campaign_id,
        })
        .select("id")
        .single();

      if (!sessionErr && session) {
        session_id = session.id;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        transition: `${currentStatus} → ${new_status}`,
        queue_item_id,
        session_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
