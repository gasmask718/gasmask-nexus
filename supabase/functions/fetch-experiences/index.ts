import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const VIATOR_API_KEY = Deno.env.get("VIATOR_API_KEY");
  if (!VIATOR_API_KEY) {
    return new Response(
      JSON.stringify({ error: "VIATOR_API_KEY not configured" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const city = body.city || "New York";
    const limit = body.limit || 50;

    // Fetch from Viator API
    const viatorRes = await fetch(
      "https://api.viator.com/partner/products/search",
      {
        method: "POST",
        headers: {
          "exp-api-key": VIATOR_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json;version=2.0",
        },
        body: JSON.stringify({
          filtering: { destination: city },
          pagination: { start: 1, count: limit },
          currency: "USD",
        }),
      }
    );

    if (!viatorRes.ok) {
      const errText = await viatorRes.text();
      // Log the error
      await supabase.from("experience_sync_errors").insert({
        error_type: "api_fetch",
        error_message: `Viator API ${viatorRes.status}: ${errText}`,
        payload: { city, limit },
      });
      return new Response(
        JSON.stringify({ error: "Viator API error", status: viatorRes.status }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const data = await viatorRes.json();
    const products = data.products || [];

    // Normalize and upsert
    let synced = 0;
    let errors = 0;

    for (const p of products) {
      const normalized = {
        viator_product_code: p.productCode,
        title: p.title || "Untitled Experience",
        description: p.description || p.shortDescription || null,
        city: city,
        category: p.productCategories?.[0]?.name || "General",
        price: p.pricing?.summary?.fromPrice || 0,
        rating: p.reviews?.combinedAverageRating || null,
        duration: p.duration?.fixedDurationInMinutes
          ? `${p.duration.fixedDurationInMinutes} min`
          : p.duration?.description || null,
        supplier_name: p.supplier?.name || null,
        booking_type: "external",
        external_url: p.productUrl || null,
        image_url: p.images?.[0]?.variants?.[0]?.url || null,
        tags: p.tags?.map((t: any) => t.text) || [],
        is_active: true,
      };

      const { error } = await supabase
        .from("experiences_master")
        .upsert(normalized, { onConflict: "viator_product_code" });

      if (error) {
        errors++;
        await supabase.from("experience_sync_errors").insert({
          error_type: "upsert_fail",
          error_message: error.message,
          payload: { productCode: p.productCode },
        });
      } else {
        synced++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_fetched: products.length,
        synced,
        errors,
        city,
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await supabase.from("experience_sync_errors").insert({
      error_type: "runtime",
      error_message: msg,
    });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
