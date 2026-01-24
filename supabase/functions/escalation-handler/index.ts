import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ESCALATION HANDLER
 * 
 * Handles mandatory human escalation triggers during AI calls.
 * When triggered:
 * 1. AI immediately stops speaking
 * 2. Human is notified with context
 * 3. Call is bridged or scheduled for callback
 * 
 * Humans ALWAYS win escalation.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EscalationRequest {
  action: 'check_triggers' | 'trigger_escalation' | 'accept_escalation' | 'decline_escalation' | 'get_pending';
  session_id: string;
  campaign_id?: string;
  business_id?: string;
  // Trigger check
  transcript_snippet?: string;
  current_confidence?: number;
  // Trigger data
  trigger_type?: string;
  trigger_details?: Record<string, any>;
  // Accept/decline
  escalation_id?: string;
  target_user_id?: string;
  schedule_callback?: boolean;
  callback_time?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get auth
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const body: EscalationRequest = await req.json();
    const { action, session_id, campaign_id, business_id } = body;

    switch (action) {
      case 'check_triggers': {
        // Check if transcript contains any escalation triggers
        const { transcript_snippet, current_confidence } = body;

        if (!transcript_snippet && current_confidence === undefined) {
          return new Response(
            JSON.stringify({ success: false, error: "transcript_snippet or current_confidence required" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Get active triggers
        const { data: triggers } = await supabase
          .from("escalation_triggers")
          .select("*")
          .eq("is_active", true);

        const triggeredEscalations: Array<{
          trigger_type: string;
          matched_keyword?: string;
          confidence_breach?: boolean;
          auto_escalate: boolean;
        }> = [];

        // Check keyword triggers
        if (transcript_snippet) {
          const lowerTranscript = transcript_snippet.toLowerCase();
          
          for (const trigger of triggers || []) {
            if (trigger.trigger_keywords) {
              for (const keyword of trigger.trigger_keywords) {
                if (lowerTranscript.includes(keyword.toLowerCase())) {
                  triggeredEscalations.push({
                    trigger_type: trigger.trigger_type,
                    matched_keyword: keyword,
                    auto_escalate: trigger.auto_escalate
                  });
                  break; // Only one match per trigger type
                }
              }
            }
          }
        }

        // Check confidence threshold
        if (current_confidence !== undefined) {
          const confidenceTrigger = triggers?.find(t => t.trigger_type === 'confidence_breach');
          if (confidenceTrigger && confidenceTrigger.confidence_threshold) {
            if (current_confidence < confidenceTrigger.confidence_threshold) {
              triggeredEscalations.push({
                trigger_type: 'confidence_breach',
                confidence_breach: true,
                auto_escalate: confidenceTrigger.auto_escalate
              });
            }
          }
        }

        if (triggeredEscalations.length === 0) {
          return new Response(
            JSON.stringify({
              success: true,
              escalation_required: false,
              triggers_checked: triggers?.length || 0
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Auto-escalate if any trigger requires it
        const autoEscalate = triggeredEscalations.some(t => t.auto_escalate);

        return new Response(
          JSON.stringify({
            success: true,
            escalation_required: true,
            auto_escalate: autoEscalate,
            triggered: triggeredEscalations,
            action_required: autoEscalate ? "stop_ai_immediately" : "notify_human",
            instructions: [
              "1. AI must STOP speaking",
              "2. Notify human operator",
              "3. Bridge call or schedule callback",
              "4. Log escalation with full context"
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'trigger_escalation': {
        const { trigger_type, trigger_details, transcript_snippet, current_confidence } = body;

        if (!trigger_type) {
          return new Response(
            JSON.stringify({ success: false, error: "trigger_type required" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Get corridor reference
        const { data: corridor } = await supabase
          .from("opening_corridor_state")
          .select("id")
          .eq("session_id", session_id)
          .single();

        // Find available human operator
        const { data: operators } = await supabase
          .from("user_call_settings")
          .select("user_id, phone_number")
          .eq("is_callable", true)
          .eq("business_id", business_id)
          .limit(1);

        const targetUserId = operators?.[0]?.user_id || null;

        // Create escalation log
        const { data: escalation, error: escalationError } = await supabase
          .from("call_escalation_log")
          .insert({
            session_id,
            campaign_id,
            corridor_id: corridor?.id,
            trigger_type,
            trigger_details,
            confidence_at_escalation: current_confidence,
            transcript_snippet,
            escalated_to_user_id: targetUserId,
            escalation_status: 'pending'
          })
          .select()
          .single();

        if (escalationError) throw escalationError;

        // Update session
        await supabase
          .from("ai_call_sessions")
          .update({
            escalated: true,
            escalation_reason: trigger_type,
            handoff_state: 'handoff_pending'
          })
          .eq("id", session_id);

        // Log to audit
        await supabase.from("ai_audit_events").insert({
          business_id: business_id || '00000000-0000-0000-0000-000000000000',
          session_id,
          event_type: 'escalation_triggered',
          event_severity: 'high',
          event_payload: {
            trigger_type,
            trigger_details,
            confidence: current_confidence,
            target_user: targetUserId
          },
          triggered_by: 'system'
        });

        return new Response(
          JSON.stringify({
            success: true,
            escalation_id: escalation.id,
            escalated_to: targetUserId,
            status: 'pending',
            ai_must_stop: true,
            message: "Escalation triggered - AI must stop speaking immediately"
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'accept_escalation': {
        const { escalation_id } = body;

        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: "Authentication required" }),
            { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        await supabase
          .from("call_escalation_log")
          .update({
            escalation_status: 'accepted',
            escalated_to_user_id: userId,
            human_response_at: new Date().toISOString(),
            call_bridged: true
          })
          .eq("id", escalation_id);

        // Update session to human active
        const { data: escalation } = await supabase
          .from("call_escalation_log")
          .select("session_id")
          .eq("id", escalation_id)
          .single();

        if (escalation) {
          await supabase
            .from("ai_call_sessions")
            .update({ handoff_state: 'human_active' })
            .eq("id", escalation.session_id);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Escalation accepted - call bridged to human",
            status: 'accepted'
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'decline_escalation': {
        const { escalation_id, schedule_callback, callback_time } = body;

        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: "Authentication required" }),
            { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        await supabase
          .from("call_escalation_log")
          .update({
            escalation_status: 'declined',
            human_response_at: new Date().toISOString(),
            followup_scheduled: schedule_callback || false
          })
          .eq("id", escalation_id);

        // If callback scheduled, create follow-up task
        if (schedule_callback && callback_time) {
          const { data: escalation } = await supabase
            .from("call_escalation_log")
            .select("session_id, campaign_id")
            .eq("id", escalation_id)
            .single();

          // Would create callback task here
          console.log("Callback scheduled for:", callback_time);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Escalation declined",
            callback_scheduled: schedule_callback,
            status: 'declined'
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'get_pending': {
        // Get pending escalations for a business
        const { data: pending } = await supabase
          .from("call_escalation_log")
          .select(`
            *,
            ai_call_sessions (
              id,
              status,
              campaign_id
            )
          `)
          .eq("escalation_status", "pending")
          .order("created_at", { ascending: false })
          .limit(10);

        return new Response(
          JSON.stringify({ success: true, pending_escalations: pending || [] }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: "Invalid action" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    }

  } catch (error: any) {
    console.error("❌ Error in escalation-handler:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
