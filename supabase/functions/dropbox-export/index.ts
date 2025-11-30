import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DROPBOX_ACCESS_TOKEN = Deno.env.get("DROPBOX_ACCESS_TOKEN");
    
    if (!DROPBOX_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({ 
          error: "DROPBOX_ACCESS_TOKEN not configured. Add it in project secrets." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { snapshot, fileName } = await req.json();

    if (!snapshot || !fileName) {
      return new Response(
        JSON.stringify({ error: "Missing snapshot or fileName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload to Dropbox
    const uploadResponse = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DROPBOX_ACCESS_TOKEN}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: `/DynastyOS-Backups/${fileName}`,
          mode: "overwrite",
          autorename: true,
          mute: false,
        }),
      },
      body: JSON.stringify(snapshot, null, 2),
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Dropbox upload failed:", errorText);
      return new Response(
        JSON.stringify({ error: `Dropbox upload failed: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await uploadResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        filesUploaded: [result.name],
        path: result.path_display,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in dropbox-export:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
