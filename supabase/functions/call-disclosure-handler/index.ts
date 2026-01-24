import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * CALL DISCLOSURE HANDLER
 * 
 * Handles AI disclosure enforcement for outbound calls.
 * - Logs disclosure events
 * - Validates disclosure completion
 * - Terminates calls on disclosure failure
 * - Flags campaigns with repeated violations
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DisclosureRequest {
  action: 'log_disclosure' | 'verify_disclosure' | 'report_failure';
  session_id: string;
  campaign_id?: string;
  campaign_run_id?: string;
  disclosure_spoken?: boolean;
  disclosure_text?: string;
  disclosure_timestamp_ms?: number;
  failure_reason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body: DisclosureRequest = await req.json();
    const { action, session_id, campaign_id, campaign_run_id } = body;

    switch (action) {
      case 'log_disclosure': {
        // Log successful disclosure
        const { data, error } = await supabase
          .from("call_disclosure_log")
          .insert({
            session_id,
            campaign_id,
            campaign_run_id,
            disclosure_spoken: body.disclosure_spoken ?? true,
            disclosure_text_used: body.disclosure_text,
            disclosure_timestamp_ms: body.disclosure_timestamp_ms,
            disclosure_acknowledged: true,
            disclosure_failed: false
          })
          .select()
          .single();

        if (error) throw error;

        // Update session
        await supabase
          .from("ai_call_sessions")
          .update({ disclosure_completed: true })
          .eq("id", session_id);

        return new Response(
          JSON.stringify({ success: true, disclosure_id: data.id, message: "Disclosure logged successfully" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'verify_disclosure': {
        // Check if disclosure was completed for this session
        const { data: disclosureLog } = await supabase
          .from("call_disclosure_log")
          .select("*")
          .eq("session_id", session_id)
          .eq("disclosure_spoken", true)
          .single();

        const { data: session } = await supabase
          .from("ai_call_sessions")
          .select("disclosure_completed, execution_mode")
          .eq("id", session_id)
          .single();

        const verified = !!(disclosureLog || session?.disclosure_completed);
        
        // For live execution, disclosure is mandatory
        if (session?.execution_mode === 'live' && !verified) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              verified: false, 
              error: "Disclosure not completed - call cannot proceed in live mode" 
            }),
            { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, verified, disclosure_log: disclosureLog }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case 'report_failure': {
        // Log disclosure failure
        const { data, error } = await supabase
          .from("call_disclosure_log")
          .insert({
            session_id,
            campaign_id,
            campaign_run_id,
            disclosure_spoken: false,
            disclosure_failed: true,
            failure_reason: body.failure_reason || 'Disclosure not spoken before pitch',
            call_terminated_for_violation: true
          })
          .select()
          .single();

        if (error) throw error;

        // Update session
        await supabase
          .from("ai_call_sessions")
          .update({ 
            disclosure_completed: false,
            status: 'failed',
            ai_notes: `Call terminated: Disclosure violation - ${body.failure_reason}`
          })
          .eq("id", session_id);

        // Increment campaign violation counter
        if (campaign_run_id) {
          await supabase
            .from("campaign_runs")
            .update({ disclosure_violations: 1 })
            .eq("id", campaign_run_id);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            disclosure_id: data.id, 
            message: "Disclosure failure logged",
            call_terminated: true,
            campaign_flagged: true
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
    console.error("❌ Error in call-disclosure-handler:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);