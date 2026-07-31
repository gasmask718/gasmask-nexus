import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const KNOWN_INDUSTRIES = [
  "cleaning", "hvac", "general", "contractor", "auto", "beauty",
  "restaurant", "landscaping", "medical", "realestate", "legal",
  "fitness", "events", "trucking", "childcare", "pets",
];

// Real-world phrasing -> canonical industry key (checked as substrings, longest first)
const INDUSTRY_ALIASES: Record<string, string> = {
  // cleaning
  "cleaning service": "cleaning", "cleaning services": "cleaning", "cleaning company": "cleaning",
  "janitorial": "cleaning", "maid": "cleaning", "housekeeping": "cleaning", "cleaner": "cleaning",
  "carpet cleaning": "cleaning", "pressure washing": "cleaning",
  // auto
  "auto repair shop": "auto", "auto repair": "auto", "car repair": "auto", "mechanic": "auto",
  "auto body": "auto", "body shop": "auto", "tire shop": "auto", "car wash": "auto",
  "automotive": "auto", "auto_repair": "auto", "dealership": "auto",
  // hvac (incl. plumbing per business rule)
  "hvac contractor": "hvac", "heating and cooling": "hvac", "air conditioning": "hvac",
  "heating": "hvac", "cooling": "hvac", "plumber": "hvac", "plumbing": "hvac",
  // contractor / trades
  "general contractor": "contractor", "construction": "contractor", "remodeling": "contractor",
  "renovation": "contractor", "handyman": "contractor", "roofing": "contractor", "roofer": "contractor",
  "electrician": "contractor", "electrical": "contractor", "painting": "contractor",
  "flooring": "contractor", "carpentry": "contractor",
  // realestate
  "real estate": "realestate", "real_estate": "realestate", "realtor": "realestate",
  "property management": "realestate", "broker": "realestate",
  // beauty
  "salon": "beauty", "hair salon": "beauty", "barber": "beauty", "barbershop": "beauty",
  "nail salon": "beauty", "spa": "beauty", "esthetician": "beauty", "lash": "beauty",
  "makeup": "beauty", "beauty salon": "beauty",
  // medical
  "dentist": "medical", "dental": "medical", "doctor": "medical", "clinic": "medical",
  "chiropractor": "medical", "physical therapy": "medical", "urgent care": "medical",
  "medspa": "medical", "med spa": "medical", "healthcare": "medical", "health care": "medical",
  "optometrist": "medical", "veterinar": "pets",
  // legal
  "attorney": "legal", "lawyer": "legal", "law firm": "legal", "law office": "legal",
  // fitness
  "gym": "fitness", "personal trainer": "fitness", "training": "fitness", "yoga": "fitness",
  "pilates": "fitness", "crossfit": "fitness", "martial arts": "fitness",
  // restaurant
  "restaurant": "restaurant", "cafe": "restaurant", "coffee shop": "restaurant", "bakery": "restaurant",
  "catering": "restaurant", "food truck": "restaurant", "pizzeria": "restaurant", "diner": "restaurant",
  "bar": "restaurant", "deli": "restaurant",
  // landscaping
  "landscaping": "landscaping", "landscaper": "landscaping", "lawn care": "landscaping",
  "lawn": "landscaping", "tree service": "landscaping", "snow removal": "landscaping",
  // events
  "event planning": "events", "event planner": "events", "wedding": "events", "party rental": "events",
  "photography": "events", "photographer": "events", "dj": "events", "venue": "events",
  // trucking
  "trucking": "trucking", "freight": "trucking", "logistics": "trucking", "hauling": "trucking",
  "moving company": "trucking", "movers": "trucking", "courier": "trucking", "delivery": "trucking",
  // childcare
  "childcare": "childcare", "child care": "childcare", "daycare": "childcare", "day care": "childcare",
  "preschool": "childcare", "nanny": "childcare", "tutoring": "childcare",
  // pets
  "pet grooming": "pets", "pet sitting": "pets", "dog walking": "pets", "dog training": "pets",
  "groomer": "pets", "kennel": "pets", "pet": "pets",
};


interface GenerateRequest {
  lead_id: string;
  engine: "native" | "durable";
  dry_run?: boolean;
  deploy_vercel?: boolean;
}

interface AiContent {
  hero_headline: string;
  hero_subheadline: string;
  services: Array<{ name: string; description: string }>;
  about_paragraph: string;
  cta_text: string;
  color_primary: string;
  color_secondary: string;
  font_recommendation: string;
}

