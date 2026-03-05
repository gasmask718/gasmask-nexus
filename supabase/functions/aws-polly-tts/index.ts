import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * AWS POLLY TTS — Latency Fallback Provider
 *
 * Called when ElevenLabs exceeds max_tts_latency_ms threshold.
 * Uses AWS Polly Neural engine for real-time speech synthesis.
 *
 * POST body: { text, voice_id?, engine?, business_id?, persona_id? }
 * Returns: audio/mpeg binary stream
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// AWS Signature V4 helpers
function hmac(key: Uint8Array, data: string): Uint8Array {
  const encoder = new TextEncoder();
  const keyData = key;
  const msgData = encoder.encode(data);
  // Use SubtleCrypto for HMAC-SHA256
  // Since we need sync-like behavior, we'll use a simpler approach with the Web Crypto API
  return new Uint8Array(0); // placeholder — we use fetch to AWS REST endpoint instead
}

async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const keyBuffer: ArrayBuffer = key instanceof ArrayBuffer ? key : (key.buffer as ArrayBuffer);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

async function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode("AWS4" + key), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AWS_ACCESS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID");
    const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY");
    const AWS_REGION = Deno.env.get("AWS_POLLY_REGION") || "us-east-1";

    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      return new Response(JSON.stringify({ error: "AWS credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text, voice_id, engine, business_id, persona_id } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const voiceId = voice_id || "Matthew"; // Neural-capable default
    const ttsEngine = engine || "neural";

    // Build AWS Polly SynthesizeSpeech request
    const service = "polly";
    const host = `${service}.${AWS_REGION}.amazonaws.com`;
    const endpoint = `https://${host}/v1/speech`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);

    const requestBody = JSON.stringify({
      Engine: ttsEngine,
      LanguageCode: "en-US",
      OutputFormat: "mp3",
      SampleRate: "22050",
      Text: text,
      TextType: "text",
      VoiceId: voiceId,
    });

    const payloadHash = await sha256Hex(requestBody);
    const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "content-type;host;x-amz-date";
    const canonicalRequest = `POST\n/v1/speech\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const credentialScope = `${dateStamp}/${AWS_REGION}/${service}/aws4_request`;
    const canonicalRequestHash = await sha256Hex(canonicalRequest);
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

    const signingKey = await getSignatureKey(AWS_SECRET_ACCESS_KEY, dateStamp, AWS_REGION, service);
    const signatureBuffer = await hmacSha256(signingKey, stringToSign);
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const authHeader = `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const startMs = Date.now();

    const pollyResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Amz-Date": amzDate,
        Authorization: authHeader,
        Host: host,
      },
      body: requestBody,
    });

    const latencyMs = Date.now() - startMs;

    // Log TTS event
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseServiceRoleKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
        await supabase.from("tts_events").insert({
          provider: "aws_polly",
          latency_ms: latencyMs,
          characters_count: text.length,
          success: pollyResponse.ok,
          was_fallback: true,
          persona_id: persona_id || null,
          business_id: business_id || null,
          error_message: pollyResponse.ok ? null : `HTTP ${pollyResponse.status}`,
        });
      }
    } catch (e) {
      console.warn("⚠️ Failed to log tts_event:", e);
    }

    if (!pollyResponse.ok) {
      const errText = await pollyResponse.text();
      console.error(`❌ AWS Polly error (${pollyResponse.status}, ${latencyMs}ms):`, errText);
      return new Response(JSON.stringify({ error: "AWS Polly synthesis failed", details: errText }), {
        status: pollyResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`✅ AWS Polly TTS: ${text.length} chars, ${latencyMs}ms, voice=${voiceId}`);

    const audioBuffer = await pollyResponse.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "X-TTS-Latency-Ms": String(latencyMs),
        "X-TTS-Provider": "aws_polly",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ AWS Polly TTS error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
