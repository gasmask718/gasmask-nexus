// Pipeline Step 15 — Pro / Custom tier client site provisioning.
//
// Starter tier auto-builds through Durable and goes live (Step 14). Pro and
// Custom instead get their OWN dedicated, isolated Vercel project (not one of
// the 16 shared industry demo projects), built from gasmask718/brandaro-base
// and personalized with the client's intake answers.
//
// The result is deployed but deliberately NOT promoted: the build job lands in
// build_status = 'review' so a dev checks it on /brandaro/builder and flips it
// to 'live' with the existing Update Status dropdown.
//
// Invoked service-to-service from brandaro-intake. Idempotent by
// vercel_project_id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { upsertVercelEnvVar } from "../_shared/vercelDeploy.ts";
import { advanceClientStatus } from "../_shared/brandaroClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TEMPLATE_REPO = "gasmask718/brandaro-base";
const LOGO_SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 year — the site reads it at build time.

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

function slugify(v: string): string {
  return (v || "client")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "client";
}

/** Vercel env vars are strings — objects/arrays must be serialized, empties dropped. */
function asJson(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v) && v.length === 0) return null;
  if (typeof v === "string") return v.trim() ? v : null;
  try {
    return JSON.stringify(v);
  } catch {
    return null;
  }
}

