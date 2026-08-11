/**
 * SEC-018 — proof that verifyTwilio accepts a genuinely signed request and
 * rejects a forged one, including the canonical-URL form the Supabase edge
 * gateway produces. Uses a throwaway token, so it proves the algorithm without
 * ever touching the real TWILIO_WEBHOOK_AUTH_TOKEN.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createHmac } from "node:crypto";
import { verifyTwilio } from "../_shared/dialer.ts";

const TOKEN = "test_auth_token_not_a_real_secret";
const FN_URL = "https://qalaaroashbggynpvqct.supabase.co/functions/v1/twilio-call-status";

function sign(token: string, url: string, params: Record<string, string>) {
  let data = url;
  for (const k of Object.keys(params).sort()) data += k + params[k];
  return createHmac("sha1", token).update(data).digest("base64");
}

function request(signature: string) {
  return new Request("http://edge-runtime/twilio-call-status", {
    method: "POST",
    headers: { "x-twilio-signature": signature, "content-type": "application/x-www-form-urlencoded" },
  });
}

const PARAMS = { CallSid: "CA123", CallStatus: "completed", From: "+15551230000", To: "+15559990000" };

Deno.test("accepts a request signed with the canonical functions URL", () => {
  Deno.env.set("SUPABASE_URL", "https://qalaaroashbggynpvqct.supabase.co");
  Deno.env.set("TWILIO_WEBHOOK_AUTH_TOKEN", TOKEN);
  Deno.env.delete("DIALER_SKIP_TWILIO_VERIFY");

  const result = verifyTwilio(request(sign(TOKEN, FN_URL, PARAMS)), PARAMS);
  assertEquals(result.ok, true);
  assertEquals(result.matchedUrl, "canonical");
});

Deno.test("rejects a forged signature", () => {
  Deno.env.set("SUPABASE_URL", "https://qalaaroashbggynpvqct.supabase.co");
  Deno.env.set("TWILIO_WEBHOOK_AUTH_TOKEN", TOKEN);
  const result = verifyTwilio(request("Zm9yZ2Vkc2lnbmF0dXJl"), PARAMS);
  assertEquals(result.ok, false);
  assertEquals(result.reason, "invalid_signature");
});

Deno.test("rejects a request with no signature header at all", () => {
  Deno.env.set("TWILIO_WEBHOOK_AUTH_TOKEN", TOKEN);
  const req = new Request("http://edge-runtime/twilio-call-status", { method: "POST" });
  const result = verifyTwilio(req, PARAMS);
  assertEquals(result.ok, false);
  assertEquals(result.reason, "no_signature_header");
});

Deno.test("rejects a body tampered with after signing", () => {
  Deno.env.set("SUPABASE_URL", "https://qalaaroashbggynpvqct.supabase.co");
  Deno.env.set("TWILIO_WEBHOOK_AUTH_TOKEN", TOKEN);
  const sig = sign(TOKEN, FN_URL, PARAMS);
  const tampered = { ...PARAMS, CallStatus: "no-answer" };
  assertEquals(verifyTwilio(request(sig), tampered).ok, false);
});

Deno.test("accepts a second Twilio account's token via extraTokenEnvVars", () => {
  Deno.env.set("SUPABASE_URL", "https://qalaaroashbggynpvqct.supabase.co");
  Deno.env.set("TWILIO_WEBHOOK_AUTH_TOKEN", TOKEN);
  Deno.env.set("BRANDARO_TWILIO_AUTH_TOKEN", "brandaro_test_token");
  const sig = sign("brandaro_test_token", FN_URL, PARAMS);
  const result = verifyTwilio(request(sig), PARAMS, { extraTokenEnvVars: ["BRANDARO_TWILIO_AUTH_TOKEN"] });
  assertEquals(result.ok, true);
  assertEquals(result.matchedToken, "BRANDARO_TWILIO_AUTH_TOKEN");
});
