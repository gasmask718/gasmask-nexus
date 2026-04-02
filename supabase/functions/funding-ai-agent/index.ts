import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { action, ...payload } = await req.json();

    let systemPrompt = "";
    let userPrompt = "";

    switch (action) {
      case "analyze_credit_items": {
        systemPrompt = `You are a master credit repair specialist with deep expertise in FCRA, FDCPA, and credit bureau dispute strategies. Analyze credit report items and produce attack plans that maximize score improvement.`;
        userPrompt = `Analyze these credit items and return a prioritized attack plan as a JSON array. For each item specify:
- item_id (from the provided data)
- priority (1 = highest priority)
- letter_type (one of: fcra_609, fcra_611, fcra_623, fdcpa_809, goodwill, mov, pay_for_delete, identity_theft)
- legal_basis (the specific legal argument)
- deletion_probability (low, medium, or high)
- reasoning (2-3 sentences)

Items: ${JSON.stringify(payload.items)}

Client: ${payload.client?.first_name} ${payload.client?.last_name}

Return ONLY the JSON array, no markdown.`;
        break;
      }

      case "generate_letter": {
        const lt = payload.letter_type;
        const item = payload.item;
        const client = payload.client;
        systemPrompt = `You are an expert consumer rights attorney specializing in credit repair. Generate professional, legally-sound dispute letters using FCRA, FDCPA, and consumer protection law. Letters must be factual, assertive, and reference specific statutes.`;
        userPrompt = `Generate a complete ${lt} dispute letter for:

Client: ${client?.first_name} ${client?.last_name}
Address: ${client?.address || '[CLIENT ADDRESS]'}, ${client?.city || ''}, ${client?.state || ''} ${client?.zip_code || ''}
SSN Last 4: ${client?.ssn_last4 || 'XXXX'}
DOB: ${client?.date_of_birth || '[DOB]'}

Bureau: ${item.bureau}
Creditor: ${item.creditor_name}
Account #: ${item.account_number || 'Unknown'}
Item Type: ${item.item_type}
Balance: $${item.balance || 0}
Date of First Delinquency: ${item.date_of_first_delinquency || 'Unknown'}
Status: ${item.current_status}

Generate a complete, ready-to-send letter with proper headers, legal citations, and a firm but professional tone. Include the date, consumer identification block, and specific demands based on the letter type.`;
        break;
      }

      case "payment_strategy": {
        systemPrompt = `You are a business credit optimization expert specializing in Paydex score acceleration and tradeline management.`;
        userPrompt = `Analyze these business tradeline accounts and create an optimal payment strategy to reach Paydex 80 as fast as possible.

Current Paydex: ${payload.current_paydex}
Client: ${payload.client?.first_name} ${payload.client?.last_name} (${payload.client?.business_name || 'No entity'})

Accounts:
${JSON.stringify(payload.accounts, null, 2)}

Provide:
1. Payment priority order (which accounts to pay first and why)
2. Optimal payment timing for each account (days before statement close)
3. Recommended payment amounts
4. Projected timeline to reach Paydex 80
5. Any accounts that should be closed or have limits increased

Be specific with dollar amounts and dates.`;
        break;
      }

      case "vendor_instructions": {
        systemPrompt = `You are a business credit building expert who has helped thousands of businesses establish vendor tradelines.`;
        userPrompt = `Generate step-by-step instructions for opening a Net 30 vendor account with ${payload.vendor_name}.

Client Business: ${payload.client?.business_name || '[Business Name]'}
EIN: ${payload.client?.ein || '[EIN]'}

Provide numbered steps including:
1. Exact URL to visit
2. What to click / what form to fill out
3. What information to provide
4. What minimum order to place (and what to order)
5. Payment instructions (pay invoice within 10 days for best Paydex impact)
6. How long until it reports to bureaus
7. Any tips or common mistakes to avoid

Be specific and actionable.`;
        break;
      }

      case "optimize_card_stack": {
        systemPrompt = `You are a master credit card stacking strategist. You understand bureau pull patterns, application velocity, and how to maximize total approved credit within a 14-day window.`;
        userPrompt = `Optimize this credit card application stack for maximum approval and total credit.

Client Scores:
- TransUnion: ${payload.scores?.tu ?? 'Unknown'}
- Equifax: ${payload.scores?.eq ?? 'Unknown'}
- Experian: ${payload.scores?.ex ?? 'Unknown'}

Selected Cards:
${JSON.stringify(payload.cards, null, 2)}

Provide:
1. Optimal application sequence (numbered, with reasoning)
2. Timing within the 14-day window (which day to apply for each)
3. Expected approval amount per card
4. Total projected available credit
5. Any cards to remove from the stack and why
6. Bureau distribution analysis

Apply hardest approvals first. Distribute across bureaus. Cluster within the 14-day window to minimize inquiry impact.`;
        break;
      }

      case "generate_funding_roadmap": {
        systemPrompt = `You are a funding acquisition strategist who builds multi-phase capital access plans for businesses. You understand personal loans, business credit, SBA programs, and alternative financing.`;
        userPrompt = `Generate a detailed funding roadmap for this client.

Client: ${payload.client?.first_name} ${payload.client?.last_name}
Monthly Revenue: $${payload.client?.monthly_revenue || 0}
Time in Business: ${payload.client?.time_in_business_months || 0} months
Funding Goal: ${payload.client?.funding_goal || 'General capital access'}
Target Amount: $${payload.client?.target_funding_amount || 0}

Credit Scores:
- Overall DFS: ${payload.scores?.overall ?? 'N/A'}
- TransUnion: ${payload.scores?.tu ?? 'N/A'}
- Equifax: ${payload.scores?.eq ?? 'N/A'}
- Experian: ${payload.scores?.ex ?? 'N/A'}

Products Available Now (match 7+): ${JSON.stringify(payload.available_now)}
Products Available at 90 Days (match 4-6): ${JSON.stringify(payload.available_90d)}

Create a roadmap with three phases:
1. NOW — What to apply for immediately, expected amounts, and sequencing
2. 90 DAYS — What becomes available after banking velocity and credit improvement
3. 12 MONTHS — Full stack available after complete optimization

For each phase include specific products, expected amounts, timing, and what actions the client must complete to unlock the next phase. Be specific with dollar amounts and timelines.`;
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let result: Record<string, unknown> = {};
    if (action === "analyze_credit_items") {
      try {
        const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        result = { analysis: JSON.parse(cleaned) };
      } catch {
        result = { analysis: [], raw: content };
      }
    } else if (action === "generate_letter") {
      result = { letter: content };
    } else if (action === "payment_strategy") {
      result = { strategy: content };
    } else if (action === "vendor_instructions") {
      result = { instructions: content };
    } else if (action === "optimize_card_stack") {
      result = { strategy: content };
    } else if (action === "generate_funding_roadmap") {
      result = { roadmap: content };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("funding-ai-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
