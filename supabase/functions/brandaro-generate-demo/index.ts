import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GenerateRequest {
  lead_id: string;
  engine: "native" | "durable";
  dry_run?: boolean;
}

function generateNativeHtml(data: {
  business_name: string;
  industry: string;
  city: string;
  state: string;
  services: string[];
  phone?: string;
  template: any;
}): string {
  const { business_name, industry, city, state, services, phone, template } = data;
  const colors = template.color_scheme || { primary: "#2563eb", accent: "#f59e0b" };
  const cta = template.cta_text || "Get Your Free Quote";
  const headline = template.hero_headline.replace(/Your/g, `${city}'s`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${business_name} — ${industry} Services in ${city}, ${state}</title>
<meta name="description" content="${business_name} provides top-quality ${industry} services in ${city}, ${state}. Contact us today.">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a2e}
.hero{background:linear-gradient(135deg,${colors.primary},${colors.primary}dd);color:#fff;padding:80px 20px;text-align:center}
.hero h1{font-size:2.5rem;margin-bottom:16px;font-weight:800}
.hero p{font-size:1.2rem;opacity:0.9;max-width:600px;margin:0 auto 32px}
.cta-btn{background:${colors.accent};color:#fff;border:none;padding:16px 40px;font-size:1.1rem;border-radius:8px;cursor:pointer;font-weight:700;text-decoration:none;display:inline-block}
.cta-btn:hover{opacity:0.9}
.services{padding:60px 20px;background:#f8fafc;text-align:center}
.services h2{font-size:2rem;margin-bottom:40px;color:${colors.primary}}
.services-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px;max-width:900px;margin:0 auto}
.service-card{background:#fff;padding:32px 24px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
.service-card h3{font-size:1.1rem;margin-bottom:8px;color:${colors.primary}}
.location{padding:60px 20px;text-align:center;background:#fff}
.location h2{font-size:2rem;margin-bottom:16px;color:${colors.primary}}
.location p{font-size:1.1rem;color:#555;max-width:600px;margin:0 auto 32px}
.contact{padding:60px 20px;background:${colors.primary};color:#fff;text-align:center}
.contact h2{font-size:2rem;margin-bottom:16px}
.contact p{font-size:1.1rem;opacity:0.9;margin-bottom:32px}
${phone ? `.phone{font-size:1.8rem;font-weight:800;margin-bottom:24px}` : ''}
.footer{padding:24px;text-align:center;background:#1a1a2e;color:#fff;font-size:0.9rem;opacity:0.7}
</style>
</head>
<body>
<section class="hero">
<h1>${headline}</h1>
<p>${template.hero_subheadline}</p>
<a href="#contact" class="cta-btn">${cta}</a>
</section>
<section class="services">
<h2>Our Services</h2>
<div class="services-grid">
${services.map(s => `<div class="service-card"><h3>${s}</h3><p>Professional ${s.toLowerCase()} services backed by years of experience.</p></div>`).join('\n')}
</div>
</section>
<section class="location">
<h2>Proudly Serving ${city}, ${state}</h2>
<p>${business_name} is a trusted local ${industry} company serving ${city} and surrounding areas. We're committed to quality workmanship and customer satisfaction.</p>
<a href="#contact" class="cta-btn">${cta}</a>
</section>
<section class="contact" id="contact">
<h2>Ready to Get Started?</h2>
<p>Contact ${business_name} today for a free consultation.</p>
${phone ? `<div class="phone">${phone}</div>` : ''}
<a href="#" class="cta-btn">${cta}</a>
</section>
<footer class="footer">© ${new Date().getFullYear()} ${business_name} — ${city}, ${state}</footer>
<script>
(function(){
  const tid='${Date.now()}';
  fetch('/functions/v1/brandaro-track-demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({demo_id:tid,event_type:'page_view'})}).catch(()=>{});
})();
</script>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { lead_id, engine = "native", dry_run } = (await req.json()) as GenerateRequest;

    if (dry_run) {
      return new Response(JSON.stringify({ ok: true, dry_run: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch lead
    const { data: lead, error: leadErr } = await supabase
      .from("brandaro_qualified_leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const industry = (lead.industry || "general").toLowerCase();

    if (engine === "native") {
      // Fetch template
      const { data: template } = await supabase
        .from("brandaro_demo_templates")
        .select("*")
        .eq("industry", industry)
        .single();

      const tmpl = template || {
        hero_headline: "Excellence in Every Detail",
        hero_subheadline: "Trusted professionals dedicated to quality and customer satisfaction",
        cta_text: "Contact Us Today",
        color_scheme: { primary: "#2563eb", accent: "#f59e0b" },
      };

      const services = lead.services_inferred || [
        "Professional Services",
        "Free Consultation",
        "Licensed & Insured",
        "Customer Satisfaction",
      ];

      const html = generateNativeHtml({
        business_name: lead.business_name,
        industry,
        city: lead.city || "Your City",
        state: lead.state || "US",
        services,
        phone: lead.phone,
        template: tmpl,
      });

      const demoSlug = `${industry}-${(lead.city || "local").toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
      const demoUrl = `https://demo.brandaro.com/${demoSlug}`;

      // Insert demo record
      const { data: demo, error: insertErr } = await supabase
        .from("brandaro_demo_sites")
        .insert({
          lead_id,
          business_name: lead.business_name,
          industry: lead.industry,
          city: lead.city,
          state: lead.state,
          services_inferred: services,
          seo_text: `${lead.business_name} provides top-quality ${industry} services in ${lead.city || "your area"}, ${lead.state || "US"}.`,
          generation_status: "ready",
          generation_engine: "native",
          engine_status: "ready",
          template_used: industry,
          demo_url: demoUrl,
          hosting_path: `/demos/${demoSlug}`,
          generated_html: html,
        })
        .select()
        .single();

      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update lead status
      await supabase
        .from("brandaro_qualified_leads")
        .update({ demo_status: "generated" })
        .eq("id", lead_id);

      return new Response(JSON.stringify({ success: true, demo, engine: "native" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (engine === "durable") {
      // Durable integration scaffold — insert pending record
      const demoSlug = `durable-${(lead.city || "local").toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;

      const { data: demo, error: insertErr } = await supabase
        .from("brandaro_demo_sites")
        .insert({
          lead_id,
          business_name: lead.business_name,
          industry: lead.industry,
          city: lead.city,
          state: lead.state,
          services_inferred: lead.services_inferred,
          seo_text: `${lead.business_name} — ${lead.industry} in ${lead.city}, ${lead.state}`,
          generation_status: "generating",
          generation_engine: "durable",
          engine_status: "pending",
          template_used: null,
        })
        .select()
        .single();

      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // TODO: Wire Durable.co API here
      // For now, simulate generation after a brief delay
      // In production, this would call the Durable API and update on callback

      return new Response(
        JSON.stringify({
          success: true,
          demo,
          engine: "durable",
          message: "Durable generation queued. Will update when API is wired.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid engine" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Demo generation error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
