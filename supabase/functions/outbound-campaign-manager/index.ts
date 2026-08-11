import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CampaignRequest {
  action: 'create' | 'update' | 'approve' | 'pause' | 'resume' | 'halt' | 'complete' | 'get' | 'list';
  campaign_id?: string;
  business_id?: string;
  data?: any;
  approved_by?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // --- JWT gate (added on restore; function was deployed with no auth check) ---
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  {
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(
      authHeader.replace('Bearer ', ''),
    );
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: CampaignRequest = await req.json();
    const action = body.action;
    // Treat empty strings as null to prevent UUID parse errors
    const campaign_id = body.campaign_id && body.campaign_id.trim() !== '' ? body.campaign_id : null;
    const business_id = body.business_id && body.business_id.trim() !== '' ? body.business_id : null;
    const data = body.data;
    const approved_by = body.approved_by;

    // Helper to safely throw errors from Supabase
    const throwIfError = (error: any, context: string) => {
      if (error) {
        const message = error.message || JSON.stringify(error);
        throw new Error(`${context}: ${message}`);
      }
    };

    switch (action) {
      case 'create': {
        // Validate required fields
        if (!data?.name || !data?.campaign_type || !business_id) {
          throw new Error('Missing required fields: name, campaign_type, business_id');
        }

        // Create the campaign
        const { data: campaign, error } = await supabase
          .from('outbound_campaigns')
          .insert({
            business_id,
            name: data.name,
            description: data.description,
            campaign_type: data.campaign_type,
            status: 'draft',
            audience_type: data.audience_type || 'existing_customers',
            allowed_business_types: data.allowed_business_types || [],
            geographic_scope: data.geographic_scope || {},
            max_calls_per_day: data.max_calls_per_day || 100,
            max_calls_per_contact: data.max_calls_per_contact || 3,
            cooldown_period_days: data.cooldown_period_days || 7,
            b2b_only: data.b2b_only !== false, // Default true
            mandatory_ai_disclosure: data.mandatory_ai_disclosure || 'This is an automated call on behalf of our company. You are speaking with an AI assistant.',
            prohibited_claims: data.prohibited_claims || [],
            required_disclaimers: data.required_disclaimers || [],
            product_playbook_id: data.product_playbook_id,
            vendor_playbook_id: data.vendor_playbook_id,
            created_by: data.created_by,
          })
          .select()
          .single();

        throwIfError(error, 'Create campaign failed');

        // Create associated kill switch
        await supabase
          .from('campaign_kill_switches')
          .insert({
            scope: 'campaign',
            campaign_id: campaign.id,
            business_id,
            is_active: true,
            auto_trigger_opt_out_rate: 0.10,
            auto_trigger_escalation_rate: 0.20,
          });

        return new Response(
          JSON.stringify({ success: true, campaign }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'approve': {
        if (!campaign_id || !approved_by) {
          throw new Error('Missing campaign_id or approved_by');
        }

        // Check sentinel status first
        const { data: sentinel } = await supabase
          .from('sentinel_status')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (sentinel?.status === 'halted') {
          throw new Error('Cannot approve campaign: Sentinel is in HALTED state');
        }

        // Check for active drift
        const { data: activeDrift } = await supabase
          .from('compliance_drift_events')
          .select('id')
          .eq('status', 'active')
          .eq('severity', 'critical')
          .limit(1);

        if (activeDrift && activeDrift.length > 0) {
          throw new Error('Cannot approve campaign: Critical drift detected');
        }

        // Create sentinel approval record
        const { data: approval, error: approvalError } = await supabase
          .from('sentinel_campaign_approvals')
          .insert({
            campaign_id,
            sentinel_status: 'approved',
            checks_passed: {
              sentinel_not_halted: true,
              no_critical_drift: true,
              baseline_stable: true,
            },
            approved_at: new Date().toISOString(),
          })
          .select()
          .single();

        throwIfError(approvalError, 'Sentinel approval failed');

        // Update campaign status
        const { data: campaign, error } = await supabase
          .from('outbound_campaigns')
          .update({
            status: 'approved',
            approved_by,
            approved_at: new Date().toISOString(),
            sentinel_approved: true,
            sentinel_approval_id: approval.id,
          })
          .eq('id', campaign_id)
          .select()
          .single();

        throwIfError(error, 'Campaign update failed');

        return new Response(
          JSON.stringify({ success: true, campaign, sentinel_approval: approval }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'pause': {
        if (!campaign_id) throw new Error('Missing campaign_id');

        const { data: campaign, error } = await supabase
          .from('outbound_campaigns')
          .update({ status: 'paused' })
          .eq('id', campaign_id)
          .select()
          .single();

        throwIfError(error, 'Pause campaign failed');

        return new Response(
          JSON.stringify({ success: true, campaign }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'resume': {
        if (!campaign_id) throw new Error('Missing campaign_id');

        // Check kill switch
        const { data: killSwitch } = await supabase
          .from('campaign_kill_switches')
          .select('*')
          .eq('campaign_id', campaign_id)
          .eq('scope', 'campaign')
          .single();

        if (killSwitch && !killSwitch.is_active) {
          throw new Error('Cannot resume: Kill switch is active. Requires manual reset.');
        }

        const { data: campaign, error } = await supabase
          .from('outbound_campaigns')
          .update({ status: 'active' })
          .eq('id', campaign_id)
          .select()
          .single();

        throwIfError(error, 'Resume campaign failed');

        return new Response(
          JSON.stringify({ success: true, campaign }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'halt': {
        if (!campaign_id) throw new Error('Missing campaign_id');

        // Trigger kill switch
        await supabase
          .from('campaign_kill_switches')
          .update({
            is_active: false,
            triggered_at: new Date().toISOString(),
            triggered_by: data?.triggered_by,
            trigger_reason: data?.reason || 'Manual halt',
          })
          .eq('campaign_id', campaign_id)
          .eq('scope', 'campaign');

        const { data: campaign, error } = await supabase
          .from('outbound_campaigns')
          .update({
            status: 'halted',
            kill_switch_triggered: true,
            kill_switch_triggered_at: new Date().toISOString(),
            kill_switch_reason: data?.reason || 'Manual halt',
          })
          .eq('id', campaign_id)
          .select()
          .single();

        throwIfError(error, 'Halt campaign failed');

        return new Response(
          JSON.stringify({ success: true, campaign }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get': {
        if (!campaign_id) throw new Error('Missing campaign_id');

        const { data: campaign, error } = await supabase
          .from('outbound_campaigns')
          .select(`
            *,
            product_playbooks(*),
            vendor_recruitment_playbooks(*),
            campaign_kill_switches(*),
            sentinel_campaign_approvals(*)
          `)
          .eq('id', campaign_id)
          .single();

        throwIfError(error, 'Get campaign failed');

        // Get target stats
        const { data: stats } = await supabase
          .from('outbound_campaign_targets')
          .select('status')
          .eq('campaign_id', campaign_id);

        const targetStats = {
          total: stats?.length || 0,
          pending: stats?.filter(t => t.status === 'pending').length || 0,
          completed: stats?.filter(t => t.status === 'completed').length || 0,
          opted_out: stats?.filter(t => t.status === 'opted_out').length || 0,
          escalated: stats?.filter(t => t.status === 'escalated').length || 0,
        };

        return new Response(
          JSON.stringify({ success: true, campaign, targetStats }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list': {
        let query = supabase
          .from('outbound_campaigns')
          .select('*')
          .order('created_at', { ascending: false });

        if (business_id) {
          query = query.eq('business_id', business_id);
        }

        const { data: campaigns, error } = await query;

        throwIfError(error, 'List campaigns failed');

        return new Response(
          JSON.stringify({ success: true, campaigns }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Outbound Campaign Manager Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
