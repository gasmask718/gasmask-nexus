import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Extract slug from query param or path
    const slug = url.searchParams.get("slug") || url.pathname.split("/").pop();

    if (!slug || slug === "brandaro-serve-demo") {
      return new Response(JSON.stringify({ error: "slug required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find demo by slug or ID
    let query = supabase.from("brandaro_demo_sites").select("*");
    
    // Try slug first, then ID
    const { data: demoBySlug } = await query.eq("slug", slug).single();
    let demo = demoBySlug;
    
    if (!demo) {
      const { data: demoById } = await supabase
        .from("brandaro_demo_sites")
        .select("*")
        .eq("id", slug)
        .single();
      demo = demoById;
    }

    if (!demo) {
      return new Response(
        `<!DOCTYPE html><html><head><title>Not Found</title></head><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0f172a;color:#94a3b8"><div style="text-align:center"><h1 style="color:#e2e8f0">Demo Not Found</h1><p>This demo may have expired or been removed.</p></div></body></html>`,
        { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // Record view event
    await supabase.from("brandaro_demo_events").insert({
      demo_id: demo.id,
      lead_id: demo.lead_id,
      event_type: "page_view",
      event_data: { source: "direct", user_agent: req.headers.get("user-agent") || "" },
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    });

    // Update view count
    await supabase
      .from("brandaro_demo_sites")
      .update({
        view_count: (demo.view_count || 0) + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq("id", demo.id);

    // Update engagement score on lead
    if (demo.lead_id) {
      const { data: lead } = await supabase
        .from("brandaro_qualified_leads")
        .select("engagement_score, lead_status")
        .eq("id", demo.lead_id)
        .single();

      if (lead) {
        const newScore = (lead.engagement_score || 0) + 5;
        const updates: Record<string, any> = { engagement_score: newScore };
        if (newScore >= 100 && lead.lead_status !== "sold") {
          updates.lead_status = "priority_call";
        } else if (newScore >= 50 && !["hot_lead", "priority_call", "sold"].includes(lead.lead_status || "")) {
          updates.lead_status = "hot_lead";
        }
        await supabase.from("brandaro_qualified_leads").update(updates).eq("id", demo.lead_id);
      }
    }

    // If we have generated HTML, serve it with tracking script injected
    if (demo.generated_html) {
      const trackingScript = `
<script>
(function(){
  var demoId="${demo.id}";
  var leadId="${demo.lead_id||""}";
  var baseUrl="${Deno.env.get("SUPABASE_URL")}/functions/v1/brandaro-track-demo-event";
  var anonKey="${Deno.env.get("SUPABASE_ANON_KEY")||""}";
  function track(type,val){
    fetch(baseUrl,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+anonKey},
    body:JSON.stringify({demo_id:demoId,lead_id:leadId,event_type:type,event_value:val})}).catch(function(){});
  }
  var maxScroll=0;
  window.addEventListener("scroll",function(){
    var pct=Math.round((window.scrollY/(document.body.scrollHeight-window.innerHeight))*100);
    if(pct>=25&&maxScroll<25){track("scroll_25");maxScroll=25;}
    if(pct>=50&&maxScroll<50){track("scroll_50");maxScroll=50;}
    if(pct>=75&&maxScroll<75){track("scroll_75");maxScroll=75;}
  });
  document.addEventListener("click",function(e){
    var t=e.target;
    if(t.tagName==="A"||t.tagName==="BUTTON"||(t.closest&&t.closest("a,button"))){
      var text=(t.textContent||"").trim().substring(0,50);
      track("cta_click",text);
    }
  });
  setTimeout(function(){track("page_view");},500);
})();
</script>`;
      
      const html = demo.generated_html.replace("</body>", trackingScript + "</body>");
      
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
      });
    }

    // No HTML — redirect to demo_url if available
    if (demo.demo_url) {
      return Response.redirect(demo.demo_url, 302);
    }

    // Fallback: show placeholder
    return new Response(
      `<!DOCTYPE html><html><head><title>${demo.business_name} - Website Preview</title></head>
      <body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0f172a;color:#e2e8f0">
      <div style="text-align:center;max-width:500px;padding:2rem">
        <h1>${demo.business_name}</h1>
        <p style="color:#94a3b8">Your website preview is being prepared. Check back soon!</p>
        <p style="color:#67e8f9;margin-top:2rem">Powered by Brandaro Digital</p>
      </div></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (err) {
    console.error("Serve demo error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