function normalizeIndustry(raw?: string): string {
  const cleaned = (raw || "general").toLowerCase().trim();
  if (!cleaned) return "general";

  // Pass 1: exact match on the slugified value ("Real Estate" -> "real_estate")
  const slug = cleaned.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (KNOWN_INDUSTRIES.includes(slug)) return slug;

  // Pass 1b: exact match with separators stripped ("real estate" -> "realestate")
  const compact = cleaned.replace(/[^a-z0-9]+/g, "");
  if (KNOWN_INDUSTRIES.includes(compact)) return compact;

  // Pass 2: alias table, longest alias first so "auto repair shop" beats "auto"
  const spaced = cleaned.replace(/[^a-z0-9]+/g, " ").trim();
  const aliases = Object.keys(INDUSTRY_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    const aliasSpaced = alias.replace(/[^a-z0-9]+/g, " ").trim();
    if (spaced === aliasSpaced || spaced.includes(aliasSpaced)) {
      return INDUSTRY_ALIASES[alias];
    }
  }

  // Pass 3: fuzzy substring against the known industry keys themselves
  const byLength = [...KNOWN_INDUSTRIES]
    .filter((k) => k !== "general")
    .sort((a, b) => b.length - a.length);
  for (const key of byLength) {
    if (compact.includes(key) || spaced.includes(key)) return key;
  }

  return "general";
}


async function loadDesignMd(supabase: any, industry: string): Promise<string | null> {
  for (const name of [`${industry}.md`, "general.md"]) {
    const { data, error } = await supabase.storage.from("brandaro-design-mds").download(name);
    if (!error && data) {
      try { return await data.text(); } catch { /* fallthrough */ }
    }
  }
  return null;
}

async function callLovableAi(lead: any, industry: string, designMd: string | null): Promise<{ ok: true; content: AiContent } | { ok: false; status: number; error: string }> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return { ok: false, status: 500, error: "LOVABLE_API_KEY not configured" };

  const services = (lead.services_inferred || []).slice(0, 8);
  const reviews = Array.isArray(lead.reviews) ? lead.reviews.slice(0, 5) : [];

  const system = `You are a senior web copywriter and brand designer. You will be given a DESIGN.md system for the ${industry} industry, plus real business data. Produce website copy that follows the DESIGN.md voice, tone, color, and structural guidance precisely. Return ONLY valid JSON matching the schema — no prose, no markdown fences.`;

  const user = `DESIGN.md (${industry}):\n${designMd ? designMd.slice(0, 12000) : "(none — use industry best practices)"}\n\nBUSINESS DATA:\n${JSON.stringify({
    business_name: lead.business_name,
    industry: lead.industry,
    city: lead.city,
    state: lead.state,
    phone: lead.phone,
    services,
    reviews_sample: reviews,
  }, null, 2)}\n\nReturn JSON:\n{\n  "hero_headline": "string (concise, local, 10 words max)",\n  "hero_subheadline": "string (1 sentence, benefit-driven)",\n  "services": [{"name":"string","description":"1-sentence value prop"}],\n  "about_paragraph": "string (2-3 sentences, warm + trustworthy)",\n  "cta_text": "string (2-4 words, action verb)",\n  "color_primary": "#hex",\n  "color_secondary": "#hex",\n  "font_recommendation": "string (e.g. Inter, Playfair Display)"\n}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, error: `Lovable AI ${res.status}: ${text.slice(0, 500)}` };
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) return { ok: false, status: 502, error: "AI returned empty content" };
  try {
    const parsed = JSON.parse(raw);
    return { ok: true, content: parsed as AiContent };
  } catch (e) {
    return { ok: false, status: 502, error: `AI JSON parse failed: ${String(e)}` };
  }
}

function generateNativeHtml(data: {
  business_name: string;
  industry: string;
  city: string;
  state: string;
  phone?: string;
  ai: AiContent;
}): string {
  const { business_name, industry, city, state, phone, ai } = data;
  const primary = ai.color_primary || "#2563eb";
  const secondary = ai.color_secondary || "#f59e0b";
  const font = ai.font_recommendation || "Inter";
  const services = ai.services?.length ? ai.services : [{ name: "Professional Service", description: "Trusted local expertise." }];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${business_name} — ${industry} in ${city}, ${state}</title>
<meta name="description" content="${ai.about_paragraph.slice(0, 155)}">
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;600;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'${font}',-apple-system,BlinkMacSystemFont,sans-serif;color:#1a1a2e;line-height:1.6}
.hero{background:linear-gradient(135deg,${primary},${primary}dd);color:#fff;padding:96px 20px;text-align:center}
.hero h1{font-size:2.75rem;margin-bottom:16px;font-weight:800;max-width:900px;margin-left:auto;margin-right:auto}
.hero p{font-size:1.25rem;opacity:0.95;max-width:640px;margin:0 auto 36px}
.cta-btn{background:${secondary};color:#fff;border:none;padding:16px 40px;font-size:1.05rem;border-radius:10px;cursor:pointer;font-weight:700;text-decoration:none;display:inline-block;transition:transform .15s}
.cta-btn:hover{transform:translateY(-2px)}
.services{padding:72px 20px;background:#f8fafc;text-align:center}
.services h2{font-size:2rem;margin-bottom:48px;color:${primary}}
.services-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px;max-width:1080px;margin:0 auto}
.service-card{background:#fff;padding:32px 24px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.06);text-align:left}
.service-card h3{font-size:1.15rem;margin-bottom:8px;color:${primary};font-weight:700}
.service-card p{color:#555;font-size:0.95rem}
.about{padding:72px 20px;text-align:center;background:#fff;max-width:820px;margin:0 auto}
.about h2{font-size:2rem;margin-bottom:20px;color:${primary}}
.about p{font-size:1.1rem;color:#333}
.contact{padding:72px 20px;background:${primary};color:#fff;text-align:center}
.contact h2{font-size:2rem;margin-bottom:16px}
${phone ? `.phone{font-size:1.9rem;font-weight:800;margin:20px 0}` : ""}
.footer{padding:24px;text-align:center;background:#0f0f1e;color:#fff;font-size:0.85rem;opacity:0.8}
</style>
</head>
<body>
<section class="hero"><h1>${ai.hero_headline}</h1><p>${ai.hero_subheadline}</p><a href="#contact" class="cta-btn">${ai.cta_text}</a></section>
<section class="services"><h2>Our Services</h2><div class="services-grid">${services.map(s => `<div class="service-card"><h3>${s.name}</h3><p>${s.description}</p></div>`).join("")}</div></section>
<section class="about"><h2>About ${business_name}</h2><p>${ai.about_paragraph}</p></section>
<section class="contact" id="contact"><h2>Ready to Get Started?</h2>${phone ? `<div class="phone">${phone}</div>` : ""}<a href="${phone ? `tel:${phone}` : "#"}" class="cta-btn">${ai.cta_text}</a></section>
<footer class="footer">© ${new Date().getFullYear()} ${business_name} — ${city}, ${state}</footer>
</body>
</html>`;
}

