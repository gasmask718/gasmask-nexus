// TEMPORARY Stage 2 verification harness. Posts a synthetic Telegram delivery
// to sbo-telegram-intake using the real webhook secret, so the 23505 no-op path
// can be exercised end to end. DELETE after verification.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const body = await req.json();
  const secret = Deno.env.get("SBO_TELEGRAM_WEBHOOK_SECRET") ?? "";
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/sbo-telegram-intake`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": secret,
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return new Response(JSON.stringify({ status: res.status, body: text }), {
    headers: { "Content-Type": "application/json" },
  });
});
