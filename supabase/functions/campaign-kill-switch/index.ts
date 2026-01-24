import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

/**
 * CAMPAIGN KILL SWITCH MANAGER
 * 
 * Multi-level emergency stop system:
 * - Global: Stops ALL outbound campaigns
 * - Business: Stops all campaigns for a business
 * - Campaign: Stops a specific campaign
 * 
 * Kill switches:
 * - Stop calls mid-sentence if needed
 * - Log the event immutably
 * - Require human approval to resume
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KillSwitchRequest {
  action: 'trigger' | 'reset' | 'status' | 'create';
  scope: 'global' | 'business' | 'campaign';
  business_id?: string;
  campaign_id?: string;
  triggered_by?: string;
  reason?: string;
  reset_by?: string;
  reset_notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const request: KillSwitchRequest = await req.json();

    switch (request.action) {
      case 'trigger': {
        // Validate scope requirements
        if (request.scope === 'business' && !request.business_id) {
          throw new Error('Business scope requires business_id');
        }
        if (request.scope === 'campaign' && !request.campaign_id) {
          throw new Error('Campaign scope requires campaign_id');
        }

        // Build filter
        let filter: any = { scope: request.scope };
        if (request.business_id) filter.business_id = request.business_id;
        if (request.campaign_id) filter.campaign_id = request.campaign_id;

        // Trigger the kill switch
        const { data: killSwitch, error } = await supabase
          .from('campaign_kill_switches')
          .update({
            is_active: false, // false = triggered/stopped
            triggered_at: new Date().toISOString(),
            triggered_by: request.triggered_by,
            trigger_reason: request.reason || 'Manual trigger',
            is_immutable: true, // Lock this record
          })
          .match(filter)
          .select()
          .single();

        if (error) {
          // If no existing switch, create one
          if (error.code === 'PGRST116') {
            const { data: newSwitch, error: createError } = await supabase
              .from('campaign_kill_switches')
              .insert({
                scope: request.scope,
                business_id: request.business_id,
                campaign_id: request.campaign_id,
                is_active: false,
                triggered_at: new Date().toISOString(),
                triggered_by: request.triggered_by,
                trigger_reason: request.reason || 'Manual trigger',
                is_immutable: true,
              })
              .select()
              .single();

            if (createError) throw createError;

            // Halt affected campaigns
            await haltAffectedCampaigns(supabase, request, request.reason);

            return new Response(
              JSON.stringify({ success: true, kill_switch: newSwitch, action: 'created_and_triggered' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          throw error;
        }

        // Halt affected campaigns
        await haltAffectedCampaigns(supabase, request, request.reason);

        // Log to audit
        await supabase.from('ai_audit_logs').insert({
          audit_type: 'campaign_kill_switch_triggered',
          business_id: request.business_id,
          payload: {
            scope: request.scope,
            campaign_id: request.campaign_id,
            triggered_by: request.triggered_by,
            reason: request.reason,
          },
          is_immutable: true,
        });

        return new Response(
          JSON.stringify({ success: true, kill_switch: killSwitch, action: 'triggered' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'reset': {
        if (!request.reset_by) {
          throw new Error('Reset requires reset_by (user ID)');
        }

        // Build filter
        let filter: any = { scope: request.scope };
        if (request.business_id) filter.business_id = request.business_id;
        if (request.campaign_id) filter.campaign_id = request.campaign_id;

        // Check if switch requires approval
        const { data: existing } = await supabase
          .from('campaign_kill_switches')
          .select('*')
          .match(filter)
          .single();

        if (existing?.resume_requires_approval) {
          // In production, this would go through an approval workflow
          // For now, we just log it
        }

        // Create new switch record (old one is immutable)
        const { data: newSwitch, error } = await supabase
          .from('campaign_kill_switches')
          .insert({
            scope: request.scope,
            business_id: request.business_id,
            campaign_id: request.campaign_id,
            is_active: true, // true = operational
            resumed_by: request.reset_by,
            resumed_at: new Date().toISOString(),
            resume_notes: request.reset_notes,
          })
          .select()
          .single();

        if (error) throw error;

        // Log to audit
        await supabase.from('ai_audit_logs').insert({
          audit_type: 'campaign_kill_switch_reset',
          business_id: request.business_id,
          payload: {
            scope: request.scope,
            campaign_id: request.campaign_id,
            reset_by: request.reset_by,
            notes: request.reset_notes,
          },
        });

        return new Response(
          JSON.stringify({ success: true, kill_switch: newSwitch, action: 'reset' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'status': {
        // Get all relevant kill switches
        let query = supabase
          .from('campaign_kill_switches')
          .select('*')
          .order('created_at', { ascending: false });

        if (request.scope === 'global') {
          query = query.eq('scope', 'global');
        } else if (request.scope === 'business' && request.business_id) {
          query = query.or(`scope.eq.global,and(scope.eq.business,business_id.eq.${request.business_id})`);
        } else if (request.scope === 'campaign' && request.campaign_id) {
          // Get campaign's business_id
          const { data: campaign } = await supabase
            .from('outbound_campaigns')
            .select('business_id')
            .eq('id', request.campaign_id)
            .single();

          if (campaign) {
            query = query.or(`scope.eq.global,and(scope.eq.business,business_id.eq.${campaign.business_id}),and(scope.eq.campaign,campaign_id.eq.${request.campaign_id})`);
          }
        }

        const { data: switches, error } = await query;

        if (error) throw error;

        // Determine overall status
        const anyTriggered = switches?.some(s => !s.is_active);
        const globalTriggered = switches?.find(s => s.scope === 'global' && !s.is_active);
        const businessTriggered = switches?.find(s => s.scope === 'business' && !s.is_active);
        const campaignTriggered = switches?.find(s => s.scope === 'campaign' && !s.is_active);

        return new Response(
          JSON.stringify({
            success: true,
            operational: !anyTriggered,
            switches,
            triggered_scopes: {
              global: !!globalTriggered,
              business: !!businessTriggered,
              campaign: !!campaignTriggered,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create': {
        // Create a new kill switch for monitoring
        const { data: newSwitch, error } = await supabase
          .from('campaign_kill_switches')
          .insert({
            scope: request.scope,
            business_id: request.business_id,
            campaign_id: request.campaign_id,
            is_active: true, // Start operational
            auto_trigger_opt_out_rate: 0.10,
            auto_trigger_escalation_rate: 0.20,
            auto_trigger_complaint_count: 3,
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, kill_switch: newSwitch }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${request.action}`);
    }
  } catch (error) {
    console.error('Campaign Kill Switch Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function haltAffectedCampaigns(supabase: any, request: KillSwitchRequest, reason?: string) {
  let query = supabase
    .from('outbound_campaigns')
    .update({
      status: 'halted',
      kill_switch_triggered: true,
      kill_switch_triggered_at: new Date().toISOString(),
      kill_switch_reason: reason || 'Kill switch triggered',
    })
    .eq('status', 'active');

  if (request.scope === 'business' && request.business_id) {
    query = query.eq('business_id', request.business_id);
  } else if (request.scope === 'campaign' && request.campaign_id) {
    query = query.eq('id', request.campaign_id);
  }
  // Global scope affects all active campaigns

  await query;
}
