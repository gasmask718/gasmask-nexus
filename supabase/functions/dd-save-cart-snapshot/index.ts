// dd-save-cart-snapshot — upserts an abandoned-cart snapshot keyed by session_id.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Body {
  user_id?: string | null;
  session_id: string;
  email?: string | null;
  cart_items: unknown[];
  cart_total: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as Body;
    if (!body?.session_id || !Array.isArray(body.cart_items)) {
      return new Response(JSON.stringify({ error: "session_id and cart_items required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.cart_items.length === 0) {
      return new Response(JSON.stringify({ success: true, skipped: "empty_cart" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const row = {
      user_id: body.user_id ?? null,
      session_id: body.session_id,
      email: body.email ?? null,
      cart_data: body.cart_items,
      cart_total: Number(body.cart_total) || 0,
      item_count: body.cart_items.length,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("dd_abandoned_carts")
      .upsert(row, { onConflict: "session_id" })
      .select("id")
      .single();

    if (error) throw error;
    return new Response(JSON.stringify({ success: true, id: data?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
