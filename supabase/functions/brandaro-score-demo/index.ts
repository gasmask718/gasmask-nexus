import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tryVercelHook } from "../_shared/vercelDeploy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * brandaro-score-demo
 *
 * Quality gate for demos. Audits the LIVE deployed demo (falling back to the
 * stored full HTML) across 8 dimensions, and — when the score is below the
 * 88 threshold — regenerates the copy with the auditor's issues as feedback,
 * redeploys through the same Vercel env-var + hook path, and re-scores.
 *
 * Actions:
 *   - score:               single audit pass, no fixing
 *   - score_and_fix:       audit -> fix -> re-audit (max 2 passes)
 *   - batch_score:         heuristic backfill for unscored demos
 *   - get_design_insights: winning design patterns from closed deals
 */

const PASS_THRESHOLD = 88;
const MAX_PASSES = 2;
const AI_MODEL = "google/gemini-3.6-flash";
const HTML_CHAR_CAP = 120_000; // full page, not the old 8k truncation
const LIVE_FETCH_ATTEMPTS = 6;
const LIVE_FETCH_DELAY_MS = 15_000;

const DIMENSIONS = [
  "design", "content", "mobile", "speed",
  "trust", "seo", "conversion", "accuracy",
] as const;
type Dimension = typeof DIMENSIONS[number];

interface Issue {
  dimension: string;
  severity: "low" | "medium" | "high";
  description: string;
  fixable: boolean;
}

interface ScoreResult {
  dimension_scores: Record<Dimension, number>;
  overall_score: number;
  cta_present: boolean;
  mobile_friendly: boolean;
  issues: Issue[];
  scored_by: "ai" | "heuristic";
}

