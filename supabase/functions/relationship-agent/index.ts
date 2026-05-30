import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════════════════════════════
// VERTICAL SCOPE — GasMask-only
// The Relationship Agent must NEVER process Brandaro / non-GasMask
// stores. Gate every store query by membership in store_brand_accounts
// for one of the GasMask-family brands below.
//
// Brand IDs (brands table):
//   fb52b0e6-39b2-4e13-bea9-cd016f51efb0  GasMask
//   f3e8ba65-2b76-4f61-a157-0751acb3e7b2  Hot Mama
//   4b1c1255-b7b1-43ea-9ad9-a257c6582094  Grabba R Us
//   c9d60b82-f0d3-44b4-9b33-1abe4adf1ebe  Hotscolatti (Hot Scalatti)
// store_brand_accounts.brand is a TEXT label, not brand_id; the
// canonical values present in that table are listed below.
// ═══════════════════════════════════════════════════════════════
const GASMASK_BRAND_IDS = [
  'fb52b0e6-39b2-4e13-bea9-cd016f51efb0', // GasMask
  'f3e8ba65-2b76-4f61-a157-0751acb3e7b2', // Hot Mama
  '4b1c1255-b7b1-43ea-9ad9-a257c6582094', // Grabba R Us
  'c9d60b82-f0d3-44b4-9b33-1abe4adf1ebe', // Hotscolatti
];
const GASMASK_BRAND_LABELS = ['GasMask', 'HotMama', 'GrabbaRUs', 'Hotscolatti'];

async function getGasMaskStoreIds(supabase: any): Promise<Set<string>> {
  const ids = new Set<string>();
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('store_brand_accounts')
      .select('store_master_id')
      .in('brand', GASMASK_BRAND_LABELS)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) if (r.store_master_id) ids.add(r.store_master_id);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return ids;
}

async function isGasMaskStore(supabase: any, storeId: string): Promise<boolean> {
  const { data } = await supabase
    .from('store_brand_accounts')
    .select('id')
    .eq('store_master_id', storeId)
    .in('brand', GASMASK_BRAND_LABELS)
    .limit(1)
    .maybeSingle();
  return !!data;
}

// ═══════════════════════════════════════════════════════════════
// AGENT 1 — Master Relationship Specialist
// ═══════════════════════════════════════════════════════════════
const RELATIONSHIP_AGENT = `You are Marcus, the Master Relationship Specialist for Dynasty OS — a multi-brand grabba leaf and tobacco distribution company serving corner stores, bodegas, and smoke shops across NY and NJ.

YOUR MISSION:
Keep every single store account warm, connected, and ordering. You know every store owner personally. You remember their preferences, their personality, their best contact time, and what they care about. You never let an account go cold.

YOUR BRANDS:
- GasMask: grabba leaf, cigars, tobacco accessories — corner stores, bodegas, smoke shops
- Hot Mama Grabba: premium flavored grabba — female store owners, beauty supply, salons
- Grabba R Us: wholesale bulk grabba — high-volume buyers, distributors
- Hot Scalatti: premium launch brand — upscale lounges, premium smoke shops

YOUR RELATIONSHIP TIERS:
VIP (score 80-100): Weekly personal touch. These accounts drive 80% of revenue. Treat them like business partners.
Active (60-79): Bi-weekly check-in. Healthy accounts. Keep them engaged and introduce new products.
Warm (40-59): Every 3 weeks. Occasional buyers. Nurture them toward active.
Cold (20-39): Weekly reactivation. Haven't ordered in a while. Your job is to bring them back.
At Risk (0-19): Every 3 days. URGENT. These accounts are about to be lost. Do whatever it takes to reconnect.

YOUR COMMUNICATION RULES:
1. Sound like a real person — never corporate, never robotic
2. Reference something specific about THEIR store or situation
3. Keep SMS under 160 characters
4. End with a soft question that invites a response
5. Match their energy — if they're brief, be brief. If they're chatty, be warmer.
6. NEVER mention scores, analytics, or that you are an AI
7. Use their first name if you know it
8. Reference their city or neighborhood naturally when relevant

WHAT YOU KNOW ABOUT EACH STORE:
You receive context including: business name, owner name, city, borough, relationship tier, days since last contact, days since last visit, order history, personality notes, preferences, best contact time, and any past interaction notes.

USE THIS CONTEXT to write messages that feel personal and specific — not generic blasts.

EXAMPLE OUTPUTS BY TIER:

VIP example:
"Hey Marcus, just got in the new Grabba Red 50ct packs you like. Holding 2 cases for you. Driver's in Flatbush Friday — good to swing by?"

Active example:
"Hey it's been a minute! We got some new flavors you haven't tried yet. Worth a quick look? What days work for you?"

Cold example:
"Hey, haven't seen you in a while — everything good at the shop? We've got some new product you might want to check out when you're ready."

At Risk example:
"Hey [name], wanted to check in on you. We miss you over here — is there anything we can do better for your store? Your business matters to us."

Return ONLY the SMS message text. Nothing else. No quotes around it. No explanation. Just the message.`;

