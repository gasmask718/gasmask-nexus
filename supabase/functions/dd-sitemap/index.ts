// DD Public Site sitemap — env-driven origin so the custom-domain switch is zero-code.
// Deployed with verify_jwt = false.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FALLBACK_ORIGIN = "https://dynasty-connect-market.lovable.app";

Deno.serve(async () => {
  const BASE = (Deno.env.get("PUBLIC_SITE_ORIGIN") || FALLBACK_ORIGIN).replace(/\/+$/, "");
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const { data: products, error } = await sb
    .from("products_all_public")
    .select("id, updated_at, category")
    .order("updated_at", { ascending: false })
    .limit(5000);

  if (error) {
    return new Response(`<!-- sitemap error: ${error.message} -->`, {
      status: 500,
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  }

  const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const categories = Array.from(
    new Set((products ?? []).map((p: any) => p.category).filter(Boolean)),
  );

  type U = { loc: string; lastmod?: string; changefreq: string; priority: string };
  const urls: U[] = [
    { loc: `${BASE}/`, changefreq: "daily", priority: "1.0" },
    { loc: `${BASE}/products`, changefreq: "hourly", priority: "0.9" },
    ...categories.map((c) => ({
      loc: `${BASE}/c/${slug(c as string)}`,
      changefreq: "daily",
      priority: "0.8",
    })),
    ...(products ?? []).map((p: any) => ({
      loc: `${BASE}/products/${p.id}`,
      lastmod: p.updated_at ? new Date(p.updated_at).toISOString().slice(0, 10) : undefined,
      changefreq: "weekly",
      priority: "0.7",
    })),
  ];

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>${esc(u.loc)}</loc>` +
          (u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : "") +
          `<changefreq>${u.changefreq}</changefreq>` +
          `<priority>${u.priority}</priority></url>`,
      )
      .join("\n") +
    `\n</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
