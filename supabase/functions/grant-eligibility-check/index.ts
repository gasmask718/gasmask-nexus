// grant-eligibility-check — DEPRECATED (Dynasty Capital Phase 4)
//
// Superseded by `grant-eligibility-checker`, which is the richer engine and the
// single source of eligibility truth. Both engines used to key results off two
// different identities (funding_clients vs grant_business_profiles); the Phase 4
// identity bridge collapsed that onto the funding client.
//
// All in-repo callers were migrated to `grant-eligibility-checker` with
// { funding_client_id }. This shim stays deployed only so any out-of-repo caller
// gets a clear, actionable failure instead of silently stale results.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireGrantsStaff, grantsAuthResponse } from "../_shared/grantsAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  // Authorization is still enforced so this endpoint never leaks its existence
  // or behaviour to unauthenticated / unauthorized callers.
  const auth = await requireGrantsStaff(req);
  if (!auth.ok) return grantsAuthResponse(auth, corsHeaders);

  return new Response(
    JSON.stringify({
      error: "deprecated",
      message:
        "grant-eligibility-check is deprecated. Call grant-eligibility-checker with { funding_client_id } (or { business_profile_id }).",
      replacement: "grant-eligibility-checker",
      eligible_count: 0,
    }),
    { status: 410, headers: jsonHeaders },
  );
});