async function createVercelProject(token: string, name: string) {
  const res = await fetch("https://api.vercel.com/v10/projects", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      framework: "vite",
      gitRepository: { type: "github", repo: TEMPLATE_REPO },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Vercel project create ${res.status}: ${text.slice(0, 400)}`);
  const body = JSON.parse(text);
  return { id: body.id as string, name: (body.name as string) ?? name };
}

async function deployProject(token: string, projectName: string) {
  const res = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: projectName,
      target: "production",
      gitSource: { type: "github", repo: TEMPLATE_REPO, ref: "main" },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Vercel deploy ${res.status}: ${text.slice(0, 400)}`);
  const body = JSON.parse(text);
  const id = (body.id ?? body.uid ?? null) as string | null;
  const url = body.url ? `https://${body.url}` : null;
  return { id, url };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = svc();
  let jobId = "";

  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    jobId = String(body?.build_job_id ?? "").trim();
    if (!jobId) return json({ error: "build_job_id is required." }, 400);

    const { data: job, error: jobErr } = await supabase
      .from("brandaro_build_jobs")
      .select("id, demo_id, client_id, package_tier, intake_data, logo_storage_path, vercel_project_id, build_status")
      .eq("id", jobId)
      .maybeSingle();
    if (jobErr) throw new Error(jobErr.message);
    if (!job) return json({ error: "Build job not found." }, 404);

    const tier = (job.package_tier ?? "").toLowerCase();
    if (tier !== "pro" && tier !== "custom") {
      return json({ skipped: true, reason: `tier "${tier || "unknown"}" is not pro/custom` });
    }
    if (job.vercel_project_id) {
      return json({ skipped: true, reason: "already provisioned", vercel_project_id: job.vercel_project_id });
    }

    const token = Deno.env.get("VERCEL_API_TOKEN");
    if (!token) throw new Error("VERCEL_API_TOKEN is not configured.");

    // ---- Source content: demo row as the base, intake answers win ----
    const { data: demo } = await supabase
      .from("brandaro_demo_sites")
      .select("business_name, industry, city, phone_e164, logo_url, generated_colors, content_blocks, services_inferred, seo_text, reviews, google_data")
      .eq("id", job.demo_id)
      .maybeSingle();

    const intake = (job.intake_data ?? {}) as Record<string, any>;
    const content = (demo?.content_blocks ?? {}) as Record<string, any>;
    const demoColors = (demo?.generated_colors ?? {}) as Record<string, any>;
    const intakeColors = (intake.colors ?? {}) as Record<string, any>;

    const businessName = String(intake.business_name || demo?.business_name || "Client").trim();

    // Client-uploaded logo (private bucket) beats the demo's generated logo.
    let logoUrl: string | null = demo?.logo_url ?? null;
    if (job.logo_storage_path) {
      const { data: signed, error: signErr } = await supabase.storage
        .from("brandaro-logos")
        .createSignedUrl(job.logo_storage_path, LOGO_SIGNED_URL_TTL);
      if (signErr) console.warn("[provision] logo sign failed:", signErr.message);
      else if (signed?.signedUrl) logoUrl = signed.signedUrl;
    }

    await supabase.from("brandaro_build_jobs").update({
      build_status: "building",
      progress_stage: "provisioning_vercel_project",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);

    // ---- 1) Dedicated, isolated Vercel project for this paying client ----
    const projectName = `brandaro-${slugify(businessName)}-${job.id.slice(0, 8)}`;
    const project = await createVercelProject(token, projectName);
    await supabase.from("brandaro_build_jobs").update({
      vercel_project_id: project.id,
      progress_stage: "syncing_env_vars",
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);

    // ---- 2) Personalization via production env vars (proven demo path) ----
    const envVars: Record<string, string> = {
      VITE_BUSINESS_NAME: businessName,
      VITE_BUSINESS_CITY: demo?.city ?? "",
      VITE_BUSINESS_PHONE: (demo as any)?.phone_e164 ?? "",
      VITE_HERO_HEADLINE: content.hero_headline ?? "",
      VITE_HERO_SUB: content.hero_subheadline ?? "",
      VITE_CTA_TEXT: content.cta_text ?? "",
      VITE_COLOR_PRIMARY: intakeColors.primary ?? demoColors.primary ?? content.color_primary ?? "",
      VITE_COLOR_SECONDARY: intakeColors.secondary ?? demoColors.secondary ?? content.color_secondary ?? "",
      VITE_DEMO_SLUG: slugify(businessName),
    };

    const envSkipped: string[] = [];
    const optional: Record<string, string | null> = {
      VITE_SERVICES_JSON: asJson(content.services ?? demo?.services_inferred),
      VITE_ABOUT_TEXT: asJson(content.about_paragraph ?? demo?.seo_text),
      VITE_REVIEWS_JSON: asJson(demo?.reviews),
      VITE_PHOTOS_JSON: asJson((demo?.google_data as any)?.photos),
      VITE_LOGO_URL: asJson(logoUrl),
      VITE_CONTENT_NOTES: asJson(intake.content_notes),
    };
    for (const [key, value] of Object.entries(optional)) {
      if (value) envVars[key] = value;
      else envSkipped.push(key);
    }

    const envResults = [];
    for (const [key, value] of Object.entries(envVars)) {
      const result = await upsertVercelEnvVar(token, project.id, key, value);
      envResults.push(result);
      if (!result.ok) console.error(`[provision] env "${key}" failed: ${result.error}`);
    }
    const envFailed = envResults.filter((r) => !r.ok).map((r) => r.key);

    // ---- 3) Deploy (new projects have no deploy hook) ----
    const deployment = await deployProject(token, project.name);

    // ---- 4) Hold at review — never auto-published ----
    const nowIso = new Date().toISOString();
    const { error: finalErr } = await supabase.from("brandaro_build_jobs").update({
      vercel_deployment_id: deployment.id,
      preview_url: deployment.url,
      build_status: "review",
      progress_stage: "awaiting_dev_review",
      review_requested_at: nowIso,
      updated_at: nowIso,
    }).eq("id", job.id);
    if (finalErr) console.error("[provision] final persist failed:", finalErr.message);

    // Canonical client record follows the build: a deployed draft awaiting dev
    // review is 'draft_ready'. Never regresses a further-along client.
    if (job.client_id) await advanceClientStatus(supabase, job.client_id, "draft_ready");

    console.log(`[provision] job ${job.id} -> project ${project.id}, deployment ${deployment.id}, awaiting review`);

    return json({
      success: true,
      build_job_id: job.id,
      vercel_project_id: project.id,
      vercel_deployment_id: deployment.id,
      preview_url: deployment.url,
      build_status: "review",
      env_failed: envFailed,
      env_skipped: envSkipped,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[brandaro-provision-client-site] failed:", message);
    if (jobId) {
      await supabase.from("brandaro_build_jobs").update({
        build_status: "failed",
        progress_stage: "provision_failed",
        error_log: { stage: "provision_client_site", message: message.slice(0, 1000), at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);
    }
    return json({ error: message }, 500);
  }
});