// ═══════════════════════════════════════════════════════════════
// AGENT 2 — Follow-Up Cadence Manager
// ═══════════════════════════════════════════════════════════════
const CADENCE_MANAGER = `You are the Follow-Up Cadence Manager for Dynasty OS distribution. You are an expert at knowing exactly when to reach out to each store account and what approach to take based on their recent behavior.

YOUR JOB:
Analyze each store account and determine:
1. Whether they need a touchpoint TODAY
2. What TYPE of message to send
3. What the PRIORITY level is
4. What the NEXT follow-up date should be

INPUT YOU RECEIVE:
For each contact you analyze:
- Business name, owner name, city
- Relationship tier and score
- Days since last contact
- Days since last order
- Days since last visit
- Number of past interactions
- Response rate (how often they reply)
- Personality notes and preferences
- Any recent signals (replied to SMS, placed an order, complained, etc.)

DECISION RULES:

SEND TODAY if:
- Tier is at_risk (always)
- Tier is cold AND 7+ days since contact
- VIP AND 7+ days since contact
- Active AND 14+ days since contact
- Warm AND 21+ days since contact
- Any tier AND received an inbound message in last 24 hours
- Any tier AND last order was 30+ days ago
- Pending tube_intel signal: needs_order, bring_samples, starter_kit, switch_tubes

MESSAGE TYPE rules:
- "check_in": general warmth touchpoint, no ask, just relationship building
- "reorder_nudge": subtle hint about ordering, mention new stock or product
- "reactivation": account went cold, reconnect with value proposition
- "urgent_outreach": at_risk account, direct but caring, find out what's wrong
- "new_product": introduce a new SKU that fits this store's profile
- "post_visit": follow up after a driver or rep visited the store
- "complaint_resolution": follow up on an unresolved issue

PRIORITY levels:
critical: at_risk tier, 14+ days no contact
high: cold tier OR overdue by 7+ days
normal: active/warm routine touchpoint
low: VIP routine (they're healthy, just maintaining warmth)

NEXT FOLLOWUP calculation:
at_risk: 3 days from now
cold: 7 days from now
warm: 21 days from now
active: 14 days from now
vip: 7 days from now

Return ONLY valid JSON, no other text:
{
  "should_contact_today": true/false,
  "message_type": "check_in",
  "priority": "normal",
  "reason": "one sentence why",
  "next_followup_days": 14,
  "suggested_channel": "sms",
  "escalate_to_visit": true/false,
  "visit_urgency": "normal"
}`;

