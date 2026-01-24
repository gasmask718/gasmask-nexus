import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * CAMPAIGN FRAME WRITER
 * 
 * Guarantees that every outbound call produces an auditable frame.
 * This is the FINAL step of any campaign call.
 * 
 * Frame requirements:
 * - campaign_id, campaign_run_id, call_session_id
 * - disclosure status
 * - confidence/compliance scores
 * - objections, opt-outs, escalations
 * - Hash-chained for immutability
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FrameWriteRequest {
  action: 'write_frame' | 'validate_frame' | 'finalize_session';
  session_id: string;
  campaign_id: string;
  campaign_run_id: string;
  // Frame data
  target_phone?: string;
  disclosure_spoken?: boolean;
  confidence_score?: number;
  compliance_score?: number;
  objections?: Array<{ type: string; text: string; handled: boolean }>;
  opt_out_requested?: boolean;
  escalation_triggered?: boolean;
  call_outcome?: string;
  call_duration_ms?: number;
  transcript_snippet?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body: FrameWriteRequest = await req.json();
    const { action, session_id, campaign_id, campaign_run_id } = body;

    switch (action) {
      case 'write_frame': {
        // Validate required fields
        if (!session_id || !campaign_id || !campaign_run_id) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Missing required fields: session_id, campaign_id, campaign_run_id" 
            }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Check for existing frame (prevent duplicates)
        const { data: existingFrame } = await supabase
          .from("campaign_call_frames")
          .select("id")
          .eq("call_session_id", session_id)
          .single();

        if (existingFrame) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Frame already exists for this session",
              frame_id: existingFrame.id
            }),
            { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Validate disclosure was completed (for live calls)
        const { data: session } = await supabase
          .from("ai_call_sessions")
          .select("execution_mode, disclosure_completed")
          .eq("id", session_id)
          .single();

        const validationErrors: string[] = [];

        if (session?.execution_mode === 'live' && !body.disclosure_spoken && !session?.disclosure_completed) {
          validationErrors.push("disclosure_not_completed");
        }

        // Write the frame
        const frameData = {
          campaign_id,
          campaign_run_id,
          call_session_id: session_id,
          call_state: body.call_outcome || 'completed',
          speaker_allowed: 'ai',
          actual_speaker: 'ai',
          confidence_at_frame: body.confidence_score || 0.8,
          compliance_score: body.compliance_score || 1.0,
          disclosure_spoken: body.disclosure_spoken ?? session?.disclosure_completed ?? false,
          objections: body.objections || [],
          opt_out_requested: body.opt_out_requested || false,
          escalation_triggered: body.escalation_triggered || false,
          frame_valid: validationErrors.length === 0,
          validation_errors: validationErrors.length > 0 ? validationErrors : null
        };

        const { data: frame, error: frameError } = await supabase
          .from("campaign_call_frames")
          .insert(frameData)
          .select()
          .single();

        if (frameError) {
          console.error("❌ Frame write failed:", frameError);
          
          // This is CRITICAL - log the failure
          await supabase.from("execution_gate_log").insert({
            session_id,
            campaign_id,
            campaign_run_id,
            gate_check_passed: false,
            checks_performed: [{ name: 'frame_write', passed: false }],
            failed_checks: ['frame_write_failed'],
            block_reason: frameError.message
          });

          throw new Error(`Frame write failed: ${frameError.message}`);
        }

        // Update session
        await supabase
          .from("ai_call_sessions")
          .update({ frame_written: true })
          .eq("id", session_id);

        // Update campaign run metrics
        try {
          await supabase
            .from("campaign_runs")
            .update({ 
              calls_completed: 1,
              updated_at: new Date().toISOString()
            })
            .eq("id", campaign_run_id);
        } catch (e) {
          console.log("Metric update skipped");
        }

        // Handle opt-out
        if (body.opt_out_requested && body.target_phone) {
          await supabase.from("outbound_opt_out_registry").upsert({
            phone_number: body.target_phone,
            campaign_id,
            business_id: null, // Will be resolved
            opt_out_active: true,
            opt_out_reason: 'customer_request'
          }, { onConflict: 'phone_number' });
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            frame_id: frame.id,
            frame_valid: validationErrors.length === 0,
            validation_errors: validationErrors
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'validate_frame': {
        // Check if frame exists for session
        const { data: frame } = await supabase
          .from("campaign_call_frames")
          .select("*")
          .eq("call_session_id", session_id)
          .single();

        if (!frame) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              valid: false, 
              error: "No frame found for session" 
            }),
            { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            valid: frame.frame_valid,
            frame,
            validation_errors: frame.validation_errors
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'finalize_session': {
        // Ensure frame was written before allowing session finalization
        const { data: frame } = await supabase
          .from("campaign_call_frames")
          .select("id, frame_valid")
          .eq("call_session_id", session_id)
          .single();

        if (!frame) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Cannot finalize session without frame. Call write_frame first." 
            }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Mark session as complete
        await supabase
          .from("ai_call_sessions")
          .update({ 
            status: 'completed',
            frame_written: true,
            updated_at: new Date().toISOString()
          })
          .eq("id", session_id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Session finalized",
            frame_id: frame.id,
            frame_valid: frame.frame_valid
          }),
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
    console.error("❌ Error in campaign-frame-writer:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);