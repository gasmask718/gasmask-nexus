import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { action, userId, missionId } = await req.json();

    if (action === 'assignDailyMissions') {
      // Get all active users with field roles
      const { data: workers } = await supabaseClient
        .from('profiles')
        .select('id, role')
        .in('role', ['driver', 'biker', 'ambassador']);

      // Get active mission templates
      const { data: templates } = await supabaseClient
        .from('mission_templates')
        .select('*')
        .eq('is_active', true);

      const assignments = [];
      const now = new Date();

      for (const worker of workers || []) {
        // Find templates for this role
        const roleTemplates = templates?.filter(t => t.role === worker.role) || [];
        
        for (const template of roleTemplates) {
          const dueDate = new Date(now);
          dueDate.setDate(dueDate.getDate() + template.validity_days);

          assignments.push({
            user_id: worker.id,
            mission_template_id: template.id,
            status: 'assigned',
            progress_current: 0,
            progress_target: template.target_count,
            assigned_at: now.toISOString(),
            due_at: dueDate.toISOString(),
          });
        }
      }

      if (assignments.length > 0) {
        const { error } = await supabaseClient
          .from('mission_assignments')
          .insert(assignments);

        if (error) throw error;
      }

      return new Response(JSON.stringify({ assigned: assignments.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'updateMissionProgress') {
      if (!userId || !missionId) {
        throw new Error('userId and missionId required');
      }

      const { data: assignment } = await supabaseClient
        .from('mission_assignments')
        .select('*, mission_templates(*)')
        .eq('id', missionId)
        .eq('user_id', userId)
        .single();

      if (!assignment) {
        throw new Error('Mission not found');
      }

      const newProgress = assignment.progress_current + 1;
      const completed = newProgress >= assignment.progress_target;

      const updateData: any = {
        progress_current: newProgress,
        status: completed ? 'completed' : 'in_progress',
      };

      if (completed) {
        updateData.completed_at = new Date().toISOString();
      }

      await supabaseClient
        .from('mission_assignments')
        .update(updateData)
        .eq('id', missionId);

      // If completed, update worker score
      if (completed) {
        const { data: score } = await supabaseClient
          .from('worker_scores')
          .select('*')
          .eq('user_id', userId)
          .single();

        const xpGain = assignment.mission_templates.xp_reward;
        const newXp = (score?.xp_total || 0) + xpGain;
        const newLevel = Math.floor(Math.sqrt(newXp / 100));

        if (score) {
          await supabaseClient
            .from('worker_scores')
            .update({
              xp_total: newXp,
              level: newLevel,
              missions_completed: score.missions_completed + 1,
              last_activity_at: new Date().toISOString(),
            })
            .eq('user_id', userId);
        } else {
          await supabaseClient
            .from('worker_scores')
            .insert({
              user_id: userId,
              role: assignment.mission_templates.role,
              xp_total: xpGain,
              level: newLevel,
              missions_completed: 1,
              last_activity_at: new Date().toISOString(),
            });
        }
      }

      return new Response(JSON.stringify({ success: true, completed }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'recalculateWorkerScore') {
      if (!userId) throw new Error('userId required');

      const { data: assignments } = await supabaseClient
        .from('mission_assignments')
        .select('*, mission_templates(*)')
        .eq('user_id', userId)
        .eq('status', 'completed');

      const totalXp = assignments?.reduce((sum, a) => sum + a.mission_templates.xp_reward, 0) || 0;
      const newLevel = Math.floor(Math.sqrt(totalXp / 100));

      const { data: score } = await supabaseClient
        .from('worker_scores')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (score) {
        await supabaseClient
          .from('worker_scores')
          .update({
            xp_total: totalXp,
            level: newLevel,
            missions_completed: assignments?.length || 0,
          })
          .eq('user_id', userId);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in missions-engine function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});