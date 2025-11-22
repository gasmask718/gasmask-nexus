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
    const { entityType, entityId } = await req.json();
    
    if (!entityType || !entityId) {
      throw new Error('entityType and entityId are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get entity data
    let entityData = null;
    if (entityType === 'store') {
      const { data } = await supabase.from('stores').select('name, status').eq('id', entityId).single();
      entityData = data;
    } else if (entityType === 'wholesaler') {
      const { data } = await supabase.from('wholesale_hubs').select('name, status').eq('id', entityId).single();
      entityData = data;
    } else if (entityType === 'influencer') {
      const { data } = await supabase.from('influencers').select('name, status').eq('id', entityId).single();
      entityData = data;
    }

    // Get communication history
    const { data: communications } = await supabase
      .from('communication_events')
      .select('created_at, direction, event_type')
      .eq('linked_entity_type', entityType)
      .eq('linked_entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Calculate metrics
    const now = new Date();
    const daysSinceLastContact = communications && communications.length > 0
      ? Math.floor((now.getTime() - new Date(communications[0].created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const last30Days = communications?.filter(c => 
      (now.getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24) <= 30
    ) || [];

    const outboundCount = last30Days.filter(c => c.direction === 'outbound').length;
    const inboundCount = last30Days.filter(c => c.direction === 'inbound').length;
    const responseRate = outboundCount > 0 ? (inboundCount / outboundCount) * 100 : 0;

    // Generate insights
    const insights = [];

    // Timing insights
    if (daysSinceLastContact > 30) {
      insights.push({
        type: 'critical',
        priority: 100,
        action: 'contact_immediately',
        reason: `No contact in ${daysSinceLastContact} days - High risk of losing relationship`,
        suggestedMessage: `Hi! It's been a while since we connected. Just checking in to see how things are going. Any updates on inventory needs?`,
      });
    } else if (daysSinceLastContact > 14) {
      insights.push({
        type: 'warning',
        priority: 75,
        action: 'schedule_followup',
        reason: `${daysSinceLastContact} days since last contact - Moderate follow-up needed`,
        suggestedMessage: `Hope all is well! Wanted to touch base and see if you need anything this week.`,
      });
    } else if (daysSinceLastContact > 7) {
      insights.push({
        type: 'info',
        priority: 50,
        action: 'gentle_check_in',
        reason: 'Regular check-in window',
        suggestedMessage: `Quick check-in! How's inventory looking? Let us know if you need anything.`,
      });
    }

    // Response rate insights
    if (responseRate < 30 && outboundCount > 3) {
      insights.push({
        type: 'warning',
        priority: 80,
        action: 'change_strategy',
        reason: `Low response rate (${responseRate.toFixed(0)}%) - Try different channel or approach`,
        suggestedMessage: null,
      });
    }

    // Activity insights
    if (last30Days.length === 0) {
      insights.push({
        type: 'critical',
        priority: 90,
        action: 'reactivation_needed',
        reason: 'No activity in 30 days - Account may be dormant',
        suggestedMessage: `We noticed you haven't placed an order recently. Is everything okay? We'd love to help with any needs you have.`,
      });
    }

    // Entity-specific insights
    if (entityType === 'store' && entityData?.status === 'inactive') {
      insights.push({
        type: 'critical',
        priority: 95,
        action: 'reactivation_campaign',
        reason: 'Store marked as inactive',
        suggestedMessage: `We'd love to have you back! What can we do to earn your business again?`,
      });
    }

    // Sort by priority
    insights.sort((a, b) => b.priority - a.priority);

    return new Response(
      JSON.stringify({
        success: true,
        entity: entityData?.name || 'Unknown',
        metrics: {
          daysSinceLastContact,
          totalCommunications: communications?.length || 0,
          last30DaysCount: last30Days.length,
          responseRate: responseRate.toFixed(1),
          outboundCount,
          inboundCount,
        },
        insights: insights.slice(0, 5), // Return top 5 insights
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in communication-insights:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
