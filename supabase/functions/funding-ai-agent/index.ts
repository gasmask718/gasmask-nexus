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

      case "generate_velocity_plan": {
        systemPrompt = `You are a banking relationship strategist who understands how banks internally score business accounts for credit decisions. You know the exact deposit volumes, transaction counts, and balance requirements that trigger automated credit offers.`;
        userPrompt = `Generate a detailed month-by-month banking velocity plan.

Institution: ${payload.institution}
Target Product: ${payload.product}
Requirements: ADB ${payload.requirements?.adb}, Monthly Deposits ${payload.requirements?.deposits}, Transactions ${payload.requirements?.transactions}/mo, Account Age ${payload.requirements?.months} months

Client: ${payload.client?.first_name} ${payload.client?.last_name}
Monthly Revenue: $${payload.client?.monthly_revenue || 0}
Time in Business: ${payload.client?.time_in_business_months || 0} months

Create a 3-month plan with:
1. Exact deposit schedule (amounts and dates per month)
2. Transaction strategy (what types, how many, minimum amounts)
3. Balance management (when to keep funds in vs move out)
4. Specific actions each month (set up direct deposit, recurring transfers, etc.)
5. What triggers to watch for (pre-approval offers, relationship manager outreach)
6. When exactly to apply and what to say

Be specific with dollar amounts and dates.`;
        break;
      }

      case "match_tradelines": {
        systemPrompt = `You are a credit optimization expert who understands how authorized user tradelines impact credit scores across different bureaus and FICO scoring models. You know which tradeline characteristics (age, limit, utilization, bureau reporting) produce the maximum score lift for specific credit profiles.`;
        userPrompt = `Find the best tradeline matches for this client.

Client: ${payload.client?.first_name} ${payload.client?.last_name}
Scores: TU ${payload.scores?.tu ?? 'N/A'}, EQ ${payload.scores?.eq ?? 'N/A'}, EX ${payload.scores?.ex ?? 'N/A'}

Available Tradelines:
${JSON.stringify(payload.available_cards, null, 2)}

For each recommended tradeline provide:
1. Which tradeline and why it's the best match
2. Expected score impact per bureau
3. Why this specific age/limit/utilization combination helps this client
4. Optimal timing (when to add AU relative to statement close)
5. Any risks or considerations

Rank from highest impact to lowest. Be specific about expected point increases.`;
        break;
      }

      case "generate_task_cards": {
        systemPrompt = `You are a funding pipeline specialist who creates precise, executable action plans. Every task you create must have exact step-by-step instructions that a non-expert can follow. Tasks must be specific, actionable, and tied to measurable funding outcomes.`;
        userPrompt = `Generate task cards for this client's ${payload.module} module.

Client: ${payload.client?.first_name} ${payload.client?.last_name}
DFS Scores: ${JSON.stringify(payload.scores)}
Module: ${payload.module}

Generate 3-5 task cards as a JSON array. Each task object must have:
- title (string, clear action title)
- category (one of: online, branch_visit, mail, phone_call, document)
- rationale (string, 2 sentences explaining why this matters and what funding it unlocks)
- steps (array of strings, numbered step-by-step instructions)
- resource_url (string or null, direct URL for online actions)
- resource_address (string or null, for branch visits)
- document_checklist (array of strings or null, documents needed)
- time_estimate (number, minutes to complete)
- deadline_days (number, days from now)
- funding_impact (number 1-10, how much this impacts funding access)

Return ONLY the JSON array, no markdown.`;
        break;
      }

      case "generate_morning_brief": {
        systemPrompt = `You are the Dynasty Funding Machine operations AI. You produce concise, actionable morning briefings that tell the operator exactly what needs to happen today in priority order. Be direct, specific, and focus on revenue-generating actions.`;
        userPrompt = `Generate today's morning briefing.

Active Clients: ${JSON.stringify(payload.clients)}
Red Alerts: ${JSON.stringify(payload.red_alerts)}
Amber Warnings: ${JSON.stringify(payload.amber_warnings)}
Green Updates: ${JSON.stringify(payload.green_updates)}
Vault: Revenue $${payload.vault?.revenue}, Slots ${payload.vault?.occupied}/${payload.vault?.total}, Pending Payouts $${payload.vault?.pending_payouts}
Tasks Due Today: ${payload.tasks_due_today}
Total Pipeline Value: $${payload.total_pipeline}

Write a concise executive briefing with:
1. TOP PRIORITY — What must happen in the next 2 hours
2. CLIENT ACTIONS — Specific actions per client in priority order
3. REVENUE OPPORTUNITIES — Where money is being left on the table
4. RISK ITEMS — What could go wrong if not addressed today
5. PIPELINE FORECAST — Where the pipeline will be in 7 days if today's actions are completed

Keep it under 500 words. Be direct and actionable.`;
        break;
      }

      case "simulate_score_impact": {
        systemPrompt = `You are a FICO 8 and VantageScore 3 algorithm expert who has analyzed thousands of credit profiles. Estimate the score impact of proposed changes with precision.`;
        userPrompt = `Current scores per bureau:
- TransUnion: ${payload.current_scores?.tu ?? 'Unknown'}
- Equifax: ${payload.current_scores?.eq ?? 'Unknown'}
- Experian: ${payload.current_scores?.ex ?? 'Unknown'}

Scenario type: ${payload.scenario_type}
Scenario parameters: ${JSON.stringify(payload.scenario_parameters)}

Estimate the projected score change per bureau as an integer, confidence as high medium or low, and reasoning under 75 words.

Return ONLY JSON with keys projected_change_tu, projected_change_eq, projected_change_ex as integers, confidence as string, and reasoning as string.`;
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
    } else if (action === "generate_velocity_plan") {
      result = { plan: content };
    } else if (action === "match_tradelines") {
      result = { matches: content };
    } else if (action === "generate_task_cards") {
      try {
        const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        result = { tasks: JSON.parse(cleaned) };
      } catch {
        result = { tasks: [], raw: content };
      }
    } else if (action === "generate_morning_brief") {
      result = { brief: content };
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
