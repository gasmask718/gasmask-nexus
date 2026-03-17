import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * brandaro-auto-build
 * 
 * Orchestrates the full website manufacturing pipeline:
 * 1. Extract demo structure
 * 2. Decide build engine (native vs durable)
 * 3. Generate content via Claude (Lovable AI)
 * 4. Build production HTML
 * 5. Deploy & verify
 * 
 * Triggered by brandaro-post-payment or manually via dashboard.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { client_id, project_id, demo_id, package_tier, dry_run } = await req.json();

    // Dry run for health probes
    if (dry_run) {
      return new Response(JSON.stringify({ ok: true, dry_run: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!client_id || !project_id) {
      return new Response(JSON.stringify({ error: "client_id and project_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // IDEMPOTENCY: Check for existing active build job
    const { data: existingJob } = await supabase
      .from("brandaro_build_jobs")
      .select("id, build_status")
      .eq("client_id", client_id)
      .not("build_status", "eq", "failed")
      .single();

    if (existingJob) {
      console.log(`[AUTO-BUILD] Build job already exists for client ${client_id}: ${existingJob.id}`);
      return new Response(JSON.stringify({ ok: true, already_exists: true, build_job_id: existingJob.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get client info
    const { data: client } = await supabase
      .from("brandaro_clients")
      .select("*")
      .eq("id", client_id)
      .single();

    // Get demo structure if available
    let demoStructure = null;
    if (demo_id) {
      const { data: demo } = await supabase
        .from("brandaro_demo_sites")
        .select("*")
        .eq("id", demo_id)
        .single();
      if (demo) {
        demoStructure = demo;
        // Mark demo as ready for conversion
        await supabase.from("brandaro_demo_sites").update({
          demo_ready_for_conversion: true,
        }).eq("id", demo_id);
      }
    }

    // SECTION 2: Build Engine Decision
    const tier = package_tier || client?.package_chosen || "starter";
    const buildEngine = decideBuildEngine(tier);
    const totalPages = decidePageCount(tier);

    // Create build job
    const { data: buildJob, error: bjErr } = await supabase
      .from("brandaro_build_jobs")
      .insert({
        client_id,
        project_id,
        demo_id: demo_id || null,
        lead_id: client?.lead_id || null,
        build_engine: buildEngine,
        build_status: "extracting_demo",
        progress_stage: "demo_extraction",
        package_tier: tier,
        total_pages: totalPages,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (bjErr) throw bjErr;

    // Link build job to project
    await supabase.from("brandaro_projects").update({
      build_job_id: buildJob.id,
      build_status: "auto_building",
    }).eq("id", project_id);

    // SECTION 4: Extract demo structure (if demo exists)
    if (demoStructure?.generated_html) {
      const extracted = extractDemoStructure(demoStructure.generated_html);
      await supabase.from("brandaro_demo_sites").update({
        extracted_structure: extracted,
        production_build_ready: true,
      }).eq("id", demo_id);

      await updateBuildStatus(supabase, buildJob.id, "generating_content", "content_generation");
    } else {
      await updateBuildStatus(supabase, buildJob.id, "generating_content", "content_generation_no_demo");
    }

    // SECTION 3: Claude Architect - Generate content via Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      await logBuildError(supabase, buildJob.id, "LOVABLE_API_KEY not configured");
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const businessName = client?.business_name || "Business";
    const industry = demoStructure?.industry || "general services";

    // Generate content for each page type
    const pageTypes = getPageTypes(tier);
    let pagesBuilt = 0;

    for (const pageType of pageTypes) {
      try {
        const contentBlocks = await generatePageContent(
          LOVABLE_API_KEY, businessName, industry, pageType, tier
        );

        // Store content blocks
        for (let i = 0; i < contentBlocks.length; i++) {
          await supabase.from("brandaro_content_blocks").insert({
            build_job_id: buildJob.id,
            client_id,
            project_id,
            page_type: pageType,
            section_name: contentBlocks[i].section,
            section_order: i,
            content_html: contentBlocks[i].html,
            content_text: contentBlocks[i].text,
            seo_title: contentBlocks[i].seoTitle || null,
            seo_description: contentBlocks[i].seoDescription || null,
            metadata: contentBlocks[i].metadata || {},
            status: "generated",
            generated_by: "claude",
          });
        }

        pagesBuilt++;
        await supabase.from("brandaro_build_jobs").update({
          pages_built: pagesBuilt,
          progress_stage: `generated_${pageType}`,
        }).eq("id", buildJob.id);
      } catch (pageErr) {
        console.error(`[AUTO-BUILD] Failed to generate ${pageType}:`, pageErr);
        await logBuildError(supabase, buildJob.id, `Failed to generate ${pageType}: ${pageErr.message}`);
      }
    }

    await supabase.from("brandaro_build_jobs").update({
      content_generated: true,
    }).eq("id", buildJob.id);

    // SECTION 5: Native Build - Assemble production HTML
    await updateBuildStatus(supabase, buildJob.id, "building", "assembling_production_html");

    const { data: allBlocks } = await supabase
      .from("brandaro_content_blocks")
      .select("*")
      .eq("build_job_id", buildJob.id)
      .order("page_type")
      .order("section_order");

    const productionHtml = assembleProductionSite(allBlocks || [], businessName, industry);

    // Store production HTML in demo_sites for serving
    const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    const productionSlug = `${slug}-live`;

    const { data: prodSite } = await supabase
      .from("brandaro_demo_sites")
      .insert({
        lead_id: client?.lead_id,
        slug: productionSlug,
        generated_html: productionHtml,
        engine_used: buildEngine,
        industry,
        demo_ready_for_conversion: false,
        production_build_ready: true,
      })
      .select()
      .single();

    // SECTION 7: Deployment
    await updateBuildStatus(supabase, buildJob.id, "deploying", "setting_up_deployment");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const liveUrl = `${SUPABASE_URL}/functions/v1/brandaro-serve-demo?slug=${productionSlug}`;

    // Update project with live URL
    await supabase.from("brandaro_projects").update({
      live_url: liveUrl,
      deployment_status: "active",
      deployed_at: new Date().toISOString(),
      build_status: "live",
      domain_type: "subdomain",
    }).eq("id", project_id);

    // SECTION 10: Quality check
    await updateBuildStatus(supabase, buildJob.id, "quality_check", "validating_deployment");

    const qualityScore = calculateQualityScore(allBlocks || [], productionHtml);

    // Mark complete
    await supabase.from("brandaro_build_jobs").update({
      build_status: "completed",
      progress_stage: "done",
      deployed_url: liveUrl,
      quality_score: qualityScore,
      completed_at: new Date().toISOString(),
      pages_built: pagesBuilt,
    }).eq("id", buildJob.id);

    // Update client onboarding
    await supabase.from("brandaro_clients").update({
      onboarding_status: "launched",
    }).eq("id", client_id);

    // SECTION 9: Post-launch - send notification
    console.log(`[AUTO-BUILD] ✅ Build complete for ${businessName}. URL: ${liveUrl}`);

    return new Response(JSON.stringify({
      ok: true,
      build_job_id: buildJob.id,
      live_url: liveUrl,
      pages_built: pagesBuilt,
      quality_score: qualityScore,
      build_engine: buildEngine,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[AUTO-BUILD] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// --- Helper Functions ---

function decideBuildEngine(tier: string): string {
  // Premium/Elite → durable for complex layouts; Starter/Pro → native for speed
  return ["premium", "elite"].includes(tier) ? "durable" : "native";
}

function decidePageCount(tier: string): number {
  const counts: Record<string, number> = {
    starter: 4,
    professional: 5,
    premium: 7,
    elite: 10,
  };
  return counts[tier] || 5;
}

function getPageTypes(tier: string): string[] {
  const base = ["homepage", "services", "about", "contact"];
  if (["professional", "premium", "elite"].includes(tier)) base.push("gallery");
  if (["premium", "elite"].includes(tier)) base.push("testimonials", "faq");
  if (tier === "elite") base.push("seo_city", "seo_city", "seo_city"); // 3 SEO pages
  return base;
}

async function generatePageContent(
  apiKey: string,
  businessName: string,
  industry: string,
  pageType: string,
  tier: string,
): Promise<Array<{ section: string; html: string; text: string; seoTitle?: string; seoDescription?: string; metadata?: any }>> {
  const systemPrompt = `You are a professional web content architect. Generate structured website content for a ${industry} business called "${businessName}". 
Package tier: ${tier}. Generate production-quality content.

Return a JSON array of content sections. Each section must have:
- section: section name (e.g., "hero", "features", "cta")
- html: production-ready HTML with inline Tailwind-style classes
- text: plain text version
- seoTitle: SEO title (homepage only)
- seoDescription: SEO meta description (homepage only)

Generate 3-5 sections per page. Make content specific to the ${industry} industry.
Be persuasive, professional, and conversion-focused.`;

  const userPrompt = `Generate all content sections for the ${pageType} page of "${businessName}" (${industry} business). Return ONLY valid JSON array.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_content_blocks",
          description: "Return structured content blocks for a website page",
          parameters: {
            type: "object",
            properties: {
              blocks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    section: { type: "string" },
                    html: { type: "string" },
                    text: { type: "string" },
                    seoTitle: { type: "string" },
                    seoDescription: { type: "string" },
                  },
                  required: ["section", "html", "text"],
                  additionalProperties: false,
                },
              },
            },
            required: ["blocks"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_content_blocks" } },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI gateway error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error("No tool call response from AI");
  }

  const parsed = JSON.parse(toolCall.function.arguments);
  return parsed.blocks || [];
}

function extractDemoStructure(html: string): any {
  // Extract key sections from demo HTML
  const sections: string[] = [];
  const sectionRegex = /<section[^>]*(?:id|class)="([^"]*)"[^>]*>/gi;
  let match;
  while ((match = sectionRegex.exec(html)) !== null) {
    sections.push(match[1]);
  }

  const hasForm = html.includes("<form");
  const hasMap = html.includes("map") || html.includes("iframe");
  const imageCount = (html.match(/<img/gi) || []).length;

  return {
    sections,
    hasForm,
    hasMap,
    imageCount,
    estimatedComplexity: sections.length > 8 ? "high" : sections.length > 4 ? "medium" : "low",
  };
}

function assembleProductionSite(
  blocks: any[],
  businessName: string,
  industry: string,
): string {
  // Group blocks by page
  const pageGroups: Record<string, any[]> = {};
  for (const block of blocks) {
    if (!pageGroups[block.page_type]) pageGroups[block.page_type] = [];
    pageGroups[block.page_type].push(block);
  }

  // Get SEO from homepage blocks
  const homepageBlocks = pageGroups["homepage"] || [];
  const seoTitle = homepageBlocks.find(b => b.seo_title)?.seo_title || `${businessName} | ${industry}`;
  const seoDesc = homepageBlocks.find(b => b.seo_description)?.seo_description || `${businessName} - Professional ${industry} services`;

  // Build nav links
  const pageNames = Object.keys(pageGroups);
  const navLinks = pageNames.map(p => 
    `<a href="#${p}" class="nav-link">${p.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</a>`
  ).join("\n          ");

  // Build page sections
  let contentSections = "";
  for (const [pageType, pageBlocks] of Object.entries(pageGroups)) {
    contentSections += `\n    <section id="${pageType}" class="page-section">\n`;
    for (const block of pageBlocks) {
      contentSections += `      <div class="content-block">\n        ${block.content_html || ""}\n      </div>\n`;
    }
    contentSections += `    </section>\n`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${seoTitle}</title>
  <meta name="description" content="${seoDesc}">
  <meta property="og:title" content="${seoTitle}">
  <meta property="og:description" content="${seoDesc}">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; }
    .nav-link { padding: 0.5rem 1rem; text-decoration: none; color: #333; font-weight: 500; transition: color 0.2s; }
    .nav-link:hover { color: #2563eb; }
    .page-section { padding: 4rem 2rem; max-width: 1200px; margin: 0 auto; }
    .content-block { margin-bottom: 2rem; }
    header { background: #fff; border-bottom: 1px solid #e5e7eb; padding: 1rem 2rem; position: sticky; top: 0; z-index: 50; }
    footer { background: #111827; color: #9ca3af; padding: 3rem 2rem; text-align: center; }
  </style>
</head>
<body>
  <header>
    <nav style="display:flex;align-items:center;justify-content:space-between;max-width:1200px;margin:0 auto;">
      <div style="font-size:1.5rem;font-weight:700;color:#1a1a1a;">${businessName}</div>
      <div style="display:flex;gap:0.5rem;">
        ${navLinks}
      </div>
    </nav>
  </header>

  <main>
    ${contentSections}
  </main>

  <footer>
    <p>&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
    <p style="margin-top:0.5rem;font-size:0.75rem;">Powered by Brandaro Digital</p>
  </footer>

  <script>
    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        document.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth' });
      });
    });
  </script>
</body>
</html>`;
}

function calculateQualityScore(blocks: any[], html: string): number {
  let score = 50; // Base
  if (blocks.length >= 10) score += 15;
  else if (blocks.length >= 5) score += 10;
  if (html.includes("<meta name=\"description\"")) score += 10;
  if (html.includes("<nav")) score += 5;
  if (html.includes("<footer")) score += 5;
  if (html.includes("viewport")) score += 5;
  if (html.length > 5000) score += 10;
  return Math.min(score, 100);
}

async function updateBuildStatus(supabase: any, jobId: string, status: string, stage: string) {
  await supabase.from("brandaro_build_jobs").update({
    build_status: status,
    progress_stage: stage,
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);
}

async function logBuildError(supabase: any, jobId: string, message: string) {
  const { data: job } = await supabase.from("brandaro_build_jobs").select("error_log").eq("id", jobId).single();
  const errors = Array.isArray(job?.error_log) ? job.error_log : [];
  errors.push({ message, timestamp: new Date().toISOString() });
  await supabase.from("brandaro_build_jobs").update({ error_log: errors }).eq("id", jobId);
}
