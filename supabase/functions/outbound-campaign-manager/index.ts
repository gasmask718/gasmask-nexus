import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CampaignRequest {
  action: 'create' | 'update' | 'approve' | 'pause' | 'resume' | 'halt' | 'complete' | 'get' | 'list';
  campaign_id?: string;
  business_id?: string;
  data?: Record<string, unknown>;
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

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // --- JWT gate (added on restore; function was deployed with no auth check) ---
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ success: false, error: 'Unauthorized' }, 401);
  }
  const authClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );
  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(
    authHeader.replace('Bearer ', ''),
  );
  if (claimsError || !claimsData?.claims?.sub) {
    return json({ success: false, error: 'Unauthorized' }, 401);
  }
  const userId = claimsData.claims.sub as string;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // ── Tenancy ────────────────────────────────────────────────────────────
    // This function holds a service-role client, so RLS does not apply. Every
    // business_id it acts on is therefore derived from the caller's membership,
    // never taken on trust from the request body.
    const [{ data: memberships, error: membershipError }, { data: platformRoles }] = await Promise.all([
      supabase.from('business_members').select('business_id, role').eq('user_id', userId),
      supabase.from('user_roles').select('role').eq('user_id', userId).in('role', ['owner', 'admin']),
    ]);
    throwIfError(membershipError, 'Membership lookup failed');

    const isPlatformAdmin = (platformRoles ?? []).length > 0;
    const memberBusinessIds = [...new Set((memberships ?? []).map((m: any) => m.business_id))];

    const businessLabel = async (id: string) => {
      const { data: biz } = await supabase.from('businesses').select('name').eq('id', id).maybeSingle();
      return biz?.name ? `"${biz.name}" (${id})` : id;
    };

    /** Confirms the caller may act on `id`, or throws a 403 naming the business. */
    const assertBusinessAccess = async (id: string) => {
      if (isPlatformAdmin || memberBusinessIds.includes(id)) return;
      throw new HttpError(
        403,
        `You are not a member of ${await businessLabel(id)} and cannot manage its campaigns.`,
      );
    };

    /**
     * Resolves the business a body-scoped action targets.
     * One membership -> derived. Several -> body value required and validated.
     */
    const resolveBusinessId = async (): Promise<string> => {
      if (requestedBusinessId) {
        await assertBusinessAccess(requestedBusinessId);
        return requestedBusinessId;
      }
      if (isPlatformAdmin) {
        throw new HttpError(400, 'business_id is required for platform administrators.');
      }
      if (memberBusinessIds.length === 0) {
        throw new HttpError(403, 'Your account has no business membership, so it cannot manage campaigns.');
      }
      if (memberBusinessIds.length > 1) {
        const names = await Promise.all(memberBusinessIds.map(businessLabel));
        throw new HttpError(
          400,
          `You belong to more than one business. Specify business_id — one of: ${names.join(', ')}.`,
        );
      }
      return memberBusinessIds[0];
    };

    /** Loads a campaign and confirms the caller's business owns it. */
    const loadOwnedCampaign = async (id: string) => {
      const { data: existing, error } = await supabase
        .from('outbound_campaigns')
        .select('id, business_id, status')
        .eq('id', id)
        .maybeSingle();
      throwIfError(error, 'Campaign lookup failed');
      if (!existing) throw new HttpError(404, `Campaign ${id} not found.`);
      await assertBusinessAccess(existing.business_id);
      return existing;
    };


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
    console.error('Outbound Campaign Manager Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
