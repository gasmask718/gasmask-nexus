// Analyze a single VA call. Uses call_summary if present, otherwise falls
// back to transcript, otherwise transcribes the Twilio recording via the
// Lovable AI gateway. Persists the analysis on va_call_logs.ai_analysis.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function fetchTwilioRecordingBase64(recordingUrl: string): Promise<{ base64: string; mime: string } | null> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!accountSid || !authToken) return null;

  let url = recordingUrl;
  // Normalize to .mp3 if bare Recording resource URL
  if (/\/Recordings\/RE[a-f0-9]+$/i.test(url)) url += ".mp3";

  const res = await fetch(url, {
    headers: { Authorization: "Basic " + btoa(`${accountSid}:${authToken}`) },
    redirect: "follow",
  });
  if (!res.ok) {
    console.error("[va-analyze-single-call] Twilio recording fetch failed", res.status);
    return null;
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  // base64 encode in chunks
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return { base64: btoa(binary), mime: "audio/mpeg" };
}

async function transcribeAudio(base64: string, format: "mp3" | "wav"): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{
        role: "user",
        content: [
          { type: "input_audio", input_audio: { data: base64, format } },
          { type: "text", text: "Transcribe the entire phone call. Label speakers as VA: and Customer: when distinguishable. Output transcript only." },
        ],
      }],
      temperature: 0,
    }),
  });
  if (!r.ok) {
    console.error("[va-analyze-single-call] transcription failed", r.status, await r.text().catch(() => ""));
    return "";
  }
  const d = await r.json();
  const c = d?.choices?.[0]?.message?.content;
  if (typeof c === "string") return c.trim();
  if (Array.isArray(c)) {
    return c.map((p: any) => (typeof p === "string" ? p : p?.text || "")).join(" ").trim();
  }
  return "";
}

async function analyzeText(context: string): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: "You are an elite sales coach analyzing a single sales call. Be specific, actionable, and concise." },
        { role: "user", content: `Analyze the following call and return structured coaching feedback.\n\n${context}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "single_call_analysis",
          description: "Structured analysis of a single sales call.",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string", description: "2-3 sentence summary of the call." },
              sentiment: { type: "string", enum: ["positive", "neutral", "negative", "mixed"] },
              buyer_intent: { type: "string", enum: ["hot", "warm", "cold", "unknown"] },
              what_went_well: { type: "array", items: { type: "string" } },
              what_to_improve: { type: "array", items: { type: "string" } },
              objections: { type: "array", items: { type: "string" } },
              next_best_action: { type: "string" },
              recommended_script: { type: "string" },
              score: { type: "number", description: "0-100 overall call quality score." },
            },
            required: ["summary", "sentiment", "buyer_intent", "what_went_well", "what_to_improve", "next_best_action", "score"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "single_call_analysis" } },
    }),
  });
  if (!r.ok) throw new Error(`AI analysis failed: ${r.status} ${await r.text().catch(() => "")}`);
  const d = await r.json();
  const args = d?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("No analysis returned");
  return JSON.parse(args);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { call_log_id } = await req.json().catch(() => ({}));
    if (!call_log_id) return json(400, { error: "call_log_id required" });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json(500, { error: "AI gateway not configured" });

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) return json(401, { error: "Unauthorized" });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: call, error: callErr } = await admin
      .from("va_call_logs")
      .select("id, va_id, call_summary, va_notes, transcript, recording_url, recording_sid, disposition, excitement_level, duration_seconds, called_at")
      .eq("id", call_log_id)
      .maybeSingle();
    if (callErr || !call) return json(404, { error: "Call not found" });

    // Authorization: user must own the call OR be admin/owner
    if (call.va_id !== userRes.user.id) {
      const { data: prof } = await admin.from("profiles").select("role").eq("id", userRes.user.id).maybeSingle();
      if (!prof || !["admin", "owner"].includes(String(prof.role))) {
        return json(403, { error: "Forbidden" });
      }
    }

    let transcript = call.transcript || "";
    let usedSource: "summary" | "transcript" | "recording" = "summary";

    // If no summary AND no transcript, transcribe the recording
    if (!call.call_summary && !transcript) {
      let recordingUrl = call.recording_url || "";
      if (!recordingUrl && call.recording_sid) {
        const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
        if (sid) recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Recordings/${call.recording_sid}.mp3`;
      }
      if (!recordingUrl) {
        return json(422, { error: "No summary, transcript, or recording available for this call." });
      }
      const audio = await fetchTwilioRecordingBase64(recordingUrl);
      if (!audio) return json(500, { error: "Failed to fetch Twilio recording" });
      transcript = await transcribeAudio(audio.base64, "mp3");
      if (!transcript) return json(500, { error: "Transcription returned empty result" });
      usedSource = "recording";
      // Persist transcript so we don't redo work
      await admin.from("va_call_logs").update({ transcript }).eq("id", call_log_id);
    } else if (!call.call_summary && transcript) {
      usedSource = "transcript";
    }

    const contextParts: string[] = [];
    contextParts.push(`Call date: ${call.called_at}`);
    if (call.duration_seconds) contextParts.push(`Duration: ${call.duration_seconds}s`);
    if (call.disposition) contextParts.push(`Disposition: ${call.disposition}`);
    if (call.excitement_level) contextParts.push(`Excitement: ${call.excitement_level}`);
    if (call.call_summary) contextParts.push(`Summary:\n${call.call_summary}`);
    if (call.va_notes) contextParts.push(`VA notes:\n${call.va_notes}`);
    if (transcript) contextParts.push(`Transcript:\n${transcript}`);

    const analysis = await analyzeText(contextParts.join("\n\n"));

    const persisted = {
      ...analysis,
      source: usedSource,
      analyzed_at: new Date().toISOString(),
    };

    await admin.from("va_call_logs").update({ ai_analysis: persisted }).eq("id", call_log_id);

    return json(200, { analysis: persisted, source: usedSource });
  } catch (e: any) {
    console.error("[va-analyze-single-call] error", e);
    return json(500, { error: e?.message || String(e) });
  }
});
