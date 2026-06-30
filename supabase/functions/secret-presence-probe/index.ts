// Temporary probe: reports edge-runtime presence + length of named secrets.
// Never returns values. DELETE after diagnostic completes.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NAMES = ['GASMASK_DNC_TOOL_SECRET', 'DC_BLAND_WEBHOOK_SECRET'];

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const out = NAMES.map((n) => {
    const v = Deno.env.get(n);
    return {
      name: n,
      present: typeof v === 'string' && v.length > 0,
      length: v ? v.length : 0,
    };
  });
  return new Response(JSON.stringify({ ok: true, secrets: out }, null, 2), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
