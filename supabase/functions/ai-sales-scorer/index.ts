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

    console.log('AI Sales Scorer: Starting analysis...');

    // Fetch all prospects with communication history
    const { data: prospects, error: prospectsError } = await supabase
      .from('sales_prospects')
      .select(`
        *,
        assigned_user:profiles!sales_prospects_assigned_to_fkey(id, name, email)
      `);

    if (prospectsError) throw prospectsError;

    // Fetch communication events for prospects
    const { data: communications, error: commsError } = await supabase
      .from('communication_events')
      .select('*')
      .eq('linked_entity_type', 'prospect');

    if (commsError) throw commsError;

    // Fetch ZIP density data for location scoring
    const { data: zipDensity, error: zipError } = await supabase
      .from('zip_density')
      .select('zip_code, state, density_score, store_count');

    if (zipError) throw zipError;

    const zipDensityMap = new Map(
      zipDensity?.map(z => [`${z.zip_code}-${z.state}`, z]) || []
    );

    const updates = [];

    for (const prospect of prospects || []) {
      // Count communications for this prospect
      const prospectComms = communications?.filter(
        c => c.linked_entity_id === prospect.id
      ) || [];

      // Get location score
      const zipKey = `${prospect.zipcode}-${prospect.state}`;
      const locationData = zipDensityMap.get(zipKey);
      const locationScore = locationData?.density_score || 50;

      // Calculate engagement score based on communications
      let engagementScore = 30;
      if (prospectComms.length > 0) engagementScore += 10;
      if (prospectComms.length > 2) engagementScore += 10;
      if (prospectComms.length > 5) engagementScore += 10;

      // Recent communication bonus
      const recentComm = prospectComms.find(c => {
        const commDate = new Date(c.created_at);
        const daysSince = (Date.now() - commDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysSince <= 7;
      });
      if (recentComm) engagementScore += 15;

      // Pipeline stage score
      const stageScores: Record<string, number> = {
        'new': 20,
        'contacted': 40,
        'follow-up': 50,
        'interested': 70,
        'qualified': 85,
        'activated': 100,
        'closed-lost': 0
      };
      const stageScore = stageScores[prospect.pipeline_stage] || 30;

      // Calculate AI score (weighted average)
      const aiScore = Math.round(
        (locationScore * 0.3) +
        (engagementScore * 0.4) +
        (stageScore * 0.3)
      );

      // Calculate likelihood to activate
      let likelihood = 30;
      if (prospect.pipeline_stage === 'interested') likelihood = 60;
      if (prospect.pipeline_stage === 'qualified') likelihood = 85;
      if (prospectComms.length > 3) likelihood += 10;
      if (locationScore > 70) likelihood += 10;
      likelihood = Math.min(100, likelihood);

      // Calculate priority
      let priority = aiScore;
      if (prospect.next_follow_up) {
        const daysUntilFollowup = (new Date(prospect.next_follow_up).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysUntilFollowup < 1) priority += 20; // Urgent
        if (daysUntilFollowup < 0) priority += 30; // Overdue
      }
      priority = Math.min(100, Math.max(0, priority));

      updates.push({
        id: prospect.id,
        ai_score: aiScore,
        likelihood_to_activate: likelihood,
        priority: Math.round(priority),
        total_communications: prospectComms.length
      });
    }

    // Batch update prospects
    if (updates.length > 0) {
      for (const update of updates) {
        await supabase
          .from('sales_prospects')
          .update({
            ai_score: update.ai_score,
            likelihood_to_activate: update.likelihood_to_activate,
            priority: update.priority,
            total_communications: update.total_communications
          })
          .eq('id', update.id);
      }
    }

    // Generate AI recommendations for top prospects
    const topProspects = updates
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5);

    const recommendations = topProspects.map(p => {
      const prospect = prospects?.find(pr => pr.id === p.id);
      return {
        prospectId: p.id,
        storeName: prospect?.store_name,
        priority: p.priority,
        aiScore: p.ai_score,
        likelihood: p.likelihood_to_activate,
        recommendation: p.likelihood_to_activate > 70
          ? 'High priority - Push for activation'
          : p.ai_score > 60
          ? 'Good potential - Schedule follow-up'
          : 'Monitor - Nurture relationship'
      };
    });

    console.log('AI Sales Scorer: Analysis complete');

    return new Response(
      JSON.stringify({
        success: true,
        prospectsScored: updates.length,
        recommendations,
        summary: {
          highPriority: updates.filter(u => u.priority >= 70).length,
          mediumPriority: updates.filter(u => u.priority >= 40 && u.priority < 70).length,
          lowPriority: updates.filter(u => u.priority < 40).length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI Sales Scorer error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});