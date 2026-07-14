// SBO Telegram Intake — receives raw posts from the Railway Telethon worker,
// stores them, and dispatches to the SBO extraction pipeline.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
        raw_payload: body,
      },
      { onConflict: "channel_id,message_id" }
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

  // Dispatch to the extraction pipeline (fire-and-forget)
  const dispatchOne = async (): Promise<{ target: string; error?: string }> => {
    if (has_media && image_url) {
      const dataUrl = await fetchImageAsDataUrl(image_url);
      if (!dataUrl) return { target: "sbo-parse-capper-image", error: "image_fetch_failed" };
      const { error } = await supabase.functions.invoke("sbo-parse-capper-image", {
        body: {
          image: dataUrl,
          capper_name: capper_name || channel_name || channel_username || null,
          platform: "telegram",
          source_group: channel_name || channel_username || null,
          source_group_id: String(channel_id),
          posted_by: channel_username ? `@${channel_username}` : channel_name || null,
          group_type: "direct",
        },
      });
      return { target: "sbo-parse-capper-image", error: error?.message };
    }
    if (message_text && String(message_text).trim().length > 0) {
      const { error } = await supabase.functions.invoke("sbo-auto-capper", {
        body: {
          mode: "process",
          telegram_user_id: String(channel_id),
          username: channel_username || null,
          display_name: capper_name || channel_name || null,
          message_text,
          group_type: "direct",
          source_group: channel_name || channel_username || null,
          source_group_id: String(channel_id),
        },
      });
      return { target: "sbo-auto-capper", error: error?.message };
    }
    return { target: "none", error: "no_content" };
  };

  // Fire and forget so we ACK Railway fast
  (async () => {
    const result = await dispatchOne();
    await supabase
      .from("sbo_telegram_posts")
      .update({
        processing_status: result.error ? "dispatch_failed" : "dispatched",
        dispatched_to: result.target,
        dispatch_error: result.error ?? null,
      })
      .eq("id", post.id);
  })();

  return json(200, { ok: true, id: post.id, stored: true });
});
