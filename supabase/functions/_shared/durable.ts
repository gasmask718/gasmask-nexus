/**
 * Shared Durable API client.
 *
 * Single integration point for POST https://api.durable.co/v1/sites, used by:
 *   - brandaro-generate-demo   (pre-sale demo generation)
 *   - demo-stripe-webhook      (starter-tier REAL paid build, fully automated)
 *
 * Callbacks land on brandaro-durable-webhook, which routes by external_reference:
 *   "<uuid>"            -> brandaro_demo_sites row id
 *   "build_job:<uuid>"  -> brandaro_build_jobs row id
 */

export type DurableResult =
  | { ok: true; site_id: string; site_url?: string; screenshot_url?: string }
  | { ok: false; status: number; error: string };

export async function callDurable(payload: Record<string, unknown>): Promise<DurableResult> {
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

export const BUILD_JOB_REF_PREFIX = "build_job:";
