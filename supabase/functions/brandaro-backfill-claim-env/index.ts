/**
 * brandaro-backfill-claim-env
 *
 * Backfills the six claim-CTA env vars onto the existing per-industry Vercel
 * projects, for demos that were generated BEFORE syncVercelEnv learned to push
 * them. A plain deploy-hook re-fire can never do this: hooks only trigger a
 * build against whatever env already exists on the project.
 *
 * Deliberately narrow: it writes ONLY the claim keys, never the personalization
 * keys. The live projects already hold correct personalization from their
 * generation run, and this function has no reliable source for hero/CTA copy
 * (those live in content_blocks, not columns) — rewriting them from partial data
 * would blank out good content.
 *
 * Which demo a project is currently serving is resolved from the project's own
 * VITE_DEMO_SLUG env var (the ground truth of what is deployed), falling back to
 * the newest demo row for that industry.
 */
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { upsertVercelEnvVar, resolveDeploymentId, type EnvVarResult } from '../_shared/vercelDeploy.ts';

const CLAIM_KEYS = [
  'VITE_DEMO_ID',
  'VITE_CHECKOUT_URL',
  'VITE_PURCHASE_STATUS_URL',
  'VITE_CHECKOUT_CONFIRM_URL',
  'VITE_CLAIM_TIERS_JSON',
  'VITE_CLAIM_ENABLED',
] as const;

const TIER_LABELS: Record<string, string> = { starter: 'Starter', pro: 'Pro', custom: 'Custom' };

interface IndustryResult {
  industry: string;
  project_id?: string | null;
  status: 'synced' | 'skipped' | 'failed' | 'dry_run';
  reason?: string;
  demo_id?: string | null;
  demo_slug?: string | null;
  slug_source?: 'vercel_env' | 'newest_demo';
  env_vars?: EnvVarResult[];
  env_failed?: string[];
  hook_status?: number;
  deployment_id?: string | null;
  would_write?: Record<string, string>;
}

