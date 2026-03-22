import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a business notes editor for Dynasty OS, a retail intelligence platform.

The following account note was imported from a legacy system and contains raw HTML tags, HTML-encoded characters (like &amp; &nbsp; &lt; &gt;), and broken UTF-8 characters (like â\u0080\u009c for smart quotes, donâ\u0080\u0099t for doesn't).

Your job:
1. Strip ALL HTML tags completely
2. Decode all HTML entities: &amp; → &, &nbsp; → space, &lt; → <, &gt; → >, &#39; → '
3. Fix all broken characters: â\u0080\u009c → ", â\u0080\u009d → ", â\u0080\u0099 → ', donâ\u0080\u0099t → doesn't, canâ\u0080\u0099t → can't, isnâ\u0080\u0099t → isn't, wonâ\u0080\u0099t → won't, didnâ\u0080\u0099t → didn't
4. Rewrite the content in clear, professional English
5. Preserve ALL factual information — names, phone numbers, dates, addresses, dollar amounts
6. If there is a structured OVERVIEW section (boss name, manager name, store number, etc.), format it as a clean labeled list
7. If there are visit notes with dates, format each as: [DATE] — [Clean note text]
8. Do not add information that was not in the original
9. Do not remove any factual details
10. Return ONLY the cleaned note text — no explanation, no preamble`;

function needsCleaning(note: string | null): boolean {
  if (!note) return false;
  const htmlPattern = /<\/?[a-z][\s\S]*?>/i;
  const entityPattern = /&amp;|&nbsp;|&lt;|&gt;|&#\d+;/i;
  const brokenCharPattern = /â|Â|donâ|canâ|isnâ|wonâ|didnâ/;
  return htmlPattern.test(note) || entityPattern.test(note) || brokenCharPattern.test(note);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { batch_size = 10, job_id = null } = await req.json().catch(() => ({}));

    // If resuming an existing job
    let jobRecord: any = null;
    if (job_id) {
      const { data } = await supabase
        .from("note_cleaner_jobs")
        .select("*")
        .eq("id", job_id)
        .single();
      jobRecord = data;
      if (!jobRecord) throw new Error("Job not found");
    }

    // Fetch one batch of dirty notes (only uncleaned ones)
    const { data: notes, error: fetchErr } = await supabase
      .from("store_notes")
      .select("id, store_id, note_text, created_at")
      .or("note_text.ilike.%<div>%,note_text.ilike.%<br>%,note_text.ilike.%<p %,note_text.ilike.%<span>%,note_text.ilike.%&amp;%,note_text.ilike.%&nbsp;%,note_text.ilike.%â%")
      .is("cleaning_status", null)
      .order("created_at", { ascending: true })
      .limit(batch_size);

    if (fetchErr) throw fetchErr;

    const dirtyNotes = (notes || []).filter((n: any) => needsCleaning(n.note_text));

    // If no job yet, create one and count total
    if (!jobRecord) {
      // Count all dirty notes for the job total
      const { count } = await supabase
        .from("store_notes")
        .select("*", { count: "exact", head: true })
        .or("note_text.ilike.%<div>%,note_text.ilike.%<br>%,note_text.ilike.%<p %,note_text.ilike.%<span>%,note_text.ilike.%&amp;%,note_text.ilike.%&nbsp;%,note_text.ilike.%â%")
        .is("cleaning_status", null);

      if (!dirtyNotes.length) {
        return new Response(
          JSON.stringify({ success: true, message: "No dirty notes found", job_id: null, has_more: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: newJob, error: jobErr } = await supabase
        .from("note_cleaner_jobs")
        .insert({
          status: "running",
          total_records: count || dirtyNotes.length,
          processed_records: 0,
          failed_records: 0,
          started_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (jobErr) throw jobErr;
      jobRecord = newJob;
    }

    // If no more dirty notes, mark complete
    if (!dirtyNotes.length) {
      await supabase
        .from("note_cleaner_jobs")
        .update({
          status: "complete",
          completed_at: new Date().toISOString(),
          current_record: null,
        })
        .eq("id", jobRecord.id);

      return new Response(
        JSON.stringify({
          success: true,
          job_id: jobRecord.id,
          status: "complete",
          total_processed: jobRecord.processed_records,
          total_records: jobRecord.total_records,
          has_more: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process this batch
    let processed = 0;
    let failed = 0;

    for (const note of dirtyNotes) {
      try {
        await supabase
          .from("note_cleaner_jobs")
          .update({ current_record: note.id })
          .eq("id", jobRecord.id);

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: `RAW NOTE:\n${note.note_text}\n\nCLEANED NOTE:` },
            ],
          }),
        });

        if (aiResp.status === 429) {
          // Rate limited — wait and retry once
          await new Promise((r) => setTimeout(r, 5000));
          const retryResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `RAW NOTE:\n${note.note_text}\n\nCLEANED NOTE:` },
              ],
            }),
          });
          if (!retryResp.ok) throw new Error(`AI error after retry: ${retryResp.status}`);
          const retryData = await retryResp.json();
          const cleanedText = retryData.choices?.[0]?.message?.content?.trim() || "";
          await supabase
            .from("store_notes")
            .update({
              original_note: note.note_text,
              note_text: cleanedText,
              is_legacy: true,
              needs_cleaning: false,
              cleaning_status: "approved",
              cleaned_at: new Date().toISOString(),
            })
            .eq("id", note.id);
          processed++;
        } else if (!aiResp.ok) {
          const errText = await aiResp.text();
          throw new Error(`AI error ${aiResp.status}: ${errText.slice(0, 200)}`);
        } else {
          const aiData = await aiResp.json();
          const cleanedText = aiData.choices?.[0]?.message?.content?.trim() || "";
          await supabase
            .from("store_notes")
            .update({
              original_note: note.note_text,
              note_text: cleanedText,
              is_legacy: true,
              needs_cleaning: false,
              cleaning_status: "approved",
              cleaned_at: new Date().toISOString(),
            })
            .eq("id", note.id);
          processed++;
        }
      } catch (err: any) {
        console.error(`Failed to clean ${note.id}:`, err.message);
        failed++;
        // Mark this note so we skip it next batch
        await supabase
          .from("store_notes")
          .update({ cleaning_status: "failed" })
          .eq("id", note.id);
      }

      // Small delay between notes
      await new Promise((r) => setTimeout(r, 500));
    }

    // Update job progress
    const newProcessed = (jobRecord.processed_records || 0) + processed;
    const newFailed = (jobRecord.failed_records || 0) + failed;

    await supabase
      .from("note_cleaner_jobs")
      .update({
        processed_records: newProcessed,
        failed_records: newFailed,
        current_record: null,
      })
      .eq("id", jobRecord.id);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobRecord.id,
        processed_this_batch: processed,
        failed_this_batch: failed,
        total_processed: newProcessed,
        total_records: jobRecord.total_records,
        status: "running",
        has_more: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("run-note-cleaner error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