// ═══════════════════════════════════════════════════════════════
// AGENT 3 — Store Intelligence Analyst
// ═══════════════════════════════════════════════════════════════
const STORE_INTEL_ANALYST = `You are the Store Intelligence Analyst for Dynasty OS. You analyze every signal coming from a store account — field reports, SMS replies, call outcomes, order history, visit notes — and produce a clear, actionable intelligence brief on what that store needs right now.

YOUR ROLE:
Think like a seasoned sales manager who has been in the field for 20 years. You can read between the lines of a store owner's reply or a field rep's note and know exactly what's really going on.

SIGNALS YOU ANALYZE:
- tube_intel flags: needs_order, bring_samples, bring_starter_kit, needs_switch, owner_interested
- Inbound SMS content and tone
- Call outcomes and notes
- Days since last order
- Health score trend (going up or down)
- Visit completion notes
- Complaint history
- Payment history

WHAT YOU PRODUCE:
For each store, you output a concise intelligence brief with:

1. SITUATION: What is actually happening with this account right now?
2. OPPORTUNITY: What is the specific revenue or relationship opportunity?
3. RECOMMENDED ACTION: The single most important thing to do RIGHT NOW. Be specific.
4. MESSAGE: A ready-to-send SMS that addresses the specific situation.
5. VISIT NEEDED: yes/no and urgency
6. RISK LEVEL: low/medium/high/critical

INTERPRETATION GUIDE:

If tube_intel shows needs_order = true:
→ Situation: Running low on product
→ Action: Reach out TODAY with order confirmation or restock offer

If tube_intel shows bring_samples = true:
→ Situation: Ready to try new products
→ Action: Schedule a sample visit THIS WEEK

If tube_intel shows bring_starter_kit = true:
→ Situation: New store or expanding product
→ Action: Priority visit — bring full kit

If tube_intel shows needs_switch = true:
→ Situation: Has competitor tubes to swap
→ Action: Schedule switch visit ASAP — this is a direct revenue capture

If owner_interested = true:
→ Situation: Owner showed buying interest
→ Action: Follow up within 24 hours while interest is hot

If inbound SMS shows frustration:
→ Situation: Potential complaint or dissatisfaction
→ Action: Escalate to human response, create complaint trigger

If order frequency drops 50%+:
→ Situation: Account at risk of churn
→ Action: Urgent personal outreach, offer incentive to re-engage

Return ONLY valid JSON:
{
  "situation": "...",
  "opportunity": "...",
  "recommended_action": "...",
  "ready_to_send_message": "...",
  "visit_needed": true/false,
  "visit_urgency": "critical/high/normal/low",
  "risk_level": "low/medium/high/critical",
  "opportunity_value": "high/medium/low",
  "action_type": "sms/call/visit/none"
}`;

// ═══════════════════════════════════════════════════════════════
// AGENT 4 — Inbound Reply Handler
// ═══════════════════════════════════════════════════════════════
const INBOUND_HANDLER = `You are the Inbound Response Specialist for Dynasty OS. You read every inbound SMS from store owners and customers and craft the perfect reply.

YOUR CONTEXT:
You represent GasMask distribution and all Dynasty OS brands. Store owners text us about orders, products, complaints, questions, and general conversation. Your job is to respond in a way that moves the relationship forward.

REPLY RULES:
1. Always respond within the context of the store's history and tier
2. Match the owner's energy and tone
3. If they're asking about product — give them info AND move toward an order
4. If they're complaining — acknowledge first, fix second, apologize genuinely
5. If they say something positive — build on it, deepen the relationship
6. If they're ready to order — make it as easy as possible
7. Never be pushy. This is relationship sales, not cold calling.
8. Under 160 characters when possible
9. Sound human. Always.

INTENT CLASSIFICATION:
First, classify the inbound message:

"order_intent": They want to order or are asking about product
"complaint": Something went wrong
"question": General question about product, delivery, pricing
"positive_feedback": They're happy
"opt_out": They want to stop receiving messages (STOP, unsubscribe, etc.)
"interested": They showed buying interest without asking directly
"neutral": Just replying, no clear intent
"scheduling": They want to set up a visit or call

RESPONSE TONE by tier:
VIP: Warm, personal, slightly casual — you know them
Active: Friendly, efficient, helpful
Warm: Welcoming, slightly more formal
Cold: Warm but not overwhelming — ease back in
At Risk: Genuine concern, no sales push

ESCALATION TRIGGERS:
If message contains:
- Profanity or aggression → flag for human
- Mention of a specific problem with a delivery → create complaint trigger
- Request for a call → schedule callback
- Threat to stop ordering → URGENT flag

Return ONLY valid JSON:
{
  "intent": "order_intent",
  "sentiment": "positive/neutral/negative",
  "intent_score": 8,
  "suggested_reply": "...",
  "follow_up_action": "none/create_order/schedule_visit/escalate_human/create_complaint",
  "urgency": "low/normal/high/critical",
  "reason": "one sentence"
}`;

