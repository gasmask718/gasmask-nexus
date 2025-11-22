import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TaskRouteRequest {
  taskType: string;
  entityType?: string;
  entityId?: string;
  priority?: number;
  description?: string;
  aiInstructions?: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const taskRequest: TaskRouteRequest = await req.json();

    console.log('VA Task Router AI:', taskRequest);

    // Get all active VAs with their skills
    const { data: vas, error: vasError } = await supabase
      .from('vas')
      .select(`
        *,
        va_skills (*)
      `)
      .eq('status', 'active')
      .order('tier', { ascending: false });

    if (vasError) throw vasError;

    if (!vas || vas.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No active VAs available'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Skill mapping for different task types
    const taskSkillMap: Record<string, string> = {
      'cold_calling': 'cold_calling',
      'sms_follow_up': 'sms_follow_up',
      'contract_management': 'contract_management',
      'data_entry': 'data_entry',
      'skip_tracing': 'skip_tracing',
      'underwriting': 'underwriting',
      'negotiations': 'negotiations',
      'appointment_setting': 'cold_calling'
    };

    const requiredSkill = taskSkillMap[taskRequest.taskType] || taskRequest.taskType;

    // Score each VA for this task
    const scoredVAs = vas.map(va => {
      let score = va.tier * 20; // Base score from tier (20-100)

      // Bonus for relevant skill
      const relevantSkill = (va.va_skills as any[])?.find(s => s.skill_type === requiredSkill);
      if (relevantSkill) {
        score += relevantSkill.proficiency_level * 10;
      }

      // Bonus for overall success rate
      score += (va.success_rate || 0) * 0.3;

      // Penalty for current workload
      // (Would need to query current assigned tasks, simplified here)
      score -= (va.total_tasks_completed || 0) * 0.01;

      return {
        va,
        score: Math.min(score, 100)
      };
    });

    // Sort by score and get the best VA
    scoredVAs.sort((a, b) => b.score - a.score);
    const bestVA = scoredVAs[0].va;

    // Create the task
    const { data: task, error: taskError } = await supabase
      .from('va_tasks')
      .insert({
        va_id: bestVA.id,
        task_type: taskRequest.taskType,
        priority: taskRequest.priority || 3,
        status: 'assigned',
        entity_type: taskRequest.entityType,
        entity_id: taskRequest.entityId,
        description: taskRequest.description,
        ai_instructions: taskRequest.aiInstructions,
        assigned_at: new Date().toISOString()
      })
      .select()
      .single();

    if (taskError) throw taskError;

    console.log('Task assigned to VA:', { vaName: bestVA.name, taskId: task.id });

    return new Response(
      JSON.stringify({
        success: true,
        task,
        assignedTo: {
          id: bestVA.id,
          name: bestVA.name,
          tier: bestVA.tier,
          skillScore: bestVA.skill_score,
          matchScore: Math.round(scoredVAs[0].score)
        },
        alternativeVAs: scoredVAs.slice(1, 4).map(s => ({
          id: s.va.id,
          name: s.va.name,
          tier: s.va.tier,
          matchScore: Math.round(s.score)
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('VA Task Router Error:', error);
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
