// Shared server-side authorization for Funding Hub edge functions.
// These functions run with the service role key (RLS bypass), so they MUST
// validate the caller's JWT and role in code. Without this, any authenticated
// user could reach client PII and funding data by calling the function URL
// directly, bypassing the frontend RequireRole guard.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export type FundingAuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string };

/**
 * Validates the bearer token and confirms the caller is funding staff via
 * public.is_funding_staff(). Service-role callers (cron, internal calls) pass.
 */
export async function requireFundingStaff(req: Request): Promise<FundingAuthResult> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  const token = authHeader.slice("Bearer ".length).trim();

  if (token === SERVICE_KEY) return { ok: true, userId: "service_role" };

  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // getClaims() THROWS on a structurally invalid JWT. Unhandled, a forged
  // token produced a 500 instead of a clean 401.
  let userId: string | undefined;
  try {
    const { data, error } = await authClient.auth.getClaims(token);
    if (error) return { ok: false, status: 401, error: "unauthorized" };
    userId = data?.claims?.sub as string | undefined;
  } catch {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  if (!userId) return { ok: false, status: 401, error: "unauthorized" };


  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: allowed, error: roleErr } = await admin.rpc("is_funding_staff", {
    _user_id: userId,
  });
  if (roleErr) return { ok: false, status: 500, error: "role_check_failed" };
  if (allowed !== true) return { ok: false, status: 403, error: "forbidden" };

  return { ok: true, userId };
}

export function fundingAuthResponse(
  result: Extract<FundingAuthResult, { ok: false }>,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ error: result.error }), {
    status: result.status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
