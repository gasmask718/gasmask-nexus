// TEMPORARY diagnostic — lists verified sender identities at Resend/SendGrid.
// No emails are sent. Delete after use.
Deno.serve(async () => {
  const out: Record<string, unknown> = {};
  const rk = Deno.env.get("RESEND_API_KEY");
  if (rk) {
    const r = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${rk}` },
    });
    out.resend = { status: r.status, body: (await r.text()).slice(0, 1000) };
  } else out.resend = "no key";

  const sk = Deno.env.get("SENDGRID_API_KEY");
  if (sk) {
    const s = await fetch("https://api.sendgrid.com/v3/verified_senders", {
      headers: { Authorization: `Bearer ${sk}` },
    });
    const d = await fetch("https://api.sendgrid.com/v3/whitelabel/domains", {
      headers: { Authorization: `Bearer ${sk}` },
    });
    out.sendgrid_senders = { status: s.status, body: (await s.text()).slice(0, 1000) };
    out.sendgrid_domains = { status: d.status, body: (await d.text()).slice(0, 1000) };
  } else out.sendgrid = "no key";

  return new Response(JSON.stringify(out, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
