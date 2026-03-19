import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CheckResult {
  name: string;
  status: "pass" | "fail" | "skip";
  message: string;
  detail?: string;
}

async function checkAnthropic(): Promise<CheckResult> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return { name: "Anthropic API", status: "fail", message: "ANTHROPIC_API_KEY not set" };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 10,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    const data = await res.json();
    if (data.content) return { name: "Anthropic API", status: "pass", message: "Connected" };
    return { name: "Anthropic API", status: "fail", message: data.error?.message || "Unknown error", detail: JSON.stringify(data).substring(0, 300) };
  } catch (e) {
    return { name: "Anthropic API", status: "fail", message: String(e) };
  }
}

async function checkGeocode(): Promise<CheckResult> {
  const key = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!key) return { name: "Google Places API", status: "fail", message: "GOOGLE_PLACES_API_KEY not set" };
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=Miami,FL&key=${key}`);
    const data = await res.json();
    if (data.status === "OK") return { name: "Google Places API", status: "pass", message: "Connected" };
    return { name: "Google Places API", status: "fail", message: `${data.status}: ${data.error_message || ""}` };
  } catch (e) {
    return { name: "Google Places API", status: "fail", message: String(e) };
  }
}

async function checkPlacesSearch(): Promise<CheckResult> {
  const key = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!key) return { name: "Google Places Search", status: "fail", message: "GOOGLE_PLACES_API_KEY not set" };
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=cleaning+service+in+Miami&key=${key}`);
    const data = await res.json();
    if (data.status === "OK" && data.results?.length > 0)
      return { name: "Google Places Search", status: "pass", message: `Working (${data.results.length} results returned)` };
    return { name: "Google Places Search", status: "fail", message: data.status };
  } catch (e) {
    return { name: "Google Places Search", status: "fail", message: String(e) };
  }
}

async function checkElevenLabs(): Promise<CheckResult> {
  const key = Deno.env.get("ELEVENLABS_API_KEY");
  if (!key) return { name: "ElevenLabs", status: "fail", message: "ELEVENLABS_API_KEY not set" };
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": key },
    });
    const data = await res.json();
    if (data.voices) return { name: "ElevenLabs", status: "pass", message: `Connected (${data.voices.length} voices available)` };
    return { name: "ElevenLabs", status: "fail", message: data.detail?.message || "Unknown error" };
  } catch (e) {
    return { name: "ElevenLabs", status: "fail", message: String(e) };
  }
}

async function checkStripe(): Promise<CheckResult> {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return { name: "Stripe", status: "fail", message: "STRIPE_SECRET_KEY not set" };
  try {
    const res = await fetch("https://api.stripe.com/v1/payment_links?limit=3", {
      headers: { Authorization: `Bearer ${key}` },
    });
    const data = await res.json();
    if (data.data) return { name: "Stripe", status: "pass", message: `Connected (${data.data.length} payment links found)` };
    return { name: "Stripe", status: "fail", message: data.error?.message || "Unknown error" };
  } catch (e) {
    return { name: "Stripe", status: "fail", message: String(e) };
  }
}

async function checkTwilio(): Promise<CheckResult> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!sid || !token) return { name: "Twilio", status: "fail", message: "TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set" };
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
      headers: { Authorization: "Basic " + btoa(`${sid}:${token}`) },
    });
    const data = await res.json();
    if (data.status === "active") return { name: "Twilio", status: "pass", message: "Connected (account active)" };
    return { name: "Twilio", status: "fail", message: data.message || `Account status: ${data.status}` };
  } catch (e) {
    return { name: "Twilio", status: "fail", message: String(e) };
  }
}

async function checkEdgeFunction(fnName: string, projectUrl: string, anonKey: string): Promise<CheckResult> {
  try {
    const res = await fetch(`${projectUrl}/functions/v1/${fnName}`, {
      method: "OPTIONS",
      headers: { apikey: anonKey },
    });
    // OPTIONS returning any 2xx or 204 means deployed
    if (res.ok || res.status === 204) return { name: fnName, status: "pass", message: "Deployed" };
    return { name: fnName, status: "fail", message: `HTTP ${res.status}` };
  } catch (e) {
    return { name: fnName, status: "fail", message: "Not found" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const projectUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  const edgeFunctions = [
    "brandaro-pipeline-automator",
    "sms-inbound-webhook",
    "intent-classifier",
    "sms-writer",
    "website-pitch-writer",
    "brandaro-lead-discovery",
  ];

  const [anthropic, geocode, placesSearch, elevenLabs, stripe, twilio, ...edgeResults] =
    await Promise.all([
      checkAnthropic(),
      checkGeocode(),
      checkPlacesSearch(),
      checkElevenLabs(),
      checkStripe(),
      checkTwilio(),
      ...edgeFunctions.map((fn) => checkEdgeFunction(fn, projectUrl, anonKey)),
    ]);

  const apiChecks = [anthropic, geocode, placesSearch, elevenLabs, stripe, twilio];
  const allChecks = [...apiChecks, ...edgeResults];
  const failCount = allChecks.filter((c) => c.status === "fail").length;

  return new Response(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      overall: failCount === 0 ? "operational" : "degraded",
      fail_count: failCount,
      total_count: allChecks.length,
      api_checks: apiChecks,
      edge_function_checks: edgeResults,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
