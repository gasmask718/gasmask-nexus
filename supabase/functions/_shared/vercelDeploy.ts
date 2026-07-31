/**
 * Shared Vercel delivery for Brandaro demos.
 *
 * Architecture: 16 separate Vercel projects, one per industry. Personalization
 * is delivered as production env vars (VITE_*) via the REST API, then the
 * industry's deploy hook is fired so the build picks them up. Only one demo is
 * "live" per industry at a time — the newest generation overwrites the last.
 *
 * Extracted from brandaro-generate-demo so brandaro-score-demo's auto-fix loop
 * can redeploy through the exact same path (no copy-paste divergence).
 */

export const VERCEL_ENV_TARGET = ["production"];

export interface EnvVarResult {
  key: string;
  ok: boolean;
  action: "created" | "updated" | "failed";
  status?: number;
  error?: string;
}

export interface VercelDeployPayload {
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
}

export interface VercelDeployResult {
  ok: boolean;
  skipped?: boolean;
  status?: number;
  error?: string;
  repo?: string;
  project_id?: string;
  env_vars?: EnvVarResult[];
  env_failed?: string[];
  env_skipped?: string[];
}

export async function upsertVercelEnvVar(
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

/**
 * Push personalization env vars into the industry's Vercel project, then fire
 * its deploy hook. Non-fatal by design: a failed env var never blocks the
 * remaining vars or the hook.
 */
export async function tryVercelHook(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  industry: string,
  payload: VercelDeployPayload,
): Promise<VercelDeployResult> {
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

  const envResults: EnvVarResult[] = [];
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
