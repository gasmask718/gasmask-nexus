import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { lead_id, assigned_by, priority, notes } = await req.json();

    if (!lead_id) {
      return new Response(JSON.stringify({ error: 'lead_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch lead from Brandaro
    const { data: lead, error: leadErr } = await supabase
      .from('brandaro_qualified_leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: 'Lead not found', details: leadErr?.message }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!lead.phone_number) {
      return new Response(JSON.stringify({ error: 'Lead has no phone number' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Check if already queued (pending or calling)
    const { data: existing } = await supabase
      .from('dynasty_call_queue')
      .select('id, status')
      .eq('source_lead_id', lead_id)
      .in('status', ['pending', 'calling'])
      .limit(1)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({
        error: 'Lead already queued in Dynasty Connect',
        queue_id: existing.id,
        status: existing.status,
      }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Insert into dynasty_call_queue with source tracking
    const { data: queued, error: queueErr } = await supabase
      .from('dynasty_call_queue')
      .insert({
        business_type: 'brandaro',
        source_table: 'brandaro_qualified_leads',
        source_lead_id: lead_id,
        contact_name: lead.full_name || lead.first_name || lead.contact_title || 'Business Owner',
        business_name: lead.business_name,
        phone_number: lead.phone_number,
        state: lead.state || null,
        status: 'pending',
        assigned_by: assigned_by || null,
        assignment_notes: notes || null,
      })
      .select()
      .single();

    if (queueErr) {
      return new Response(JSON.stringify({ error: 'Failed to queue lead', details: queueErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Update Brandaro lead with DC queue reference
    await supabase
      .from('brandaro_qualified_leads')
      .update({
        dc_queue_id: queued.id,
        call_source: lead.call_source === 'va_native' ? 'both' : 'dynasty_connect',
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead_id);

    return new Response(JSON.stringify({
      success: true,
      queue_id: queued.id,
      lead_name: lead.business_name,
      phone: lead.phone_number,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('assign-lead-to-dc error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