async function callDurable(payload: any): Promise<{ ok: true; site_id: string; site_url?: string; screenshot_url?: string } | { ok: false; status: number; error: string }> {
  const key = Deno.env.get("DURABLE_API_KEY");
  if (!key) return { ok: false, status: 500, error: "DURABLE_API_KEY not configured" };

  const res = await fetch("https://api.durable.co/v1/sites", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, error: `Durable ${res.status}: ${text.slice(0, 500)}` };
  try {
    const data = JSON.parse(text);
    return {
      ok: true,
      site_id: data.id || data.site_id || data.data?.id,
      site_url: data.url || data.site_url || data.data?.url,
      screenshot_url: data.screenshot_url || data.data?.screenshot_url,
    };
  } catch {
    return { ok: false, status: 502, error: "Durable returned non-JSON" };
  }
}

// Per-industry Vercel projects: each industry has its own Vercel project
// (vercel_project_id) and deploy hook (vercel_deploy_hook_url), both stored in
// brandaro_demo_templates.
//
// Deploy hooks DISCARD any POST body, so personalization cannot ride along with
// the hook. Instead we do a two-step delivery:
//   1. Write the demo's content into the project's production environment
//      variables via the Vercel REST API (upsert semantics).
//   2. Only then fire the deploy hook so the build picks up the new values.
//
// ACCEPTED TRADE-OFF: environment variables are project-scoped, so only ONE
// demo can be live per industry at a time. Generating a new demo for the same
// industry overwrites the previous demo's content once the build completes.
const VERCEL_ENV_TARGET = ["production"];

interface EnvVarResult {
  key: string;
  ok: boolean;
  action: "created" | "updated" | "failed";
  status?: number;
  error?: string;
}

/**
 * Upsert a single production env var on a Vercel project.
 * POST /v10/projects/{id}/env?upsert=true handles both create and update.
 * If the deployment rejects upsert (409 / already exists), fall back to an
 * explicit lookup + PATCH on /v9/projects/{id}/env/{envId}.
 */
