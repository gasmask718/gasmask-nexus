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

    // SECTION 2: Build Engine Decision (Durable-First Hybrid)
    const tier = package_tier || client?.package_chosen || "starter";
    const isRebuild = !!(await req.clone().json().catch(() => ({}))).rebuild;
    const initialEngine = decideBuildEngine(tier, !isRebuild);
    const buildEngine = initialEngine;
    const totalPages = decidePageCount(tier);

    // Create build job with hybrid engine tracking
    const { data: buildJob, error: bjErr } = await supabase
      .from("brandaro_build_jobs")
      .insert({
        client_id,
        project_id,
        demo_id: demo_id || null,
        lead_id: client?.lead_id || null,
        build_engine: buildEngine,
        initial_engine: initialEngine,
        final_engine: buildEngine,
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

    // ===== DURABLE-FIRST HYBRID: EXTRACTION + STANDARDIZATION =====
    // If initial engine was Durable and demo HTML exists, extract design patterns
    // then rebuild using native engine for full control
    if (initialEngine === "durable" && demoStructure?.generated_html) {
      await updateBuildStatus(supabase, buildJob.id, "extracting_durable", "extracting_durable_patterns");
      
      const durablePatterns = extractDurableDesignPatterns(demoStructure.generated_html);
      
      // Store extracted template for reuse
      await supabase.from("brandaro_extracted_templates").insert({
        build_job_id: buildJob.id,
        client_id,
        source_engine: "durable",
        extracted_html: demoStructure.generated_html,
        extracted_sections: durablePatterns.sections,
        design_patterns: durablePatterns.patterns,
        layout_hierarchy: durablePatterns.layout,
        color_scheme: durablePatterns.colors,
        typography: durablePatterns.typography,
      });

      // Store raw Durable HTML for reference
      await supabase.from("brandaro_build_jobs").update({
        durable_raw_html: demoStructure.generated_html,
      }).eq("id", buildJob.id);

      console.log(`[AUTO-BUILD] Durable patterns extracted. Standardizing via native engine.`);
    }

    // ===== TASTE ENGINE: Select Design Profile =====
    await updateBuildStatus(supabase, buildJob.id, "selecting_design", "taste_engine_selecting");

    const designSelection = await selectDesignProfile(supabase, industry);
    if (designSelection) {
      await supabase.from("brandaro_build_jobs").update({
        design_profile_id: designSelection.profileId,
      }).eq("id", buildJob.id);
      console.log(`[AUTO-BUILD] Taste Engine selected profile: ${designSelection.palette.mood}`);
    }

    // Check for high-performing reusable template
    const bestTemplate = await selectBestTemplate(supabase, industry);
    if (bestTemplate) {
      console.log(`[AUTO-BUILD] Reusing top template (score: ${bestTemplate.avg_score})`);
    }

    // ===== CONVERSION INTELLIGENCE: Select best patterns for this industry =====
    await updateBuildStatus(supabase, buildJob.id, "selecting_patterns", "conversion_intelligence");
    const conversionPatterns = await selectConversionPatterns(supabase, industry);
    console.log(`[AUTO-BUILD] Conversion Intelligence selected ${conversionPatterns.length} patterns`);

    // Record which patterns were used in this build
    for (const pattern of conversionPatterns) {
      await supabase.from("brandaro_build_patterns").insert({
        build_job_id: buildJob.id,
        pattern_id: pattern.id,
      });
    }

    // SECTION 5: STANDARDIZATION — Always assemble final site via native engine
    await updateBuildStatus(supabase, buildJob.id, "building", "standardizing_via_native");

    const { data: allBlocks } = await supabase
      .from("brandaro_content_blocks")
      .select("*")
      .eq("build_job_id", buildJob.id)
      .order("page_type")
      .order("section_order");

    // Use taste engine palette if available, otherwise random
    // Pass conversion patterns for structural integration
    let productionHtml = designSelection
      ? assembleProductionSiteWithProfile(allBlocks || [], businessName, industry, designSelection.palette, conversionPatterns)
      : assembleProductionSite(allBlocks || [], businessName, industry, conversionPatterns);

    // Inject tracking values
    productionHtml = productionHtml
      .replace("TRACKING_BASE_URL", Deno.env.get("SUPABASE_URL") || "")
      .replace("TRACKING_ANON_KEY", Deno.env.get("SUPABASE_ANON_KEY") || "")
      .replace("TRACKING_CLIENT_ID", client_id)
      .replace("TRACKING_PROJECT_ID", project_id || "");

    // Mark standardization complete — final engine is always native
    await supabase.from("brandaro_build_jobs").update({
      final_engine: "native",
      standardization_applied: initialEngine === "durable",
      engine_switched: initialEngine !== "native",
    }).eq("id", buildJob.id);

    // Slug for deployment
    const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    const productionSlug = `${slug}-live`;

    // ===== QUALITY GATE SYSTEM =====
    await updateBuildStatus(supabase, buildJob.id, "quality_check", "scoring_quality");

    const qualityResult = calculateQualityScore(allBlocks || [], productionHtml);
    const qualityScore = qualityResult.score;
    const qualityBreakdown = qualityResult.breakdown;
    const issueReasons = qualityResult.issues;

    // Store quality data on build job
    await supabase.from("brandaro_build_jobs").update({
      quality_score: qualityScore,
      quality_breakdown: qualityBreakdown,
    }).eq("id", buildJob.id);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const liveUrl = `${SUPABASE_URL}/functions/v1/brandaro-serve-demo?slug=${productionSlug}`;

    // QUALITY GATE DECISION
    if (qualityScore >= 80) {
      // AUTO-DEPLOY: High quality
      await deploySite(supabase, buildJob.id, project_id, client_id, liveUrl, productionSlug, productionHtml, client, buildEngine, industry, allBlocks || [], pagesBuilt);
      await supabase.from("brandaro_build_jobs").update({ deployment_decision: "auto_deployed" }).eq("id", buildJob.id);
      console.log(`[AUTO-BUILD] ✅ Auto-deployed (score: ${qualityScore}). URL: ${liveUrl}`);
      // Record template performance for taste engine learning
      if (designSelection) {
        await recordTemplatePerformance(supabase, designSelection.profileId, buildJob.id, client_id);
      }

    } else if (qualityScore >= 60) {
      // DEPLOY + FLAG: Medium quality
      await deploySite(supabase, buildJob.id, project_id, client_id, liveUrl, productionSlug, productionHtml, client, buildEngine, industry, allBlocks || [], pagesBuilt);
      await supabase.from("brandaro_build_jobs").update({ deployment_decision: "review_recommended" }).eq("id", buildJob.id);
      
      // Add to review queue as advisory
      await supabase.from("brandaro_review_queue").insert({
        build_job_id: buildJob.id,
        client_id: client_id,
        project_id: project_id,
        quality_score: qualityScore,
        quality_breakdown: qualityBreakdown,
        issue_reasons: issueReasons,
        priority: "low",
        status: "pending_review",
      });
      console.log(`[AUTO-BUILD] ⚠️ Deployed with review flag (score: ${qualityScore}). URL: ${liveUrl}`);

    } else {
      // BLOCK: Low quality — attempt auto-improvement first
      const currentRetries = buildJob.auto_retry_count || 0;
      const maxRetries = 2;

      if (currentRetries < maxRetries) {
        // AUTO-IMPROVEMENT: Ask AI to fix weak areas
        await supabase.from("brandaro_build_jobs").update({
          auto_retry_count: currentRetries + 1,
          build_status: "auto_improving",
          progress_stage: "ai_regenerating_weak_sections",
        }).eq("id", buildJob.id);

        console.log(`[AUTO-BUILD] 🔄 Auto-improving attempt ${currentRetries + 1}/${maxRetries} (score: ${qualityScore})`);

        // Trigger rebuild via self-invocation
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/brandaro-auto-build`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify({
              client_id: client_id,
              project_id: project_id,
              demo_id: demo_id || null,
              package_tier: package_tier,
              rebuild: true,
              improvement_hints: issueReasons,
            }),
          });
        } catch (retryErr) {
          console.error("[AUTO-BUILD] Retry trigger failed:", retryErr);
        }

        return new Response(JSON.stringify({
          ok: true,
          action: "auto_improving",
          quality_score: qualityScore,
          retry_attempt: currentRetries + 1,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      } else {
        // MAX RETRIES EXHAUSTED: Send to human review
        await supabase.from("brandaro_build_jobs").update({
          build_status: "needs_review",
          deployment_decision: "needs_review",
        }).eq("id", buildJob.id);

        await supabase.from("brandaro_review_queue").insert({
          build_job_id: buildJob.id,
          client_id: client_id,
          project_id: project_id,
          quality_score: qualityScore,
          quality_breakdown: qualityBreakdown,
          issue_reasons: issueReasons,
          priority: qualityScore < 40 ? "high" : "medium",
          status: "pending_review",
          auto_retry_count: currentRetries,
        });

        console.log(`[AUTO-BUILD] 🛑 Sent to human review (score: ${qualityScore}, retries exhausted)`);
      }
    }

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

function decideBuildEngine(tier: string, isFirstBuild: boolean = true): string {
  // DURABLE-FIRST HYBRID: Use Durable for initial generation speed,
  // then standardize internally via native engine for long-term control.
  // Only skip Durable for rebuilds or when explicitly native-only.
  if (isFirstBuild) return "durable";
  // Fallback to native for rebuilds/retries
  return "native";
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

// Taste Engine variant: uses a specific design profile palette
function assembleProductionSiteWithProfile(
  blocks: any[],
  businessName: string,
  industry: string,
  palette: StylePalette,
): string {
  // Same assembly logic but with a pre-selected palette
  const pageGroups: Record<string, any[]> = {};
  for (const block of blocks) {
    if (!pageGroups[block.page_type]) pageGroups[block.page_type] = [];
    pageGroups[block.page_type].push(block);
  }

  const layoutSeed = Math.floor(Math.random() * 5);
  const homepageBlocks = pageGroups["homepage"] || [];
  const seoTitle = homepageBlocks.find((b: any) => b.seo_title)?.seo_title || `${businessName} | ${industry}`;
  const seoDesc = homepageBlocks.find((b: any) => b.seo_description)?.seo_description || `${businessName} - Professional ${industry} services`;

  const pageNames = Object.keys(pageGroups);
  const navLinks = pageNames.map(p =>
    `<a href="#${p}" class="nav-link">${p.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</a>`
  ).join("\n          ");

  const sectionLayouts = ["full-width", "two-column", "offset-left", "centered-narrow", "wide-hero"];

  let contentSections = "";
  let sectionIdx = 0;
  for (const [pageType, pageBlocks] of Object.entries(pageGroups)) {
    const layoutClass = sectionLayouts[(sectionIdx + layoutSeed) % sectionLayouts.length];
    const sectionStyle = getSectionStyle(layoutClass, palette);
    contentSections += `\n    <section id="${pageType}" class="page-section" style="${sectionStyle}">\n`;
    for (const block of pageBlocks) {
      const componentVariant = getComponentVariant(block.section_name, sectionIdx, palette);
      contentSections += `      <div class="content-block" style="${componentVariant.wrapperStyle}">\n        ${block.content_html || ""}\n      </div>\n`;
    }
    contentSections += `    </section>\n`;
    sectionIdx++;
  }

  // Identical HTML shell but with taste-engine-selected palette
  return assembleHtmlShell(businessName, industry, seoTitle, seoDesc, navLinks, contentSections, palette);
}

// Shared HTML shell to avoid duplication
function assembleHtmlShell(
  businessName: string, industry: string, seoTitle: string, seoDesc: string,
  navLinks: string, contentSections: string, palette: StylePalette,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${seoTitle}</title>
  <meta name="description" content="${seoDesc}">
  <meta property="og:title" content="${seoTitle}">
  <meta property="og:description" content="${seoDesc}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${palette.headingFont.replace(/ /g, "+")}:wght@400;600;700&family=${palette.bodyFont.replace(/ /g, "+")}:wght@300;400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    :root { --primary: ${palette.primary}; --secondary: ${palette.secondary}; --accent: ${palette.accent}; --bg: ${palette.bg}; --text: ${palette.text}; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: '${palette.bodyFont}', system-ui, sans-serif; color: var(--text); background: var(--bg); }
    h1,h2,h3,h4,h5 { font-family: '${palette.headingFont}', serif; }
    .nav-link { padding: 0.5rem 1rem; text-decoration: none; color: var(--text); font-weight: 500; transition: color 0.2s; font-size: 0.9rem; }
    .nav-link:hover { color: var(--primary); }
    .page-section { padding: 5rem 2rem; max-width: 1200px; margin: 0 auto; }
    .content-block { margin-bottom: 2.5rem; }
    header { background: var(--bg); border-bottom: 1px solid ${palette.primary}15; padding: 1rem 2rem; position: sticky; top: 0; z-index: 50; backdrop-filter: blur(12px); }
    footer { background: ${palette.text}; color: ${palette.bg}; padding: 4rem 2rem; text-align: center; }
    .btn-primary { background: var(--primary); color: white; padding: 0.75rem 2rem; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 25px ${palette.primary}40; }
    @media (max-width: 768px) { .page-section { padding: 3rem 1.5rem; } header nav { flex-direction: column; gap: 0.5rem; } }
  </style>
</head>
<body>
  <header>
    <nav style="display:flex;align-items:center;justify-content:space-between;max-width:1200px;margin:0 auto;">
      <div style="font-size:1.5rem;font-weight:700;color:var(--primary);font-family:'${palette.headingFont}',serif;">${businessName}</div>
      <div style="display:flex;gap:0.25rem;align-items:center;">
        ${navLinks}
        <a href="#contact" class="btn-primary" style="margin-left:1rem;padding:0.5rem 1.25rem;font-size:0.85rem;">Get Started</a>
      </div>
    </nav>
  </header>
  <main>${contentSections}</main>
  <footer>
    <div style="max-width:1200px;margin:0 auto;">
      <p style="font-size:1.25rem;font-weight:700;font-family:'${palette.headingFont}',serif;margin-bottom:1rem;">${businessName}</p>
      <p style="opacity:0.7;">&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
      <p style="margin-top:0.75rem;font-size:0.7rem;opacity:0.5;">Powered by Brandaro Digital</p>
    </div>
  </footer>
  <script>document.querySelectorAll('a[href^="#"]').forEach(a=>{a.addEventListener('click',e=>{e.preventDefault();document.querySelector(a.getAttribute('href'))?.scrollIntoView({behavior:'smooth'});});});<\/script>
  <!-- Brandaro Tracking -->
  <script>
  (function(){var baseUrl="TRACKING_BASE_URL";var anonKey="TRACKING_ANON_KEY";var clientId="TRACKING_CLIENT_ID";var projectId="TRACKING_PROJECT_ID";var sid=Math.random().toString(36).substring(2);function track(type,val){fetch(baseUrl+"/functions/v1/brandaro-track-lead-event",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+anonKey},body:JSON.stringify({client_id:clientId,project_id:projectId,event_type:type,event_value:val||"",source:document.referrer?"referral":"direct",page_url:location.href,session_id:sid})}).catch(function(){});}track("session");var maxScroll=0;window.addEventListener("scroll",function(){var pct=Math.round((window.scrollY/(document.body.scrollHeight-window.innerHeight))*100);if(pct>=25&&maxScroll<25){track("scroll_25");maxScroll=25;}if(pct>=50&&maxScroll<50){track("scroll_50");maxScroll=50;}if(pct>=75&&maxScroll<75){track("scroll_75");maxScroll=75;}});document.addEventListener("click",function(e){var t=e.target;if(t.tagName==="A"||t.tagName==="BUTTON"||(t.closest&&t.closest("a,button"))){var text=(t.textContent||"").trim().substring(0,50);track("cta_click",text);if(t.href&&t.href.startsWith("tel:"))track("phone_click",t.href);}});document.querySelectorAll("form").forEach(function(f){f.addEventListener("submit",function(){track("form_submit",f.id||f.action||"unknown");});});})();
  <\/script>
</body>
</html>`;
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

  // DESIGN INTELLIGENCE: Select random style palette
  const palette = selectStylePalette();
  const layoutSeed = Math.floor(Math.random() * 5);

  // Get SEO from homepage blocks
  const homepageBlocks = pageGroups["homepage"] || [];
  const seoTitle = homepageBlocks.find(b => b.seo_title)?.seo_title || `${businessName} | ${industry}`;
  const seoDesc = homepageBlocks.find(b => b.seo_description)?.seo_description || `${businessName} - Professional ${industry} services`;

  // Build nav links with palette styling
  const pageNames = Object.keys(pageGroups);
  const navLinks = pageNames.map(p => 
    `<a href="#${p}" class="nav-link">${p.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</a>`
  ).join("\n          ");

  // LAYOUT VARIATIONS: Different section arrangements per seed
  const sectionLayouts = [
    "full-width", "two-column", "offset-left", "centered-narrow", "wide-hero"
  ];
  
  // Build page sections with component variants
  let contentSections = "";
  let sectionIdx = 0;
  for (const [pageType, pageBlocks] of Object.entries(pageGroups)) {
    const layoutClass = sectionLayouts[(sectionIdx + layoutSeed) % sectionLayouts.length];
    const sectionStyle = getSectionStyle(layoutClass, palette);
    
    contentSections += `\n    <section id="${pageType}" class="page-section" style="${sectionStyle}">\n`;
    
    for (const block of pageBlocks) {
      const componentVariant = getComponentVariant(block.section_name, sectionIdx, palette);
      contentSections += `      <div class="content-block" style="${componentVariant.wrapperStyle}">\n        ${block.content_html || ""}\n      </div>\n`;
    }
    contentSections += `    </section>\n`;
    sectionIdx++;
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${palette.headingFont.replace(/ /g, "+")}:wght@400;600;700&family=${palette.bodyFont.replace(/ /g, "+")}:wght@300;400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
      --primary: ${palette.primary};
      --secondary: ${palette.secondary};
      --accent: ${palette.accent};
      --bg: ${palette.bg};
      --text: ${palette.text};
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: '${palette.bodyFont}', system-ui, sans-serif; color: var(--text); background: var(--bg); }
    h1, h2, h3, h4, h5 { font-family: '${palette.headingFont}', serif; }
    .nav-link { padding: 0.5rem 1rem; text-decoration: none; color: var(--text); font-weight: 500; transition: color 0.2s; font-size: 0.9rem; }
    .nav-link:hover { color: var(--primary); }
    .page-section { padding: 5rem 2rem; max-width: 1200px; margin: 0 auto; }
    .content-block { margin-bottom: 2.5rem; }
    header { background: var(--bg); border-bottom: 1px solid ${palette.primary}15; padding: 1rem 2rem; position: sticky; top: 0; z-index: 50; backdrop-filter: blur(12px); }
    footer { background: ${palette.text}; color: ${palette.bg}; padding: 4rem 2rem; text-align: center; }
    footer a { color: var(--accent); }
    .btn-primary { background: var(--primary); color: white; padding: 0.75rem 2rem; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; font-size: 1rem; }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 25px ${palette.primary}40; }
    .btn-secondary { background: transparent; color: var(--primary); padding: 0.75rem 2rem; border: 2px solid var(--primary); border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-secondary:hover { background: var(--primary); color: white; }
    /* Layout variants */
    .layout-full-width { max-width: 100%; padding: 5rem 4rem; }
    .layout-two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: center; }
    .layout-offset-left { max-width: 900px; margin-left: 10%; }
    .layout-centered-narrow { max-width: 800px; text-align: center; }
    .layout-wide-hero { max-width: 100%; padding: 6rem 4rem; background: linear-gradient(135deg, ${palette.primary}08, ${palette.accent}08); }
    @media (max-width: 768px) {
      .layout-two-column { grid-template-columns: 1fr; }
      .layout-offset-left { margin-left: auto; }
      .layout-full-width, .layout-wide-hero { padding: 3rem 1.5rem; }
      .page-section { padding: 3rem 1.5rem; }
      header nav { flex-direction: column; gap: 0.5rem; }
    }
  </style>
</head>
<body>
  <header>
    <nav style="display:flex;align-items:center;justify-content:space-between;max-width:1200px;margin:0 auto;">
      <div style="font-size:1.5rem;font-weight:700;color:var(--primary);font-family:'${palette.headingFont}',serif;">${businessName}</div>
      <div style="display:flex;gap:0.25rem;align-items:center;">
        ${navLinks}
        <a href="#contact" class="btn-primary" style="margin-left:1rem;padding:0.5rem 1.25rem;font-size:0.85rem;">Get Started</a>
      </div>
    </nav>
  </header>

  <main>
    ${contentSections}
  </main>

  <footer>
    <div style="max-width:1200px;margin:0 auto;">
      <p style="font-size:1.25rem;font-weight:700;font-family:'${palette.headingFont}',serif;margin-bottom:1rem;">${businessName}</p>
      <p style="opacity:0.7;">&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
      <p style="margin-top:0.75rem;font-size:0.7rem;opacity:0.5;">Powered by Brandaro Digital</p>
    </div>
  </footer>

  <script>
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        document.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth' });
      });
    });
  </script>

  <!-- Brandaro Result Engine Tracking -->
  <script>
  (function(){
    var baseUrl="TRACKING_BASE_URL";
    var anonKey="TRACKING_ANON_KEY";
    var clientId="TRACKING_CLIENT_ID";
    var projectId="TRACKING_PROJECT_ID";
    var sid=Math.random().toString(36).substring(2);
    function track(type,val){
      fetch(baseUrl+"/functions/v1/brandaro-track-lead-event",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+anonKey},
        body:JSON.stringify({client_id:clientId,project_id:projectId,event_type:type,event_value:val||"",source:document.referrer?"referral":"direct",page_url:location.href,session_id:sid})
      }).catch(function(){});
    }
    track("session");
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
        if(t.href&&t.href.startsWith("tel:")) track("phone_click",t.href);
      }
    });
    document.querySelectorAll("form").forEach(function(f){
      f.addEventListener("submit",function(){track("form_submit",f.id||f.action||"unknown");});
    });
  })();
  </script>
