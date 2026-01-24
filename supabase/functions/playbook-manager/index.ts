import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlaybookRequest {
  action: 'create' | 'update' | 'approve' | 'deactivate' | 'get' | 'list';
  playbook_type: 'product' | 'vendor';
  playbook_id?: string;
  business_id?: string;
  data?: any;
  approved_by?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, playbook_type, playbook_id, business_id, data, approved_by }: PlaybookRequest = await req.json();

    const table = playbook_type === 'product' ? 'product_playbooks' : 'vendor_recruitment_playbooks';

    switch (action) {
      case 'create': {
        if (!business_id) throw new Error('Missing business_id');

        let insertData: any;
        
        if (playbook_type === 'product') {
          insertData = {
            business_id,
            product_name: data.product_name,
            product_description: data.product_description,
            target_store_profile: data.target_store_profile || {},
            key_value_propositions: data.key_value_propositions || [],
            allowed_pricing_language: data.allowed_pricing_language || [],
            objection_handling: data.objection_handling || {},
            forbidden_promises: data.forbidden_promises || [],
            forbidden_pricing_claims: data.forbidden_pricing_claims || [],
            forbidden_commitments: data.forbidden_commitments || [],
            escalation_triggers: data.escalation_triggers || ['competitor_mention', 'legal_question', 'price_negotiation', 'complaint', 'regulatory_concern'],
            conversion_goals: data.conversion_goals || ['interest_expressed', 'order_placed', 'demo_scheduled', 'callback_requested'],
            confidence_floor: data.confidence_floor || 0.80,
            is_active: false, // Requires approval
          };
        } else {
          insertData = {
            business_id,
            service_category: data.service_category,
            outreach_goal: data.outreach_goal || 'listing_signup',
            website_signup_explanation: data.website_signup_explanation,
            benefits_framing: data.benefits_framing || [],
            platform_value_props: data.platform_value_props || [],
            objection_handling: data.objection_handling || {},
            opt_out_phrasing: data.opt_out_phrasing || 'I understand. I will remove you from our contact list. Thank you for your time.',
            escalation_triggers: data.escalation_triggers || ['existing_relationship', 'technical_questions', 'pricing_inquiry', 'complaint'],
            escalate_to_human_role: data.escalate_to_human_role || 'sales_rep',
            must_state_business_identity: true,
            must_state_purpose: true,
            must_offer_opt_out: true,
            no_pressure_tactics: true,
            confidence_floor: data.confidence_floor || 0.75,
            is_active: false, // Requires approval
          };
        }

        const { data: playbook, error } = await supabase
          .from(table)
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, playbook }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'approve': {
        if (!playbook_id || !approved_by) {
          throw new Error('Missing playbook_id or approved_by');
        }

        const { data: playbook, error } = await supabase
          .from(table)
          .update({
            is_active: true,
            approved_by,
            approved_at: new Date().toISOString(),
          })
          .eq('id', playbook_id)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, playbook }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deactivate': {
        if (!playbook_id) throw new Error('Missing playbook_id');

        const { data: playbook, error } = await supabase
          .from(table)
          .update({ is_active: false })
          .eq('id', playbook_id)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, playbook }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        if (!playbook_id) throw new Error('Missing playbook_id');

        // When updating, reset approval status
        const updateData = {
          ...data,
          is_active: false, // Require re-approval after edit
          approved_by: null,
          approved_at: null,
          updated_at: new Date().toISOString(),
        };

        const { data: playbook, error } = await supabase
          .from(table)
          .update(updateData)
          .eq('id', playbook_id)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, playbook, requires_reapproval: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get': {
        if (!playbook_id) throw new Error('Missing playbook_id');

        const { data: playbook, error } = await supabase
          .from(table)
          .select('*')
          .eq('id', playbook_id)
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, playbook }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list': {
        let query = supabase.from(table).select('*').order('created_at', { ascending: false });

        if (business_id) {
          query = query.eq('business_id', business_id);
        }

        const { data: playbooks, error } = await query;

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, playbooks }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Playbook Manager Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
