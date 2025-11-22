import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recommendations = [];
    
    // Find stores with no communication in 30+ days
    const { data: stores } = await supabase
      .from('stores')
      .select('id, name, status')
      .eq('status', 'active');
    
    if (stores) {
      for (const store of stores) {
        const { data: recentComms } = await supabase
          .from('communication_events')
          .select('id')
          .eq('linked_entity_type', 'store')
          .eq('linked_entity_id', store.id)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .limit(1);
        
        if (!recentComms || recentComms.length === 0) {
          // Create AI recommendation
          const { error } = await supabase
            .from('ai_recommendations')
            .insert({
              category: 'communication_followup',
              title: `Follow up with ${store.name}`,
              description: `No communication in 30+ days`,
              severity: 'medium',
              entity_type: 'store',
              entity_id: store.id,
              reasoning: 'Store has had no contact in over 30 days. Recommend reaching out to maintain relationship.',
              recommended_action: {
                type: 'send_message',
                channel: 'sms',
                message: 'Checking in - how are things going? Need any restocking?'
              }
            });
          
          if (!error) {
            recommendations.push({
              entityType: 'store',
              entityId: store.id,
              entityName: store.name,
              reason: 'No contact in 30+ days',
            });
          }
        }
      }
    }
    
    // Find customers with no communication
    const { data: customers } = await supabase
      .from('crm_customers')
      .select('id, name, relationship_status')
      .eq('relationship_status', 'active');
    
    if (customers) {
      for (const customer of customers) {
        const { data: recentComms } = await supabase
          .from('communication_events')
          .select('id')
          .eq('linked_entity_type', 'customer')
          .eq('linked_entity_id', customer.id)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .limit(1);
        
        if (!recentComms || recentComms.length === 0) {
          const { error } = await supabase
            .from('ai_recommendations')
            .insert({
              category: 'communication_followup',
              title: `Follow up with ${customer.name}`,
              description: `Customer has had no communication in 30+ days`,
              severity: 'medium',
              entity_type: 'customer',
              entity_id: customer.id,
              reasoning: 'Customer relationship may be cooling. Recommend proactive outreach.',
              recommended_action: {
                type: 'send_message',
                channel: 'email',
                message: 'Hope you\'re doing well! We wanted to check in and see if there\'s anything we can help with.'
              }
            });
          
          if (!error) {
            recommendations.push({
              entityType: 'customer',
              entityId: customer.id,
              entityName: customer.name,
              reason: 'No contact in 30+ days',
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        recommendations_created: recommendations.length,
        details: recommendations 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in communication-automation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});