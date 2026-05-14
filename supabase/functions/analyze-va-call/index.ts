// Analyze a VA call (recording / transcript) with AI and return a coaching report.
// Saves result to va_call_logs.ai_analysis. Does NOT push to VA — that is done
// separately via send-coaching-to-va.
//
// Fallbacks:
//   1. transcript on the call log
//   2. va_notes
//   3. live Claude/AI coaching captured during the call
//   4. fetch the recording MP3 (from recording_url or Twilio Brandaro account
//      via recording_sid) and transcribe it on-demand via Lovable AI (Gemini
//      audio). The transcript is then persisted back onto va_call_logs.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANALYSIS_MODEL = "google/gemini-2.5-pro";
const TRANSCRIBE_MODEL = "google/gemini-2.5-flash";

function bytesToBase64(bytes: Uint8Array): string {
  // Chunked encoding to avoid call-stack overflow on large MP3s.
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function downloadRecording(
  call: { recording_url: string | null; recording_sid: string | null; call_sid: string | null },
): Promise<{ base64: string; mime: string } | null> {
  const accountSid = Deno.env.get("BRANDARO_TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("BRANDARO_TWILIO_AUTH_TOKEN");
  const basicAuth = accountSid && authToken
    ? "Basic " + btoa(`${accountSid}:${authToken}`)
    : null;

  // Candidate URLs to try, in order
  const urls: { url: string; useTwilioAuth: boolean }[] = [];

  if (call.recording_sid && accountSid) {
    urls.push({
      url: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${call.recording_sid}.mp3`,
      useTwilioAuth: true,
    });
  }
  if (call.recording_url) {
    const isTwilio = /api\.twilio\.com/.test(call.recording_url);
    const url = isTwilio && !/\.mp3($|\?)/.test(call.recording_url)
      ? call.recording_url + ".mp3"
      : call.recording_url;
    urls.push({ url, useTwilioAuth: isTwilio });
  }

  for (const { url, useTwilioAuth } of urls) {
    try {
      const headers: Record<string, string> = {};
      if (useTwilioAuth && basicAuth) headers["Authorization"] = basicAuth;
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        console.warn(`[analyze-va-call] recording fetch failed ${resp.status} ${url}`);
        continue;
      }
      const buf = new Uint8Array(await resp.arrayBuffer());
      if (buf.byteLength < 1000) continue; // empty / placeholder
      const mime = resp.headers.get("content-type") || "audio/mpeg";
      return { base64: bytesToBase64(buf), mime };
    } catch (e) {
      console.warn(`[analyze-va-call] recording fetch error ${url}:`, e);
    }
  }
  return null;
}

async function transcribeAudio(base64: string, mime: string, apiKey: string): Promise<string> {
  const format = mime.includes("mp3") || mime.includes("mpeg") ? "mp3"
    : mime.includes("wav") ? "wav"
    : mime.includes("webm") ? "webm"
    : "mp3";

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TRANSCRIBE_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "input_audio", input_audio: { data: base64, format } },
            {
              type: "text",
              text:
                "Transcribe this sales call verbatim. Format with speaker labels: 'VA:' for the agent and 'Customer:' for the prospect. New line per turn. Output only the transcript text, no commentary.",
            },
          ],
        },
      ],
      temperature: 0,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Transcription failed (${resp.status}): ${t}`);
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.map((p: any) => (typeof p === "string" ? p : p?.text || "")).join(" ").trim();
  }
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { call_log_id } = await req.json();
    if (!call_log_id) throw new Error("call_log_id required");

    const { data: call, error: callErr } = await supabase
      .from("va_call_logs")
      .select(
        "id, transcript, va_notes, duration_seconds, disposition, call_status, recording_url, recording_sid, call_sid, call_summary",
      )
      .eq("id", call_log_id)
      .maybeSingle();

    if (callErr) throw callErr;
    if (!call) throw new Error("Call log not found");

    // Pull any live coaching captured during the call
    const { data: liveRows } = await supabase
      .from("va_live_call_analysis")
      .select("created_at, sentiment, buyer_intent, coaching_tip, next_best_action, objection_detected, transcript_chunk")
      .eq("call_log_id", call_log_id)
      .order("created_at", { ascending: true });

    const liveHistory = (liveRows || []).map((r: any, i: number) =>
      `[${i + 1}] intent=${r.buyer_intent ?? "?"} sentiment=${r.sentiment ?? "?"}` +
      (r.objection_detected ? ` objection="${r.objection_detected}"` : "") +
      (r.coaching_tip ? `\n   tip: ${r.coaching_tip}` : "") +
      (r.next_best_action ? `\n   next: ${r.next_best_action}` : "")
    ).join("\n");

    let transcript = (call.transcript || "").trim();
    let transcribedNow = false;

    // Fallback: transcribe the recording on-demand
    if (!transcript && (call.recording_url || call.recording_sid)) {
      console.log(`[analyze-va-call] no transcript on ${call_log_id}, transcribing recording…`);
      const audio = await downloadRecording(call as any);
      if (audio) {
        try {
          transcript = await transcribeAudio(audio.base64, audio.mime, LOVABLE_API_KEY);
          if (transcript) {
            transcribedNow = true;
            await supabase
              .from("va_call_logs")
              .update({ transcript })
              .eq("id", call_log_id);
            console.log(`[analyze-va-call] transcript saved (${transcript.length} chars)`);
          }
        } catch (e) {
          console.error(`[analyze-va-call] transcription error:`, e);
        }
      } else {
        console.warn(`[analyze-va-call] could not download recording for ${call_log_id}`);
      }
    }

    const inputText = transcript || (call.va_notes || "").trim() || (call.call_summary || "").trim();

    if (!inputText && !liveHistory) {
      return new Response(
        JSON.stringify({
          error:
            "No transcript could be generated. The call has no recording, notes, or live coaching to analyze.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ANALYSIS_MODEL,
        messages: [
          {
            role: "system",
            content:
              `You are an elite sales coach reviewing an outbound sales call by a Brandaro VA (Virtual Assistant).
Your job is to (1) score the call, (2) identify specific things the VA did well, (3) point out concrete things they should improve, (4) give actionable tactics on how they should handle similar calls next time, and (5) give specific better rebuttals/scripts they could have said.
Be specific, reference moments from the transcript when possible, and write in plain coaching language the VA can act on. Do not be generic.`,
          },
          {
            role: "user",
            content:
              `Call duration: ${call.duration_seconds ?? "unknown"}s\nDisposition: ${call.disposition ?? "n/a"}\nStatus: ${call.call_status ?? "n/a"}\n\nTRANSCRIPT / NOTES:\n${inputText || "(no transcript captured)"}\n\nLIVE AI COACHING HISTORY DURING CALL:\n${liveHistory || "(none)"}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "coaching_report",
              description: "Return structured coaching feedback for the VA",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "2-3 sentence summary of what happened on the call" },
                  overall_score: { type: "number", description: "0-10 rating of the VA's performance" },
                  coaching_note: { type: "string", description: "One-sentence headline coaching message" },
                  va_strengths: { type: "array", items: { type: "string" } },
                  va_improvements: { type: "array", items: { type: "string" } },
                  missed_opportunities: { type: "array", items: { type: "string" } },
                  recommended_rebuttals: { type: "array", items: { type: "string" } },
                  handling_tips: { type: "array", items: { type: "string" } },
                  objections_raised: { type: "array", items: { type: "string" } },
                },
                required: [
                  "summary", "overall_score", "coaching_note",
                  "va_strengths", "va_improvements", "handling_tips", "recommended_rebuttals",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "coaching_report" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error ${aiResp.status}: ${errText}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI returned no analysis");

    const analysis = JSON.parse(toolCall.function.arguments);
    analysis.analyzed_at = new Date().toISOString();
    analysis.model = ANALYSIS_MODEL;
    analysis.transcript_source = transcribedNow
      ? "transcribed_from_recording"
      : transcript
        ? "stored_transcript"
        : call.va_notes ? "va_notes" : "live_coaching_only";
    analysis.live_coaching_count = (liveRows || []).length;
    analysis.live_coaching_history = (liveRows || []).map((r: any) => ({
      at: r.created_at,
      sentiment: r.sentiment,
      buyer_intent: r.buyer_intent,
      coaching_tip: r.coaching_tip,
      next_best_action: r.next_best_action,
      objection_detected: r.objection_detected,
    }));

    const { error: updateErr } = await supabase
      .from("va_call_logs")
      .update({ ai_analysis: analysis })
      .eq("id", call_log_id);

    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({ success: true, analysis, transcribed: transcribedNow }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("analyze-va-call error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
