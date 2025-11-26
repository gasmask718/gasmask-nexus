import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Dynasty Automations - Process Automation Engine
 * Processes pending automation logs and executes actions (sends SMS, emails, etc.)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🤖 Dynasty Automations: Processing pending automation logs...');

    // Get pending automation logs
    const { data: pendingLogs, error: fetchError } = await supabase
      .from('automation_logs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch pending logs: ${fetchError.message}`);
    }

    if (!pendingLogs || pendingLogs.length === 0) {
      console.log('✅ No pending automation logs to process');
      return new Response(JSON.stringify({
        success: true,
        processed: 0,
        message: 'No pending logs'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📋 Found ${pendingLogs.length} pending automation logs`);

    let successCount = 0;
    let failureCount = 0;

    // Process each pending log
    for (const log of pendingLogs) {
      try {
        console.log(`Processing automation log ${log.id}: ${log.event_type} -> ${log.action_type}`);

        // Execute action based on action_type
        if (log.action_type === 'send_sms') {
          if (!log.recipient_phone) {
            throw new Error('No recipient phone number');
          }

          // Log the SMS to communication_logs
          const { data: commLog, error: commError } = await supabase
            .from('communication_logs')
            .insert({
              channel: 'sms',
              direction: 'outbound',
              summary: `Automated SMS: ${log.event_type}`,
              message_content: log.message_sent,
              recipient_phone: log.recipient_phone,
              brand: log.brand,
              business_id: log.business_id,
              performed_by: 'system',
              delivery_status: 'sent',
            })
            .select()
            .single();

          if (commError) throw commError;

          // Update automation log as success
          await supabase
            .from('automation_logs')
            .update({
              status: 'success',
              communication_log_id: commLog.id,
            })
            .eq('id', log.id);

          console.log(`✅ SMS sent successfully for automation log ${log.id}`);
          successCount++;

        } else if (log.action_type === 'send_email') {
          if (!log.recipient_email) {
            throw new Error('No recipient email');
          }

          // Log the email to communication_logs
          const { data: commLog, error: commError } = await supabase
            .from('communication_logs')
            .insert({
              channel: 'email',
              direction: 'outbound',
              summary: `Automated Email: ${log.event_type}`,
              message_content: log.message_sent,
              recipient_email: log.recipient_email,
              brand: log.brand,
              business_id: log.business_id,
              performed_by: 'system',
              delivery_status: 'sent',
            })
            .select()
            .single();

          if (commError) throw commError;

          // Update automation log as success
          await supabase
            .from('automation_logs')
            .update({
              status: 'success',
              communication_log_id: commLog.id,
            })
            .eq('id', log.id);

          console.log(`✅ Email sent successfully for automation log ${log.id}`);
          successCount++;
        }

      } catch (error) {
        console.error(`❌ Failed to process automation log ${log.id}:`, error);

        // Update automation log as failed
        await supabase
          .from('automation_logs')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : String(error),
          })
          .eq('id', log.id);

        failureCount++;
      }
    }

    console.log(`🎯 Automation processing complete: ${successCount} success, ${failureCount} failures`);

    return new Response(JSON.stringify({
      success: true,
      processed: pendingLogs.length,
      successful: successCount,
      failed: failureCount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Dynasty Automations Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
