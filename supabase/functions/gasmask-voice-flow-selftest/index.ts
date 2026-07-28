/**
 * GASMASK VOICE FLOW SELF-TEST (temporary diagnostic)
 *
 * Signs synthetic Twilio webhook requests server-side (using the account auth
 * token that never leaves the edge runtime) and replays the whole inbound flow:
 *   1. gasmask-inbound-voice          → disclosure + ring owner/VAs
 *   2. gasmask-call-dial-complete     → answered  OR  AI-agent fallback
 *   3. dc-inbound-call (AI agent leg) → Bland AI dial
 *   4. gasmask-missed-call-handler    → recovery SMS + voicemail tail
 *
 * Returns the raw TwiML of each step so the sequencing can be verified.
 */

import { corsHeaders } from "../_shared/dialer.ts";

const SUPA = Deno.env.get("SUPABASE_URL")!;

function hmacKey(token: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(token),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
}

async function twilioSignature(token: string, url: string, params: Record<string, string>) {
  let data = url;
  for (const k of Object.keys(params).sort()) data += k + params[k];
  const key = await hmacKey(token);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function callWebhook(path: string, params: Record<string, string>) {
  const token = Deno.env.get("TWILIO_WEBHOOK_AUTH_TOKEN") || Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  const url = `${SUPA}/functions/v1/${path}`;
  const sig = await twilioSignature(token, url, params);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": sig,
    },
    body: new URLSearchParams(params).toString(),
  });
  return { path, status: res.status, twiml: await res.text() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const scenario = body.scenario || "no_answer";
  const sid = body.call_sid || `CAselftest${Date.now()}`;
  const from = body.from || "+15550001111";
  const to = body.to || "+19298225712";

  const steps: unknown[] = [];

  // Step 1 — the single entry point
  steps.push(await callWebhook("gasmask-inbound-voice", {
    CallSid: sid, From: from, To: to, AccountSid: "ACselftest", Direction: "inbound",
  }));

  if (scenario === "answered") {
    steps.push(await callWebhook("gasmask-call-dial-complete?next=voicemail", {
      CallSid: sid, From: from, To: to,
      DialCallStatus: "completed", DialCallDuration: "42", DialCallSid: "CDselftest",
    }));
  } else {
    // Step 2 — nobody answered
    const s2 = await callWebhook("gasmask-call-dial-complete?next=voicemail", {
      CallSid: sid, From: from, To: to,
      DialCallStatus: "no-answer", DialCallDuration: "0",
    });
    steps.push(s2);

    // Step 3 — follow the redirect the fallback produced (the AI agent route)
    const m = /<Redirect[^>]*>([^<]+)<\/Redirect>/.exec(s2.twiml);
    if (m) {
      const redirectPath = m[1].replace(`${SUPA}/functions/v1/`, "").replace(/&amp;/g, "&");
      const s3 = await callWebhook(redirectPath, {
        CallSid: sid, From: from, To: to, AccountSid: "ACselftest", Direction: "inbound",
      });
      steps.push(s3);

      // Step 4 — AI agent also missed → recovery SMS + voicemail
      const a = /action="([^"]+gasmask-missed-call-handler[^"]*)"/.exec(s3.twiml);
      if (a && body.simulate_ai_miss !== false) {
        const actionPath = a[1].replace(`${SUPA}/functions/v1/`, "").replace(/&amp;/g, "&");
        steps.push(await callWebhook(actionPath, {
          CallSid: sid, From: from, To: to, DialCallStatus: "no-answer", DialCallDuration: "0",
        }));
      }
    }
  }

  return new Response(JSON.stringify({ scenario, call_sid: sid, steps }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
