import { corsHeaders } from "../_shared/dialer.ts";
const SUPA = Deno.env.get("SUPABASE_URL")!;
async function sign(token: string, url: string, p: Record<string,string>) {
  let d = url; for (const k of Object.keys(p).sort()) d += k + p[k];
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(token), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(d));
  return btoa(String.fromCharCode(...new Uint8Array(s)));
}
async function hook(path: string, p: Record<string,string>) {
  const token = Deno.env.get("TWILIO_WEBHOOK_AUTH_TOKEN") || Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  const url = `${SUPA}/functions/v1/${path}`;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Twilio-Signature": await sign(token, url, p) }, body: new URLSearchParams(p).toString() });
  return { path, status: res.status, twiml: await res.text() };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const b = await req.json().catch(() => ({}));
  const scenario = b.scenario || "no_answer";
  const sid = b.call_sid || `CAselftest${Date.now()}`;
  const from = b.from || "+15550001111", to = b.to || "+19298225712";
  const steps: unknown[] = [];
  steps.push(await hook("gasmask-inbound-voice", { CallSid: sid, From: from, To: to, AccountSid: "ACselftest", Direction: "inbound" }));
  if (scenario === "answered") {
    steps.push(await hook("gasmask-call-dial-complete?next=voicemail", { CallSid: sid, From: from, To: to, DialCallStatus: "completed", DialCallDuration: "42", DialCallSid: "CDselftest" }));
  } else {
    const s2 = await hook("gasmask-call-dial-complete?next=voicemail", { CallSid: sid, From: from, To: to, DialCallStatus: "no-answer", DialCallDuration: "0" });
    steps.push(s2);
    const m = /<Redirect[^>]*>([^<]+)<\/Redirect>/.exec(s2.twiml);
    if (m) {
      const rp = m[1].replace(`${SUPA}/functions/v1/`, "").replace(/&amp;/g, "&");
      const s3 = await hook(rp, { CallSid: sid, From: from, To: to, AccountSid: "ACselftest", Direction: "inbound" });
      steps.push(s3);
      const a = /action="([^"]+gasmask-missed-call-handler[^"]*)"/.exec(s3.twiml);
      if (a) steps.push(await hook(a[1].replace(`${SUPA}/functions/v1/`, "").replace(/&amp;/g, "&"), { CallSid: sid, From: from, To: to, DialCallStatus: "no-answer", DialCallDuration: "0" }));
    }
  }
  return new Response(JSON.stringify({ scenario, call_sid: sid, steps }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
