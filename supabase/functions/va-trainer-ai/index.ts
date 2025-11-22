import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrainingRequest {
  vaId: string;
  lessonId?: string;
  skillType?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { vaId, lessonId, skillType }: TrainingRequest = await req.json();

    console.log('VA Trainer AI:', { vaId, lessonId, skillType });

    // Get VA profile
    const { data: va, error: vaError } = await supabase
      .from('vas')
      .select('*')
      .eq('id', vaId)
      .single();

    if (vaError) throw vaError;

    let trainingPlan;

    if (lessonId) {
      // Specific lesson training
      const { data: lesson } = await supabase
        .from('va_lessons')
        .select('*')
        .eq('id', lessonId)
        .single();

      trainingPlan = {
        type: 'specific_lesson',
        lesson,
        adaptiveInstructions: generateAdaptiveInstructions(va, lesson),
        estimatedTime: lesson?.estimated_minutes || 15,
        nextSteps: ['complete_quiz', 'practice_scenario', 'real_world_application']
      };
    } else if (skillType) {
      // Skill-based training
      const { data: lessons } = await supabase
        .from('va_lessons')
        .select('*')
        .eq('category', skillType)
        .order('order_index');

      trainingPlan = {
        type: 'skill_training',
        skillType,
        lessons,
        currentLevel: va.tier,
        targetLevel: Math.min(va.tier + 1, 5),
        estimatedTime: lessons?.reduce((sum, l) => sum + (l.estimated_minutes || 0), 0) || 60
      };
    } else {
      // Personalized training plan based on VA's current performance
      const { data: skills } = await supabase
        .from('va_skills')
        .select('*')
        .eq('va_id', vaId);

      const weakestSkills = skills
        ?.filter(s => s.proficiency_level < 3)
        .sort((a, b) => a.proficiency_level - b.proficiency_level)
        .slice(0, 3) || [];

      const { data: recommendedLessons } = await supabase
        .from('va_lessons')
        .select('*')
        .in('category', weakestSkills.map(s => s.skill_type))
        .limit(5);

      trainingPlan = {
        type: 'personalized_plan',
        weakestSkills,
        recommendedLessons,
        focusAreas: weakestSkills.map(s => s.skill_type),
        estimatedWeeks: 2
      };
    }

    // Log training session
    await supabase
      .from('va_scores')
      .insert({
        va_id: vaId,
        metric_type: 'training_session_started',
        metric_value: 1,
        period_start: new Date().toISOString(),
        notes: JSON.stringify(trainingPlan)
      });

    return new Response(
      JSON.stringify({
        success: true,
        trainingPlan,
        va: {
          name: va.name,
          tier: va.tier,
          skillScore: va.skill_score
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('VA Trainer Error:', error);
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

function generateAdaptiveInstructions(va: any, lesson: any) {
  const instructions = [];

  if (va.tier <= 2) {
    instructions.push('Focus on fundamentals');
    instructions.push('Practice scripts word-for-word');
    instructions.push('Review examples multiple times');
  } else if (va.tier <= 4) {
    instructions.push('Apply concepts to real scenarios');
    instructions.push('Develop your own approach');
    instructions.push('Focus on speed and accuracy');
  } else {
    instructions.push('Master advanced techniques');
    instructions.push('Mentor other VAs');
    instructions.push('Innovate new strategies');
  }

  return instructions;
}
