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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get automation settings
    const { data: settings } = await supabase
      .from('automation_communication_settings')
      .select('*')
      .eq('is_enabled', true);

    if (!settings || settings.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No automation enabled',
        events_created: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const eventsCreated = [];

    for (const setting of settings) {
      if (setting.automation_type === 'no_communication') {
        // Find stores with no communication in last N days
        const daysCutoff = new Date();
        daysCutoff.setDate(daysCutoff.getDate() - setting.trigger_days);

        const { data: stores } = await supabase
          .from('stores')
          .select('id, name')
          .not('id', 'in', 
            supabase
              .from('communication_events')
              .select('store_id')
              .gte('created_at', daysCutoff.toISOString())
          );

        if (stores) {
          for (const store of stores) {
            const message = setting.message_template.replace('{store_name}', store.name);
            
            const { error } = await supabase
              .from('communication_events')
              .insert({
                event_type: 'automated',
                direction: 'outbound',
                channel: 'in-app',
                summary: message,
                store_id: store.id,
                payload: {
                  automation_type: setting.automation_type,
                  template_id: setting.id
                }
              });

            if (!error) {
              eventsCreated.push({ store_id: store.id, type: setting.automation_type });
            }
          }
        }
      }

      if (setting.automation_type === 'low_inventory') {
        // Find stores with low inventory alerts
        const { data: alerts } = await supabase
          .from('inventory_alerts')
          .select('store_id, stores!inner(name)')
          .eq('is_resolved', false)
          .eq('alert_type', 'stockout');

        if (alerts) {
          for (const alert of alerts) {
            const store = alert.stores as any;
            const storeName = store?.name || 'Store';
            const message = setting.message_template.replace('{store_name}', storeName);
            
            const { error } = await supabase
              .from('communication_events')
              .insert({
                event_type: 'automated',
                direction: 'outbound',
                channel: 'in-app',
                summary: message,
                store_id: alert.store_id,
                linked_entity_id: alert.store_id,
                linked_entity_type: 'inventory_alert',
                payload: {
                  automation_type: setting.automation_type,
                  template_id: setting.id
                }
              });

            if (!error) {
              eventsCreated.push({ store_id: alert.store_id, type: setting.automation_type });
            }
          }
        }
      }

      if (setting.automation_type === 'large_purchase_thanks') {
        // Find recent large orders (last 24 hours)
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        const { data: orders } = await supabase
          .from('wholesale_orders')
          .select('id, store_id, total, stores!inner(name)')
          .gte('created_at', oneDayAgo.toISOString())
          .gte('total', 500) // Large order threshold
          .eq('status', 'pending');

        if (orders) {
          for (const order of orders) {
            const store = order.stores as any;
            const storeName = store?.name || 'Store';
            const message = setting.message_template.replace('{store_name}', storeName);
            
            const { error } = await supabase
              .from('communication_events')
              .insert({
                event_type: 'automated',
                direction: 'outbound',
                channel: 'in-app',
                summary: message,
                store_id: order.store_id,
                linked_entity_id: order.id,
                linked_entity_type: 'wholesale_order',
                payload: {
                  automation_type: setting.automation_type,
                  template_id: setting.id
                }
              });

            if (!error) {
              eventsCreated.push({ store_id: order.store_id, type: setting.automation_type });
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      events_created: eventsCreated.length,
      details: eventsCreated
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in auto-text-ai:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});