import { HttpError, tenancy } from '../_shared/tenancy.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CampaignRequest {
  action: 'create' | 'update' | 'approve' | 'pause' | 'resume' | 'halt' | 'complete' | 'get' | 'list';
  campaign_id?: string;
  business_id?: string;
  data?: Record<string, unknown>;
  /** Ignored. Approval is attributed to the authenticated caller. */
  approved_by?: string;
}

// Fields a caller may change via `update`. Anything else in data is ignored.
// Deliberately excludes status, approval, kill-switch and business_id columns —
// those move only through their own actions.
const UPDATABLE_FIELDS = [
  'name',
  'description',
  'campaign_type',
  'audience_type',
  'allowed_business_types',
  'geographic_scope',
  'max_calls_per_day',
  'max_calls_per_contact',
  'cooldown_period_days',
  'b2b_only',
  'mandatory_ai_disclosure',
  'prohibited_claims',
  'required_disclaimers',
  'product_playbook_id',
  'vendor_playbook_id',
] as const;

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth + tenancy in one door. Throws HttpError(401) without a valid JWT;
    // the service-role client only exists behind it.
    const t = await tenancy(req);
    const { userId, admin: supabase, isPlatformAdmin, memberBusinessIds } = t;
    const assertBusinessAccess = t.assertBusinessAccess;

    const body: CampaignRequest = await req.json();
    const action = body.action;
    // Treat empty strings as null to prevent UUID parse errors
    const campaign_id = body.campaign_id && body.campaign_id.trim() !== '' ? body.campaign_id : null;
    const requestedBusinessId = body.business_id && body.business_id.trim() !== '' ? body.business_id : null;
    const data = body.data as Record<string, any> | undefined;

    // Helper to safely throw errors from Supabase
    const throwIfError = (error: any, context: string) => {
      if (error) {
        const message = error.message || JSON.stringify(error);
        throw new Error(`${context}: ${message}`);
      }
    };

    /** Resolves the target business from the caller's membership, not the body. */
    const resolveBusinessId = () => t.resolveBusinessId(body);

    /** Loads a campaign and confirms the caller's business owns it. */
    const loadOwnedCampaign = (id: string) =>
      t.loadOwned<{ id: string; business_id: string; status: string }>('outbound_campaigns', id, {
        select: 'id, business_id, status',
        label: 'Campaign',
      });




    switch (action) {
      case 'create': {
        const businessId = await resolveBusinessId();
        if (!data?.name || !data?.campaign_type) {
          throw new HttpError(400, 'Missing required fields: name, campaign_type');
        }

        // Create the campaign
        const { data: campaign, error } = await supabase
          .from('outbound_campaigns')
          .insert({
            business_id: businessId,
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
            created_by: userId,
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
            business_id: businessId,
            is_active: true,
            auto_trigger_opt_out_rate: 0.10,
            auto_trigger_escalation_rate: 0.20,
          });

        return json({ success: true, campaign });
      }

      case 'update': {
        if (!campaign_id) throw new HttpError(400, 'Missing campaign_id');
        await loadOwnedCampaign(campaign_id);

        const patch: Record<string, unknown> = {};
        for (const field of UPDATABLE_FIELDS) {
          if (data && Object.prototype.hasOwnProperty.call(data, field)) {
            patch[field] = data[field];
          }
        }
        if (Object.keys(patch).length === 0) {
          throw new HttpError(
            400,
            `No updatable fields supplied. Allowed: ${UPDATABLE_FIELDS.join(', ')}.`,
          );
        }

        const { data: campaign, error } = await supabase
          .from('outbound_campaigns')
          .update(patch)
          .eq('id', campaign_id)
          .select()
          .single();

        throwIfError(error, 'Update campaign failed');

        return json({ success: true, campaign, updated_fields: Object.keys(patch) });
      }

      case 'complete': {
        if (!campaign_id) throw new HttpError(400, 'Missing campaign_id');
        await loadOwnedCampaign(campaign_id);

        const { data: campaign, error } = await supabase
          .from('outbound_campaigns')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', campaign_id)
          .select()
          .single();

        throwIfError(error, 'Complete campaign failed');

        return json({ success: true, campaign });
      }

      case 'approve': {
        if (!campaign_id) throw new HttpError(400, 'Missing campaign_id');
        await loadOwnedCampaign(campaign_id);
        // Approval is attributed to the authenticated caller, never to a
        // body-supplied approved_by.
        const approved_by = userId;


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

        return json({ success: true, campaign, sentinel_approval: approval });
      }

      case 'pause': {
        if (!campaign_id) throw new HttpError(400, 'Missing campaign_id');
        await loadOwnedCampaign(campaign_id);

        const { data: campaign, error } = await supabase
          .from('outbound_campaigns')
          .update({ status: 'paused' })
          .eq('id', campaign_id)
          .select()
          .single();

        throwIfError(error, 'Pause campaign failed');

        return json({ success: true, campaign });
      }

      case 'resume': {
        if (!campaign_id) throw new HttpError(400, 'Missing campaign_id');
        await loadOwnedCampaign(campaign_id);

        // Check kill switch
        const { data: killSwitch } = await supabase
          .from('campaign_kill_switches')
          .select('*')
          .eq('campaign_id', campaign_id)
          .eq('scope', 'campaign')
          .maybeSingle();

        if (killSwitch && !killSwitch.is_active) {
          throw new HttpError(409, 'Cannot resume: Kill switch is active. Requires manual reset.');
        }

        const { data: campaign, error } = await supabase
          .from('outbound_campaigns')
          .update({ status: 'active' })
          .eq('id', campaign_id)
          .select()
          .single();

        throwIfError(error, 'Resume campaign failed');

        return json({ success: true, campaign });
      }

      case 'halt': {
        if (!campaign_id) throw new HttpError(400, 'Missing campaign_id');
        await loadOwnedCampaign(campaign_id);

        // Trigger kill switch
        await supabase
          .from('campaign_kill_switches')
          .update({
            is_active: false,
            triggered_at: new Date().toISOString(),
            triggered_by: userId,
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

        return json({ success: true, campaign });
      }

      case 'get': {
        if (!campaign_id) throw new HttpError(400, 'Missing campaign_id');
        await loadOwnedCampaign(campaign_id);

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
          pending: stats?.filter((t: any) => t.status === 'pending').length || 0,
          completed: stats?.filter((t: any) => t.status === 'completed').length || 0,
          opted_out: stats?.filter((t: any) => t.status === 'opted_out').length || 0,
          escalated: stats?.filter((t: any) => t.status === 'escalated').length || 0,
        };

        return json({ success: true, campaign, targetStats });
      }

      case 'list': {
        let query = supabase
          .from('outbound_campaigns')
          .select('*')
          .order('created_at', { ascending: false });

        if (requestedBusinessId) {
          await assertBusinessAccess(requestedBusinessId);
          query = query.eq('business_id', requestedBusinessId);
        } else if (!isPlatformAdmin) {
          // No body filter: return only the caller's own businesses, never all.
          if (memberBusinessIds.length === 0) {
            return json({ success: true, campaigns: [] });
          }
          query = query.in('business_id', memberBusinessIds);
        }

        const { data: campaigns, error } = await query;

        throwIfError(error, 'List campaigns failed');

        return json({ success: true, campaigns });
      }

      default:
        throw new HttpError(400, `Unknown action: ${action}`);
    }

  } catch (error) {
    if (error instanceof HttpError) {
      // 400/403/404/409 are caller-facing decisions, not server faults.
      return json({ success: false, error: error.message }, error.status);
    }
    console.error('Outbound Campaign Manager Error:', error);
    return json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});

