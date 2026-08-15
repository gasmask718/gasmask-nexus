import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errText } from "../_shared/errText.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { action, partner_id, job_id, content, category, input_type } = await req.json();

    switch (action) {
      // ═══════════════════════════════════════
      // EXTRACT FROM TEXT/PDF/URL CONTENT
      // ═══════════════════════════════════════
      case "extract": {
        // Create ingestion job
        const { data: job, error: jobErr } = await supabase
          .from("ut_ai_ingestion_jobs")
          .insert({ partner_id, input_type: input_type || "text", raw_content: content, status: "processing" })
          .select().single();
        if (jobErr) throw jobErr;

        const systemPrompt = `You are an expert at extracting structured business data from vendor content for an event marketplace.
Extract ALL items you can find: menus, dishes, packages, pricing, services, themes, inventory items.
Return a JSON object with these arrays (include only what's found):
{
  "menus": [{ "name": "", "type": "", "description": "", "price_type": "per_person|flat", "base_price": null, "guest_range_min": null, "guest_range_max": null }],
  "menu_items": [{ "menu_name": "", "item_name": "", "category": "appetizer|entree|dessert|side|drink|cocktail|signature", "description": "", "price": null, "dietary_tags": [], "is_signature": false }],
  "packages": [{ "name": "", "description": "", "base_price": null, "price_type": "per_person|flat|tiered", "tier": "basic|standard|premium", "included_items": [], "add_ons": [] }],
  "themes": [{ "name": "", "description": "", "style_tags": [], "event_type": "", "base_price": null }],
  "offerings": [{ "name": "", "category": "", "description": "", "base_price": null }],
  "inventory_items": [{ "item_name": "", "category": "", "description": "", "rental_price": null, "quantity": null }]
}
Category context: ${category || "general"}`;

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Extract structured data from this vendor content:\n\n${content}` },
            ],
            tools: [{
              type: "function",
              function: {
                name: "extract_vendor_data",
                description: "Extract structured vendor data",
                parameters: {
                  type: "object",
                  properties: {
                    menus: { type: "array", items: { type: "object", properties: { name: { type: "string" }, type: { type: "string" }, description: { type: "string" }, price_type: { type: "string" }, base_price: { type: "number" }, guest_range_min: { type: "number" }, guest_range_max: { type: "number" } }, required: ["name"] } },
                    menu_items: { type: "array", items: { type: "object", properties: { menu_name: { type: "string" }, item_name: { type: "string" }, category: { type: "string" }, description: { type: "string" }, price: { type: "number" }, dietary_tags: { type: "array", items: { type: "string" } }, is_signature: { type: "boolean" } }, required: ["item_name"] } },
                    packages: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, base_price: { type: "number" }, price_type: { type: "string" }, tier: { type: "string" }, included_items: { type: "array", items: { type: "string" } }, add_ons: { type: "array", items: { type: "string" } } }, required: ["name"] } },
                    themes: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, style_tags: { type: "array", items: { type: "string" } }, event_type: { type: "string" }, base_price: { type: "number" } }, required: ["name"] } },
                    offerings: { type: "array", items: { type: "object", properties: { name: { type: "string" }, category: { type: "string" }, description: { type: "string" }, base_price: { type: "number" } }, required: ["name"] } },
                    inventory_items: { type: "array", items: { type: "object", properties: { item_name: { type: "string" }, category: { type: "string" }, description: { type: "string" }, rental_price: { type: "number" }, quantity: { type: "number" } }, required: ["item_name"] } },
                  },
                  required: [],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "extract_vendor_data" } },
          }),
        });

        if (!aiResp.ok) {
          const errText = await aiResp.text();
          if (aiResp.status === 429) throw new Error("Rate limited. Please try again shortly.");
          if (aiResp.status === 402) throw new Error("AI credits exhausted. Please add funds.");
          throw new Error(`AI extraction failed: ${errText}`);
        }

        const aiData = await aiResp.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        let extracted = {};
        if (toolCall?.function?.arguments) {
          extracted = typeof toolCall.function.arguments === "string"
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;
        }

        // Update job
        await supabase.from("ut_ai_ingestion_jobs").update({
          extracted_content: extracted, status: "completed", updated_at: new Date().toISOString(),
        }).eq("id", job.id);

        // Store extracted items
        const extractedRows: any[] = [];
        const ex = extracted as any;
        for (const menu of (ex.menus || [])) {
          extractedRows.push({ ingestion_job_id: job.id, partner_id, data_type: "menu", extracted_data: menu, confidence_score: 0.85 });
        }
        for (const item of (ex.menu_items || [])) {
          extractedRows.push({ ingestion_job_id: job.id, partner_id, data_type: "menu_item", extracted_data: item, confidence_score: 0.8 });
        }
        for (const pkg of (ex.packages || [])) {
          extractedRows.push({ ingestion_job_id: job.id, partner_id, data_type: "package", extracted_data: pkg, confidence_score: 0.82 });
        }
        for (const theme of (ex.themes || [])) {
          extractedRows.push({ ingestion_job_id: job.id, partner_id, data_type: "theme", extracted_data: theme, confidence_score: 0.8 });
        }
        for (const off of (ex.offerings || [])) {
          extractedRows.push({ ingestion_job_id: job.id, partner_id, data_type: "offering", extracted_data: off, confidence_score: 0.8 });
        }
        for (const inv of (ex.inventory_items || [])) {
          extractedRows.push({ ingestion_job_id: job.id, partner_id, data_type: "inventory_item", extracted_data: inv, confidence_score: 0.78 });
        }

        if (extractedRows.length > 0) {
          await supabase.from("ut_ai_extracted_data").insert(extractedRows);
        }

        return new Response(JSON.stringify({ job_id: job.id, extracted, item_count: extractedRows.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ═══════════════════════════════════════
      // AUTO-BUILD: Apply extracted data to real tables
      // ═══════════════════════════════════════
      case "auto_build": {
        const { data: items, error: itemErr } = await supabase
          .from("ut_ai_extracted_data")
          .select("*")
          .eq("partner_id", partner_id)
          .eq("status", "approved")
          .order("created_at");
        if (itemErr) throw itemErr;

        let applied = 0;
        const menuIdMap: Record<string, string> = {};

        // Apply menus first
        for (const item of (items || []).filter((i: any) => i.data_type === "menu")) {
          const d = item.extracted_data as any;
          const { data: menu } = await supabase.from("ut_partner_menus").insert({
            partner_id, name: d.name, menu_type: d.type || "general", description: d.description,
            price_type: d.price_type || "per_person", base_price: d.base_price,
            guest_range_min: d.guest_range_min, guest_range_max: d.guest_range_max,
          }).select().single();
          if (menu) {
            menuIdMap[d.name] = menu.id;
            await supabase.from("ut_ai_extracted_data").update({ status: "applied", applied_to_id: menu.id, applied_to_table: "ut_partner_menus" }).eq("id", item.id);
            applied++;
          }
        }

        // Apply menu items
        for (const item of (items || []).filter((i: any) => i.data_type === "menu_item")) {
          const d = item.extracted_data as any;
          const menuId = menuIdMap[d.menu_name] || Object.values(menuIdMap)[0];
          if (menuId) {
            const { data: mi } = await supabase.from("ut_partner_menu_items").insert({
              menu_id: menuId, item_name: d.item_name, category: d.category || "entree",
              description: d.description, upgrade_price: d.price,
              dietary_tags: d.dietary_tags, is_signature: d.is_signature || false,
            }).select().single();
            if (mi) {
              await supabase.from("ut_ai_extracted_data").update({ status: "applied", applied_to_id: mi.id, applied_to_table: "ut_partner_menu_items" }).eq("id", item.id);
              applied++;
            }
          }
        }

        // Apply packages
        for (const item of (items || []).filter((i: any) => i.data_type === "package")) {
          const d = item.extracted_data as any;
          const { data: pkg } = await supabase.from("ut_partner_service_packages").insert({
            partner_id, name: d.name, description: d.description, base_price: d.base_price,
            price_type: d.price_type || "flat", included_items: d.included_items,
            optional_add_ons: d.add_ons, event_type: d.tier || "general",
          }).select().single();
          if (pkg) {
            await supabase.from("ut_ai_extracted_data").update({ status: "applied", applied_to_id: pkg.id, applied_to_table: "ut_partner_service_packages" }).eq("id", item.id);
            applied++;
          }
        }

        return new Response(JSON.stringify({ applied }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ═══════════════════════════════════════
      // GENERATE LISTING
      // ═══════════════════════════════════════
      case "generate_listing": {
        // Gather partner data
        const [{ data: partner }, { data: menus }, { data: packages }] = await Promise.all([
          supabase.from("ut_partners").select("*").eq("id", partner_id).single(),
          supabase.from("ut_partner_menus").select("*, ut_partner_menu_items(*)").eq("partner_id", partner_id),
          supabase.from("ut_partner_service_packages").select("*").eq("partner_id", partner_id),
        ]);

        const context = JSON.stringify({ partner, menus, packages }, null, 2);

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: `You are a premium marketplace copywriter. Generate a compelling, conversion-optimized listing.` },
              { role: "user", content: `Generate a premium marketplace listing for this vendor:\n${context}` },
            ],
            tools: [{
              type: "function",
              function: {
                name: "generate_listing",
                description: "Generate marketplace listing content",
                parameters: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Catchy listing title (max 80 chars)" },
                    description: { type: "string", description: "Compelling 2-3 paragraph description" },
                    highlights: { type: "array", items: { type: "string" }, description: "5-7 bullet point highlights" },
                    tags: { type: "array", items: { type: "string" }, description: "10-15 search tags" },
                    seo_copy: { type: "string", description: "SEO-optimized meta description (160 chars)" },
                    estimated_event_value: { type: "number", description: "Average estimated event value in USD" },
                    upsell_suggestions: { type: "array", items: { type: "string" }, description: "3-5 upsell opportunities" },
                  },
                  required: ["title", "description", "highlights", "tags"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "generate_listing" } },
          }),
        });

        if (!aiResp.ok) {
          const t = await aiResp.text();
          throw new Error(`Listing generation failed: ${t}`);
        }

        const aiData = await aiResp.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        let listing: any = {};
        if (toolCall?.function?.arguments) {
          listing = typeof toolCall.function.arguments === "string"
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;
        }

        const { data: saved } = await supabase.from("ut_ai_generated_listings").insert({
          partner_id,
          listing_type: category || "general",
          ai_title: listing.title,
          ai_description: listing.description,
          ai_highlights: listing.highlights || [],
          ai_tags: listing.tags || [],
          ai_seo_copy: listing.seo_copy,
          estimated_event_value: listing.estimated_event_value,
          upsell_score: 0.75,
          profit_score: 0.7,
        }).select().single();

        return new Response(JSON.stringify({ listing: saved, upsell_suggestions: listing.upsell_suggestions }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ═══════════════════════════════════════
      // GENERATE SUGGESTIONS
      // ═══════════════════════════════════════
      case "generate_suggestions": {
        const [{ data: partner }, { data: menus }, { data: packages }, { data: media }] = await Promise.all([
          supabase.from("ut_partners").select("*").eq("id", partner_id).single(),
          supabase.from("ut_partner_menus").select("*, ut_partner_menu_items(*)").eq("partner_id", partner_id),
          supabase.from("ut_partner_service_packages").select("*").eq("partner_id", partner_id),
          supabase.from("ut_partner_media").select("*").eq("partner_id", partner_id),
        ]);

        const context = JSON.stringify({
          partner, menu_count: (menus || []).length,
          item_count: (menus || []).reduce((a: number, m: any) => a + (m.ut_partner_menu_items?.length || 0), 0),
          package_count: (packages || []).length, media_count: (media || []).length,
        });

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "You are an event marketplace optimization advisor. Analyze vendor profiles and suggest improvements." },
              { role: "user", content: `Analyze this vendor and give 3-6 actionable suggestions:\n${context}` },
            ],
            tools: [{
              type: "function",
              function: {
                name: "suggest_improvements",
                description: "Suggest vendor improvements",
                parameters: {
                  type: "object",
                  properties: {
                    suggestions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          type: { type: "string", enum: ["missing_info", "pricing", "upsell", "media", "content", "package", "optimization"] },
                          title: { type: "string" },
                          description: { type: "string" },
                          priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                        },
                        required: ["type", "title", "description", "priority"],
                      },
                    },
                  },
                  required: ["suggestions"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "suggest_improvements" } },
          }),
        });

        if (!aiResp.ok) {
          const t = await aiResp.text();
          throw new Error(`Suggestions failed: ${t}`);
        }

        const aiData = await aiResp.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        let result: any = { suggestions: [] };
        if (toolCall?.function?.arguments) {
          result = typeof toolCall.function.arguments === "string"
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;
        }

        // Clear old active suggestions, insert new ones
        await supabase.from("ut_ai_suggestions").update({ status: "dismissed" }).eq("partner_id", partner_id).eq("status", "active");

        const rows = (result.suggestions || []).map((s: any) => ({
          partner_id, suggestion_type: s.type, title: s.title, description: s.description, priority: s.priority,
        }));

        if (rows.length > 0) {
          await supabase.from("ut_ai_suggestions").insert(rows);
        }

        return new Response(JSON.stringify({ suggestions: result.suggestions }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ═══════════════════════════════════════
      // AUTO PACKAGE GENERATION
      // ═══════════════════════════════════════
      case "auto_packages": {
        const { data: menus } = await supabase
          .from("ut_partner_menus").select("*, ut_partner_menu_items(*)").eq("partner_id", partner_id);

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "You are an event pricing strategist. Create 3 tiered packages (basic/standard/premium) from the vendor's menu items. Maximize upsell potential." },
              { role: "user", content: `Create 3 tiered packages from:\n${JSON.stringify(menus)}` },
            ],
            tools: [{
              type: "function",
              function: {
                name: "create_packages",
                description: "Create tiered service packages",
                parameters: {
                  type: "object",
                  properties: {
                    packages: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          description: { type: "string" },
                          base_price: { type: "number" },
                          price_type: { type: "string" },
                          tier: { type: "string" },
                          included_items: { type: "array", items: { type: "string" } },
                          add_ons: { type: "array", items: { type: "string" } },
                        },
                        required: ["name", "description", "base_price"],
                      },
                    },
                  },
                  required: ["packages"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "create_packages" } },
          }),
        });

        if (!aiResp.ok) { const t = await aiResp.text(); throw new Error(`Package gen failed: ${t}`); }

        const aiData = await aiResp.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        let result: any = { packages: [] };
        if (toolCall?.function?.arguments) {
          result = typeof toolCall.function.arguments === "string"
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;
        }

        // Insert as extracted data for review
        const rows = (result.packages || []).map((p: any) => ({
          ingestion_job_id: null as any, partner_id, data_type: "package",
          extracted_data: p, confidence_score: 0.85, status: "draft",
        }));

        // We need an ingestion job to tie to — create a synthetic one
        const { data: synthJob } = await supabase.from("ut_ai_ingestion_jobs").insert({
          partner_id, input_type: "text", raw_content: "Auto-generated packages from menus", status: "completed",
        }).select().single();

        if (synthJob) {
          for (const row of rows) row.ingestion_job_id = synthJob.id;
          await supabase.from("ut_ai_extracted_data").insert(rows);
        }

        return new Response(JSON.stringify({ packages: result.packages }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (e: any) {
    console.error("AI Business Builder error:", errText(e));
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