</body>
</html>`;
}

// ===== DESIGN INTELLIGENCE HELPERS =====

interface StylePalette {
  primary: string; secondary: string; accent: string;
  bg: string; text: string;
  headingFont: string; bodyFont: string;
  mood: string;
}

const STYLE_PALETTES: StylePalette[] = [
  { primary: "#1e40af", secondary: "#0369a1", accent: "#06b6d4", bg: "#f8fafc", text: "#0f172a", headingFont: "Montserrat", bodyFont: "Open Sans", mood: "professional" },
  { primary: "#166534", secondary: "#15803d", accent: "#84cc16", bg: "#f0fdf4", text: "#14532d", headingFont: "Playfair Display", bodyFont: "Lato", mood: "trustworthy" },
  { primary: "#c2410c", secondary: "#ea580c", accent: "#fbbf24", bg: "#fffbeb", text: "#431407", headingFont: "Poppins", bodyFont: "Inter", mood: "energetic" },
  { primary: "#1e1b4b", secondary: "#312e81", accent: "#818cf8", bg: "#eef2ff", text: "#1e1b4b", headingFont: "Space Grotesk", bodyFont: "DM Sans", mood: "bold" },
  { primary: "#9f1239", secondary: "#e11d48", accent: "#fb7185", bg: "#fff1f2", text: "#4c0519", headingFont: "Merriweather", bodyFont: "Source Sans 3", mood: "warm" },
  { primary: "#334155", secondary: "#475569", accent: "#38bdf8", bg: "#f1f5f9", text: "#0f172a", headingFont: "Inter", bodyFont: "Inter", mood: "minimal" },
  { primary: "#7e22ce", secondary: "#a855f7", accent: "#c084fc", bg: "#faf5ff", text: "#3b0764", headingFont: "Cinzel", bodyFont: "Raleway", mood: "luxurious" },
  { primary: "#713f12", secondary: "#a16207", accent: "#65a30d", bg: "#fefce8", text: "#422006", headingFont: "Vollkorn", bodyFont: "Nunito", mood: "organic" },
  { primary: "#18181b", secondary: "#3f3f46", accent: "#f97316", bg: "#fafafa", text: "#09090b", headingFont: "Oswald", bodyFont: "Roboto", mood: "industrial" },
  { primary: "#0284c7", secondary: "#0ea5e9", accent: "#22d3ee", bg: "#ecfeff", text: "#0c4a6e", headingFont: "Quicksand", bodyFont: "Work Sans", mood: "fresh" },
];

function selectStylePalette(): StylePalette {
  return STYLE_PALETTES[Math.floor(Math.random() * STYLE_PALETTES.length)];
}

// ===== TASTE ENGINE: Design Profile Selection =====

async function selectDesignProfile(
  supabase: any,
  industry: string,
): Promise<{ profileId: string; palette: StylePalette } | null> {
  // Fetch active design profiles ranked by performance
  const { data: profiles } = await supabase
    .from("brandaro_design_profiles")
    .select("*")
    .eq("is_active", true)
    .order("avg_conversion_rate", { ascending: false });

  if (!profiles || profiles.length === 0) return null;

  // Industry → style category mapping
  const industryStyleMap: Record<string, string[]> = {
    "restaurant": ["modern", "bold"],
    "plumbing": ["local_service", "corporate"],
    "hvac": ["local_service", "corporate"],
    "cleaning": ["minimal", "local_service"],
    "law": ["luxury", "corporate"],
    "real estate": ["luxury", "modern"],
    "salon": ["modern", "bold"],
    "landscaping": ["local_service", "bold"],
    "dental": ["minimal", "corporate"],
    "fitness": ["bold", "modern"],
  };

  const preferredStyles = industryStyleMap[industry.toLowerCase()] || ["modern", "corporate"];

  // Weighted selection: 60% performance rank, 30% style match, 10% novelty
  const scored = profiles.map((p: any) => {
    let score = 0;
    // Performance score (higher rank = higher score)
    score += (1 - (p.performance_rank || profiles.length) / profiles.length) * 60;
    // Style match
    if (preferredStyles.includes(p.style_category)) score += 30;
    // Novelty bonus (less used = more novel)
    const usagePenalty = Math.min((p.usage_count || 0) / 50, 1) * 10;
    score += 10 - usagePenalty;
    return { ...p, selectionScore: score };
  });

  scored.sort((a: any, b: any) => b.selectionScore - a.selectionScore);

  // Pick from top 3 with slight randomness to avoid staleness
  const topN = scored.slice(0, Math.min(3, scored.length));
  const selected = topN[Math.floor(Math.random() * topN.length)];

  // Increment usage count
  await supabase
    .from("brandaro_design_profiles")
    .update({ usage_count: (selected.usage_count || 0) + 1, updated_at: new Date().toISOString() })
    .eq("id", selected.id);

  // Convert DB palette to StylePalette
  const cp = selected.color_palette || {};
  const fp = selected.font_pairing || {};
  const palette: StylePalette = {
    primary: cp.primary || "#1e40af",
    secondary: cp.secondary || "#0369a1",
    accent: cp.accent || "#06b6d4",
    bg: cp.bg || "#f8fafc",
    text: cp.text || "#0f172a",
    headingFont: fp.heading || "Montserrat",
    bodyFont: fp.body || "Open Sans",
    mood: selected.style_category,
  };

  return { profileId: selected.id, palette };
}

// Select best-performing template for reuse
async function selectBestTemplate(
  supabase: any,
  industry: string,
): Promise<any | null> {
  const { data: templates } = await supabase
    .from("brandaro_extracted_templates")
    .select("*, brandaro_template_performance(*)")
    .gt("avg_score", 60)
    .order("avg_score", { ascending: false })
    .limit(5);

  if (!templates || templates.length === 0) return null;

  // Avoid over-reuse: skip templates used more than 10 times
  const eligible = templates.filter((t: any) => (t.usage_count || 0) < 10);
  if (eligible.length === 0) return null;

  const selected = eligible[0];

  // Increment usage
  await supabase
    .from("brandaro_extracted_templates")
    .update({ usage_count: (selected.usage_count || 0) + 1, last_used_at: new Date().toISOString() })
    .eq("id", selected.id);

  return selected;
}

// Record template performance after deployment
async function recordTemplatePerformance(
  supabase: any,
  templateId: string,
  buildJobId: string,
  clientId: string,
): Promise<void> {
  await supabase.from("brandaro_template_performance").insert({
    template_id: templateId,
    build_job_id: buildJobId,
    client_id: clientId,
  });
}

function getSectionStyle(layout: string, palette: StylePalette): string {
  const styles: Record<string, string> = {
    "full-width": `max-width:100%;padding:5rem 4rem;`,
    "two-column": `display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:center;`,
    "offset-left": `max-width:900px;margin-left:10%;`,
    "centered-narrow": `max-width:800px;margin:0 auto;text-align:center;`,
    "wide-hero": `max-width:100%;padding:6rem 4rem;background:linear-gradient(135deg,${palette.primary}08,${palette.accent}08);border-radius:0;`,
  };
  return styles[layout] || "";
}

function getComponentVariant(sectionName: string, idx: number, palette: StylePalette): { wrapperStyle: string } {
  // Alternate between card-style and flush based on index
  const isCard = idx % 3 === 1;
  if (isCard) {
    return {
      wrapperStyle: `background:white;border-radius:12px;padding:2rem;box-shadow:0 4px 20px ${palette.primary}10;border:1px solid ${palette.primary}10;`,
    };
  }
  if (idx % 3 === 2) {
    return {
      wrapperStyle: `border-left:4px solid ${palette.primary};padding-left:1.5rem;`,
    };
  }
  return { wrapperStyle: "" };
}



function calculateQualityScore(blocks: any[], html: string): { score: number; breakdown: Record<string, number>; issues: string[] } {
  const breakdown: Record<string, number> = {};
  const issues: string[] = [];

  // Content completeness (0-25)
  if (blocks.length >= 12) breakdown.content_completeness = 25;
  else if (blocks.length >= 8) breakdown.content_completeness = 20;
  else if (blocks.length >= 5) breakdown.content_completeness = 15;
  else { breakdown.content_completeness = 5; issues.push("Too few content sections"); }

  // SEO presence (0-20)
  let seo = 0;
  if (html.includes('<meta name="description"')) seo += 5;
  else issues.push("Missing meta description");
  if (html.includes('<meta property="og:title"')) seo += 5;
  else issues.push("Missing Open Graph tags");
  if (html.includes("viewport")) seo += 5;
  if (html.includes("<title>") && !html.includes("<title></title>")) seo += 5;
  else issues.push("Missing or empty title tag");
  breakdown.seo_presence = seo;

  // CTA strength (0-20)
  const ctaPatterns = ["Get Started", "Contact Us", "Call Now", "Book Now", "Free Quote", "Get Quote", "Learn More", "Schedule"];
  const ctaCount = ctaPatterns.filter(p => html.toLowerCase().includes(p.toLowerCase())).length;
  if (ctaCount >= 3) breakdown.cta_strength = 20;
  else if (ctaCount >= 2) breakdown.cta_strength = 15;
  else if (ctaCount >= 1) breakdown.cta_strength = 10;
  else { breakdown.cta_strength = 0; issues.push("No call-to-action buttons detected"); }

  // Design consistency (0-15)
  let design = 0;
  if (html.includes("<nav")) design += 5;
  else issues.push("Missing navigation");
  if (html.includes("<footer")) design += 5;
  else issues.push("Missing footer");
  if (html.includes("<header")) design += 5;
  breakdown.design_consistency = design;

  // Content volume (0-20)
  const textLength = html.replace(/<[^>]*>/g, "").length;
  if (textLength > 3000) breakdown.content_volume = 20;
  else if (textLength > 1500) breakdown.content_volume = 15;
  else if (textLength > 500) breakdown.content_volume = 10;
  else { breakdown.content_volume = 5; issues.push("Very low content volume"); }

  const score = Object.values(breakdown).reduce((s, v) => s + v, 0);
  return { score: Math.min(score, 100), breakdown, issues };
}

async function deploySite(
  supabase: any, buildJobId: string, projectId: string, clientId: string,
  liveUrl: string, slug: string, html: string, client: any,
  buildEngine: string, industry: string, blocks: any[], pagesBuilt: number
) {
  // Store production site
  await supabase.from("brandaro_demo_sites").insert({
    lead_id: client?.lead_id,
    slug,
    generated_html: html,
    engine_used: buildEngine,
    industry,
    demo_ready_for_conversion: false,
    production_build_ready: true,
  });

  // Update project
  await supabase.from("brandaro_projects").update({
    live_url: liveUrl,
    deployment_status: "active",
    deployed_at: new Date().toISOString(),
    build_status: "live",
    domain_type: "subdomain",
  }).eq("id", projectId);

  // Mark build complete
  await supabase.from("brandaro_build_jobs").update({
    build_status: "completed",
    progress_stage: "done",
    deployed_url: liveUrl,
    completed_at: new Date().toISOString(),
    pages_built: pagesBuilt,
    deployed_at: new Date().toISOString(),
  }).eq("id", buildJobId);

  // Update client
  await supabase.from("brandaro_clients").update({
    onboarding_status: "launched",
  }).eq("id", clientId);
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

/**
 * Extract design patterns from Durable-generated HTML
 * Used to inform native builder standardization
 */
function extractDurableDesignPatterns(html: string): {
  sections: any[]; patterns: any; layout: any; colors: any; typography: any;
} {
  const sections: any[] = [];
  
  // Extract sections with their types
  const sectionRegex = /<section[^>]*(?:class|id)="([^"]*)"[^>]*>([\s\S]*?)<\/section>/gi;
  let match;
  while ((match = sectionRegex.exec(html)) !== null) {
    const classOrId = match[1];
    const content = match[2];
    const hasImages = (content.match(/<img/gi) || []).length;
    const hasButtons = (content.match(/<button|<a[^>]*class="[^"]*btn/gi) || []).length;
    const textLength = content.replace(/<[^>]*>/g, "").trim().length;
    
    sections.push({
      identifier: classOrId,
      hasImages: hasImages > 0,
      imageCount: hasImages,
      hasCTA: hasButtons > 0,
      ctaCount: hasButtons,
      contentDensity: textLength > 500 ? "high" : textLength > 200 ? "medium" : "low",
    });
  }

  // Extract color patterns
  const colorRegex = /#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|hsl\([^)]+\)/g;
  const colorsFound = [...new Set((html.match(colorRegex) || []))].slice(0, 10);

  // Extract font patterns
  const fontRegex = /font-family:\s*([^;}"]+)/gi;
  const fontsFound: string[] = [];
  while ((match = fontRegex.exec(html)) !== null) {
    fontsFound.push(match[1].trim());
  }

  // Layout detection
  const usesGrid = html.includes("display: grid") || html.includes("display:grid");
  const usesFlex = html.includes("display: flex") || html.includes("display:flex");
  const columnsDetected = (html.match(/grid-template-columns|col-span|columns/gi) || []).length;

  return {
    sections,
    patterns: {
      totalSections: sections.length,
      sectionsWithCTA: sections.filter(s => s.hasCTA).length,
      sectionsWithImages: sections.filter(s => s.hasImages).length,
      avgContentDensity: sections.length > 0
        ? sections.filter(s => s.contentDensity === "high").length / sections.length
        : 0,
    },
    layout: {
      usesGrid,
      usesFlex,
      columnsDetected,
      estimatedComplexity: sections.length > 8 ? "high" : sections.length > 4 ? "medium" : "low",
    },
    colors: { palette: colorsFound },
    typography: { fonts: [...new Set(fontsFound)] },
  };
}