async function upsertVercelEnvVar(
  token: string,
  projectId: string,
  key: string,
  value: string,
): Promise<EnvVarResult> {
  try {
    const res = await fetch(
      `https://api.vercel.com/v10/projects/${projectId}/env?upsert=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key, value, type: "plain", target: VERCEL_ENV_TARGET }),
      },
    );

    if (res.ok) return { key, ok: true, action: "created", status: res.status };

    const body = await res.text();

    // Already exists and upsert wasn't honored -> find the env var id and PATCH it.
    if (res.status === 409 || /already exists/i.test(body)) {
      const listRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!listRes.ok) {
        return {
          key, ok: false, action: "failed", status: listRes.status,
          error: `env list failed: ${(await listRes.text()).slice(0, 200)}`,
        };
      }
      const list = await listRes.json();
      const existing = (list?.envs ?? []).find(
        (e: { key: string; target?: string[]; id: string }) =>
          e.key === key && (e.target ?? []).includes("production"),
      );
      if (!existing?.id) {
        return { key, ok: false, action: "failed", status: res.status, error: `conflict but no existing production var found` };
      }

      const patchRes = await fetch(
        `https://api.vercel.com/v9/projects/${projectId}/env/${existing.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ value, type: "plain", target: VERCEL_ENV_TARGET }),
        },
      );
      if (patchRes.ok) return { key, ok: true, action: "updated", status: patchRes.status };
      return {
        key, ok: false, action: "failed", status: patchRes.status,
        error: `PATCH ${patchRes.status}: ${(await patchRes.text()).slice(0, 200)}`,
      };
    }

    return { key, ok: false, action: "failed", status: res.status, error: `POST ${res.status}: ${body.slice(0, 200)}` };
  } catch (e) {
    return { key, ok: false, action: "failed", error: e instanceof Error ? e.message : "request failed" };
  }
}

