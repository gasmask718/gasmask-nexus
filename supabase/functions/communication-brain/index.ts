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
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch entity data
    let entityData: any = null;
    if (entityType === 'store') {
      const { data } = await supabase.from('stores').select('*').eq('id', entityId).single();
      entityData = data;
    } else if (entityType === 'wholesaler') {
      const { data } = await supabase.from('wholesale_hubs').select('*').eq('id', entityId).single();
      entityData = data;
    } else if (entityType === 'influencer') {
      const { data } = await supabase.from('influencers').select('*').eq('id', entityId).single();
      entityData = data;
    }

    // Fetch communication history
    const { data: communications } = await supabase
      .from('communication_events')
      .select('*')
      .eq('linked_entity_type', entityType)
      .eq('linked_entity_id', entityId)
      .order('created_at', { ascending: false });

    // Fetch reminders
    const reminderField = entityType === 'store' ? 'store_id' : 
                         entityType === 'wholesaler' ? 'wholesaler_id' : 'influencer_id';
    const { data: reminders } = await supabase
      .from('reminders')
      .select('*')
      .eq(reminderField, entityId);

    // Calculate metrics
    const now = new Date();
    const lastContact = communications?.[0]?.created_at ? new Date(communications[0].created_at) : null;
    const daysSinceLastContact = lastContact ? 
      Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24)) : 999;

    const last30Days = communications?.filter(c => {
      const date = new Date(c.created_at);
      return (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24) <= 30;
    }) || [];

    const outboundCount = last30Days.filter(c => c.direction === 'outbound').length;
    const inboundCount = last30Days.filter(c => c.direction === 'inbound').length;
    const responseRate = outboundCount > 0 ? (inboundCount / outboundCount) * 100 : 0;

    // Calculate channel preferences
    const channelStats: Record<string, { sent: number; replied: number }> = {};
    communications?.forEach(c => {
      if (!c.channel) return;
      if (!channelStats[c.channel]) {
        channelStats[c.channel] = { sent: 0, replied: 0 };
      }
      if (c.direction === 'outbound') {
        channelStats[c.channel].sent++;
      } else {
        channelStats[c.channel].replied++;
      }
    });

    let bestChannel = 'sms';
    let bestScore = 0;
    Object.entries(channelStats).forEach(([channel, stats]) => {
      const score = stats.sent > 0 ? (stats.replied / stats.sent) : 0;
      if (score > bestScore) {
        bestScore = score;
        bestChannel = channel;
      }
    });

    // Calculate health score (0-100)
    let healthScore = 100;
    
    // Penalize for days since last contact
    if (daysSinceLastContact > 30) healthScore -= 40;
    else if (daysSinceLastContact > 14) healthScore -= 25;
    else if (daysSinceLastContact > 7) healthScore -= 10;
    
    // Factor in response rate
    if (responseRate < 20) healthScore -= 20;
    else if (responseRate < 50) healthScore -= 10;
    else if (responseRate > 80) healthScore += 5;
    
    // Factor in communication frequency
    if (last30Days.length === 0) healthScore -= 20;
    else if (last30Days.length > 10) healthScore += 5;

    // Check for overdue reminders
    const overdueReminders = reminders?.filter(r => {
      const dueDate = new Date(r.follow_up_date);
      return r.status === 'pending' && dueDate < now;
    }) || [];
    if (overdueReminders.length > 0) healthScore -= 15;

    healthScore = Math.max(0, Math.min(100, healthScore));

    // Determine urgency
    let urgencyColor: 'green' | 'yellow' | 'red' = 'green';
    if (healthScore < 40) urgencyColor = 'red';
    else if (healthScore < 70) urgencyColor = 'yellow';

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (daysSinceLastContact > 14) {
      recommendations.push('Critical: No contact in 14+ days. Send immediate follow-up.');
    } else if (daysSinceLastContact > 7) {
      recommendations.push('Send a check-in message within 24 hours.');
    }

    if (responseRate < 30 && outboundCount > 3) {
      recommendations.push('Low response rate. Try switching to ' + (bestChannel === 'sms' ? 'phone call' : 'direct visit'));
    }

    if (overdueReminders.length > 0) {
      recommendations.push(`${overdueReminders.length} overdue reminder(s). Complete follow-ups immediately.`);
    }

    if (inboundCount > outboundCount) {
      recommendations.push('Highly engaged! Consider offering exclusive deals or early access.');
    }

    if (last30Days.length === 0) {
      recommendations.push('Zero communication this month. Urgent outreach needed.');
    }

    if (channelStats.visit && channelStats.visit.replied > 0) {
      recommendations.push('Responds well to in-person visits. Schedule a route stop.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Relationship healthy. Maintain regular contact schedule.');
    }

    // Calculate average contact frequency
    const contactFrequencyDays = communications && communications.length > 1 ? 
      Math.floor((new Date(communications[0].created_at).getTime() - 
                  new Date(communications[communications.length - 1].created_at).getTime()) / 
                 (1000 * 60 * 60 * 24) / communications.length) : 14;

    // Generate communication scripts
    const entityName = entityData?.name || 'there';
    const scripts = {
      initial: `Hey ${entityName}, just checking in! We noticed it's been a while since we connected. How's everything going with your inventory?`,
      followup: `Hi ${entityName}, following up on my last message. We have some great deals on popular items right now. Would you like to place an order?`,
      visit: `Good morning! I'm in your area today and wanted to stop by to see how things are going. Do you have a few minutes around [time]?`,
      whatsapp: `👋 Hey ${entityName}! Quick check-in - need anything restocked this week? We have fast delivery available.`
    };

    return new Response(JSON.stringify({
      health_score: Math.round(healthScore),
      recommended_actions: recommendations,
      urgency_color: urgencyColor,
      next_best_channel: bestChannel,
      contact_frequency_days: contactFrequencyDays,
      response_rate: Math.round(responseRate),
      days_since_last_contact: daysSinceLastContact,
      total_communications_30d: last30Days.length,
      scripts,
      metrics: {
        outbound_count: outboundCount,
        inbound_count: inboundCount,
        overdue_reminders: overdueReminders.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in communication-brain:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
