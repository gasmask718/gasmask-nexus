import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/** Legacy voice-note screen: delegate to the real authenticated transcription/check-card pipeline. */
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const { noteId } = await req.json();
    if (!noteId) return new Response(JSON.stringify({ error: "noteId is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/store-voice-update-process`, {
      method: "POST",
      headers: { Authorization: req.headers.get("Authorization") || "", apikey: Deno.env.get("SUPABASE_ANON_KEY") || "", "Content-Type": "application/json" },
      body: JSON.stringify({ noteId }),
    });
    if (!response.ok) {
      const message = await response.text();
      return new Response(JSON.stringify({ error: message.slice(0, 1000) }), { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const events = (await response.text()).split("\n").filter(Boolean).map(line => JSON.parse(line));
    const failure = events.find(event => event.type === "error");
    if (failure) return new Response(JSON.stringify({ error: failure.message }), { status: failure.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const transcript = events.find(event => event.type === "transcript")?.transcript || "";
    const result = events.find(event => event.type === "result");
    if (!result) return new Response(JSON.stringify({ error: "No check card was returned" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ success: true, noteId, transcript, summary: result.check_card.summary, sentiment: "neutral", check_card: result.check_card }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Voice processing failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
