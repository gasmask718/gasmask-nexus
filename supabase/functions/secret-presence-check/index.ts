// Diagnostic: reports presence + length of specific secrets, never the value.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KEYS = ["GASMASK_DNC_TOOL_SECRET", "DC_BLAND_WEBHOOK_SECRET"];

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const report = KEYS.map((k) => {
    const v = Deno.env.get(k);
    return {
      key: k,
      present: typeof v === "string" && v.length > 0,
      length: v ? v.length : 0,
      preview: v ? `${v.slice(0, 2)}…${v.slice(-2)}` : null,
    };
  });
  return new Response(JSON.stringify({ ok: true, report }, null, 2), {
    headers: { ...CORS, "content-type": "application/json" },
  });
});
