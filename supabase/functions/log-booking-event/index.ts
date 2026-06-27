import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      booking_id,
      event_type,
      previous_state,
      new_state,
      actor_id,
      actor_type,
      actor_label,
      reason,
      metadata,
    } = body ?? {};

    if (!booking_id || !event_type) {
      return new Response(
        JSON.stringify({ ok: false, error: "booking_id and event_type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("booking_events")
      .insert({
        booking_id,
        event_type,
        previous_state: previous_state ?? null,
        new_state: new_state ?? null,
        actor_id: actor_id ?? null,
        actor_type: actor_type ?? "system",
        actor_label: actor_label ?? null,
        reason: reason ?? null,
        metadata: metadata ?? {},
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, event_id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("log-booking-event error", err);
    return new Response(JSON.stringify({ ok: false, error: err?.message ?? "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
