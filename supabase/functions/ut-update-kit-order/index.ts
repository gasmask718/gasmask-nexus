import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { errText } from "../_shared/errText.ts";

interface UpdatePayload {
  order_id: string;
  status?: string;
  tracking_number?: string;
  tracking_url?: string;
  estimated_delivery?: string;
  shipping_carrier?: string;
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const DYNASTY_OS_API_KEY = Deno.env.get("DYNASTY_OS_API_KEY");
    if (!DYNASTY_OS_API_KEY) throw new Error("DYNASTY_OS_API_KEY not configured");
    if (!authHeader || authHeader !== `Bearer ${DYNASTY_OS_API_KEY}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as UpdatePayload;
    if (!body?.order_id) {
      return new Response(JSON.stringify({ error: "order_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowed = [
      "status",
      "tracking_number",
      "tracking_url",
      "estimated_delivery",
      "shipping_carrier",
      "notes",
    ] as const;

    const updateObj: Record<string, unknown> = {};
    for (const key of allowed) {
      const v = body[key];
      if (v !== undefined) updateObj[key] = v;
    }

    if (Object.keys(updateObj).length === 0) {
      return new Response(JSON.stringify({ error: "No fields provided to update" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: updateError } = await supabase
      .from("ut_kit_orders")
      .update(updateObj)
      .eq("id", body.order_id);

    if (updateError) throw updateError;

    // Notify customer when marked shipped with tracking
    if (body.status === "shipped" && body.tracking_number) {
      try {
        await supabase.functions.invoke("ut-send-customer-order-update", {
          body: {
            order_id: body.order_id,
            type: "shipped",
            tracking_number: body.tracking_number,
            tracking_url: body.tracking_url,
            shipping_carrier: body.shipping_carrier,
            estimated_delivery: body.estimated_delivery,
          },
        });
      } catch (notifyErr) {
        console.error("customer notification failed:", notifyErr);
      }
    }

    await supabase.from("dynasty_os_api_logs").insert({
      endpoint: "ut-update-kit-order",
      method: "POST",
      request_payload: body as unknown as Record<string, unknown>,
      response_status: 200,
    });

    return new Response(
      JSON.stringify({
        success: true,
        order_id: body.order_id,
        updated_fields: Object.keys(updateObj),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("ut-update-kit-order error:", errText(error));
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
