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

    // Check if there's already a running job
    const { data: existingJob } = await supabase
      .from("note_cleaner_jobs")
      .select("id")
      .eq("status", "running")
      .maybeSingle();

    if (existingJob) {
      return new Response(
        JSON.stringify({ error: "A cleaning job is already running", job_id: existingJob.id }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch dirty notes
    const { data: notes, error: fetchErr } = await supabase
      .from("store_notes")
      .select("id, store_id, note_text, created_at")
      .or("note_text.ilike.%<div>%,note_text.ilike.%<br>%,note_text.ilike.%<p %,note_text.ilike.%<span>%,note_text.ilike.%&amp;%,note_text.ilike.%&nbsp;%,note_text.ilike.%â%")
      .is("cleaning_status", null)
      .order("created_at", { ascending: true })
      .limit(500);

    if (fetchErr) throw fetchErr;

    const dirtyNotes = (notes || []).filter((n: any) => needsCleaning(n.note_text));

    if (dirtyNotes.length === 0) {
      return new Response(
        JSON.stringify({ message: "No dirty notes found", job_id: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create job record
    const { data: job, error: jobErr } = await supabase
      .from("note_cleaner_jobs")
      .insert({
        status: "running",
        total_records: dirtyNotes.length,
        processed_records: 0,
        failed_records: 0,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (jobErr) throw jobErr;

    // Return immediately — client can poll
    const jobId = job.id;

    // Respond to client right away
    const responseBody = JSON.stringify({
      success: true,
      job_id: jobId,
      total: dirtyNotes.length,
      message: "Cleaning job started — runs server-side",
    });

    // Kick off background processing (non-blocking)
    const processingPromise = (async () => {
      let processed = 0;
      let failed = 0;
      const results: any[] = [];

      for (const note of dirtyNotes) {
        try {
          // Update current record
          await supabase
            .from("note_cleaner_jobs")
            .update({ current_record: note.id })
            .eq("id", jobId);

          // Call AI to clean
          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `RAW NOTE:\n${note.note_text}\n\nCLEANED NOTE:` },
              ],
            }),
          });

          if (aiResp.status === 429) {
            // Rate limited — wait and retry
            await new Promise((r) => setTimeout(r, 5000));
            const retryResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
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

            results.push({ id: note.id, status: "cleaned" });
            processed++;
          } else if (!aiResp.ok) {
            throw new Error(`AI error: ${aiResp.status}`);
          } else {
            const aiData = await aiResp.json();
            const cleanedText = aiData.choices?.[0]?.message?.content?.trim() || "";

            // Save cleaned note back
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

            results.push({ id: note.id, status: "cleaned" });
            processed++;
          }
        } catch (err: any) {
          failed++;
          results.push({ id: note.id, status: "failed", error: err.message });
        }

        // Update progress
        await supabase
          .from("note_cleaner_jobs")
          .update({
            processed_records: processed + failed,
            failed_records: failed,
            results,
          })
          .eq("id", jobId);

        // Delay between notes to avoid rate limits
        await new Promise((r) => setTimeout(r, 1000));
      }

      // Mark complete
      await supabase
        .from("note_cleaner_jobs")
        .update({
          status: "complete",
          processed_records: processed,
          failed_records: failed,
          results,
          current_record: null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    })();

    // Don't await — let it run in background
    // Edge functions in Deno have ~400s timeout, which is enough for many notes
    // For very large batches, the function will process as many as it can
    processingPromise.catch(async (err) => {
      console.error("Background processing error:", err);
      await supabase
        .from("note_cleaner_jobs")
        .update({
          status: "failed",
          error: err.message || "Unknown background error",
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    });

    // Wait for the processing to complete before responding
    // This ensures the edge function stays alive while processing
    await processingPromise;

    return new Response(responseBody, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("run-note-cleaner error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