interface BusinessFacts {
  business_name?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  industry?: string | null;
  services?: unknown;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    if (body.dry_run) {
      return new Response(JSON.stringify({ ok: true, dry_run: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = body;

    switch (action) {
      case "score":
        return await handleScore(supabase, body);
      case "score_and_fix":
        return await handleScoreAndFix(supabase, body);
      case "batch_score":
        return await handleBatchScore(supabase);
      case "get_design_insights":
        return await handleDesignInsights(supabase);
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("brandaro-score-demo error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ---------------------------------------------------------------------------
// Content acquisition — live site first, stored HTML as fallback
// ---------------------------------------------------------------------------

/**
 * Connection-level failures that will never resolve by waiting: TLS handshake
 * errors, DNS resolution failures, refused/unreachable hosts, bad certs.
 * These indicate a domain/Vercel misconfiguration, not a build still in flight.
 */
function isPermanentFetchError(msg: string): boolean {
  const m = msg.toLowerCase();
  return [
    "tls handshake",
    "invalid peer certificate",
    "certificate",
    "unknown issuer",
    "dns error",
    "failed to lookup address",
    "name or service not known",
    "nodename nor servname",
    "getaddrinfo",
    "connection refused",
    "network is unreachable",
    "no route to host",
    "unknownhostexception",
  ].some((needle) => m.includes(needle));
}

/**
 * Poll the deployed demo URL. Vercel builds take ~1-3 minutes, so the first
 * attempts can legitimately 404 or serve the previous build. Non-fatal: the
 * caller falls back to the stored HTML and records which source was scored.
 *
 * Retries/backoff are reserved for genuinely transient failures (timeouts,
 * 5xx, 404 during build). Connection-level failures (TLS/DNS/refused) bail
 * after a single attempt — waiting cannot fix a misconfigured domain.
 */
async function fetchLiveHtml(
  url: string,
  opts: { attempts?: number; delayMs?: number } = {},
): Promise<{ html: string | null; attempts: number; error?: string; permanent?: boolean }> {
  const attempts = opts.attempts ?? LIVE_FETCH_ATTEMPTS;
  const delayMs = opts.delayMs ?? LIVE_FETCH_DELAY_MS;
  let lastError = "not attempted";

  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "BrandaroAuditBot/1.0", "Cache-Control": "no-cache" },
        redirect: "follow",
      });
      if (res.ok) {
        const html = await res.text();
        if (html && html.length > 500) {
          console.log(`[audit] live fetch ok on attempt ${i} (${html.length} chars) — ${url}`);
          return { html, attempts: i };
        }
        lastError = `response too small (${html.length} chars)`;
      } else {
        lastError = `HTTP ${res.status}`;
        await res.text().catch(() => "");
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : "fetch failed";
      if (isPermanentFetchError(lastError)) {
        console.warn(
          `[audit] live fetch permanent config error on attempt ${i} for ${url}: ${lastError} — bailing without retry`,
        );
        return { html: null, attempts: i, error: `permanent: ${lastError}`, permanent: true };
      }
    }
    console.log(`[audit] live fetch attempt ${i}/${attempts} failed for ${url}: ${lastError}`);
    if (i < attempts) await new Promise((r) => setTimeout(r, delayMs));
  }

  return { html: null, attempts, error: lastError };
}


// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

async function scoreWithAI(html: string, facts: BusinessFacts): Promise<ScoreResult | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("[audit] LOVABLE_API_KEY missing — falling back to heuristics");
    return null;
  }

  const page = html.slice(0, HTML_CHAR_CAP);
  const truncated = html.length > HTML_CHAR_CAP;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a strict website quality auditor for a web design agency. " +
              "You grade a live small-business demo site across 8 dimensions and list concrete, actionable issues. " +
              `Anything scoring below ${PASS_THRESHOLD} overall will be automatically rewritten, so be precise about what is wrong. ` +
              "Mark an issue fixable=true ONLY if it can be fixed by rewriting the site's copy, headline, services, about text, CTA text, or brand colors. " +
              "Structural, performance, framework, or markup problems are fixable=false.",
          },
          {
            role: "user",
            content:
              `REAL BUSINESS FACTS (the site must match these exactly — any mismatch is an accuracy failure):\n` +
              `${JSON.stringify(facts, null, 2)}\n\n` +
              `SITE HTML${truncated ? " (truncated at 120k chars)" : ""}:\n\n${page}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "score_demo",
            description: "Return 8-dimension quality scores and issues for the demo",
            parameters: {
              type: "object",
              properties: {
                design: { type: "number", description: "0-100 visual quality, layout, typography, color harmony, distinctiveness vs a generic template" },
                content: { type: "number", description: "0-100 copy quality, clarity, relevance, absence of filler/lorem/placeholder text" },
                mobile: { type: "number", description: "0-100 responsive/mobile readiness (viewport, fluid layout, tap targets)" },
                speed: { type: "number", description: "0-100 likely load performance (payload size, blocking assets, image handling)" },
                trust: { type: "number", description: "0-100 credibility signals: reviews, testimonials, real contact info, address, guarantees" },
                seo: { type: "number", description: "0-100 title, meta description, heading hierarchy, alt text, local SEO signals" },
                conversion: { type: "number", description: "0-100 likelihood to convert: CTA prominence, contact paths, clarity of next step" },
                accuracy: { type: "number", description: "0-100 how faithfully the page matches the REAL BUSINESS FACTS. Hallucinated or wrong name/city/phone/services must score low." },
                cta_present: { type: "boolean", description: "Has at least one clear call-to-action" },
                mobile_friendly: { type: "boolean", description: "Uses responsive/mobile-friendly patterns" },
                issues: {
                  type: "array",
                  description: "Specific problems found, worst first",
                  items: {
                    type: "object",
                    properties: {
                      dimension: { type: "string" },
                      severity: { type: "string", enum: ["low", "medium", "high"] },
                      description: { type: "string" },
                      fixable: { type: "boolean" },
                    },
                    required: ["dimension", "severity", "description", "fixable"],
                    additionalProperties: false,
                  },
                },
              },
              required: [...DIMENSIONS, "cta_present", "mobile_friendly", "issues"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "score_demo" } },
      }),
    });

    if (!response.ok) {
      console.error(`[audit] AI gateway ${response.status}: ${(await response.text()).slice(0, 400)}`);
      return null;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("[audit] AI returned no tool call");
      return null;
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const dimension_scores = {} as Record<Dimension, number>;
    for (const d of DIMENSIONS) {
      dimension_scores[d] = clamp(Number(parsed[d]));
    }

    return {
      dimension_scores,
      overall_score: mean(dimension_scores),
      cta_present: !!parsed.cta_present,
      mobile_friendly: !!parsed.mobile_friendly,
      issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 25) : [],
      scored_by: "ai",
    };
  } catch (e) {
    console.error("[audit] AI scoring failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function mean(scores: Record<Dimension, number>): number {
  const values = DIMENSIONS.map((d) => scores[d] ?? 0);
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Deterministic fallback when the AI path is unavailable. Extended to the full
 * 8 dimensions so a fallback row is shaped identically to an AI row — the
 * `scored_by` field is what tells them apart.
 */
function heuristicScore(html: string, facts: BusinessFacts = {}): ScoreResult {
  const lower = (html || "").toLowerCase();
  const len = (html || "").length;

  let design = 50;
  if (/gradient|linear-gradient|radial-gradient/.test(lower)) design += 10;
  if (/font-family|fonts\.googleapis/.test(lower)) design += 10;
  if (/box-shadow/.test(lower)) design += 5;
  if (/<img/.test(lower)) design += 10;
  if (/animation|transition|transform/.test(lower)) design += 5;
  if (/<style|tailwind/.test(lower)) design += 10;

  let content = 40;
  if (len > 5000) content += 15;
  if (len > 10000) content += 10;
  if (!/lorem ipsum|placeholder|your business name/.test(lower)) content += 15;

  const mobileFriendly = /viewport|@media|responsive|flex|grid/.test(lower);
  const mobile = mobileFriendly ? 80 : 35;

  let speed = 70;
  if (len > 300_000) speed -= 25;
  if ((lower.match(/<script/g) || []).length > 12) speed -= 10;
  if (/loading=["']lazy/.test(lower)) speed += 10;

  let trust = 35;
  if (/testimonial|review|rating|star/.test(lower)) trust += 20;
  if (/tel:|mailto:/.test(lower)) trust += 15;
  if (/guarantee|licensed|insured|years/.test(lower)) trust += 10;

  let seo = 30;
  if (/<title>/.test(lower)) seo += 20;
  if (/name=["']description/.test(lower)) seo += 20;
  if (/<h1/.test(lower)) seo += 15;
  if (/alt=["'][^"']+/.test(lower)) seo += 10;

  const ctaPresent = /call.*now|get.*started|book.*now|contact.*us|schedule|sign.*up|order.*now|get.*quote|free.*estimate/.test(lower);
  let conversion = 40;
  if (ctaPresent) conversion += 25;
  if (/tel:|mailto:/.test(lower)) conversion += 15;
  if (/form|input/.test(lower)) conversion += 10;

  // Accuracy: do the real facts literally appear on the page?
  let accuracy = 40;
  const hasFact = (v?: string | null) => !!v && lower.includes(String(v).toLowerCase());
  if (hasFact(facts.business_name)) accuracy += 25;
  if (hasFact(facts.city)) accuracy += 20;
  if (facts.phone && lower.replace(/\D/g, "").includes(String(facts.phone).replace(/\D/g, ""))) accuracy += 15;

  const dimension_scores: Record<Dimension, number> = {
    design: clamp(design),
    content: clamp(content),
    mobile: clamp(mobile),
    speed: clamp(speed),
    trust: clamp(trust),
    seo: clamp(seo),
    conversion: clamp(conversion),
    accuracy: clamp(accuracy),
  };

  const issues: Issue[] = [];
  for (const d of DIMENSIONS) {
    if (dimension_scores[d] < PASS_THRESHOLD) {
      issues.push({
        dimension: d,
        severity: dimension_scores[d] < 50 ? "high" : "medium",
        description: `Heuristic fallback: ${d} scored ${dimension_scores[d]}/100 (below ${PASS_THRESHOLD}).`,
        fixable: ["content", "trust", "conversion", "accuracy", "design"].includes(d),
      });
    }
  }

  return {
    dimension_scores,
    overall_score: mean(dimension_scores),
    cta_present: ctaPresent,
    mobile_friendly: mobileFriendly,
    issues,
    scored_by: "heuristic",
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function writeScoreRow(supabase: any, args: {
  demo_id?: string | null;
  lead_id?: string | null;
  result: ScoreResult;
  pass_number: number;
  source: string;
  fixes_applied?: unknown;
}) {
  const { result } = args;
  const flagged = result.overall_score < PASS_THRESHOLD;

  const { data, error } = await supabase
    .from("brandaro_demo_quality_scores")
    .insert({
      demo_id: args.demo_id ?? null,
      lead_id: args.lead_id ?? null,
      // Legacy 3-column shape kept populated for backwards compatibility.
      design_score: result.dimension_scores.design,
      uniqueness_score: result.dimension_scores.content,
      conversion_score: result.dimension_scores.conversion,
      cta_present: result.cta_present,
      mobile_friendly: result.mobile_friendly,
      overall_score: result.overall_score,
      flagged,
      pass_number: args.pass_number,
      dimension_scores: { ...result.dimension_scores, scored_by: result.scored_by, source: args.source },
      issues: result.issues,
      fixes_applied: args.fixes_applied ?? null,
      review_notes: flagged
        ? `Auto-flagged: ${result.overall_score} below threshold ${PASS_THRESHOLD} (pass ${args.pass_number}, ${result.scored_by}, ${args.source}).`
        : null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// deno-lint-ignore no-explicit-any
async function writeDemoSiteAudit(supabase: any, demoId: string, args: {
  result: ScoreResult;
  passes: number;
  source: string;
  fixes_applied?: unknown;
}) {
  const breakdown = {
    dimensions: args.result.dimension_scores,
    overall: args.result.overall_score,
    threshold: PASS_THRESHOLD,
    passed: args.result.overall_score >= PASS_THRESHOLD,
    passes: args.passes,
    scored_by: args.result.scored_by,
    source: args.source,
    cta_present: args.result.cta_present,
    mobile_friendly: args.result.mobile_friendly,
    issues: args.result.issues,
    fixes_applied: args.fixes_applied ?? null,
    audited_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("brandaro_demo_sites")
    .update({ audit_score: args.result.overall_score, audit_breakdown: breakdown })
    .eq("id", demoId);

  if (error) console.error(`[audit] failed writing audit_score to demo ${demoId}: ${error.message}`);
  return breakdown;
}

// ---------------------------------------------------------------------------
// Action: score (single pass, no fixing)
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function handleScore(supabase: any, body: any) {
  const { demo_id, lead_id, html_content, demo_url } = body;

  let html: string | null = html_content ?? null;
  let source = html ? "supplied_html" : "unknown";
  let facts: BusinessFacts = {};
  // deno-lint-ignore no-explicit-any
  let demo: any = null;

  if (demo_id) {
    const { data } = await supabase.from("brandaro_demo_sites").select("*").eq("id", demo_id).maybeSingle();
    demo = data;
  }
  if (demo) {
    facts = await loadFacts(supabase, demo);
    if (!html) {
      const target = demo_url || demo.demo_url;
      if (target) {
        const live = await fetchLiveHtml(target, { attempts: body.live_attempts ?? 2, delayMs: 5000 });
        if (live.html) { html = live.html; source = "live"; }
      }
      if (!html && demo.generated_html) { html = demo.generated_html; source = "stored_html"; }
    }
  }

  if (!html) {
    return json({ error: "No content to score: supply html_content, or a demo_id whose site is reachable / has generated_html" }, 400);
  }

  const result = (await scoreWithAI(html, facts)) ?? heuristicScore(html, facts);
  const record = await writeScoreRow(supabase, {
    demo_id: demo_id ?? null,
    lead_id: lead_id ?? demo?.lead_id ?? null,
    result,
    pass_number: 1,
    source,
  });

  if (demo_id) await writeDemoSiteAudit(supabase, demo_id, { result, passes: 1, source });

  return json({
    success: true,
    score_id: record.id,
    overall_score: result.overall_score,
    threshold: PASS_THRESHOLD,
    passed: result.overall_score >= PASS_THRESHOLD,
    flagged: result.overall_score < PASS_THRESHOLD,
    allow_send: true,
    scored_by: result.scored_by,
    source,
    dimension_scores: result.dimension_scores,
    issues: result.issues,
  });
}

// deno-lint-ignore no-explicit-any
async function loadFacts(supabase: any, demo: any): Promise<BusinessFacts> {
  let lead = null;
  if (demo?.lead_id) {
    const { data } = await supabase
      .from("brandaro_qualified_leads")
      .select("business_name, city, state, phone, industry, services_inferred")
      .eq("id", demo.lead_id)
      .maybeSingle();
    lead = data;
  }
  return {
    business_name: lead?.business_name ?? demo?.business_name ?? null,
    city: lead?.city ?? demo?.city ?? null,
    state: lead?.state ?? demo?.state ?? null,
    phone: lead?.phone ?? null,
    industry: lead?.industry ?? demo?.industry ?? null,
    services: lead?.services_inferred ?? demo?.services_inferred ?? null,
  };
}

// ---------------------------------------------------------------------------
// Action: score_and_fix (audit -> regenerate copy -> redeploy -> re-audit)
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function handleScoreAndFix(supabase: any, body: any) {
  const { demo_id } = body;
  if (!demo_id) return json({ error: "demo_id required" }, 400);

  const maxPasses = Math.min(Number(body.max_passes) || MAX_PASSES, MAX_PASSES);
  const liveAttempts = Number(body.live_attempts) || LIVE_FETCH_ATTEMPTS;
  const liveDelay = Number(body.live_delay_ms) || LIVE_FETCH_DELAY_MS;

  const { data: demo, error: demoErr } = await supabase
    .from("brandaro_demo_sites").select("*").eq("id", demo_id).maybeSingle();
  if (demoErr || !demo) return json({ error: `Demo ${demo_id} not found` }, 404);

  const facts = await loadFacts(supabase, demo);
  const passes: Array<Record<string, unknown>> = [];
  // deno-lint-ignore no-explicit-any
  let content: any = demo.content_blocks ?? null;
  let lastResult: ScoreResult | null = null;
  let lastSource = "unknown";
  let fixesApplied: unknown = null;
  // Set once a connection-level (TLS/DNS) failure proves the domain is
  // misconfigured — later passes skip the live fetch entirely.
  let liveFetchPermanentError: string | null = null;

  for (let pass = 1; pass <= maxPasses; pass++) {
    // --- acquire content: live site first, stored HTML as the safety net ---
    let html: string | null = null;
    let source = "stored_html";
    if (demo.demo_url && !liveFetchPermanentError) {
      const live = await fetchLiveHtml(demo.demo_url, { attempts: liveAttempts, delayMs: liveDelay });
      if (live.html) { html = live.html; source = "live"; }
      else if (live.permanent) {
        liveFetchPermanentError = live.error ?? "permanent fetch error";
        console.warn(`[audit] live fetch permanently unavailable for ${demo.demo_url} (${liveFetchPermanentError}) — skipping live fetch for remaining passes`);
      } else {
        console.warn(`[audit] live fetch exhausted for ${demo.demo_url} (${live.error}) — using stored HTML`);
      }
    } else if (liveFetchPermanentError) {
      console.warn(`[audit] skipping live fetch (${liveFetchPermanentError})`);
    }

    if (!html) html = demo.generated_html ?? null;
    if (!html) {
      return json({ error: "No live site and no stored generated_html to audit", passes }, 422);
    }

    // --- score ---
    const result = (await scoreWithAI(html, facts)) ?? heuristicScore(html, facts);
    lastResult = result;
    lastSource = source;

    const row = await writeScoreRow(supabase, {
      demo_id,
      lead_id: demo.lead_id,
      result,
      pass_number: pass,
      source,
      fixes_applied: pass > 1 ? fixesApplied : null,
    });

    passes.push({
      pass_number: pass,
      score_id: row.id,
      overall_score: result.overall_score,
      scored_by: result.scored_by,
      source,
      issues_count: result.issues.length,
    });

    console.log(`[audit] demo ${demo_id} pass ${pass}: ${result.overall_score}/${PASS_THRESHOLD} (${result.scored_by}, ${source})`);

    if (result.overall_score >= PASS_THRESHOLD) break;
    if (pass >= maxPasses) {
      console.warn(`[audit] demo ${demo_id} still ${result.overall_score} after ${pass} passes — capped, no further fixes`);
      break;
    }

    // --- fix: regenerate copy with the auditor's issues as corrective input ---
    const fixable = result.issues.filter((i) => i.fixable);
    if (!fixable.length) {
      console.warn(`[audit] demo ${demo_id} below threshold but no fixable issues — stopping`);
      passes[passes.length - 1].fix_skipped = "no_fixable_issues";
      break;
    }

    const regenerated = await regenerateContent(content, facts, fixable);
    if (!regenerated) {
      passes[passes.length - 1].fix_skipped = "regeneration_failed";
      break;
    }
    content = regenerated;

    // Persist the corrected copy, then redeploy through the same env-var + hook path.
    await supabase.from("brandaro_demo_sites").update({
      content_blocks: content,
      seo_text: content.about_paragraph ?? demo.seo_text,
      generated_colors: {
        primary: content.color_primary, secondary: content.color_secondary,
        font: content.font_recommendation,
      },
    }).eq("id", demo_id);

    const vercel = await tryVercelHook(supabase, demo.template_used || demo.industry, {
      demo_id,
      slug: demo.slug,
      industry: demo.template_used || demo.industry,
      business_name: demo.business_name,
      demo_url: demo.demo_url,
      city: demo.city,
      phone: facts.phone,
      hero_headline: content.hero_headline,
      hero_sub: content.hero_subheadline,
      cta_text: content.cta_text,
      color_primary: content.color_primary,
      color_secondary: content.color_secondary,
      services: content.services,
      about_text: content.about_paragraph,
      reviews: null,
      photos: null,
      logo_url: demo.logo_url ?? null,
    });

    fixesApplied = {
      pass: pass + 1,
      addressed_issues: fixable.map((i) => ({ dimension: i.dimension, severity: i.severity, description: i.description })),
      regenerated_fields: ["hero_headline", "hero_subheadline", "services", "about_paragraph", "cta_text", "colors"],
      redeploy: { ok: vercel.ok, status: vercel.status, error: vercel.error, env_failed: vercel.env_failed },
    };
    passes[passes.length - 1].fix = fixesApplied;

    if (!vercel.ok) {
      console.error(`[audit] redeploy failed for demo ${demo_id}: ${vercel.error} — re-scoring anyway`);
    }
  }

  const breakdown = lastResult
    ? await writeDemoSiteAudit(supabase, demo_id, {
        result: lastResult, passes: passes.length, source: lastSource, fixes_applied: fixesApplied,
      })
    : null;

  return json({
    success: true,
    demo_id,
    threshold: PASS_THRESHOLD,
    overall_score: lastResult?.overall_score ?? null,
    passed: (lastResult?.overall_score ?? 0) >= PASS_THRESHOLD,
    scored_by: lastResult?.scored_by ?? null,
    source: lastSource,
    live_fetch_error: liveFetchPermanentError,

    passes,
    dimension_scores: lastResult?.dimension_scores ?? null,
    issues: lastResult?.issues ?? [],
    audit_breakdown: breakdown,
  });
}

/**
 * Ask the model to rewrite the demo's copy, given the previous copy and the
 * specific issues the auditor raised. Returns the same AiContent shape the
 * generator produces so the env-var sync is unchanged.
 */
async function regenerateContent(
  // deno-lint-ignore no-explicit-any
  previous: any,
  facts: BusinessFacts,
  issues: Issue[],
  // deno-lint-ignore no-explicit-any
): Promise<any | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a senior web copywriter fixing a failed quality audit for a small-business website. " +
              "Rewrite the site copy so every listed issue is resolved. Keep all facts accurate to the real business data — never invent services, awards, years in business, or contact details. " +
              "Return ONLY valid JSON matching the schema, no prose, no markdown fences.",
          },
          {
            role: "user",
            content:
              `REAL BUSINESS DATA:\n${JSON.stringify(facts, null, 2)}\n\n` +
              `CURRENT COPY:\n${JSON.stringify(previous ?? {}, null, 2)}\n\n` +
              `AUDIT ISSUES TO FIX:\n${issues.map((i) => `- [${i.severity}] ${i.dimension}: ${i.description}`).join("\n")}\n\n` +
              `Return JSON:\n{\n  "hero_headline": "string (concise, local, 10 words max)",\n  "hero_subheadline": "string (1 sentence, benefit-driven)",\n  "services": [{"name":"string","description":"1-sentence value prop"}],\n  "about_paragraph": "string (2-3 sentences, warm + trustworthy)",\n  "cta_text": "string (2-4 words, action verb)",\n  "color_primary": "#hex",\n  "color_secondary": "#hex",\n  "font_recommendation": "string"\n}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.error(`[audit] regeneration failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.hero_headline) return null;
    return parsed;
  } catch (e) {
    console.error("[audit] regeneration error:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Action: batch_score (heuristic backfill)
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function handleBatchScore(supabase: any) {
  const { data: demos } = await supabase
    .from("brandaro_qualified_leads")
    .select("id, business_name, city, state, phone, industry, demo_html")
    .eq("demo_status", "completed")
    .not("demo_html", "is", null)
    .limit(20);

  let scored = 0;
  for (const demo of (demos || [])) {
    const { data: existing } = await supabase
      .from("brandaro_demo_quality_scores")
      .select("id")
      .eq("lead_id", demo.id)
      .limit(1);

    if (existing && existing.length > 0) continue;

    const result = heuristicScore(demo.demo_html, {
      business_name: demo.business_name, city: demo.city, state: demo.state,
      phone: demo.phone, industry: demo.industry,
    });

    await writeScoreRow(supabase, {
      lead_id: demo.id,
      result,
      pass_number: 1,
      source: "lead_demo_html",
    });

    scored++;
  }

  return json({ success: true, demos_scored: scored, threshold: PASS_THRESHOLD });
}

// ---------------------------------------------------------------------------
// Phase 14: Design Learning
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function handleDesignInsights(supabase: any) {
  const { data: closedDeals } = await supabase
    .from("brandaro_close_pipeline")
    .select("*, brandaro_demo_quality_scores:brandaro_demo_quality_scores(design_score, uniqueness_score, conversion_score)")
    .eq("stage", "closed")
    .gt("revenue_amount", 0)
    .order("revenue_amount", { ascending: false })
    .limit(50);

  const patterns = {
    avg_design_score: 0,
    avg_conversion_score: 0,
    top_colors: [] as string[],
    top_layouts: [] as string[],
    top_cta_styles: [] as string[],
    total_revenue: 0,
    deal_count: 0,
  };

  for (const deal of (closedDeals || [])) {
    patterns.deal_count++;
    patterns.total_revenue += deal.revenue_amount || 0;
    if (deal.design_colors) patterns.top_colors.push(...deal.design_colors);
    if (deal.design_layout) patterns.top_layouts.push(deal.design_layout);
    if (deal.design_cta_style) patterns.top_cta_styles.push(deal.design_cta_style);
  }

  return json({ success: true, insights: patterns });
}