async function readProjectEnv(
  token: string,
  projectId: string,
): Promise<{ ok: boolean; vars: Record<string, string>; error?: string }> {
  try {
    const res = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env?decrypt=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ok: false, vars: {}, error: `env list ${res.status}: ${(await res.text()).slice(0, 200)}` };
    const json = await res.json();
    const vars: Record<string, string> = {};
    for (const e of (json?.envs ?? []) as Array<{ key: string; value?: string; target?: string[] }>) {
      if ((e.target ?? []).includes('production') && typeof e.value === 'string') vars[e.key] = e.value;
    }
    return { ok: true, vars };
  } catch (e) {
    return { ok: false, vars: {}, error: e instanceof Error ? e.message : 'env read failed' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch { /* no body = backfill all, live */ }

    const dryRun = body.dry_run === true;
    const fireHook = body.fire_hook !== false; // default: yes, rebuild so the vars take effect
    const onlyIndustries = Array.isArray(body.industries)
      ? (body.industries as unknown[]).map(String)
      : null;

    const token = Deno.env.get('VERCEL_API_TOKEN');
    if (!token) return json({ error: 'VERCEL_API_TOKEN is not configured' }, 500);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // ---- Shared claim payload: tier pricing is identical across industries ----
    const stripeMode = Deno.env.get('STRIPE_MODE') === 'live' ? 'live' : 'test';
    const { data: tierRows, error: tierErr } = await supabase
      .from('brandaro_stripe_config')
      .select('tier, amount_cents')
      .eq('mode', stripeMode)
      .in('tier', ['starter', 'pro', 'custom']);
    if (tierErr) return json({ error: `Stripe tier lookup failed: ${tierErr.message}` }, 500);

    const claimTiers = ['starter', 'pro', 'custom']
      .map((t) => {
        const row = (tierRows ?? []).find((r: { tier: string }) => r.tier === t);
        return row ? { tier: t, label: TIER_LABELS[t], amount_cents: row.amount_cents ?? null } : null;
      })
      .filter(Boolean) as Array<{ tier: string; label: string; amount_cents: number | null }>;

    // Never push a live CTA with no prices behind it — that is how a stale demo
    // takes a real payment against a fake reference.
    if (claimTiers.length === 0) {
      return json({ error: `No ${stripeMode}-mode rows in brandaro_stripe_config — refusing to enable the claim CTA` }, 400);
    }

    const supaUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const globallyEnabled = Deno.env.get('BRANDARO_CLAIM_ENABLED') !== '0';

    // ---- Target projects ----
    const { data: templates, error: tplErr } = await supabase
      .from('brandaro_demo_templates')
      .select('industry, vercel_project_id, vercel_deploy_hook_url')
      .eq('is_active', true);
    if (tplErr) return json({ error: `Template lookup failed: ${tplErr.message}` }, 500);

    const targets = (templates ?? []).filter(
      (t: { industry: string }) => !onlyIndustries || onlyIndustries.includes(t.industry),
    );

    const results: IndustryResult[] = [];

    for (const tpl of targets as Array<{ industry: string; vercel_project_id: string | null; vercel_deploy_hook_url: string | null }>) {
      const industry = tpl.industry;

      if (!tpl.vercel_project_id) {
        results.push({ industry, status: 'skipped', reason: 'no vercel_project_id on template' });
        continue;
      }

      // Which demo is this project actually serving right now?
      const current = await readProjectEnv(token, tpl.vercel_project_id);
      if (!current.ok) {
        results.push({ industry, project_id: tpl.vercel_project_id, status: 'failed', reason: current.error });
        continue;
      }

      const deployedSlug = current.vars.VITE_DEMO_SLUG?.trim() || null;
      let demo: { id: string; slug: string | null } | null = null;
      let slugSource: 'vercel_env' | 'newest_demo' = 'vercel_env';

      if (deployedSlug) {
        const { data } = await supabase
          .from('brandaro_demo_sites')
          .select('id, slug')
          .eq('slug', deployedSlug)
          .maybeSingle();
        demo = data ?? null;
      }
      if (!demo) {
        slugSource = 'newest_demo';
        const { data } = await supabase
          .from('brandaro_demo_sites')
          .select('id, slug')
          .eq('industry', industry)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        demo = data ?? null;
      }

      if (!demo?.id) {
        results.push({
          industry,
          project_id: tpl.vercel_project_id,
          status: 'skipped',
          reason: deployedSlug
            ? `deployed slug "${deployedSlug}" has no matching demo row and industry has no demos`
            : 'no demo row for this industry',
        });
        continue;
      }

      const envVars: Record<string, string> = {
        VITE_DEMO_ID: demo.id,
        VITE_CHECKOUT_URL: `${supaUrl}/functions/v1/demo-stripe-checkout`,
        VITE_PURCHASE_STATUS_URL: `${supaUrl}/functions/v1/demo-purchase-status`,
        VITE_CHECKOUT_CONFIRM_URL: `${supaUrl}/functions/v1/demo-purchase-status`,
        VITE_CLAIM_TIERS_JSON: JSON.stringify(claimTiers),
        VITE_CLAIM_ENABLED: globallyEnabled ? '1' : '0',
      };

      if (dryRun) {
        results.push({
          industry,
          project_id: tpl.vercel_project_id,
          status: 'dry_run',
          demo_id: demo.id,
          demo_slug: demo.slug,
          slug_source: slugSource,
          would_write: envVars,
          reason: CLAIM_KEYS.filter((k) => !(k in current.vars)).join(', ') || 'all claim keys already present (values will be refreshed)',
        });
        continue;
      }

      // Sequential + non-fatal, same contract as the generation path.
      const envResults: EnvVarResult[] = [];
      for (const [key, value] of Object.entries(envVars)) {
        const r = await upsertVercelEnvVar(token, tpl.vercel_project_id, key, value);
        envResults.push(r);
        if (!r.ok) console.error(`[backfill] ${industry} env "${key}" failed: ${r.error}`);
      }
      const envFailed = envResults.filter((r) => !r.ok).map((r) => r.key);

      const entry: IndustryResult = {
        industry,
        project_id: tpl.vercel_project_id,
        status: envFailed.length === envResults.length ? 'failed' : 'synced',
        demo_id: demo.id,
        demo_slug: demo.slug,
        slug_source: slugSource,
        env_vars: envResults,
        env_failed: envFailed,
      };

      // Env vars are build-time in Vite — without a rebuild the live site keeps
      // serving the old bundle and its hardcoded fallback.
      if (fireHook && entry.status === 'synced') {
        if (!tpl.vercel_deploy_hook_url) {
          entry.reason = 'env synced but no deploy hook — site will not pick up the vars until its next build';
        } else {
          try {
            const firedAt = Date.now();
            const res = await fetch(tpl.vercel_deploy_hook_url, { method: 'POST' });
            entry.hook_status = res.status;
            if (!res.ok) entry.reason = `hook ${res.status}: ${(await res.text()).slice(0, 200)}`;
            else entry.deployment_id = await resolveDeploymentId(token, tpl.vercel_project_id, firedAt);
          } catch (e) {
            entry.reason = `hook failed: ${e instanceof Error ? e.message : 'request error'}`;
          }
        }
      }

      // Keep the deployment id fresh so expiry cleanup can still delete it.
      if (entry.deployment_id) {
        await supabase
          .from('brandaro_demo_sites')
          .update({ vercel_deployment_id: entry.deployment_id, vercel_project_id: tpl.vercel_project_id })
          .eq('id', demo.id);
      }

      results.push(entry);
    }

    const summary = {
      dry_run: dryRun,
      stripe_mode: stripeMode,
      claim_tiers: claimTiers,
      projects_considered: targets.length,
      synced: results.filter((r) => r.status === 'synced').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      failed: results.filter((r) => r.status === 'failed').length,
    };

    return json({ success: true, summary, results });
  } catch (e) {
    console.error('[brandaro-backfill-claim-env]', e);
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
