import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

/**
 * OUTBOUND CALL STATE AUTHORITY
 * 
 * This function serves as the single source of truth for whether an outbound 
 * AI call may proceed. It enforces ALL governance requirements:
 * 
 * 1. Campaign must be approved and active
 * 2. Playbook must be attached
 * 3. Sentinel must not be halted
 * 4. Kill switches must be inactive
 * 5. Confidence must meet playbook floor
 * 6. Human fallback must exist
 * 7. Target must not be opted out
 * 
 * If ANY condition fails → Call is blocked
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuthorityRequest {
  action: 'check_permission' | 'request_call' | 'log_outcome';
  campaign_id: string;
  target_id?: string;
  confidence?: number;
  session_id?: string;
  outcome?: string;
  outcome_details?: any;
}

interface AuthorityResult {
  permitted: boolean;
  reason?: string;
  blocks: string[];
  campaign?: any;
  playbook?: any;
  target?: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const request: AuthorityRequest = await req.json();

    if (request.action === 'check_permission' || request.action === 'request_call') {
      const result = await checkCallPermission(supabase, request);
      
      // If requesting a call, update target status
      if (request.action === 'request_call' && result.permitted && request.target_id) {
        await supabase
          .from('outbound_campaign_targets')
          .update({
            status: 'calling',
            attempts: (result.target?.attempts || 0) + 1,
            last_attempt_at: new Date().toISOString(),
          })
          .eq('id', request.target_id);
      }

      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (request.action === 'log_outcome') {
      if (!request.campaign_id || !request.target_id) {
        throw new Error('Missing campaign_id or target_id');
      }

      // Update target with outcome
      const { error: targetError } = await supabase
        .from('outbound_campaign_targets')
        .update({
          status: request.outcome === 'opted_out' ? 'opted_out' : 
                  request.outcome === 'escalated' ? 'escalated' : 'completed',
          outcome: request.outcome,
          outcome_details: request.outcome_details,
          opted_out: request.outcome === 'opted_out',
          opted_out_at: request.outcome === 'opted_out' ? new Date().toISOString() : null,
        })
        .eq('id', request.target_id);

      if (targetError) throw targetError;

      // If opted out, add to registry
      if (request.outcome === 'opted_out' && request.outcome_details?.phone) {
        await supabase
          .from('outbound_opt_out_registry')
          .upsert({
            phone_number: request.outcome_details.phone,
            business_id: request.outcome_details.business_id,
            opt_out_method: 'verbal',
            opt_out_source: request.campaign_id,
          }, {
            onConflict: 'phone_number,business_id'
          });
      }

      // Update campaign metrics
      const { data: campaign } = await supabase
        .from('outbound_campaigns')
        .select('*')
        .eq('id', request.campaign_id)
        .single();

      if (campaign) {
        const updates: any = {
          calls_made: (campaign.calls_made || 0) + 1,
        };
        
        if (['interested', 'order_placed', 'demo_scheduled'].includes(request.outcome || '')) {
          updates.conversions = (campaign.conversions || 0) + 1;
        }
        if (request.outcome === 'opted_out') {
          updates.opt_outs = (campaign.opt_outs || 0) + 1;
        }
        if (request.outcome === 'escalated') {
          updates.escalations = (campaign.escalations || 0) + 1;
        }

        await supabase
          .from('outbound_campaigns')
          .update(updates)
          .eq('id', request.campaign_id);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${request.action}`);

  } catch (error) {
    console.error('Outbound Call Authority Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        permitted: false,
        error: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function checkCallPermission(
  supabase: any, 
  request: AuthorityRequest
): Promise<AuthorityResult> {
  const blocks: string[] = [];
  
  // 1. Get campaign and validate
  const { data: campaign, error: campaignError } = await supabase
    .from('outbound_campaigns')
    .select(`
      *,
      product_playbooks(*),
      vendor_recruitment_playbooks(*)
    `)
    .eq('id', request.campaign_id)
    .single();

  if (campaignError || !campaign) {
    return { permitted: false, reason: 'Campaign not found', blocks: ['campaign_not_found'] };
  }

  // Check campaign status
  if (campaign.status !== 'active') {
    blocks.push(`campaign_status_${campaign.status}`);
  }

  // 2. Check playbook attachment
  const playbook = campaign.product_playbooks || campaign.vendor_recruitment_playbooks;
  if (!playbook) {
    blocks.push('no_playbook_attached');
  }

  // 3. Check Sentinel status
  const { data: sentinel } = await supabase
    .from('sentinel_status')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (sentinel?.status === 'halted') {
    blocks.push('sentinel_halted');
  }

  // 4. Check kill switches (global, business, campaign)
  const { data: killSwitches } = await supabase
    .from('campaign_kill_switches')
    .select('*')
    .or(`scope.eq.global,and(scope.eq.business,business_id.eq.${campaign.business_id}),and(scope.eq.campaign,campaign_id.eq.${campaign.id})`);

  for (const ks of killSwitches || []) {
    if (!ks.is_active) {
      blocks.push(`kill_switch_${ks.scope}`);
    }
  }

  // Also check the AI kill switch state
  const { data: aiKillSwitch } = await supabase
    .from('ai_kill_switch_state')
    .select('*')
    .or(`scope.eq.global,and(scope.eq.business,business_id.eq.${campaign.business_id})`)
    .eq('is_triggered', true)
    .limit(1);

  if (aiKillSwitch && aiKillSwitch.length > 0) {
    blocks.push('ai_kill_switch_active');
  }

  // 5. Check confidence threshold
  if (request.confidence !== undefined && playbook) {
    const floor = playbook.confidence_floor || 0.75;
    if (request.confidence < floor) {
      blocks.push('confidence_below_floor');
    }
  }

  // 6. Check human fallback exists
  const { data: callableUsers } = await supabase
    .from('user_call_settings')
    .select('id')
    .eq('business_id', campaign.business_id)
    .eq('is_callable', true)
    .limit(1);

  if (!callableUsers || callableUsers.length === 0) {
    blocks.push('no_human_fallback');
  }

  // 7. Check target opt-out (if target specified)
  let target = null;
  if (request.target_id) {
    const { data: targetData } = await supabase
      .from('outbound_campaign_targets')
      .select('*')
      .eq('id', request.target_id)
      .single();

    target = targetData;

    if (target?.opted_out) {
      blocks.push('target_opted_out');
    }

    // Check global opt-out registry
    if (target?.target_phone) {
      const { data: optOut } = await supabase
        .from('outbound_opt_out_registry')
        .select('id')
        .eq('phone_number', target.target_phone)
        .eq('is_active', true)
        .or(`business_id.is.null,business_id.eq.${campaign.business_id}`)
        .limit(1);

      if (optOut && optOut.length > 0) {
        blocks.push('phone_in_opt_out_registry');
      }
    }
  }

  const permitted = blocks.length === 0;

  return {
    permitted,
    reason: permitted ? 'All checks passed' : `Blocked by: ${blocks.join(', ')}`,
    blocks,
    campaign,
    playbook,
    target,
  };
}
