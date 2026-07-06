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

/**
 * Check `x-webhook-secret` against a project env var.
 * Returns a 401 Response on failure, or null on success.
 */
export function webhookSecretCheck(req: Request, envVarName: string): Response | null {
  const provided = req.headers.get("x-webhook-secret") ?? "";
  const expected = Deno.env.get(envVarName) ?? "";
  if (!expected) {
    console.error(`[intake] ${envVarName} not configured on this project`);
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }
  if (!provided || !safeEqual(provided, expected)) {
    console.warn(`[intake] invalid or missing x-webhook-secret`);
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  return null;
}
