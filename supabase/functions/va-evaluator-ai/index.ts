import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvaluationRequest {
  vaId: string;
  period?: 'day' | 'week' | 'month';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { vaId, period = 'week' }: EvaluationRequest = await req.json();

    console.log('VA Evaluator AI:', { vaId, period });

    // Get VA current data
    const { data: va, error: vaError } = await supabase
      .from('vas')
      .select('*')
      .eq('id', vaId)
      .single();

    if (vaError) throw vaError;

    // Get recent performance metrics
    const daysBack = period === 'day' ? 1 : period === 'week' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const { data: metrics } = await supabase
      .from('va_performance_metrics')
      .select('*')
      .eq('va_id', vaId)
      .gte('date', startDate.toISOString().split('T')[0]);

    // Get completed tasks
    const { data: tasks } = await supabase
      .from('va_tasks')
      .select('*')
      .eq('va_id', vaId)
      .eq('status', 'completed')
      .gte('completed_at', startDate.toISOString());

    // Get lesson attempts
    const { data: attempts } = await supabase
      .from('va_attempts')
      .select('*')
      .eq('va_id', vaId)
      .gte('completed_at', startDate.toISOString());

    // Calculate scores
    const totalCalls = metrics?.reduce((sum, m) => sum + (m.call_attempts || 0), 0) || 0;
    const totalContacts = metrics?.reduce((sum, m) => sum + (m.contacts_made || 0), 0) || 0;
    const totalConversations = metrics?.reduce((sum, m) => sum + (m.conversations || 0), 0) || 0;
    const totalAppointments = metrics?.reduce((sum, m) => sum + (m.appointments_set || 0), 0) || 0;
    const totalContracts = metrics?.reduce((sum, m) => sum + (m.contracts_signed || 0), 0) || 0;

    const contactRate = totalCalls > 0 ? (totalContacts / totalCalls) * 100 : 0;
    const conversationRate = totalContacts > 0 ? (totalConversations / totalContacts) * 100 : 0;
    const appointmentRate = totalConversations > 0 ? (totalAppointments / totalConversations) * 100 : 0;
    const contractRate = totalAppointments > 0 ? (totalContracts / totalAppointments) * 100 : 0;

    const taskSuccessRate = tasks && tasks.length > 0
      ? (tasks.filter(t => t.result && (t.result as any).success).length / tasks.length) * 100
      : 0;

    const avgLessonScore = attempts && attempts.length > 0
      ? attempts.reduce((sum, a) => sum + (a.score || 0), 0) / attempts.length
      : 0;

    // Calculate overall AI score (0-100)
    const aiScore = Math.round(
      (contactRate * 0.2) +
      (conversationRate * 0.2) +
      (appointmentRate * 0.15) +
      (contractRate * 0.15) +
      (taskSuccessRate * 0.15) +
      (avgLessonScore * 0.15)
    );

    // Determine new tier
    let newTier = va.tier;
    if (aiScore >= 90 && va.tier < 5) newTier = Math.min(va.tier + 1, 5);
    else if (aiScore >= 75 && va.tier < 4) newTier = Math.min(va.tier + 1, 4);
    else if (aiScore >= 60 && va.tier < 3) newTier = Math.min(va.tier + 1, 3);
    else if (aiScore < 40 && va.tier > 1) newTier = Math.max(va.tier - 1, 1);

    const evaluation = {
      period,
      aiScore,
      currentTier: va.tier,
      newTier,
      tierChange: newTier - va.tier,
      metrics: {
        calls: totalCalls,
        contacts: totalContacts,
        conversations: totalConversations,
        appointments: totalAppointments,
        contracts: totalContracts,
        contactRate: Math.round(contactRate),
        conversationRate: Math.round(conversationRate),
        appointmentRate: Math.round(appointmentRate),
        contractRate: Math.round(contractRate),
        taskSuccessRate: Math.round(taskSuccessRate),
        avgLessonScore: Math.round(avgLessonScore)
      },
      strengths: [] as string[],
      weaknesses: [] as string[],
      recommendations: [] as string[]
    };

    // Identify strengths and weaknesses
    if (contactRate >= 70) evaluation.strengths.push('High contact rate');
    else if (contactRate < 40) evaluation.weaknesses.push('Low contact rate - needs more call volume');

    if (conversationRate >= 50) evaluation.strengths.push('Good conversation conversion');
    else if (conversationRate < 30) evaluation.weaknesses.push('Struggles to engage in conversations');

    if (appointmentRate >= 40) evaluation.strengths.push('Excellent appointment setter');
    else if (appointmentRate < 20) evaluation.weaknesses.push('Needs improvement in setting appointments');

    if (contractRate >= 30) evaluation.strengths.push('Strong closer');
    else if (contractRate < 15) evaluation.weaknesses.push('Closing skills need development');

    // Generate recommendations
    if (evaluation.weaknesses.includes('Low contact rate - needs more call volume')) {
      evaluation.recommendations.push('Increase daily call targets by 50%');
    }
    if (evaluation.weaknesses.includes('Struggles to engage in conversations')) {
      evaluation.recommendations.push('Complete "Advanced Conversation Techniques" training');
    }
    if (evaluation.weaknesses.includes('Needs improvement in setting appointments')) {
      evaluation.recommendations.push('Practice objection handling scenarios');
    }
    if (newTier > va.tier) {
      evaluation.recommendations.push(`Congratulations! Promoted to Tier ${newTier}`);
    }

    // Update VA record
    await supabase
      .from('vas')
      .update({
        tier: newTier,
        skill_score: aiScore,
        success_rate: taskSuccessRate,
        updated_at: new Date().toISOString()
      })
      .eq('id', vaId);

    // Log evaluation
    await supabase
      .from('va_scores')
      .insert({
        va_id: vaId,
        metric_type: 'ai_evaluation',
        metric_value: aiScore,
        period_start: startDate.toISOString(),
        period_end: new Date().toISOString(),
        notes: JSON.stringify(evaluation)
      });

    return new Response(
      JSON.stringify({
        success: true,
        evaluation,
        va: {
          name: va.name,
          previousTier: va.tier,
          newTier
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('VA Evaluator Error:', error);
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
