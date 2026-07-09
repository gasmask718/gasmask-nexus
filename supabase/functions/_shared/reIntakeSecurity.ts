// Shared security + CORS helpers for the Real Estate intake webhook.
// Reusable template for future business intake functions — copy this file,
// change the env-var name, keep everything else.

export const intakeCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-make-execution-id, x-idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...intakeCorsHeaders, "Content-Type": "application/json" },
  });
}

// Constant-time string compare to prevent timing attacks on the shared secret.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// NOTE: The old env-var-based `webhookSecretCheck(req, envVarName)` was removed
// on 2026-07-09. It carried a hardcoded fallback token that silently accepted
// requests when the Edge Function env var failed to propagate — a real risk
// given the confirmed secret-propagation bug in this project. All intake
// functions now use `webhookSecretCheckExpected` with a secret loaded from
// the DB config table (public.dd_ai_config). Do NOT reintroduce an env-var
// path or a hardcoded fallback here.

/**
 * Check `x-webhook-secret` against an explicit expected string (e.g. loaded
 * from the DB config table when Edge Function env vars don't propagate).
 */
export function webhookSecretCheckExpected(req: Request, expected: string | null): Response | null {
  if (!expected) {
    console.error("[intake] expected webhook secret not configured (DB lookup returned empty)");
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }
  const provided = req.headers.get("x-webhook-secret") ?? "";
  if (!provided || !safeEqual(provided, expected)) {
    console.warn("[intake] invalid or missing x-webhook-secret");
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  return null;
}