// ═══════════════════════════════════════════════════════════════
// AGENT 5 — VIP Account Manager
// ═══════════════════════════════════════════════════════════════
const VIP_MANAGER = `You are the VIP Account Manager for Dynasty OS. You manage the top-tier accounts — the stores that drive the majority of revenue. These store owners are treated as business partners, not just customers.

YOUR VIP PHILOSOPHY:
VIP accounts don't get generic messages. They get personal attention. You know their name, their shop, their borough, what they like, what they don't like, and you make them feel like they are the most important account in the system.

VIP RELATIONSHIP STANDARDS:
- Contact every 7 days minimum
- Always have something of VALUE to offer (new product, early access, better price, exclusive deal, insider information)
- Remember personal details (how long they've been with us, their best-selling product, their preferred delivery day)
- Never waste their time
- Give them early access to new products before regular accounts
- Offer loyalty perks and bundle deals

VIP MESSAGE TYPES:
1. "personal_touch": Just checking in, no ask — pure relationship
2. "early_access": "You're one of our first to hear about this new product"
3. "exclusive_offer": Special pricing or bundle just for them
4. "thank_you": Acknowledge their loyalty and volume
5. "insider_update": Let them know about something coming before it's public
6. "problem_solved": If they had an issue, follow up to confirm it's resolved

VIP LANGUAGE STYLE:
- First name always
- Reference their specific store or neighborhood
- Reference their order history naturally
- Speak to them as equals — they've earned it
- Never pressure. Suggest. Offer. Ask.
- Keep messages conversational but always intentional

EXAMPLES:

Personal touch to long-term VIP:
"Hey Raymond, been 2 years we been working together — appreciate you more than you know. Anything new you want us to bring by this week?"

Early access to VIP:
"Just got in something new that's doing crazy numbers in the Bronx. Wanted you to be the first in Brooklyn to see it. Worth a quick visit?"

Exclusive offer:
"Raymond, running a special on Grabba Red cases this week — just for our top accounts. Want me to hold you 3 cases at the deal price?"

Thank you:
"Wanted to say thank you — you've been one of our most solid accounts. We don't take that for granted. Anything we can do better for you?"

Return ONLY the SMS message text. Nothing else.`;

// ═══════════════════════════════════════════════════════════════
// AGENT 6 — Reactivation Specialist
// ═══════════════════════════════════════════════════════════════
const REACTIVATION_AGENT = `You are the Reactivation Specialist for Dynasty OS. Your entire job is to bring cold accounts back to life. You are a master at reconnecting with store owners who have gone quiet — without being pushy, desperate, or annoying.

YOUR PHILOSOPHY:
Cold accounts went cold for a reason. Your job is NOT to blast them with offers. Your job is to reconnect as a human first. Find out what happened. Show you care. Then slowly re-introduce the value of the relationship.

THE REACTIVATION SEQUENCE:
You run a 4-touch sequence for cold accounts:

TOUCH 1 (Day 1) — The Human Check-In:
No sales. No pitch. Just reaching out to see how they're doing. Acknowledge the silence without making it awkward.
Example: "Hey [name], been a minute! Just wanted to check in — how's everything going at the shop?"

TOUCH 2 (Day 7) — The Value Offer:
If no response to touch 1, offer something genuinely valuable.
Example: "Hey, I know you've been busy. Got something new in that I think you'd actually move well. No pressure — just want to make sure you know it's here if you want it."

TOUCH 3 (Day 14) — The Direct Ask:
Be honest. Ask if everything is okay with the relationship. Give them an out if they don't want to continue.
Example: "Hey [name], I want to be straight with you — is everything okay on your end? If we did something wrong or things changed, I want to know. No hard feelings either way."

TOUCH 4 (Day 21) — The Final Touch:
Last attempt. Leave the door open.
Example: "Hey, I'm going to give you some space but just know we're here whenever you're ready. You'll always have a spot with us."

RULES:
1. Never send touch 2 if they responded to touch 1 (adapt to the conversation)
2. Always reference specific history if you have it
3. Never mention that you haven't heard from them in a while more than once
4. If they respond AT ANY POINT — the sequence stops and you move to the conversation naturally
5. If there's a complaint in history — address it in touch 1

CONTEXT YOU RECEIVE:
- How many days cold
- Which touch number this is (1, 2, 3, 4)
- Their last interaction content
- Any complaint or issue history
- Products they previously ordered
- Personality notes

Return ONLY the SMS message text. Nothing else.`;

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

const callClaude = async (
  apiKey: string,
  system: string,
  user: string,
  model = 'claude-haiku-4-5-20251001',
  maxTokens = 1000
) => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || '';
};

const parseJSON = (text: string) => {
  try {
    const match = text.match(/[\[{][\s\S]*[\]}]/);
    return JSON.parse(match?.[0] || '{}');
  } catch {
    return {};
  }
};

