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
    // Tunable batch sizes — keep total wall time well under the 150s edge limit.
    const recordingBatch: number = Math.min(Number(body.batch) || 6, 15);
    const transcriptBatch: number = Math.min(Number(body.transcript_batch) || 5, 15);
    const concurrency: number = Math.min(Number(body.concurrency) || 3, 6);
    const skipTranscripts: boolean = body.skip_transcripts === true;

    // Hard deadline — bail out cleanly before the 150s edge timeout fires.
    const startedAt = Date.now();
    const DEADLINE_MS = 120_000;
    const timeUp = () => Date.now() - startedAt > DEADLINE_MS;

    const result: SyncResult & { has_more?: boolean; remaining_no_transcript?: number } = {
      synced: 0,
      transcribed: 0,
      skipped: 0,
      errors: [],
    };

    const runWithConcurrency = async <T>(items: T[], worker: (item: T) => Promise<void>) => {
      let i = 0;
      const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (i < items.length) {
          if (timeUp()) return;
          const idx = i++;
          try { await worker(items[idx]); } catch (e) {
            result.errors.push(e instanceof Error ? e.message : String(e));
          }
        }
      });
      await Promise.all(runners);
    };

    if (specificCallSid) {
      const recs = await fetchRecordingsForCall(accountSid, authToken, specificCallSid);
      console.log(`[sync] specific call ${specificCallSid} -> ${recs.length} recordings`);
      await runWithConcurrency(recs.slice(0, recordingBatch), (rec) =>
        processRecording(supabase, accountSid, authToken, rec, result, true),
      );
    } else {
      // Incremental sync: pull the most recent N recordings from Twilio.
      // We DON'T date-filter on Twilio's side — `URLSearchParams` URL-encodes
      // `>` to `%3E` which Twilio silently ignores, AND a date filter blocks
      // backfill of older calls. Pull the latest N and dedupe locally.
      const pageSize: number = Math.min(Number(body.page_size) || 25, 100);

      const recordings = await fetchRecentRecordings(accountSid, authToken, pageSize);
      console.log(`[sync] fetched ${recordings.length} recording(s) from Twilio (page_size=${pageSize})`);

      // Pre-filter: skip only recordings that are FULLY synced (have a public URL).
      // Rows missing recording_url still need re-download.
      const sids = recordings.map((r: any) => r.sid).filter(Boolean);
      const { data: existingRows } = sids.length
        ? await supabase
            .from("va_call_logs")
            .select("recording_sid, recording_url")
            .in("recording_sid", sids)
        : { data: [] as any[] };
      const fullySyncedSet = new Set(
        (existingRows || [])
          .filter((r: any) => r.recording_url)
          .map((r: any) => r.recording_sid),
      );
      const todo = recordings.filter((r: any) => !fullySyncedSet.has(r.sid));
      const slice = todo.slice(0, recordingBatch);
      result.has_more = todo.length > slice.length;
      console.log(`[sync] ${todo.length} new/incomplete, processing ${slice.length}`);

      // First pass: just download recordings + create rows. Skip transcript polling
      // here — it's the slowest part. Transcripts are handled in the dedicated
      // second pass below (and on subsequent syncs).
      await runWithConcurrency(slice, (rec) =>
        processRecording(supabase, accountSid, authToken, rec, result, false),
      );

      // Re-poll a small batch of rows missing transcripts (skippable via flag)
      if (!skipTranscripts && !timeUp()) {
        const { data: pending } = await supabase
          .from("va_call_logs")
          .select("id, recording_sid")
          .not("recording_sid", "is", null)
          .is("transcript", null)
          .limit(transcriptBatch);

        if (pending && pending.length) {
          await runWithConcurrency(pending, async (row: any) => {
            if (!row.recording_sid || timeUp()) return;
            const transcript = await pollTranscript(accountSid, authToken, row.recording_sid);
            if (transcript) {
              await supabase.from("va_call_logs").update({ transcript }).eq("id", row.id);
              result.transcribed++;
            }
          });
        }
      }

      const { count } = await supabase
        .from("va_call_logs")
        .select("id", { count: "exact", head: true })
        .not("recording_sid", "is", null)
        .is("transcript", null);
      result.remaining_no_transcript = count ?? 0;
      result.has_more = result.has_more || (result.remaining_no_transcript ?? 0) > 0;
    }

    const elapsed = Date.now() - startedAt;
    console.log(`[sync] done in ${elapsed}ms`, result);

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
  pollForTranscript = false,
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

    // Only poll transcripts when explicitly asked (slow Twilio calls).
    let transcript: string | null = existing?.transcript ?? null;
    if (!transcript && pollForTranscript) {
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
    const fromNumber: string | null = callDetails?.from || null;
    const toNumber: string | null = callDetails?.to || null;

    let vaId: string | null = null;

    // 1. If From is a Twilio Client identity like "client:va_<uuid>", parse va_id directly
    const fromClientMatch = fromNumber?.match(/^client:(?:va_)?([0-9a-f-]{36})/i);
    if (fromClientMatch) vaId = fromClientMatch[1];

    // 2. Match by twilio_number (most recent VA who used the same outbound number)
    if (!vaId) {
      for (const candidate of [fromNumber, toNumber].filter(Boolean) as string[]) {
        if (candidate.startsWith("client:")) continue;
        const { data: prior } = await supabase
          .from("va_call_logs")
          .select("va_id")
          .eq("twilio_number", candidate)
          .not("va_id", "is", null)
          .order("called_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (prior?.va_id) { vaId = prior.va_id; break; }
      }
    }

    // 3. Final fallback — any active VA in the system (single-tenant Brandaro account)
    if (!vaId) {
      const { data: anyVa } = await supabase
        .from("va_call_logs")
        .select("va_id")
        .not("va_id", "is", null)
        .order("called_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      vaId = anyVa?.va_id ?? null;
    }

    // Validate va_id actually exists in profiles before insert (avoid FK violation)
    if (vaId) {
      const { data: profileCheck } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", vaId)
        .maybeSingle();
      if (!profileCheck) vaId = null;
    }

    if (!vaId) {
      // Last-ditch: pick any existing valid profile referenced by va_call_logs
      const { data: anyValid } = await supabase
        .from("va_call_logs")
        .select("va_id, profiles!inner(id)")
        .not("va_id", "is", null)
        .order("called_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      vaId = (anyValid as any)?.va_id ?? null;
    }

    if (!vaId) {
      result.skipped++;
      console.log(`[sync] skipped ${recordingSid} (no VA attribution possible)`);
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
