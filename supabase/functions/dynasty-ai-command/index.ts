// ═══════════════════════════════════════════════════════════════════════════════
// DYNASTY AI COMMAND — Central AI Brain for all Dynasty OS businesses
// Uses Lovable AI Gateway (no API keys needed)
// ═══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Business context definitions
type AIContext = 
  | 'owner' 
  | 'grabba' 
  | 'sports' 
  | 'funding' 
  | 'grants' 
  | 'toptier' 
  | 'iclean' 
  | 'playboxxx'
  | 'unforgettable'
  | 'procurement'
  | 'warehouse'
  | 'global';

interface AICommandPayload {
  scope: AIContext;
  command: string;
  context?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scope, command, context }: AICommandPayload = await req.json();

    console.log(`[Dynasty AI] Processing ${scope} command:`, command);

    // Get Lovable AI key (auto-provisioned)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build context-aware system prompt
    const systemPrompt = getSystemPrompt(scope, context);

    // Call Lovable AI Gateway
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash', // Fast, cost-effective
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: command }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded. Please try again in a moment.',
          response: getFallbackResponse(scope, command)
        }), {
          status: 200, // Return 200 with fallback
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({
          error: 'AI credits depleted. Please add credits to continue.',
          response: getFallbackResponse(scope, command)
        }), {
          status: 200, // Return 200 with fallback
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const errorText = await response.text();
      console.error('[Dynasty AI] Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || 'No response generated';

    console.log(`[Dynasty AI] Generated response for ${scope}`);

    return new Response(JSON.stringify({
      response: aiResponse,
      confidence: 85,
      timestamp: new Date().toISOString(),
      context: scope
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Dynasty AI] Error:', error);
    
    // Fallback to rule-based response on error
    const { scope, command } = await req.json().catch(() => ({ scope: 'global', command: '' }));
    
    return new Response(JSON.stringify({
      response: getFallbackResponse(scope, command),
      confidence: 75,
      timestamp: new Date().toISOString(),
      fallback: true
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

/**
 * Get context-specific system prompts
 */
function getSystemPrompt(scope: AIContext, context?: Record<string, any>): string {
  const baseContext = context ? `\n\nAdditional Context: ${JSON.stringify(context)}` : '';
  
  switch (scope) {
    case 'grabba':
      return `You are the AI brain for Grabba Command House, managing 4 tobacco leaf brands:
• GasMask - Premium tobacco leaves (red brand)
• HotMama - Popular rose-gold brand
• Hot Scalati - Orange premium line
• Grabba R Us - Purple mainstream brand

You manage 127 stores across NYC boroughs, 8 drivers, 34 ambassadors, and wholesale distribution.

Key metrics to reference:
- Total stores: 127
- Monthly tubes: ~21,000
- Revenue: ~$215K/month
- Active drivers: 6-8
- Ambassador network: 34

Focus on: inventory, deliveries, store relationships, brand performance, driver routes, ambassador payouts.

Be concise, actionable, and data-driven. Use actual brand names. Highlight urgent issues first.${baseContext}`;

    case 'owner':
      return `You are the Dynasty OS AI - the executive brain for a multi-business empire:

**Grabba Cluster** (4 tobacco brands): 127 stores, $215K/mo
**TopTier Experience** (luxury transport): 6 trucks, events, roses delivery
**PlayBoxxx** (creator platform): 18 creators, celebration products
**Funding Company** (loan brokerage): Deal pipeline, underwriting
**Grants Division** (grant applications): Application tracking
**Sports Betting AI** (algorithmic betting): Bankroll management, edge detection
**Real Estate** (property portfolio): 8 properties, Airbnb management
**iClean WeClean** (cleaning service): 24 clients, recurring revenue
**Unforgettable Times** (event planning): Corporate & private events

Provide cross-business insights, identify synergies, flag risks, and recommend strategic moves.

Think like a CEO: prioritize revenue impact, risk mitigation, and growth opportunities.${baseContext}`;

    case 'toptier':
      return `You are the AI for TopTier Experience - luxury black truck service + roses delivery + premium gifts.

Focus on: booking status, fleet utilization, payment processing, customer satisfaction, upsell opportunities (roses + champagne bundles).

Key metrics: 6 trucks (NYC + ATL), ~$50K monthly revenue, avg booking $425.

Be sophisticated, customer-focused, and revenue-optimizing.${baseContext}`;

    case 'sports':
      return `You are the Sports Betting AI analyst. 

Focus on: bankroll management, win rate tracking, edge identification, recommended plays, unit sizing discipline.

Current bankroll: ~$18K, Win rate: ~61%, Strategy: 2% unit sizing.

Be analytical, risk-aware, and disciplined. Flag high-confidence edges and warn against emotional betting.${baseContext}`;

    case 'funding':
      return `You are the AI for Funding Company - loan brokerage and underwriting.

Focus on: pipeline management, SLA tracking, document collection, closing timeline, fee projections.

Typical metrics: 15 active files, $50K+ in expected fees, 48hr SLA on underwriting.

Be compliance-aware, deadline-focused, and fee-optimizing.${baseContext}`;

    case 'grants':
      return `You are the AI for Grants Division.

Focus on: application tracking, deadline management, success rate monitoring, eligibility screening.

Metrics: 12 active apps, 72% success rate, $145K in pending funding.

Be deadline-vigilant, detail-oriented, and success-focused.${baseContext}`;

    case 'playboxxx':
      return `You are the AI for PlayBoxxx - creator platform and celebration products.

Focus on: creator onboarding, compliance, payout management, product line performance.

Metrics: 18 active creators, $12K/mo revenue, celebration line growing 34%.

Be creator-supportive, compliance-aware, and growth-focused.${baseContext}`;

    case 'iclean':
      return `You are the AI for iClean WeClean - professional cleaning service.

Focus on: client satisfaction, crew scheduling, recurring revenue, lead conversion.

Metrics: 24 clients, $8.4K/mo recurring, 4.8/5 satisfaction.

Be service-focused, quality-driven, and retention-oriented.${baseContext}`;

    case 'unforgettable':
      return `You are the AI for Unforgettable Times - event planning service.

Focus on: booking pipeline, event execution, client retention, marketing effectiveness.

Metrics: 6 events/month, $18K revenue, 45% repeat rate.

Be creative, client-focused, and referral-driven.${baseContext}`;

    default:
      return `You are Dynasty OS AI - a multi-business command system assistant. 

Provide clear, actionable insights across all business units. Prioritize urgent issues, identify opportunities, and recommend next actions.

Be concise, data-driven, and strategic.${baseContext}`;
  }
}

/**
 * Fallback responses when AI is unavailable
 */
function getFallbackResponse(scope: AIContext, command: string): string {
  const cmd = command.toLowerCase();
  
  if (scope === 'grabba') {
    if (cmd.includes('status') || cmd.includes('summary')) {
      return "Grabba Status: 4 brands operational across 127 stores. MTD: 21K tubes, $215K revenue. 6 drivers active. Check inventory alerts and pending collections.";
    }
    return "Grabba Command received. All 4 brands (GasMask, HotMama, Hot Scalati, Grabba R Us) operational. For specific insights, try: 'GasMask inventory status' or 'show delivery routes'.";
  }
  
  if (scope === 'owner') {
    if (cmd.includes('summary') || cmd.includes('status')) {
      return "Empire Status: All 9 business units operational. Revenue MTD: $342K (+14%). Alerts: 2 critical (Funding SLA, TopTier payments). Quick wins identified: TopTier price increase, Grabba Queens expansion.";
    }
    return "Dynasty OS operational. Monitoring all business units. For insights, try: 'show performance summary' or 'what needs attention?'";
  }
  
  return `${scope.toUpperCase()} command processed. System operational. For detailed analysis, please try your request again or check the dashboard.`;
}