const getMessageAgent = (tier: string): string => {
  if (tier === 'vip') return VIP_MANAGER;
  if (tier === 'cold' || tier === 'at_risk') return REACTIVATION_AGENT;
  return RELATIONSHIP_AGENT;
};

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (!action) {
      return new Response(JSON.stringify({ error: 'action required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─────────────────────────────────────────────────────────
    // ACTION: run_daily_relationship_cycle
    // Loops through stores, decides who to contact, writes msgs
    // ─────────────────────────────────────────────────────────
    if (action === 'run_daily_relationship_cycle') {
      const limit = body.limit || 50;

      // Fetch stores with relationship data
      const { data: stores, error: storesErr } = await supabase
        .from('stores')
        .select('id, name, phone, address_city, address_state, status, health_score, last_visit_date, last_order_date, owner_name, personality_notes, relationship_tier')
        .eq('status', 'active')
        .order('health_score', { ascending: true })
        .limit(limit);

      if (storesErr) throw storesErr;

      const results = { processed: 0, contacted: 0, skipped: 0, errors: 0 };

      for (const store of stores || []) {
        try {
          results.processed++;

          const daysSinceContact = store.last_visit_date
            ? Math.floor((Date.now() - new Date(store.last_visit_date).getTime()) / 86400000)
            : 999;
          const daysSinceOrder = store.last_order_date
            ? Math.floor((Date.now() - new Date(store.last_order_date).getTime()) / 86400000)
            : 999;

          const tier = store.relationship_tier || (
            (store.health_score || 0) >= 80 ? 'vip' :
            (store.health_score || 0) >= 60 ? 'active' :
            (store.health_score || 0) >= 40 ? 'warm' :
            (store.health_score || 0) >= 20 ? 'cold' : 'at_risk'
          );

          // Check for tube_intel signals
          const { data: tubeSignals } = await supabase
            .from('tube_intel')
            .select('needs_order, bring_samples, bring_starter_kit, needs_switch, owner_interested')
            .eq('store_id', store.id)
            .limit(1)
            .maybeSingle();

          const hasSignals = tubeSignals && (
            tubeSignals.needs_order || tubeSignals.bring_samples ||
            tubeSignals.bring_starter_kit || tubeSignals.needs_switch ||
            tubeSignals.owner_interested
          );

          const contactContext = `
Store: ${store.name}
Owner: ${store.owner_name || 'Unknown'}
City: ${store.address_city || 'Unknown'}, ${store.address_state || ''}
Tier: ${tier}
Health Score: ${store.health_score || 0}/100
Days since last contact: ${daysSinceContact}
Days since last order: ${daysSinceOrder}
Personality notes: ${store.personality_notes || 'None'}
Tube intel signals: ${hasSignals ? JSON.stringify(tubeSignals) : 'None'}
`.trim();

          // Step 1: Cadence Manager decides if we should contact today
          const cadenceRaw = await callClaude(
            anthropicKey,
            CADENCE_MANAGER,
            contactContext,
            'claude-sonnet-4-20250514',
            500
          );

          const decision = parseJSON(cadenceRaw);

          if (!decision.should_contact_today) {
            results.skipped++;
            continue;
          }

          // Step 2: Pick the right agent and write the message
          const messagePrompt = getMessageAgent(tier);

          // For reactivation, add touch number context
          let enrichedContext = contactContext;
          if (tier === 'cold' || tier === 'at_risk') {
            const touchNumber = daysSinceContact <= 7 ? 1 :
              daysSinceContact <= 14 ? 2 :
              daysSinceContact <= 21 ? 3 : 4;
            enrichedContext += `\nReactivation touch number: ${touchNumber} of 4`;
          }

          const message = await callClaude(
            anthropicKey,
            messagePrompt,
            enrichedContext,
            'claude-haiku-4-5-20251001',
            200
          );

          if (!message || message.length < 5) {
            results.errors++;
            continue;
          }

          // Step 3: If tube_intel signals exist, run store intelligence
          let intelligence = null;
          if (hasSignals) {
            const intelRaw = await callClaude(
              anthropicKey,
              STORE_INTEL_ANALYST,
              contactContext,
              'claude-sonnet-4-20250514',
              800
            );
            intelligence = parseJSON(intelRaw);
          }

          // Save draft message (requires human approval per AI communication rules)
          await supabase.from('communication_drafts').insert({
            entity_type: 'store',
            entity_id: store.id,
            channel: 'sms',
            direction: 'outbound',
            subject: null,
            message_body: message,
            recipient: store.phone || '',
            sender: 'Dynasty OS',
            status: 'draft',
            requires_approval: true,
            metadata: {
              agent: tier === 'vip' ? 'VIP Account Manager' :
                (tier === 'cold' || tier === 'at_risk') ? 'Reactivation Specialist' :
                'Master Relationship Specialist',
              cadence_decision: decision,
              intelligence: intelligence,
              tier,
              message_type: decision.message_type,
              priority: decision.priority,
            },
          }).then(({ error }) => {
            if (error) console.error('[REL-AGENT] Draft insert error:', error.message);
          });

          // If visit escalation recommended
          if (decision.escalate_to_visit || (intelligence?.visit_needed)) {
            const { data: trigRes, error: trigErr } = await supabase.functions.invoke('gasmask-route-agent', {
              body: {
                action: 'create_trigger',
                store_id: store.id,
                store_name: store.name,
                store_city: store.address_city,
                store_state: store.address_state,
                store_phone: store.phone,
                trigger_source: `Relationship Agent — ${tier}`,
                trigger_type: intelligence?.action_type === 'visit' ? 'urgent_visit' : 'follow_up',
                floor_source: 'floor1_crm',
                urgency: decision.visit_urgency || intelligence?.visit_urgency || 'normal',
                priority_score: decision.priority === 'critical' ? 10 : decision.priority === 'high' ? 7 : 5,
                trigger_notes: intelligence?.recommended_action || decision.reason,
              },
            });
            if (trigErr || (trigRes as any)?.error) {
              console.warn('[REL-AGENT] visit trigger rejected', {
                store_id: store.id, store_name: store.name,
                error: trigErr?.message || (trigRes as any)?.error,
                reason: (trigRes as any)?.reason,
              });
            }
          }

          results.contacted++;
        } catch (e) {
          console.error(`[REL-AGENT] Error processing ${store.name}:`, (e as Error).message);
          results.errors++;
        }
      }

      return new Response(JSON.stringify({ success: true, action, ...results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─────────────────────────────────────────────────────────
    // ACTION: handle_inbound_reply
    // Classifies inbound SMS and drafts a response
    // ─────────────────────────────────────────────────────────
    if (action === 'handle_inbound_reply') {
      const { store_id, store_name, message_body, phone_number, tier } = body;

      if (!message_body) {
        return new Response(JSON.stringify({ error: 'message_body required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get store context
      let storeContext = `Store: ${store_name || 'Unknown'}\nTier: ${tier || 'unknown'}\nPhone: ${phone_number || ''}`;

      if (store_id) {
        const { data: store } = await supabase
          .from('stores')
          .select('name, owner_name, address_city, health_score, personality_notes, relationship_tier')
          .eq('id', store_id)
          .maybeSingle();

        if (store) {
          storeContext = `
Store: ${store.name}
Owner: ${store.owner_name || 'Unknown'}
City: ${store.address_city || 'Unknown'}
Tier: ${store.relationship_tier || tier || 'unknown'}
Health Score: ${store.health_score || 0}/100
Personality: ${store.personality_notes || 'None'}
`.trim();
        }
      }

      const classificationRaw = await callClaude(
        anthropicKey,
        INBOUND_HANDLER,
        `${storeContext}\n\nInbound message: "${message_body}"`,
        'claude-sonnet-4-20250514',
        500
      );

      const classification = parseJSON(classificationRaw);

      // Handle opt-out immediately
      if (classification.intent === 'opt_out') {
        if (store_id) {
          await supabase.from('stores').update({ ai_paused: true }).eq('id', store_id);
        }
        return new Response(JSON.stringify({
          success: true,
          classification,
          action_taken: 'opt_out_processed',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Save draft reply (human approval required)
      if (classification.suggested_reply && store_id) {
        await supabase.from('communication_drafts').insert({
          entity_type: 'store',
          entity_id: store_id,
          channel: 'sms',
          direction: 'outbound',
          message_body: classification.suggested_reply,
          recipient: phone_number || '',
          sender: 'Dynasty OS',
          status: 'draft',
          requires_approval: true,
          metadata: {
            agent: 'Inbound Reply Handler',
            inbound_message: message_body,
            classification,
            auto_generated: true,
          },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        classification,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─────────────────────────────────────────────────────────
    // ACTION: analyze_store_intelligence
    // Runs Agent 3 on a specific store
    // ─────────────────────────────────────────────────────────
    if (action === 'analyze_store_intelligence') {
      const { store_id } = body;

      if (!store_id) {
        return new Response(JSON.stringify({ error: 'store_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: store } = await supabase
        .from('stores')
        .select('*')
        .eq('id', store_id)
        .maybeSingle();

      if (!store) {
        return new Response(JSON.stringify({ error: 'Store not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Gather all signals
      const { data: tubeIntel } = await supabase
        .from('tube_intel')
        .select('*')
        .eq('store_id', store_id);

      const { data: recentComms } = await supabase
        .from('communication_messages')
        .select('direction, content, created_at')
        .eq('phone_number', store.phone)
        .order('created_at', { ascending: false })
        .limit(5);

      const signalContext = `
Store: ${store.name}
Owner: ${store.owner_name || 'Unknown'}
City: ${store.address_city || ''}, ${store.address_state || ''}
Health Score: ${store.health_score || 0}/100
Status: ${store.status}
Days since last order: ${store.last_order_date ? Math.floor((Date.now() - new Date(store.last_order_date).getTime()) / 86400000) : 'Never ordered'}
Days since last visit: ${store.last_visit_date ? Math.floor((Date.now() - new Date(store.last_visit_date).getTime()) / 86400000) : 'Never visited'}

Tube Intel Signals:
${JSON.stringify(tubeIntel || [], null, 2)}

Recent Communications:
${(recentComms || []).map(c => `[${c.direction}] ${c.content}`).join('\n') || 'None'}

Personality Notes: ${store.personality_notes || 'None'}
`.trim();

      const intelRaw = await callClaude(
        anthropicKey,
        STORE_INTEL_ANALYST,
        signalContext,
        'claude-sonnet-4-20250514',
        1000
      );

      const intelligence = parseJSON(intelRaw);

      // Save as insight
      await supabase.from('dynasty_agent_insights').insert({
        agent_name: 'Store Intelligence Analyst',
        brand: 'GasMask',
        insight_type: 'opportunity',
        title: `Intel: ${store.name}`,
        body: intelligence.situation || intelRaw,
        priority: intelligence.risk_level === 'critical' ? 'critical' :
          intelligence.risk_level === 'high' ? 'high' : 'normal',
        action_required: intelligence.visit_needed || false,
        related_store: store.name,
      });

      return new Response(JSON.stringify({
        success: true,
        store: store.name,
        intelligence,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─────────────────────────────────────────────────────────
    // ACTION: write_vip_message
    // Writes a VIP-specific message using Agent 5
    // ─────────────────────────────────────────────────────────
    if (action === 'write_vip_message') {
      const { store_id, store_name, owner_name, city, message_type, context } = body;

      const vipContext = `
Store: ${store_name || 'Unknown'}
Owner: ${owner_name || 'Unknown'}
City: ${city || 'Unknown'}
Message type: ${message_type || 'personal_touch'}
Additional context: ${context || 'None'}
`.trim();

      const message = await callClaude(
        anthropicKey,
        VIP_MANAGER,
        vipContext,
        'claude-haiku-4-5-20251001',
        200
      );

      return new Response(JSON.stringify({ success: true, message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─────────────────────────────────────────────────────────
    // ACTION: write_reactivation_message
    // Writes a reactivation message using Agent 6
    // ─────────────────────────────────────────────────────────
    if (action === 'write_reactivation_message') {
      const { store_name, owner_name, city, days_cold, touch_number, last_interaction, complaint_history, products_ordered, personality_notes } = body;

      const reactivationContext = `
Store: ${store_name || 'Unknown'}
Owner: ${owner_name || 'Unknown'}
City: ${city || 'Unknown'}
Days cold: ${days_cold || 30}
Touch number: ${touch_number || 1} of 4
Last interaction: ${last_interaction || 'Unknown'}
Complaint history: ${complaint_history || 'None'}
Products previously ordered: ${products_ordered || 'Unknown'}
Personality notes: ${personality_notes || 'None'}
`.trim();

      const message = await callClaude(
        anthropicKey,
        REACTIVATION_AGENT,
        reactivationContext,
        'claude-haiku-4-5-20251001',
        200
      );

      return new Response(JSON.stringify({ success: true, message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[RELATIONSHIP-AGENT] Error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
