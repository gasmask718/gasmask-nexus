import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-proxy-secret",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const ALLOWED_TABLES = [
  "solar_leads",
  "solar_deals",
  "solar_partners",
  "solar_partner_deals",
  "solar_partner_performance",
  "solar_partner_rankings",
  "solar_partner_outreach",
  "solar_appointments",
  "solar_followups",
  "solar_interactions",
  "solar_notifications",
  "solar_agents",
  "solar_call_queue",
  "solar_call_batches",
  "solar_closing_sessions",
  "solar_objection_library",
  "solar_outreach_contacts",
  "solar_property_intelligence",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Path: /external-db-proxy/{table} or /external-db-proxy/{table}/{id}
    const table = pathParts[1] || url.searchParams.get("table");
    const recordId = pathParts[2] || url.searchParams.get("id");

    if (!table || !ALLOWED_TABLES.includes(table)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Table '${table}' is not allowed. Allowed: ${ALLOWED_TABLES.join(", ")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const method = req.method.toUpperCase();

    // READ
    if (method === "GET") {
      let query = supabase.from(table).select("*");

      if (recordId) {
        query = query.eq("id", recordId).single();
      }

      // Support query params for filtering
      const filters = url.searchParams.get("filters");
      if (filters) {
        try {
          const parsed = JSON.parse(filters);
          for (const [col, val] of Object.entries(parsed)) {
            query = query.eq(col, val);
          }
        } catch { /* ignore bad filters */ }
      }

      const limit = parseInt(url.searchParams.get("limit") || "100");
      const offset = parseInt(url.searchParams.get("offset") || "0");
      if (!recordId) {
        query = query.range(offset, offset + limit - 1);
      }

      const orderBy = url.searchParams.get("order_by") || "created_at";
      const orderDir = url.searchParams.get("order_dir") === "asc";
      if (!recordId) {
        query = query.order(orderBy, { ascending: orderDir });
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data, count }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CREATE
    if (method === "POST") {
      const body = await req.json();
      const rows = Array.isArray(body) ? body : [body];

      const { data, error } = await supabase.from(table).insert(rows).select();
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // UPDATE
    if (method === "PUT" || method === "PATCH") {
      const body = await req.json();
      const id = recordId || body.id;
      if (!id) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing record id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updateData = { ...body };
      delete updateData.id;

      const { data, error } = await supabase
        .from(table)
        .update(updateData)
        .eq("id", id)
        .select();
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE
    if (method === "DELETE") {
      const id = recordId || url.searchParams.get("id");
      if (!id) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing record id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, deleted: id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("external-db-proxy error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
