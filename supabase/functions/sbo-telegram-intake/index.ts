// SBO Telegram Intake — receives raw posts from the Railway Telethon worker,
// stores them, dispatches to sbo-auto-capper for capper resolution, then
// runs Claude extraction to insert structured picks into sbo_capper_picks.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeStat, UNMATCHABLE } from "../_shared/statNormalize.ts";
import { canonicalizeSport } from "../_shared/sportCanonical.ts";

/**
 * Canonicalize prop_type at write time so 'pitcher outs' and 'pitcher_outs'
 * collide under the widened dedup index. When the stat is UNMATCHABLE we keep
 * the caller's token in normalized token form rather than writing the sentinel
 * to the database — the sentinel is a matching signal, not stored data.
 */
function canonicalPropType(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const norm = normalizeStat(raw);
  if (norm && norm !== UNMATCHABLE) return norm;
  return raw.toLowerCase().trim().replace(/[_\-\s]+/g, "_");
}

const CLAUDE_MODEL = "claude-sonnet-4-5";
const CLAUDE_URL = "https://api.anthropic.com/v1/messages";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "image/jpeg";
    const buf = new Uint8Array(await r.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return `data:${ct};base64,${btoa(bin)}`;
  } catch (e) {
    console.error("fetchImageAsDataUrl failed:", (e as Error).message);
    return null;
  }
}

// ---------- Claude pick extraction ----------
interface ClaudePick {
  is_pick: boolean;
  sport?: string | null;
  game?: string | null;
  pick_type?: "spread" | "moneyline" | "total" | "prop" | "parlay" | "other" | null;
  pick_detail?: string | null;
  team_or_player?: string | null;
  side?: string | null;
  line?: number | null;
  odds?: number | null;
  units?: number | null;
  confidence_label?: string | null;
  game_date?: string | null;
  is_prop?: boolean;
  prop_stat?: string | null;
  is_parlay?: boolean;
  parlay_legs?: unknown[] | null;
  extraction_confidence?: "high" | "medium" | "low";
  capper_notes?: string | null;
}

