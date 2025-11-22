import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('AI KPI Enforcer: Checking performance against $10M/month target');

    // Fetch current month's performance
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: monthlyClosings } = await supabase
      .from("deal_closings")
      .select("*")
      .gte("closing_date", startOfMonth.toISOString());

    const monthlyRevenue = monthlyClosings?.reduce((sum, d) => sum + (d.assignment_fee || 0), 0) || 0;
    const target = 10000000; // $10M
    const percentOfTarget = (monthlyRevenue / target) * 100;
    const daysInMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0).getDate();
    const dayOfMonth = new Date().getDate();
    const expectedProgress = (dayOfMonth / daysInMonth) * 100;
    const gap = expectedProgress - percentOfTarget;

    console.log(`Revenue: $${monthlyRevenue}, Target: $${target}, Progress: ${percentOfTarget.toFixed(1)}%`);

    // Use AI to generate corrective actions
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an AI CEO enforcing KPIs for a $10M/month real estate business. Generate aggressive corrective actions when behind target.'
          },
          {
            role: 'user',
            content: `URGENT KPI ALERT:

Monthly Revenue Target: $${target.toLocaleString()}
Current Revenue: $${monthlyRevenue.toLocaleString()}
Progress: ${percentOfTarget.toFixed(1)}%
Expected Progress: ${expectedProgress.toFixed(1)}%
Gap: ${gap.toFixed(1)}% ${gap > 0 ? 'BEHIND' : 'AHEAD'}

Day ${dayOfMonth} of ${daysInMonth}

Generate 5-7 immediate corrective actions to close this gap:
1. Lead generation adjustments
2. Conversion optimization
3. Deal velocity improvements
4. Team performance corrections
5. Budget reallocation
6. Market expansion priorities
7. VA task assignments

Format as JSON array with keys: action_type, description, priority, expected_impact, due_date_hours`
          }
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    let actions: any[] = [];
    try {
      actions = JSON.parse(content);
    } catch {
      actions = [{
        action_type: 'review_needed',
        description: 'AI analysis requires review',
        priority: 'medium',
        expected_impact: 'TBD',
        due_date_hours: 24
      }];
    }

    // Store corrective actions
    const actionInserts = actions.map((action: any) => {
      const dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + (action.due_date_hours || 24));
      
      return {
        action_type: action.action_type,
        action_description: action.description,
        priority: action.priority,
        automated: true,
        status: 'pending',
        due_date: dueDate.toISOString()
      };
    });

    const { data: storedActions, error: actionsError } = await supabase
      .from("ceo_actions")
      .insert(actionInserts)
      .select();

    if (actionsError) throw actionsError;

    console.log(`Generated ${storedActions.length} corrective actions`);

    return new Response(
      JSON.stringify({ 
        success: true,
        kpi_status: {
          revenue: monthlyRevenue,
          target,
          percent_of_target: percentOfTarget,
          gap,
          status: gap > 5 ? 'critical' : gap > 0 ? 'warning' : 'on_track'
        },
        actions: storedActions
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in KPI enforcer:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});