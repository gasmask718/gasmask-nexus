import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const accountSid = Deno.env.get("BRANDARO_TWILIO_ACCOUNT_SID")!;
    const authToken = Deno.env.get("BRANDARO_TWILIO_AUTH_TOKEN")!;
    const brandароNumber = "+19292623850";

    if (!accountSid || !authToken) {
      return new Response(JSON.stringify({ error: "Twilio credentials missing" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";
    const authHeader = `Basic ${btoa(`${accountSid}:${authToken}`)}`;

    // ACTION: list — fetch all recent calls with recordings from Twilio + DB
    if (action === "list") {
      const limit = parseInt(url.searchParams.get("limit") || "100");
      const vaId = url.searchParams.get("va_id");

      // Fetch from both call log tables
      let dbQuery = supabase
        .from("va_call_logs")
        .select("id, va_id, call_sid, recording_url, recording_sid, transcript, duration_seconds, call_status, disposition, called_at, direction, excitement_level, va_notes, lead_id")
        .eq("twilio_number", brandароNumber)
        .order("called_at", { ascending: false })
        .limit(limit);

      if (vaId) dbQuery = dbQuery.eq("va_id", vaId);
      const { data: vaLogs } = await dbQuery;

      let brandQuery = supabase
        .from("brandaro_call_logs")
        .select("id, called_by_user_id, call_outcome, call_notes, call_timestamp, call_duration_seconds, recording_url, lead_id, phone_used, call_attempt_number")
        .order("call_timestamp", { ascending: false })
        .limit(limit);

      if (vaId) brandQuery = brandQuery.eq("called_by_user_id", vaId);
      const { data: brandLogs } = await brandQuery;

      // Fetch VA names
      const vaIds = new Set<string>();
      (vaLogs || []).forEach((l: any) => l.va_id && vaIds.add(l.va_id));
      (brandLogs || []).forEach((l: any) => l.called_by_user_id && vaIds.add(l.called_by_user_id));

      let profiles: Record<string, string> = {};
      if (vaIds.size > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", Array.from(vaIds));
        (profileData || []).forEach((p: any) => { profiles[p.id] = p.name || "VA"; });
      }

      // Normalize into unified format
      const unified: any[] = [];

      (vaLogs || []).forEach((l: any) => {
        unified.push({
          id: l.id,
          source: "va_call_logs",
          va_id: l.va_id,
          va_name: profiles[l.va_id] || "Unknown VA",
          call_sid: l.call_sid,
          recording_url: l.recording_url,
          transcript: l.transcript,
          duration_seconds: l.duration_seconds,
          call_status: l.call_status,
          disposition: l.disposition,
          called_at: l.called_at,
          direction: l.direction,
          excitement_level: l.excitement_level,
          notes: l.va_notes,
          lead_id: l.lead_id,
        });
      });

      (brandLogs || []).forEach((l: any) => {
        unified.push({
          id: l.id,
          source: "brandaro_call_logs",
          va_id: l.called_by_user_id,
          va_name: profiles[l.called_by_user_id] || "Unknown VA",
          call_sid: null,
          recording_url: l.recording_url,
          transcript: null,
          duration_seconds: l.call_duration_seconds,
          call_status: l.call_outcome,
          disposition: l.call_outcome,
          called_at: l.call_timestamp,
          direction: "outbound",
          excitement_level: null,
          notes: l.call_notes,
          lead_id: l.lead_id,
        });
      });

      // Sort by date desc, dedup by id
      unified.sort((a, b) => new Date(b.called_at || 0).getTime() - new Date(a.called_at || 0).getTime());

      return new Response(JSON.stringify({ calls: unified.slice(0, limit) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: fetch-recording — get recording from Twilio for a specific call_sid
    if (action === "fetch-recording") {
      const callSid = url.searchParams.get("call_sid");
      if (!callSid) {
        return new Response(JSON.stringify({ error: "call_sid required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const recRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}/Recordings.json`,
        { headers: { Authorization: authHeader } },
      );

      if (!recRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch recordings from Twilio" }), {
          status: recRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const recData = await recRes.json();
      const recordings = (recData.recordings || []).map((r: any) => ({
        sid: r.sid,
        duration: r.duration,
        url: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${r.sid}.mp3`,
        date_created: r.date_created,
      }));

      return new Response(JSON.stringify({ recordings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: fetch-transcript — get transcript for a recording SID from Twilio
    if (action === "fetch-transcript") {
      const recordingSid = url.searchParams.get("recording_sid");
      if (!recordingSid) {
        return new Response(JSON.stringify({ error: "recording_sid required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const transRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}/Transcriptions.json`,
        { headers: { Authorization: authHeader } },
      );

      if (!transRes.ok) {
        return new Response(JSON.stringify({ transcript: null, status: "unavailable" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const transData = await transRes.json();
      const transcriptions = transData.transcriptions || [];

      if (transcriptions.length === 0) {
        return new Response(JSON.stringify({ transcript: null, status: "none" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const trans = transcriptions[0];
      if (trans.status !== "completed") {
        return new Response(JSON.stringify({ transcript: null, status: trans.status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch full text
      const fullRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Transcriptions/${trans.sid}.json`,
        { headers: { Authorization: authHeader } },
      );

      if (!fullRes.ok) {
        return new Response(JSON.stringify({ transcript: null, status: "fetch_error" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fullData = await fullRes.json();
      return new Response(JSON.stringify({ transcript: fullData.transcription_text, status: "completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: sync — trigger sync of all missing recordings
    if (action === "sync") {
      // Invoke the existing sync function
      const { data, error } = await supabase.functions.invoke("brandaro-sync-recordings", {
        body: {},
      });

      return new Response(JSON.stringify(data || { error: error?.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[brandaro-fetch-recordings]", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
