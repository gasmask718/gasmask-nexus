import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { errText } from "../_shared/errText.ts";

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const status = url.searchParams.get("status");

    let query = supabase
      .from("ut_kit_orders")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(100);

    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) throw error;

    await supabase.from("dynasty_os_api_logs").insert({
      endpoint: "ut-get-kit-orders",
      method: "GET",
      request_payload: { status },
      response_status: 200,
    });

    return new Response(
      JSON.stringify({ success: true, orders: data ?? [], total: count ?? (data?.length ?? 0) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("ut-get-kit-orders error:", errText(error));
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
