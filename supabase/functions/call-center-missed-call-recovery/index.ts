import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find missed calls from the last hour that haven't been recovered
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: missedCalls } = await supabase
      .from('call_center_logs')
      .select('*, call_center_phone_numbers(*)')
      .eq('direction', 'inbound')
      .is('answered_by', null)
      .gte('created_at', oneHourAgo)
      .is('recovered', null);

    if (!missedCalls || missedCalls.length === 0) {
      return new Response(
        JSON.stringify({ success: true, recovered_calls: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recoveryResults = [];

    for (const call of missedCalls) {
      // Create outbound call task
      const { error: taskError } = await supabase
        .from('call_center_tasks')
        .insert({
          call_log_id: call.id,
          task_type: 'return_call',
          title: `Return missed call from ${call.caller_id}`,
          description: `Automated recovery: Call back ${call.caller_id} regarding their missed call to ${call.call_center_phone_numbers?.business_name}`,
          priority: 'high',
          business_name: call.call_center_phone_numbers?.business_name,
          created_by_ai: true,
          status: 'pending'
        });

      if (!taskError) {
        // Mark as recovered
        await supabase
          .from('call_center_logs')
          .update({ recovered: true })
          .eq('id', call.id);

        recoveryResults.push({
          call_id: call.id,
          caller_id: call.caller_id,
          business: call.call_center_phone_numbers?.business_name
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        recovered_calls: recoveryResults.length,
        details: recoveryResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Missed Call Recovery Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});