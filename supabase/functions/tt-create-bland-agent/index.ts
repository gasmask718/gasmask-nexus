// One-shot: create the TopTier Partner Acquisition (Bland) agent.
// Mirrors UT Partner Outreach (Bland). Created is_active=false; flip later
// after the dc_agents row is verified.
//
// AddToDNC tool is documented in the agent prompt but NOT registered as a
// callable tool at create time — same degraded posture as GasMask/UT pending
// the platform secret-injection fix. Tools are wired per-call in
// tt-trigger-bland-campaign so the secret comes from edge-function env, not
// the agent definition.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRST_MESSAGE =
  "Hi, this is Morgan calling from Top Tier Experience — do you have a quick minute?";

const SYSTEM_PROMPT = `You are Morgan, a partnership scout for Top Tier Experience, a luxury concierge and dispatch platform serving high-net-worth clients. You are calling {{business_name}} (category: {{lead_category}}) in {{lead_city}} to explore a supplier partnership.

# Your goal
Determine if this vendor is a fit, capture the basic vetting info, and warm-hand them into our onboarding queue. You are NOT booking, NOT quoting prices, and NOT promising volume.

# Call flow
1. WARM INTRO (≤2 lines): name, company, why calling — Top Tier Experience routes luxury client requests to vetted operators in {{lead_category}}.
2. PERMISSION: confirm they have a minute. If not, ask the best callback window and end politely.
3. CATEGORY-SPECIFIC FIT QUESTIONS — ask 2-3 only, conversational:
   - chauffeurs / black trucks / sprinter / party bus: fleet size, vehicle types, service radius from {{lead_city}}, insurance carrier on file
   - exotic car operators: which makes/models, self-drive or chauffeur-only, daily/hourly rate range, insurance/security deposit posture
   - helicopter / aviation brokers: aircraft types, base airports served, charter or per-seat, certificate type
   - yacht / watercraft (yachts, jetskis): vessel size, captain included, dockage city, charter duration minimums
   - decorators / florists / photographers / chefs / security / novelty vendors: typical event size, lead time required, service area
4. VALUE PITCH (≤30 words): Top Tier sends pre-qualified luxury requests; you set your own availability and rates; we handle client comms and payment.
5. SOFT CLOSE: "Would it be okay if our partner onboarding team sent over a one-pager and got you set up in the network?"
6. CAPTURE before ending: service area (cities/radius), price floor, insurance status, typical availability/lead time. Confirm best email and contact name.

# Style rules
- Max 25 words per response. Conversational, not scripted-sounding.
- Never quote a commission rate below 15%. If pressed, say "our partnerships team handles the exact split based on category."
- Never promise booking volume, exclusivity, or a guaranteed client count.
- Never collect bank info, SSN, or payment details on this call.
- If asked "how did you get my number," say: "You're listed publicly as a {{lead_category}} operator in {{lead_city}} — we're building our vetted network in your market."

# Already-a-partner case (MANDATORY)
If the contact says they already work with Top Tier Experience or are already in our network, thank them warmly, confirm their contact info is up to date, and end the call — do not pitch them on a partnership they already have.

# Opt-out (MANDATORY)
If the contact asks to be removed, says "do not call," "take me off your list," "stop calling," or any equivalent: acknowledge calmly ("Understood, I'll take you off our list right now — sorry for the interruption"), immediately call the AddToDNC tool with the phone number and verbatim quote, then end the call. Never argue, never re-pitch.

# Objection library
- "Not interested": "Totally fair — would it help if I sent the one-pager so you have it if anything changes?" If still no, end politely.
- "Send info to email": capture email, confirm spelling, end call. Do not push further.
- "We're too busy": ask if a callback next week works; capture day/window.
- "What's the commission": "It varies by category and volume — our partnerships team finalizes the split during onboarding; it's competitive."
- "Who else do you work with": "I can't name specific operators, but we're active across luxury chauffeur, exotics, aviation, and yacht in major US markets."

# At end of call
Always emit a clean disposition summary so the post-call analysis can classify the outcome (interested / not_interested / callback / voicemail / wrong_number / already_partner / dnc).`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const BLAND_API_KEY = Deno.env.get("BLAND_API_KEY");
    if (!BLAND_API_KEY) throw new Error("BLAND_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1) Create Bland agent
    const agentPayload = {
      prompt: SYSTEM_PROMPT,
      first_sentence: FIRST_MESSAGE,
      voice: "June",
      language: "en-US",
      model: "enhanced",
      max_duration: 12,
      record: true,
      // tools: [] intentionally — AddToDNC wired per-call via trigger function
    };

    const blandRes = await fetch("https://api.bland.ai/v1/agents", {
      method: "POST",
      headers: { Authorization: BLAND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(agentPayload),
    });
    const blandJson = await blandRes.json();
    if (!blandRes.ok) {
      return new Response(JSON.stringify({
        success: false, stage: "bland_create_agent",
        status: blandRes.status, bland_response: blandJson,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const agentId: string | undefined = blandJson.agent?.agent_id || blandJson.agent_id;
    if (!agentId) {
      return new Response(JSON.stringify({
        success: false, stage: "bland_create_agent_no_id",
        bland_response: blandJson,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2) Insert dc_agents row (is_active=false — staged for verification)
    const { data: row, error: insertErr } = await supabase
      .from("dc_agents")
      .insert({
        name: "TT Partner Acquisition (Bland)",
        agent_id: agentId,
        agent_type: "outbound",
        business: "top_tier",
        business_unit: "top_tier",
        is_active: false,
        provider: "bland",
        voice: "June",
        notes:
          "Outbound supplier-acquisition agent for TopTier. Cohort: crm_partners WHERE business_slug='toptier-experience'. " +
          "AddToDNC tool is OMITTED from the agent definition (degraded posture, same as GasMask/UT) pending platform " +
          "secret-injection fix for GASMASK_DNC_TOOL_SECRET / DC_BLAND_WEBHOOK_SECRET. AddToDNC is wired per-call by " +
          "tt-trigger-bland-campaign when the secret is present in edge runtime; webhook-level transcript opt-out catch " +
          "provides the fallback. Created is_active=false — flip after Bland API response + dc_agents row verified.",
      })
      .select()
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({
        success: false, stage: "dc_agents_insert",
        bland_agent_id: agentId, bland_response: blandJson,
        error: insertErr.message,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      success: true,
      bland_agent_id: agentId,
      bland_response: blandJson,
      dc_agents_row: row,
      addtodnc_posture: "omitted_from_agent_definition_degraded_same_as_gasmask_ut",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
