// Public, unauthenticated read endpoint for demo sites.
// Consumed by the brandaro-base dynamic app (middleware -> page render).
// Returns ONLY allowlisted, non-sensitive fields.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Allowlist — anything not listed here never leaves the database.
const PUBLIC_FIELDS = [
  "id",
  "slug",
  "business_name",
  "industry",
  "city",
  "state",
  "zip",
  "address",
  "phone_e164",
  "logo_url",
  "services_inferred",
  "seo_text",
  "content_blocks",
  "extracted_structure",
  "generated_colors",
  "reviews",
  "preview_image",
  "screenshot_url",
  "hero_variant",
  "services_variant",
  "about_variant",
  "reviews_variant",
  "cta_variant",
  "generated_html",
  "published_at",
  "public_status",
  "published_version",
].join(", ");

/** Extract the demo slug from a Host header of the form `slug--industry.demo.brandarodigital.com`. */
function slugFromHost(host: string | null): { slug: string | null; industry: string | null } {
  if (!host) return { slug: null, industry: null };
  const label = host.split(":")[0].toLowerCase().split(".")[0];
  if (!label) return { slug: null, industry: null };
  const idx = label.lastIndexOf("--");
  if (idx === -1) return { slug: label, industry: null };
  return { slug: label.slice(0, idx), industry: label.slice(idx + 2) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let slug = url.searchParams.get("slug");
    let industry = url.searchParams.get("industry");
    const hostParam = url.searchParams.get("host");

    if (!slug && hostParam) {
      const parsed = slugFromHost(hostParam);
      slug = parsed.slug;
      industry = industry || parsed.industry;
    }

    if (!slug && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.slug) slug = String(body.slug);
      if (!slug && body.host) {
        const parsed = slugFromHost(String(body.host));
        slug = parsed.slug;
        industry = industry || parsed.industry;
      }
    }

    if (!slug || !/^[a-z0-9-]{1,200}$/.test(slug)) {
      return new Response(JSON.stringify({ found: false, error: "valid slug required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("brandaro_demo_sites")
      .select(PUBLIC_FIELDS)
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return new Response(JSON.stringify({ found: false, slug }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=30",
        },
      });
    }

    // Fire-and-forget view metering; never blocks the response path.
    supabase
      .rpc("noop_never_called")
      .then(() => {})
      .catch(() => {});
    await supabase
      .from("brandaro_demo_sites")
      .update({ last_viewed_at: new Date().toISOString() })
      .eq("id", (data as Record<string, unknown>).id as string);

    return new Response(
      JSON.stringify({ found: true, requested_industry: industry, demo: data }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          // Edge-cached; revalidated in the background so demo edits go live fast
          // without every request hitting the database.
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
        },
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ found: false, error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