function stripJsonFence(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

async function extractPickWithClaude(
  messageText: string,
  apiKey: string,
): Promise<{ pick: ClaudePick | null; error?: string; raw?: string }> {
  const system =
    "You are a sports betting pick extractor. Extract structured pick data from Telegram messages. Return ONLY valid JSON, no other text.";
  const user = `Extract pick data from this Telegram message. Return JSON with these exact fields:
{
  is_pick: boolean,
  sport: string or null (MUST be one of: MLB, NBA, NFL, NHL, WNBA, NCAAB, NCAAF, UFC, Tennis, Golf, Soccer, CFL, Boxing, Rugby — use null if the sport is not in this list or the message covers multiple sports),
  game: string or null,
  pick_type: 'spread'|'moneyline'|'total'|'f5_total'|'team_total'|'prop'|'parlay'|'other',
  pick_detail: string or null,
  team_or_player: string or null,
  side: string or null,
  line: number or null,
  odds: number or null,
  units: number or null,
  confidence_label: string or null,
  game_date: string or null,
  is_prop: boolean,
  prop_stat: string or null,
  is_parlay: boolean,
  parlay_legs: array or null,
  extraction_confidence: 'high'|'medium'|'low',
  capper_notes: string or null
}
Pick type rules:
- Use 'f5_total' for first-5-innings, first half, or any partial-game total (e.g. "F5 OVER 4.5", "1H UNDER 48.5", "first 5 OVER 4.5").
- Use 'team_total' for one team's score only (e.g. "Yankees OVER 4.5", "Lakers TT UNDER 112").
- Use 'total' for full-game combined totals only.
If not a pick return { is_pick: false }.
Message: ${messageText}`;

  try {
    const r = await fetch(CLAUDE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        // BUG-06: was 500. The schema above has 18 fields and parlay_legs is an
        // array, so real picks routinely exceeded the cap and came back as
        // truncated JSON ("Unterminated string at position ~1250"). Those were
        // then filed as skipped_not_pick — a silent conversion loss.
        max_tokens: 2000,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!r.ok) {
      const errText = await r.text();
      return { pick: null, error: `claude_http_${r.status}: ${errText.slice(0, 400)}` };
    }

    const data = await r.json();
    const raw = data?.content?.[0]?.text ?? "";
    if (!raw) return { pick: null, error: "claude_empty_response" };

    // A truncated completion is a FAILURE, not a verdict. Surface it explicitly
    // so it is never confused with "the model read this and said it is not a pick".
    const stopReason = data?.stop_reason ?? null;
    if (stopReason === "max_tokens") {
      return {
        pick: null,
        error: `claude_truncated: response hit max_tokens (${raw.length} chars) — pick could not be extracted`,
        raw,
      };
    }

    try {
      const parsed = JSON.parse(stripJsonFence(raw)) as ClaudePick;
      return { pick: parsed, raw };
    } catch (parseErr) {
      // Return pick:null (previously { is_pick: false }) so the caller records
      // extraction_failed instead of skipped_not_pick. An unparseable response
      // means we do not know whether it was a pick.
      return {
        pick: null,
        error: `claude_parse_error: ${(parseErr as Error).message}`,
        raw,
      };
    }
  } catch (e) {
    return { pick: null, error: `claude_call_failed: ${(e as Error).message}` };
  }
}

function confidenceToNumber(c?: string | null): number | null {
  if (c === "high") return 90;
  if (c === "medium") return 70;
  if (c === "low") return 40;
  return null;
}

function normalizeGameDate(d?: string | null): string | null {
  if (!d) return null;
  const trimmed = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function toIntOrNull(n: unknown): number | null {
  if (n === null || n === undefined) return null;
  const num = Number(n);
  if (!isFinite(num)) return null;
  return Math.trunc(num);
}

function toNumOrNull(n: unknown): number | null {
  if (n === null || n === undefined) return null;
  const num = Number(n);
  return isFinite(num) ? num : null;
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const expected = Deno.env.get("SBO_TELEGRAM_WEBHOOK_SECRET");
    if (!expected) {
      console.error("SBO_TELEGRAM_WEBHOOK_SECRET is not configured");
      return json(500, { error: "Webhook secret not configured on server" });
    }

    const provided = req.headers.get("x-webhook-secret") || "";
    if (!safeEqual(provided, expected)) {
      return json(401, { error: "Unauthorized" });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const {
      channel_id,
      channel_name,
      channel_username,
      capper_name,
      message_id,
      message_text,
      image_url,
      image_data,
      has_media,
      edited,
      deleted,
      posted_at,
    } = body ?? {};

    if (!channel_id || !message_id) {
      return json(400, { error: "channel_id and message_id are required" });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Idempotency gate (Stage 1) ──
    // Telethon re-delivers the same message_id on retries and on edits. Hash the
    // meaningful content so a re-delivery of IDENTICAL content is a no-op, while a
    // genuine edit reprocesses cleanly (delete-and-reinsert, never additive).
    const sourceMessageId = `${String(channel_id)}:${String(message_id)}`;
    const contentHash = await sha256Hex(
      JSON.stringify({
        t: typeof message_text === "string" ? message_text.trim() : "",
        i: image_url ?? null,
        m: !!has_media,
        d: typeof image_data === "string" ? image_data.length : 0,
      }),
    );

    const { data: existing } = await supabase
      .from("sbo_telegram_posts")
      .select("id, processing_status, content_hash")
      .eq("channel_id", String(channel_id))
      .eq("message_id", String(message_id))
      .maybeSingle();

    const TERMINAL_STATUSES = [
      "dispatched",
      "extracted",
      "skipped_not_pick",
      "deleted",
    ];
    const alreadyProcessed =
      !!existing && TERMINAL_STATUSES.includes(existing.processing_status ?? "");
    const contentUnchanged = !!existing && existing.content_hash === contentHash;

    if (alreadyProcessed && contentUnchanged && !deleted) {
      console.log("Idempotency gate: skipping re-delivery of", sourceMessageId);
      return json(200, {
        ok: true,
        id: existing.id,
        stored: true,
        dispatched: false,
        reason: "duplicate_delivery",
      });
    }

    // Genuine edit of a message we already turned into picks: remove the old picks
    // for this exact source message before reprocessing, so an edit REPLACES rather
    // than accumulates.
    const isReprocess = alreadyProcessed && !contentUnchanged;
    if (isReprocess) {
      const { error: delErr, count } = await supabase
        .from("sbo_capper_picks")
        .delete({ count: "exact" })
        .eq("source_message_id", sourceMessageId);
      if (delErr) {
        console.error("Reprocess delete failed:", delErr.message);
        return json(500, { error: "Failed to clear prior picks", details: delErr.message });
      }
      console.log(`Reprocess ${sourceMessageId}: deleted ${count ?? 0} prior picks`);
    }

    // Store / upsert the raw post
    const { data: post, error: upsertErr } = await supabase
      .from("sbo_telegram_posts")
      .upsert(
        {
          channel_id: String(channel_id),
          channel_name: channel_name ?? null,
          channel_username: channel_username ?? null,
          capper_name: capper_name ?? null,
          message_id: String(message_id),
          message_text: message_text ?? null,
          image_url: image_url ?? null,
          has_media: !!has_media,
          edited: !!edited,
          deleted: !!deleted,
          posted_at: posted_at || new Date().toISOString(),
          processing_status: "received",
          content_hash: contentHash,
          raw_payload: body,
        },
        { onConflict: "channel_id,message_id" },
      )
      .select("id")
      .single();

    if (upsertErr) {
      console.error("Upsert failed:", upsertErr.message);
      return json(500, { error: "Failed to store post", details: upsertErr.message });
    }

    // Deletes: mark but do not dispatch
    if (deleted) {
      await supabase
        .from("sbo_telegram_posts")
        .update({ processing_status: "deleted" })
        .eq("id", post.id);
      return json(200, { ok: true, id: post.id, dispatched: false, reason: "deleted" });
    }

    // Dispatch pipeline (fire-and-forget after ACK)
    const runPipeline = async () => {
      // Image branch: unchanged — hand off to sbo-parse-capper-image
      if (has_media && (image_data || image_url)) {
        // Prefer inline base64 payload (image_data) when provided; otherwise fetch image_url.
        const dataUrl = (typeof image_data === "string" && image_data.length > 0)
          ? image_data
          : await fetchImageAsDataUrl(image_url);
        if (!dataUrl) {
          await supabase
            .from("sbo_telegram_posts")
            .update({
              processing_status: "dispatch_failed",
              dispatched_to: "sbo-parse-capper-image",
              dispatch_error: "image_fetch_failed",
            })
            .eq("id", post.id);
          return;
        }
        const { error } = await supabase.functions.invoke("sbo-parse-capper-image", {
          body: {
            image: dataUrl,
            capper_name: capper_name || channel_name || channel_username || null,
            platform: "telegram",
            source_group: channel_name || channel_username || null,
            source_group_id: String(channel_id),
            source_message_id: sourceMessageId,
            posted_by: channel_username ? `@${channel_username}` : channel_name || null,
            group_type: "direct",
          },
        });
        await supabase
          .from("sbo_telegram_posts")
          .update({
            processing_status: error ? "dispatch_failed" : "dispatched",
            dispatched_to: "sbo-parse-capper-image",
            dispatch_error: error?.message ?? null,
          })
          .eq("id", post.id);
        return;
      }

      // Text branch: identify capper, then extract pick with Claude
      const text = typeof message_text === "string" ? message_text.trim() : "";
      if (!text) {
        await supabase
          .from("sbo_telegram_posts")
          .update({
            processing_status: "dispatch_failed",
            dispatched_to: "none",
            dispatch_error: "no_content",
          })
          .eq("id", post.id);
        return;
      }

      // Stage 1: capper resolution
      const { data: capperResp, error: capperErr } = await supabase.functions.invoke(
        "sbo-auto-capper",
        {
          body: {
            mode: "process",
            telegram_user_id: String(channel_id),
            username: channel_username || null,
            display_name: capper_name || channel_name || null,
            message_text: text,
            group_type: "direct",
            source_group: channel_name || channel_username || null,
            source_group_id: String(channel_id),
            // Stage 3: the second-sighting gate keys on distinct messages.
            source_message_id: sourceMessageId,

          },
        },
      );

      if (capperErr) {
        await supabase
          .from("sbo_telegram_posts")
          .update({
            processing_status: "dispatch_failed",
            dispatched_to: "sbo-auto-capper",
            dispatch_error: capperErr.message,
          })
          .eq("id", post.id);
        return;
      }

      // If auto-capper skipped (no betting signal), don't call Claude
      if (capperResp?.action === "skipped") {
        await supabase
          .from("sbo_telegram_posts")
          .update({
            processing_status: "skipped_not_pick",
            dispatched_to: "sbo-auto-capper",
            dispatch_error: null,
          })
          .eq("id", post.id);
        return;
      }

      const capperId: string | null = capperResp?.capper_id ?? null;
      if (!capperId) {
        await supabase
          .from("sbo_telegram_posts")
          .update({
            processing_status: "dispatch_failed",
            dispatched_to: "sbo-auto-capper",
            dispatch_error: "no_capper_id_returned",
          })
          .eq("id", post.id);
        return;
      }

      // Stage 2: Claude extraction
      const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
      if (!ANTHROPIC_API_KEY) {
        console.error("ANTHROPIC_API_KEY is not configured");
        await supabase
          .from("sbo_telegram_posts")
          .update({
            processing_status: "extraction_failed",
            dispatched_to: "claude",
            dispatch_error: "anthropic_key_missing",
          })
          .eq("id", post.id);
        return;
      }

      const { pick, error: claudeErr, raw } = await extractPickWithClaude(text, ANTHROPIC_API_KEY);

      if (!pick) {
        console.error("Claude extraction failed:", claudeErr);
        await supabase
          .from("sbo_telegram_posts")
          .update({
            processing_status: "extraction_failed",
            dispatched_to: "claude",
            dispatch_error: claudeErr ?? "unknown_claude_error",
          })
          .eq("id", post.id);
        return;
      }

      if (!pick.is_pick) {
        await supabase
          .from("sbo_telegram_posts")
          .update({
            processing_status: "skipped_not_pick",
            dispatched_to: "claude",
            dispatch_error: claudeErr ?? null,
          })
          .eq("id", post.id);
        return;
      }

      // Stage 3: insert into sbo_capper_picks
      const pickText =
        pick.pick_detail ||
        [pick.team_or_player, pick.side, pick.line, pick.prop_stat]
          .filter((v) => v !== null && v !== undefined && v !== "")
          .join(" ") ||
        text.slice(0, 200);

      const insertRow: Record<string, unknown> = {
        capper_id: capperId,
        pick_text: pickText,
        raw_message: text,
        sport: canonicalizeSport(pick.sport) ?? null,
        bet_type: pick.pick_type ?? (pick.is_parlay ? "parlay" : pick.is_prop ? "prop" : null),
        prop_type: canonicalPropType(pick.prop_stat),
        line: toNumOrNull(pick.line),
        direction: pick.side ?? null,
        odds: toIntOrNull(pick.odds),
        stake: toNumOrNull(pick.units),
        game_date: normalizeGameDate(pick.game_date),
        player_name: pick.is_prop ? pick.team_or_player ?? null : null,
        team: !pick.is_prop ? pick.team_or_player ?? null : null,
        parsed_by_ai: true,
        parse_confidence: confidenceToNumber(pick.extraction_confidence),
        review_status: "pending_ai",
        result: "pending",
        data_source: "telegram",
        source_group: channel_name || channel_username || null,
        source_group_id: String(channel_id),
        source_message_id: sourceMessageId,
        posted_by: channel_username ? `@${channel_username}` : channel_name || null,
        extracted_capper_name: capperResp?.extracted_capper_name ?? null,
        capper_detection_confidence: capperResp?.capper_detection_confidence ?? null,
      };

      const { error: insertErr } = await supabase.from("sbo_capper_picks").insert(insertRow);

      // A 23505 here is the widened dedup index doing its job: this exact pick
      // already exists for this capper. Treat it as a successful no-op so the
      // post lands in 'extracted', not 'extraction_failed'.
      if (insertErr && (insertErr as { code?: string }).code === "23505") {
        console.log(
          `[dedup] duplicate pick suppressed: capper=${capperId} ` +
            `player=${insertRow.player_name ?? "-"} prop=${insertRow.prop_type ?? "-"} ` +
            `line=${insertRow.line ?? "-"} date=${insertRow.game_date ?? "-"}`,
        );
        await supabase
          .from("sbo_telegram_posts")
          .update({
            processing_status: "extracted",
            dispatched_to: "claude",
            dispatch_error: null,
          })
          .eq("id", post.id);
        return;
      }

      if (insertErr) {
        console.error("sbo_capper_picks insert failed:", insertErr.message);
        await supabase
          .from("sbo_telegram_posts")
          .update({
            processing_status: "extraction_failed",
            dispatched_to: "claude",
            dispatch_error: `insert_failed: ${insertErr.message}`,
          })
          .eq("id", post.id);
        return;
      }

      await supabase
        .from("sbo_telegram_posts")
        .update({
          processing_status: "extracted",
          dispatched_to: "claude",
          dispatch_error: null,
        })
        .eq("id", post.id);

      console.log(
        "Extracted pick for capper",
        capperId,
        "confidence",
        pick.extraction_confidence,
        raw ? `raw_len=${raw.length}` : "",
      );
    };

    // Fire and forget so we ACK Railway fast
    (async () => {
      try {
        await runPipeline();
      } catch (e) {
        console.error("Pipeline error:", (e as Error).message, (e as Error).stack);
        try {
          await supabase
            .from("sbo_telegram_posts")
            .update({
              processing_status: "extraction_failed",
              dispatch_error: `pipeline_exception: ${(e as Error).message}`,
            })
            .eq("id", post.id);
        } catch { /* ignore */ }
      }
    })();

    return json(200, { ok: true, id: post.id, stored: true });
  } catch (error) {
    const err = error as Error;
    console.error("sbo-telegram-intake unhandled error:", err.message, err.stack);
    return new Response(
      JSON.stringify({ error: err.message, stack: err.stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