async function tryVercelHook(
  supabase: ReturnType<typeof createClient>,
  industry: string,
  payload: {
    demo_id: string;
    slug: string;
    industry: string;
    business_name: string;
    demo_url: string;
    city?: string | null;
    phone?: string | null;
    hero_headline?: string;
    hero_sub?: string;
    cta_text?: string;
    color_primary?: string;
    color_secondary?: string;
    services?: unknown;
    about_text?: string | null;
    reviews?: unknown;
    photos?: unknown;
    logo_url?: string | null;
  },
): Promise<{
  ok: boolean;
  skipped?: boolean;
  status?: number;
  error?: string;
  repo?: string;
  project_id?: string;
  env_vars?: EnvVarResult[];
  env_failed?: string[];
  env_skipped?: string[];
}> {
  const { data: tpl, error } = await supabase
    .from("brandaro_demo_templates")
    .select("vercel_deploy_hook_url, vercel_template_repo, vercel_project_id, primary_color, secondary_color")
    .eq("industry", industry)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return { ok: false, error: `Template lookup failed: ${error.message}` };
  if (!tpl?.vercel_deploy_hook_url) {
    return { ok: false, skipped: true, error: `No deploy hook configured for industry "${industry}"` };
  }

  // Vercel env vars are always strings — objects/arrays must be serialized.
  const asJson = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    if (Array.isArray(v) && v.length === 0) return null;
    if (typeof v === "string") return v.trim() ? v : null;
    try {
      return JSON.stringify(v);
    } catch {
      return null;
    }
  };

  // ---- Step 1: push personalization into the project's production env vars ----
  const token = Deno.env.get("VERCEL_API_TOKEN");
  const envVars: Record<string, string> = {
    VITE_BUSINESS_NAME: payload.business_name ?? "",
    VITE_BUSINESS_CITY: payload.city ?? "",
    VITE_BUSINESS_PHONE: payload.phone ?? "",
    VITE_HERO_HEADLINE: payload.hero_headline ?? "",
    VITE_HERO_SUB: payload.hero_sub ?? "",
    VITE_CTA_TEXT: payload.cta_text ?? "",
    VITE_COLOR_PRIMARY: payload.color_primary ?? tpl.primary_color ?? "",
    VITE_COLOR_SECONDARY: payload.color_secondary ?? tpl.secondary_color ?? "",
    VITE_DEMO_SLUG: payload.slug ?? "",
  };

  // Optional vars: only sync when we actually have data, so brandaro-base's
  // fallbacks (typographic logo, generic services, hidden reviews/photos) apply.
  const envSkipped: string[] = [];
  const optional: Record<string, string | null> = {
    VITE_SERVICES_JSON: asJson(payload.services),
    VITE_ABOUT_TEXT: asJson(payload.about_text),
    VITE_REVIEWS_JSON: asJson(payload.reviews),
    VITE_PHOTOS_JSON: asJson(payload.photos),
    VITE_LOGO_URL: asJson(payload.logo_url),
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value) envVars[key] = value;
    else {
      envSkipped.push(key);
      console.log(`[vercel] optional env var "${key}" omitted — no data at generation time`);
    }
  }


  let envResults: EnvVarResult[] = [];
  if (!token) {
    console.warn("[vercel] VERCEL_API_TOKEN missing — skipping env var sync, deploying with stale content");
  } else if (!tpl.vercel_project_id) {
    console.warn(`[vercel] No vercel_project_id for industry "${industry}" — skipping env var sync`);
  } else {
    // Sequential + non-fatal: one bad var must not block the others.
    for (const [key, value] of Object.entries(envVars)) {
      const result = await upsertVercelEnvVar(token, tpl.vercel_project_id, key, value);
      envResults.push(result);
      if (!result.ok) {
        console.error(`[vercel] env var "${key}" failed for project ${tpl.vercel_project_id}: ${result.error}`);
      }
    }
  }
  const envFailed = envResults.filter((r) => !r.ok).map((r) => r.key);
  if (envFailed.length) {
    console.warn(`[vercel] ${envFailed.length}/${envResults.length} env vars failed: ${envFailed.join(", ")} — firing deploy hook anyway`);
  }

  // ---- Step 2: fire the deploy hook so the build picks up the new env vars ----
  try {
    const res = await fetch(tpl.vercel_deploy_hook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Deploy hooks ignore the body; content is delivered via env vars above.
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false, status: res.status,
        error: `Vercel hook ${res.status}: ${text.slice(0, 300)}`,
        repo: tpl.vercel_template_repo, project_id: tpl.vercel_project_id,
        env_vars: envResults, env_failed: envFailed, env_skipped: envSkipped,
      };
    }
    return {
      ok: true, status: res.status,
      repo: tpl.vercel_template_repo, project_id: tpl.vercel_project_id,
      env_vars: envResults, env_failed: envFailed, env_skipped: envSkipped,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Vercel hook request failed",
      repo: tpl.vercel_template_repo, project_id: tpl.vercel_project_id,
      env_vars: envResults, env_failed: envFailed, env_skipped: envSkipped,
    };
  }
}




Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { lead_id, engine = "native", dry_run } = (await req.json()) as GenerateRequest;

    if (dry_run) {
      return new Response(JSON.stringify({ ok: true, dry_run: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: lead, error: leadErr } = await supabase
      .from("brandaro_qualified_leads").select("*").eq("id", lead_id).single();
    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const industry = normalizeIndustry(lead.industry);

    // Backfill Google reviews/photos for leads imported before the content
    // pass existed. One Details call + N photo-media calls; never fatal.
    let leadReviews = (lead as any).reviews ?? null;
    let leadPhotos = (lead as any).photos ?? null;
    const gKey = Deno.env.get("GOOGLE_PLACES_API_KEY") || Deno.env.get("GOOGLE_MAPS_API_KEY");
    if ((!leadReviews || !leadPhotos) && lead.google_place_id && gKey) {
      try {
        const content = await fetchPlaceContent(lead.google_place_id, gKey, { maxReviews: 5, maxPhotos: 6 });
        leadReviews = leadReviews ?? (content.reviews.length ? content.reviews : null);
        leadPhotos = leadPhotos ?? (content.photos.length ? content.photos : null);
        if (leadReviews || leadPhotos) {
          await supabase.from("brandaro_qualified_leads")
            .update({ reviews: leadReviews, photos: leadPhotos }).eq("id", lead_id);
        }
        console.log(`[demo] places content backfill: reviews=${content.reviews.length} photos=${content.photos.length}`);
      } catch (e) {
        console.warn("[demo] places content backfill failed:", e instanceof Error ? e.message : e);
      }
    }

    if (engine === "native") {
      const designMd = await loadDesignMd(supabase, industry);
      const aiRes = await callLovableAi(lead, industry, designMd);

      if (!aiRes.ok) {
        const { data: errDemo } = await supabase.from("brandaro_demo_sites").insert({
          lead_id, business_name: lead.business_name, industry: lead.industry,
          city: lead.city, state: lead.state,
          generation_status: "error", generation_engine: "native",
          engine_status: "error", template_used: industry, error_message: aiRes.error,
        }).select().single();

        const status = aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 500;
        return new Response(JSON.stringify({ error: aiRes.error, demo: errDemo }), {
          status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const html = generateNativeHtml({
        business_name: lead.business_name, industry,
        city: lead.city || "Your City", state: lead.state || "US",
        phone: lead.phone, ai: aiRes.content,
      });

      const demoSlug = `${(lead.business_name || "demo").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-${Date.now()}`;
      // Two-level subdomain served by the industry's own Vercel project:
      // `<slug>.<industry>.demo.brandarodigital.com`
      const demoUrl = `https://${demoSlug}.${industry}.demo.brandarodigital.com`;
      const nowIso = new Date().toISOString();

      const { data: demo, error: insertErr } = await supabase.from("brandaro_demo_sites").insert({
        lead_id, business_name: lead.business_name, industry: lead.industry,
        city: lead.city, state: lead.state,
        services_inferred: aiRes.content.services.map(s => s.name),
        seo_text: aiRes.content.about_paragraph,
        generation_status: "ready", generation_engine: "native",
        engine_status: "ready", template_used: industry,
        slug: demoSlug,
        demo_url: demoUrl, hosting_path: `/demos/${demoSlug}`,
        generated_html: html,
        content_blocks: aiRes.content,
        generated_colors: { primary: aiRes.content.color_primary, secondary: aiRes.content.color_secondary, font: aiRes.content.font_recommendation },
        published_at: nowIso,
        public_status: "live",
        demo_ready_for_conversion: true,
      }).select().single();

      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("brandaro_qualified_leads").update({ demo_status: "generated" }).eq("id", lead_id);

      // Trigger a rebuild of this industry's Vercel project.
      const vercel = await tryVercelHook(supabase, industry, {
        demo_id: demo.id,
        slug: demoSlug,
        industry,
        business_name: lead.business_name,
        demo_url: demoUrl,
        city: lead.city,
        phone: lead.phone,
        hero_headline: aiRes.content.hero_headline,
        hero_sub: aiRes.content.hero_subheadline,
        cta_text: aiRes.content.cta_text,
        color_primary: aiRes.content.color_primary,
        color_secondary: aiRes.content.color_secondary,
        services: aiRes.content.services,
        about_text: aiRes.content.about_paragraph,
        // Real Google Places content (reviews + resolved photo image URLs).
        reviews: leadReviews,
        photos: leadPhotos,
        logo_url: (demo as any).logo_url ?? null,

      });
      if (!vercel.ok) console.warn("Vercel deploy hook not fired:", vercel.error);

      return new Response(JSON.stringify({ success: true, demo, engine: "native", design_md_loaded: !!designMd, vercel }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (engine === "durable") {
      const { data: demo, error: insertErr } = await supabase.from("brandaro_demo_sites").insert({
        lead_id, business_name: lead.business_name, industry: lead.industry,
        city: lead.city, state: lead.state,
        services_inferred: lead.services_inferred,
        seo_text: `${lead.business_name} — ${lead.industry} in ${lead.city}, ${lead.state}`,
        generation_status: "generating", generation_engine: "durable",
        engine_status: "queued", durable_job_status: "queued",
      }).select().single();

      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const durableRes = await callDurable({
        business_name: lead.business_name,
        industry: lead.industry,
        location: { city: lead.city, state: lead.state },
        phone: lead.phone,
        services: lead.services_inferred || [],
        webhook_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/brandaro-durable-webhook`,
        external_reference: demo.id,
      });

      if (!durableRes.ok) {
        await supabase.from("brandaro_demo_sites").update({
          durable_job_status: "error",
          durable_last_error: durableRes.error,
          generation_status: "error",
          engine_status: "error",
          error_message: durableRes.error,
        }).eq("id", demo.id);
        return new Response(JSON.stringify({ error: durableRes.error, demo }), {
          status: durableRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: updated } = await supabase.from("brandaro_demo_sites").update({
        durable_site_id: durableRes.site_id,
        durable_generated_url: durableRes.site_url,
        durable_screenshot_url: durableRes.screenshot_url,
        durable_job_status: "processing",
        engine_status: "processing",
      }).eq("id", demo.id).select().single();

      return new Response(JSON.stringify({ success: true, demo: updated, engine: "durable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid engine" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Demo generation error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
