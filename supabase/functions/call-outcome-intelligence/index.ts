import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IntelligenceRequest {
  action: 'analyze_business' | 'generate_signals' | 'get_insights';
  business_id?: string;
  time_range_hours?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, business_id, time_range_hours = 168 } = await req.json() as IntelligenceRequest;

    if (action === 'analyze_business' && business_id) {
      const signals = await analyzeBusinessCalls(supabase, business_id, time_range_hours);
      return new Response(
        JSON.stringify({ success: true, signals }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'generate_signals') {
      // Analyze all businesses
      const { data: businesses } = await supabase
        .from('businesses')
        .select('id, name')
        .eq('is_active', true);

      const allSignals = [];
      for (const biz of businesses || []) {
        const signals = await analyzeBusinessCalls(supabase, biz.id, time_range_hours);
        allSignals.push(...signals);
      }

      return new Response(
        JSON.stringify({ success: true, total_signals: allSignals.length, signals: allSignals }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_insights' && business_id) {
      const { data: signals } = await supabase
        .from('call_intelligence_signals')
        .select('*')
        .eq('business_id', business_id)
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })
        .limit(20);

      return new Response(
        JSON.stringify({ success: true, insights: signals }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Call outcome intelligence error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function analyzeBusinessCalls(
  supabase: any,
  businessId: string,
  timeRangeHours: number
) {
  const signals: Array<{
    signal_type: string;
    severity: string;
    title: string;
    description: string;
    metric_value?: number;
    metric_unit?: string;
    suggested_action: string;
  }> = [];

  const since = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000).toISOString();

  // Get call outcomes for analysis
  const { data: outcomes } = await supabase
    .from('call_outcomes')
    .select('*')
    .eq('business_id', businessId)
    .gte('created_at', since);

  if (!outcomes || outcomes.length === 0) {
    return signals;
  }

  const totalCalls = outcomes.length;
  const missedCalls = outcomes.filter((o: { outcome: string }) => o.outcome === 'missed').length;
  const voicemailCalls = outcomes.filter((o: { outcome: string }) => o.outcome === 'voicemail').length;
  const connectedCalls = outcomes.filter((o: { outcome: string }) => o.outcome === 'connected').length;

  // Calculate after-hours missed calls
  const afterHoursMissed = outcomes.filter(
    (o: { outcome: string; is_business_hours: boolean | null }) => o.outcome === 'missed' && o.is_business_hours === false
  ).length;

  // Signal: High miss rate
  const missRate = (missedCalls / totalCalls) * 100;
  if (missRate > 30) {
    const signal = {
      signal_type: 'high_miss_rate',
      severity: missRate > 50 ? 'critical' : 'warning',
      title: `High call miss rate: ${missRate.toFixed(1)}%`,
      description: `${missedCalls} of ${totalCalls} calls were missed in the last ${Math.round(timeRangeHours / 24)} days`,
      metric_value: missRate,
      metric_unit: 'percent',
      suggested_action: 'Add more callable users or review business hours configuration',
    };
    signals.push(signal);

    await supabase.from('call_intelligence_signals').insert({
      business_id: businessId,
      ...signal,
      related_entity_type: 'business',
      related_entity_id: businessId,
    });
  }

  // Signal: After-hours issues
  if (afterHoursMissed > 5) {
    const signal = {
      signal_type: 'after_hours_issues',
      severity: 'warning',
      title: `${afterHoursMissed} calls missed after hours`,
      description: 'Multiple calls are being missed outside business hours',
      metric_value: afterHoursMissed,
      metric_unit: 'calls',
      suggested_action: 'Configure after-hours routing to voicemail or on-call staff',
    };
    signals.push(signal);

    await supabase.from('call_intelligence_signals').insert({
      business_id: businessId,
      ...signal,
      related_entity_type: 'business',
      related_entity_id: businessId,
    });
  }

  // Signal: No callable users for routes
  const { data: routes } = await supabase
    .from('inbound_call_routes')
    .select('id, route_type, route_target_user_id, route_target_role')
    .eq('business_id', businessId)
    .eq('is_active', true);

  for (const route of routes || []) {
    if (route.route_type === 'user' && route.route_target_user_id) {
      const { data: user } = await supabase
        .from('user_profiles')
        .select('phone, is_callable')
        .eq('user_id', route.route_target_user_id)
        .maybeSingle();

      if (!user?.phone || !user?.is_callable) {
        const signal = {
          signal_type: 'uncallable_route_target',
          severity: 'critical',
          title: 'Route target is not callable',
          description: 'An inbound route points to a user without a valid phone number',
          suggested_action: 'Update user phone number or disable the route',
        };
        signals.push(signal);

        await supabase.from('call_intelligence_signals').insert({
          business_id: businessId,
          ...signal,
          related_entity_type: 'route',
          related_entity_id: route.id,
        });
      }
    }

    if (route.route_type === 'role' && route.route_target_role) {
      const { count } = await supabase
        .from('user_profiles')
        .select('user_id', { count: 'exact' })
        .eq('business_id', businessId)
        .eq('primary_role', route.route_target_role)
        .eq('is_callable', true)
        .not('phone', 'is', null);

      if ((count || 0) === 0) {
        const signal = {
          signal_type: 'no_callable_role_users',
          severity: 'critical',
          title: `No callable ${route.route_target_role}s configured`,
          description: `The role "${route.route_target_role}" has no users with valid phone numbers`,
          suggested_action: `Add phone numbers to ${route.route_target_role} users or change route target`,
        };
        signals.push(signal);

        await supabase.from('call_intelligence_signals').insert({
          business_id: businessId,
          ...signal,
          related_entity_type: 'route',
          related_entity_id: route.id,
        });
      }
    }
  }

  // Signal: Repeat callers going to voicemail
  const { data: voicemails } = await supabase
    .from('voicemails')
    .select('caller_number')
    .eq('business_id', businessId)
    .gte('created_at', since);

  const callerCounts: Record<string, number> = {};
  for (const vm of voicemails || []) {
    if (vm.caller_number) {
      callerCounts[vm.caller_number] = (callerCounts[vm.caller_number] || 0) + 1;
    }
  }

  const repeatCallers = Object.entries(callerCounts).filter(([_, count]) => count >= 3);
  if (repeatCallers.length > 0) {
    const signal = {
      signal_type: 'repeat_voicemail_callers',
      severity: 'warning',
      title: `${repeatCallers.length} callers left 3+ voicemails`,
      description: 'Some callers are repeatedly going to voicemail without being reached',
      metric_value: repeatCallers.length,
      metric_unit: 'callers',
      suggested_action: 'Review voicemail inbox and prioritize callbacks to repeat callers',
    };
    signals.push(signal);

    await supabase.from('call_intelligence_signals').insert({
      business_id: businessId,
      ...signal,
      related_entity_type: 'business',
      related_entity_id: businessId,
      metadata: { repeat_callers: repeatCallers.map(([number, count]) => ({ number, count })) },
    });
  }

  // Signal: Low answer rate during business hours
    const businessHoursCalls = outcomes.filter((o: { is_business_hours: boolean | null }) => o.is_business_hours === true);
    const businessHoursConnected = businessHoursCalls.filter((o: { outcome: string }) => o.outcome === 'connected').length;
  if (businessHoursCalls.length > 10) {
    const answerRate = (businessHoursConnected / businessHoursCalls.length) * 100;
    if (answerRate < 60) {
      const signal = {
        signal_type: 'low_business_hours_answer_rate',
        severity: answerRate < 40 ? 'critical' : 'warning',
        title: `Only ${answerRate.toFixed(1)}% of business hours calls answered`,
        description: `${businessHoursConnected} of ${businessHoursCalls.length} calls during business hours were connected`,
        metric_value: answerRate,
        metric_unit: 'percent',
        suggested_action: 'Add more callable staff or review ring timeout settings',
      };
      signals.push(signal);

      await supabase.from('call_intelligence_signals').insert({
        business_id: businessId,
        ...signal,
        related_entity_type: 'business',
        related_entity_id: businessId,
      });
    }
  }

  console.log(`Generated ${signals.length} intelligence signals for business ${businessId}`);
  return signals;
}
