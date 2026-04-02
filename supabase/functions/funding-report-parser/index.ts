import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const { client_id, pdf_base64, bureau } = await req.json();
    if (!client_id || !pdf_base64 || !bureau) {
      return new Response(JSON.stringify({ error: "client_id, pdf_base64, and bureau are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert credit report analyst with 20 years of experience reading Experian Equifax and TransUnion credit reports. Extract all data from this credit report and return ONLY a valid JSON object with absolutely no markdown formatting no backticks no explanation and no text outside the JSON. The JSON must have these exact keys. bureau as a string. negative_items as an array where each object has creditor_name as string, account_number as string, item_type as one of late_payment collection charge_off bankruptcy judgment repossession or hard_inquiry, balance as number, date_opened as string in YYYY-MM-DD format, date_of_first_delinquency as string in YYYY-MM-DD format or null, current_status as string, and scheduled_purge_date as string calculated as exactly 7 years after date_of_first_delinquency in YYYY-MM-DD format or null if no delinquency date. hard_inquiries as an array where each object has creditor_name as string and inquiry_date as string in YYYY-MM-DD format. open_accounts as an array where each object has creditor_name as string, account_type as string, credit_limit as number, current_balance as number, date_opened as string, utilization_pct as number rounded to nearest integer, and payment_history as a string of up to 24 characters using G for good standing N for negative and dash for no data reading most recent month first. bureau_score as a number representing the credit score shown on this report.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdf_base64 },
            },
            { type: "text", text: "Parse the following credit report." },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const aiData = await response.json();
    const rawContent = aiData.content?.[0]?.text || "";
    const cleaned = rawContent.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      throw new Error("Failed to parse credit report — AI returned invalid JSON");
    }

    // Return parsed data for operator confirmation (don't auto-insert)
    return new Response(JSON.stringify({
      parsed_data: parsed,
      summary: {
        negative_items_found: parsed.negative_items?.length || 0,
        hard_inquiries_found: parsed.hard_inquiries?.length || 0,
        open_accounts_found: parsed.open_accounts?.length || 0,
        bureau_score_found: parsed.bureau_score || null,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("funding-report-parser error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
