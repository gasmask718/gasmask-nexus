// Health-probe detection for Bland webhook endpoints.
//
// WHY THIS EXISTS
// ---------------
// `comms-health-monitor` liveness-checks the Bland webhook functions by POSTing
// a synthetic body to them. Those bodies were being persisted as real call rows
// in `dynasty_ai_calls` — 9,027 of 9,053 rows in that table were probes, not calls.
//
// THE IDENTIFIER (must be something a real Bland call can never match)
// -------------------------------------------------------------------
// 1. `healthcheck === true` — an explicit boolean the probe sets itself. Bland's
//    call payload schema has no `healthcheck` field at any nesting level; it is
//    ours, not theirs. This is the primary and authoritative signal.
// 2. `call_id` matching /^health_\d{10,}$/ — the probe's literal shape
//    ("health_" + Date.now()). Bland call ids are UUIDs, so a real call cannot
//    produce this string. This is a belt-and-braces fallback for probes emitted
//    by an older monitor build that predates the flag.
//
// Both are structural, not heuristic. A probe that drifts in shape fails BOTH
// checks and is then treated as a real call — loud and visible — rather than
// being silently swallowed by a loose filter.
export function isHealthProbe(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  if (p.healthcheck === true) return true;
  const id = p.call_id;
  return typeof id === "string" && /^health_\d{10,}$/.test(id);
}

export function healthProbeResponse(fn: string, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ ok: true, healthcheck: true, function: fn, persisted: false }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
