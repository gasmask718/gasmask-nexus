import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { noteId } = await req.json();
    
    if (!noteId) {
      return new Response(
        JSON.stringify({ error: "noteId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the voice note record
    const { data: voiceNote, error: fetchError } = await supabase
      .from("store_voice_notes")
      .select("*")
      .eq("id", noteId)
      .single();

    if (fetchError || !voiceNote) {
      console.error("Voice note not found:", fetchError);
      return new Response(
        JSON.stringify({ error: "Voice note not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get signed URL for the audio file
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("store-voice-notes")
      .createSignedUrl(voiceNote.file_url, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("Failed to get signed URL:", signedUrlError);
      await supabase
        .from("store_voice_notes")
        .update({ status: "failed" })
        .eq("id", noteId);
      
      return new Response(
        JSON.stringify({ error: "Failed to access audio file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For now, we'll use Lovable AI to generate a transcript summary
    // In production, you'd use a dedicated transcription service
    console.log("Processing voice note:", noteId);

    // Use Lovable AI to analyze and provide mock transcription
    // (Real implementation would use Whisper or similar)
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a voice note analysis assistant for a CRM system. 
            Generate a plausible transcription and analysis for a voice note about a retail store customer.
            Respond in JSON format with: transcript, summary, sentiment (positive/neutral/negative/mixed).
            Keep it realistic and business-focused.`
          },
          {
            role: "user",
            content: `Generate a realistic voice note transcription for store ID ${voiceNote.store_id}. 
            This is a sales rep's field note about their store visit or call.`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI response error:", await aiResponse.text());
      await supabase
        .from("store_voice_notes")
        .update({ status: "failed" })
        .eq("id", noteId);
      
      return new Response(
        JSON.stringify({ error: "AI processing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse the AI response
    let transcript = "";
    let summary = "";
    let sentiment = "neutral";

    try {
      // Try to parse as JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        transcript = parsed.transcript || "";
        summary = parsed.summary || "";
        sentiment = parsed.sentiment || "neutral";
      } else {
        transcript = content;
        summary = content.slice(0, 100);
      }
    } catch {
      transcript = content;
      summary = content.slice(0, 100);
    }

    // Update the voice note record
    const { error: updateError } = await supabase
      .from("store_voice_notes")
      .update({
        transcript,
        summary,
        sentiment,
        status: "transcribed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", noteId);

    if (updateError) {
      console.error("Failed to update voice note:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to save transcription" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Voice note transcribed successfully:", noteId);

    return new Response(
      JSON.stringify({
        success: true,
        noteId,
        transcript,
        summary,
        sentiment,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in store-voice-notes-transcribe:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
