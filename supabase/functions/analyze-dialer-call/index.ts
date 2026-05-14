// Analyze an auto-dialer call (outbound_call_queue row) with AI and store
// the result in outbound_call_queue.ai_analysis.
//
// Transcript sources, in order:
//   1. outbound_call_queue.bland_transcript (final transcript from Bland)
//   2. live_call_transcripts utterances (per-utterance live capture)
//   3. fetch & transcribe bland_recording_url via Lovable AI (Gemini audio)

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
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function downloadRecording(url: string): Promise<{ base64: string; mime: string } | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buf = new Uint8Array(await resp.arrayBuffer());
    if (buf.byteLength < 1000) return null;
    const mime = resp.headers.get("content-type") || "audio/mpeg";
    return { base64: bytesToBase64(buf), mime };
  } catch {
    return null;
  }
}

async function transcribeAudio(base64: string, mime: string, apiKey: string): Promise<string> {
  const format = mime.includes("mp3") || mime.includes("mpeg") ? "mp3"
    : mime.includes("wav") ? "wav"
    : mime.includes("webm") ? "webm" : "mp3";
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TRANSCRIBE_MODEL,
      messages: [{
        role: "user",
        content: [
          { type: "input_audio", input_audio: { data: base64, format } },
          { type: "text", text: "Transcribe this sales call verbatim. Use 'Agent:' for the AI/agent and 'Customer:' for the prospect. New line per turn. Output only the transcript." },
        ],
      }],
      temperature: 0,
    }),
  });
  if (!resp.ok) throw new Error(`Transcription failed (${resp.status}): ${await resp.text()}`);
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map((p: any) => typeof p === "string" ? p : p?.text || "").join(" ").trim();
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

    const { queue_item_id } = await req.json();
    if (!queue_item_id) throw new Error("queue_item_id required");

    const { data: row, error: rowErr } = await supabase
      .from("outbound_call_queue")
      .select("id, status, contact_name, phone_number, bland_transcript, bland_recording_url, twilio_call_sid, dial_status, answered_by, voicemail_left, bridge_failed_reason, ended_at, dialing_started_at, answered_at")
      .eq("id", queue_item_id)
      .maybeSingle();
    if (rowErr) throw rowErr;
    if (!row) throw new Error("Queue item not found");

    let transcript = (row.bland_transcript || "").trim();

    // Fallback: build transcript from live utterances
    if (!transcript && row.twilio_call_sid) {
      const { data: utts } = await supabase
        .from("live_call_transcripts")
        .select("speaker, text, created_at")
        .eq("call_sid", row.twilio_call_sid)
        .order("created_at", { ascending: true });
      if (utts && utts.length > 0) {
        transcript = utts.map((u: any) =>
          `${u.speaker === "ai" ? "Agent" : u.speaker === "human" || u.speaker === "caller" ? "Customer" : u.speaker}: ${u.text}`
        ).join("\n");
      }
    }

    // Fallback: transcribe the recording on-demand
    let transcribedNow = false;
    if (!transcript && row.bland_recording_url) {
      const audio = await downloadRecording(row.bland_recording_url);
      if (audio) {
        try {
          transcript = await transcribeAudio(audio.base64, audio.mime, LOVABLE_API_KEY);
          if (transcript) {
            transcribedNow = true;
            await supabase.from("outbound_call_queue").update({ bland_transcript: transcript }).eq("id", queue_item_id);
          }
        } catch (e) {
          console.error("[analyze-dialer-call] transcribe error:", e);
        }
      }
    }

    if (!transcript) {
      return new Response(
        JSON.stringify({ error: "No transcript available yet — recording may still be processing." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const duration = row.dialing_started_at && row.ended_at
      ? Math.round((new Date(row.ended_at).getTime() - new Date(row.dialing_started_at).getTime()) / 1000)
      : null;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ANALYSIS_MODEL,
        messages: [
          { role: "system", content: "You are an expert sales conversation analyst. Summarize an outbound auto-dialer call and propose a follow-up plan. Be concrete and reference actual moments from the transcript." },
          { role: "user", content:
              `Contact: ${row.contact_name || row.phone_number}\nDuration: ${duration ?? "?"}s\nDial status: ${row.dial_status ?? "?"}\nAnswered by: ${row.answered_by ?? "?"}\nVoicemail: ${row.voicemail_left ? "yes" : "no"}\nBridge error: ${row.bridge_failed_reason ?? "none"}\n\nTRANSCRIPT:\n${transcript}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "call_analysis",
            description: "Structured wrap-up for an auto-dialer call",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "2-3 sentence summary of what happened" },
                outcome: {
                  type: "string",
                  enum: ["won_back","closed_deal","callback_needed","follow_up_later","nurture","no_answer","not_interested"],
                  description: "Suggested wrap-up status",
                },
                overall_score: { type: "number", description: "0-10 quality score" },
                coaching_note: { type: "string" },
                key_objections: { type: "array", items: { type: "string" } },
                next_steps: { type: "array", items: { type: "string" } },
                recommended_followup_at: { type: "string", description: "ISO timestamp suggestion or empty" },
                next_call_context: { type: "string", description: "What the next caller needs to know" },
              },
              required: ["summary","outcome","overall_score","next_steps","next_call_context"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "call_analysis" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limited, retry shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error ${aiResp.status}: ${errText}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI returned no analysis");
    const analysis = JSON.parse(toolCall.function.arguments);
    analysis.analyzed_at = new Date().toISOString();
    analysis.model = ANALYSIS_MODEL;
    analysis.transcript_source = transcribedNow ? "transcribed_from_recording" : (row.bland_transcript ? "bland_transcript" : "live_utterances");

    const { error: updateErr } = await supabase
      .from("outbound_call_queue")
      .update({ ai_analysis: analysis })
      .eq("id", queue_item_id);
    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-dialer-call error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
