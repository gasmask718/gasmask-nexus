// TEMPORARY debug function — delete after use
Deno.serve(async () => {
  const key = Deno.env.get("RESEND_API_KEY");
  const r = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = await r.text();
  return new Response(JSON.stringify({ status: r.status, body }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
