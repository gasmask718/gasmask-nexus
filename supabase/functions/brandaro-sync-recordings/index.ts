import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Brandaro Sync Recordings
 *
 * Pulls recordings + transcripts from the dedicated Brandaro Twilio sub-account
 * and persists them on `va_call_logs`. Recording MP3s are downloaded once and
 * re-uploaded to the public `call-recordings` Supabase Storage bucket so the
 * browser <audio> element can play them without Twilio Basic Auth / CORS issues.
 *
 * Strategy:
 *  1. List recent recordings from Twilio (account-wide, not phone-filtered).
 *  2. For each recording: skip if recording_sid already stored on a row.
 *  3. Otherwise: download MP3, upload to storage, get public URL.
 *  4. Try to attach to an existing va_call_logs row matched by parent CallSid.
 *     If no row exists, create one (attribute to most recent VA who used the
 *     matching twilio_number; skip if attribution impossible — never insert
 *     without a va_id).
 *  5. Fetch / re-poll the transcription. If completed → store formatted text.
 *     If pending → request one and try again on next sync.
 */

interface SyncResult {
  synced: number;
  transcribed: number;
  skipped: number;
  errors: string[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const accountSid = Deno.env.get("BRANDARO_TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("BRANDARO_TWILIO_AUTH_TOKEN");

    if (!accountSid || !authToken) {
      return json({ error: "Brandaro Twilio credentials not configured" }, 400);
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const specificCallSid: string | undefined = body.call_sid;

    const result: SyncResult = { synced: 0, transcribed: 0, skipped: 0, errors: [] };

    if (specificCallSid) {
      // Fetch recordings for one specific call
      const recs = await fetchRecordingsForCall(accountSid, authToken, specificCallSid);
      console.log(`[sync] specific call ${specificCallSid} -> ${recs.length} recordings`);
      for (const rec of recs) {
        await processRecording(supabase, accountSid, authToken, rec, result);
      }
    } else {
      // Pull recent account-wide recordings
      const recordings = await fetchRecentRecordings(accountSid, authToken, 100);
      console.log(`[sync] account-wide recordings fetched: ${recordings.length}`);
      for (const rec of recordings) {
        await processRecording(supabase, accountSid, authToken, rec, result);
      }

      // Re-poll any DB rows that have a recording but no transcript yet
      const { data: pending } = await supabase
        .from("va_call_logs")
        .select("id, recording_sid")
        .not("recording_sid", "is", null)
        .is("transcript", null)
        .limit(50);

      if (pending) {
        for (const row of pending) {
          if (!row.recording_sid) continue;
          const transcript = await pollTranscript(accountSid, authToken, row.recording_sid);
          if (transcript) {
            await supabase
              .from("va_call_logs")
              .update({ transcript })
              .eq("id", row.id);
            result.transcribed++;
          }
        }
      }
    }

    return json({ success: true, ...result }, 200);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[brandaro-sync-recordings] Error:", msg);
    return json({ error: msg }, 500);
  }
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function basicAuth(sid: string, token: string) {
  return "Basic " + btoa(`${sid}:${token}`);
}

async function fetchRecentRecordings(
  accountSid: string,
  authToken: string,
  pageSize: number,
): Promise<any[]> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings.json?PageSize=${pageSize}`;
  const res = await fetch(url, { headers: { Authorization: basicAuth(accountSid, authToken) } });
  if (!res.ok) {
    console.warn(`[sync] list recordings failed: ${res.status} ${await res.text()}`);
    return [];
  }
  const data = await res.json();
  return data.recordings || [];
}

async function fetchRecordingsForCall(
  accountSid: string,
  authToken: string,
  callSid: string,
): Promise<any[]> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}/Recordings.json`;
  const res = await fetch(url, { headers: { Authorization: basicAuth(accountSid, authToken) } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.recordings || [];
}

async function fetchCallDetails(
  accountSid: string,
  authToken: string,
  callSid: string,
): Promise<any | null> {
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`,
      { headers: { Authorization: basicAuth(accountSid, authToken) } },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function processRecording(
  supabase: any,
  accountSid: string,
  authToken: string,
  rec: any,
  result: SyncResult,
): Promise<void> {
  const recordingSid: string = rec.sid;
  const callSid: string = rec.call_sid;

  try {
    // Skip if already stored
    const { data: existing } = await supabase
      .from("va_call_logs")
      .select("id, recording_url, transcript")
      .eq("recording_sid", recordingSid)
      .maybeSingle();

    let publicUrl: string | null = existing?.recording_url ?? null;

    if (!publicUrl) {
      // Download MP3 from Twilio and upload to public storage
      publicUrl = await downloadAndStoreRecording(supabase, accountSid, authToken, recordingSid);
      if (!publicUrl) {
        result.errors.push(`download failed for ${recordingSid}`);
        return;
      }
    }

    // Try to fetch transcript (poll if exists, request if not)
    let transcript: string | null = existing?.transcript ?? null;
    if (!transcript) {
      transcript = await pollTranscript(accountSid, authToken, recordingSid);
    }

    const updateData: Record<string, unknown> = {
      recording_url: publicUrl,
      recording_sid: recordingSid,
    };
    if (transcript) updateData.transcript = transcript;
    if (rec.duration) updateData.duration_seconds = parseInt(rec.duration, 10);

    if (existing) {
      const { error } = await supabase
        .from("va_call_logs")
        .update(updateData)
        .eq("id", existing.id);
      if (error) {
        result.errors.push(`update existing ${existing.id}: ${error.message}`);
        return;
      }
      result.synced++;
      if (transcript) result.transcribed++;
      return;
    }

    // Try to match by parent call_sid
    if (callSid) {
      const { data: byCall } = await supabase
        .from("va_call_logs")
        .select("id")
        .eq("call_sid", callSid)
        .maybeSingle();

      if (byCall) {
        const { error } = await supabase
          .from("va_call_logs")
          .update(updateData)
          .eq("id", byCall.id);
        if (error) {
          result.errors.push(`update byCall ${byCall.id}: ${error.message}`);
          return;
        }
        result.synced++;
        if (transcript) result.transcribed++;
        return;
      }
    }

    // No existing row — try to create one. Need a va_id (NOT NULL).
    const callDetails = callSid ? await fetchCallDetails(accountSid, authToken, callSid) : null;
    const fromNumber = callDetails?.from || null;
    const toNumber = callDetails?.to || null;

    // Most recent VA who used either number on outbound
    const candidate = fromNumber || toNumber;
    let vaId: string | null = null;
    if (candidate) {
      const { data: prior } = await supabase
        .from("va_call_logs")
        .select("va_id")
        .eq("twilio_number", candidate)
        .not("va_id", "is", null)
        .order("called_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      vaId = prior?.va_id ?? null;
    }

    if (!vaId) {
      // Skip — never insert with NULL va_id
      result.skipped++;
      console.log(`[sync] skipped ${recordingSid} (no VA attribution for ${candidate})`);
      return;
    }

    const direction =
      callDetails?.direction?.startsWith("outbound") ? "outbound" : "inbound";

    const { error: insErr } = await supabase.from("va_call_logs").insert({
      va_id: vaId,
      call_sid: callSid,
      recording_sid: recordingSid,
      recording_url: publicUrl,
      transcript,
      twilio_number: fromNumber || toNumber || "unknown",
      duration_seconds: callDetails?.duration ? parseInt(callDetails.duration, 10) : null,
      call_status: callDetails?.status || "completed",
      called_at: callDetails?.start_time || rec.date_created,
      direction,
    });

    if (insErr) {
      result.errors.push(`insert ${recordingSid}: ${insErr.message}`);
      return;
    }
    result.synced++;
    if (transcript) result.transcribed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`process ${recordingSid}: ${msg}`);
  }
}

async function downloadAndStoreRecording(
  supabase: any,
  accountSid: string,
  authToken: string,
  recordingSid: string,
): Promise<string | null> {
  try {
    const twilioMp3Url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.mp3`;
    const res = await fetch(twilioMp3Url, {
      headers: { Authorization: basicAuth(accountSid, authToken) },
    });
    if (!res.ok) {
      console.warn(`[sync] mp3 download failed for ${recordingSid}: ${res.status}`);
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const path = `brandaro/${recordingSid}.mp3`;

    const { error: upErr } = await supabase.storage
      .from("call-recordings")
      .upload(path, bytes, {
        contentType: "audio/mpeg",
        upsert: true,
      });
    if (upErr) {
      console.warn(`[sync] storage upload failed: ${upErr.message}`);
      return null;
    }
    const { data: pub } = supabase.storage.from("call-recordings").getPublicUrl(path);
    return pub.publicUrl;
  } catch (err) {
    console.warn(`[sync] downloadAndStore error:`, err);
    return null;
  }
}

async function pollTranscript(
  accountSid: string,
  authToken: string,
  recordingSid: string,
): Promise<string | null> {
  try {
    const listRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}/Transcriptions.json`,
      { headers: { Authorization: basicAuth(accountSid, authToken) } },
    );
    if (!listRes.ok) return null;
    const list = await listRes.json();
    const transcriptions = list.transcriptions || [];

    if (transcriptions.length === 0) {
      // Request a new transcription (best-effort — Twilio basic transcription)
      await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}/Transcriptions.json`,
        {
          method: "POST",
          headers: {
            Authorization: basicAuth(accountSid, authToken),
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );
      return null;
    }

    const completed = transcriptions.find((t: any) => t.status === "completed");
    if (!completed) return null;

    const fullRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Transcriptions/${completed.sid}.json`,
      { headers: { Authorization: basicAuth(accountSid, authToken) } },
    );
    if (!fullRes.ok) return null;
    const full = await fullRes.json();
    return formatTranscript(full.transcription_text || "");
  } catch (err) {
    console.warn(`[sync] pollTranscript error for ${recordingSid}:`, err);
    return null;
  }
}

function formatTranscript(rawText: string): string {
  if (!rawText) return "";
  const lines = rawText.split(/(?<=[.!?])\s+/).filter((l) => l.trim());
  if (lines.length <= 1) return rawText;
  return lines
    .map((line, i) => {
      const speaker = i % 2 === 0 ? "Agent" : "Caller";
      return `${speaker}: ${line.trim()}`;
    })
    .join("\n");
}
