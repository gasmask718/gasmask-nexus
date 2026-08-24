import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * OUTBOUND CALL SERVICE
 * 
 * This edge function initiates outbound calls via Twilio Voice API.
 * It can be called from any OS module by any authorized role.
 * 
 * Required permissions:
 * - owner, admin: Can call anyone
 * - employee, staff, csr: Can call assigned contacts
 * - ambassador: Can call their assigned stores
 * - driver: Can call their assigned routes
 * 
 * Flow:
 * 1. Validate user authorization
 * 2. Initiate call via Twilio
 * 3. Log call to database
 * 4. Return CallSid for tracking
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ErrorStage =
  | "cors"
  | "auth"
  | "role_lookup"
  | "permission"
  | "input"
  | "caller_id"
  | "log_create"
  | "twilio"
  | "audit"
  | "unknown";

function jsonError(
  status: number,
  error: string,
  stage: ErrorStage,
  details?: unknown,
): Response {
  return new Response(
    JSON.stringify({ success: false, error, stage, details }),
    { status, headers: { "Content-Type": "application/json", ...corsHeaders } },
  );
}

function getTwilioAuthHeader(): string {
  const apiKeySid = Deno.env.get("TWILIO_API_SID");
  const apiKeySecret = Deno.env.get("TWILIO_API_KEY");
  if (apiKeySid && apiKeySecret) {
    return `Basic ${btoa(`${apiKeySid}:${apiKeySecret}`)}`;
  }

  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (accountSid && authToken) {
    return `Basic ${btoa(`${accountSid}:${authToken}`)}`;
  }

  throw new Error(
    "Missing Twilio credentials. Set (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN) or (TWILIO_API_SID + TWILIO_API_KEY).",
  );
}

// Roles that can place outbound calls
const ALLOWED_ROLES = [
  "owner",
  "admin", 
  "va",
  "employee",
  "staff",
  "csr",
  "ambassador",
  "driver",
  "accountant",
  "biker",
  "production",
];

interface PlaceCallRequest {
  destination_phone: string;
  entity_type?: "store" | "customer" | "wholesaler" | "driver" | "other";
  entity_id?: string;
  entity_name?: string;
  business_id?: string;
  notes?: string;
  agent_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("📞 Outbound call request received");

  try {
    // Get Twilio credentials
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER"); // Fallback

    // We still need the real Account SID for the Twilio REST URL.
    if (!TWILIO_ACCOUNT_SID) {
      return jsonError(
        500,
        "Twilio is not configured: TWILIO_ACCOUNT_SID is missing.",
        "twilio",
      );
    }
    if (!TWILIO_ACCOUNT_SID.startsWith("AC")) {
      return jsonError(
        500,
        "Twilio is misconfigured: TWILIO_ACCOUNT_SID must start with 'AC'.",
        "twilio",
        { provided_prefix: TWILIO_ACCOUNT_SID.slice(0, 2) },
      );
    }

    let twilioAuthHeader: string;
    try {
      twilioAuthHeader = getTwilioAuthHeader();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return jsonError(500, msg, "twilio");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token from request
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return jsonError(401, "Unauthorized - no token provided", "auth");
    }

    // Verify user and get their role
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("❌ Auth error:", authError);
      return jsonError(401, "Unauthorized - invalid token", "auth", authError);
    }

    // Get user profile - try profiles table first
    let userRole = null;
    let userName = "User";
    
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, phone, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) {
      userRole = profile.role;
      userName = profile.name || "User";
      console.log(`✅ Found profile for user: ${userName}, role: ${userRole}`);
    } else {
      console.log("⚠️ No profile found, checking user_roles table");
    }

    // If no role from profiles, check user_roles table
    if (!userRole) {
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      
      if (roleData) {
        userRole = roleData.role;
        console.log(`✅ Found role from user_roles: ${userRole}`);
      } else {
        console.error("❌ No role found for user:", user.id, roleError);
        return jsonError(
          403,
          "User role not found. Please contact administrator.",
          "role_lookup",
          roleError,
        );
      }
    }

    // Check role permission
    if (!ALLOWED_ROLES.includes(userRole)) {
      console.error(`❌ Permission denied for role: ${userRole}`);
      
      // Log permission denial
      await supabase.from("admin_audit_log").insert({
        actor_user_id: user.id,
        action: "call_permission_denied",
        target_type: "outbound_call",
        reason: `Role ${userRole} is not authorized to place outbound calls`,
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Permission denied - your role cannot place outbound calls" 
        }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const profile_name = userName;

    // Parse request body
    const body: PlaceCallRequest = await req.json();
    const { 
      destination_phone, 
      entity_type, 
      entity_id, 
      entity_name,
      business_id,
      notes,
      agent_id,
    } = body;

    if (!destination_phone) {
      return jsonError(400, "Missing destination_phone", "input");
    }

    // Format phone number
    let formattedPhone = destination_phone.replace(/\D/g, "");
    if (formattedPhone.startsWith("09") && formattedPhone.length === 11) {
      formattedPhone = `+63${formattedPhone.substring(1)}`;
    } else if (formattedPhone.startsWith("63") && formattedPhone.length === 12) {
      formattedPhone = `+${formattedPhone}`;
    } else if (formattedPhone.length === 10) {
      formattedPhone = `+1${formattedPhone}`;
    } else if (formattedPhone.length >= 11 && !formattedPhone.startsWith("+")) {
      formattedPhone = `+${formattedPhone}`;
    }

    console.log(`📞 Initiating call from ${profile_name} to ${formattedPhone}`);

    // Get the status callback URL
    const projectId = supabaseUrl.replace("https://", "").split(".")[0];
    const statusCallbackUrl = `https://${projectId}.supabase.co/functions/v1/twilio-call-status`;

    // Get business-specific caller ID if business_id provided
    let callerIdNumber = TWILIO_PHONE_NUMBER;
    if (business_id) {
      const { data: businessPhone } = await supabase
        .from("business_phone_numbers")
        .select("phone_number")
        .eq("business_id", business_id)
        .eq("is_active", true)
        .in("type", ["call", "both"])
        .order("is_default", { ascending: false })
        .limit(1)
        .single();
      
      if (businessPhone?.phone_number) {
        callerIdNumber = businessPhone.phone_number;
        console.log(`📞 Using business caller ID: ${callerIdNumber}`);
      }
    }

    if (!callerIdNumber) {
      return jsonError(
        500,
        "No caller ID available (configure a call-capable business phone number, or set TWILIO_PHONE_NUMBER).",
        "caller_id",
      );
    }

    // 1. Create the call log FIRST (so we have the ID for tracking)
    const callLogData = {
      phone_number: formattedPhone,
      direction: "outbound",
      status: "initiated",
      caller_id: user.id,
      started_at: new Date().toISOString(),
      notes: notes || `Outbound call to ${entity_name || formattedPhone}`,
      business_id: business_id || null,
      store_id: entity_type === "store" ? entity_id : null,
      contact_id: entity_type !== "store" ? entity_id : null,
      from_number: callerIdNumber,
      to_number: formattedPhone,
      related_entity_type: entity_type || null,
      related_entity_id: entity_id || null,
    };

    const { data: callLog, error: logError } = await supabase
      .from("manual_call_logs")
      .insert(callLogData)
      .select()
      .single();

    if (logError) {
      console.error("❌ Failed to create call log:", logError);
      // We still attempt the Twilio call, but we return structured visibility.
    }

    // 2. Build TwiML URL for connecting the call
    let twimlUrl: string;
    if (agent_id) {
      // Route through the clean bridge webhook: TTS greeting → pause → ElevenLabs Stream
      twimlUrl = `https://${projectId}.supabase.co/functions/v1/twilio-bridge?agent_id=${encodeURIComponent(agent_id)}`;
      console.log(`🤖 AI Agent mode: routing call to twilio-bridge (agent=${agent_id})`);
    } else {
      twimlUrl = buildTwimlUrl(formattedPhone, statusCallbackUrl, callerIdNumber);
    }

    // 3. Initiate call via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;

    const callParams = new URLSearchParams();
    callParams.append("To", formattedPhone);
    callParams.append("From", callerIdNumber);
    callParams.append("Url", twimlUrl);
    callParams.append("StatusCallback", statusCallbackUrl);
    // Repeated params — a space-joined single value subscribes to nothing.
    for (const ev of ["initiated", "ringing", "answered", "completed"]) {
      callParams.append("StatusCallbackEvent", ev);
    }
    callParams.append("StatusCallbackMethod", "POST");
    callParams.append("Record", "true"); // Enable recording
    callParams.append("Timeout", "30");

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: twilioAuthHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: callParams,
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("❌ Twilio error:", twilioData);
      
      // Update call log with failure
      if (callLog) {
        await supabase
          .from("manual_call_logs")
          .update({
            status: "failed",
            outcome: "failed",
            notes: `${notes || ""}\nError: ${twilioData.message || "Unknown error"}`,
            ended_at: new Date().toISOString(),
          })
          .eq("id", callLog.id);
      }

      return jsonError(
        twilioResponse.status || 502,
        twilioData?.message || "Failed to initiate call",
        "twilio",
        twilioData,
      );
    }

    console.log(`✅ Call initiated: SID=${twilioData.sid}, Status=${twilioData.status}`);

    // 4. Create call_recordings entry for status tracking
    const { error: recordingError } = await supabase
      .from("call_recordings")
      .insert({
        manual_call_id: callLog?.id,
        provider: "twilio",
        provider_call_sid: twilioData.sid,
        business_id: business_id || null,
        store_id: entity_type === "store" ? entity_id : null,
        started_at: new Date().toISOString(),
      });

    if (recordingError) {
      console.error("❌ Failed to create call recording entry:", recordingError);
    }

    // 5. Log to audit
    await supabase.from("admin_audit_log").insert({
      actor_user_id: user.id,
      action: "outbound_call_initiated",
      target_type: entity_type || "phone",
      target_id: entity_id || null,
      after: {
        call_sid: twilioData.sid,
        destination: formattedPhone,
        entity_name: entity_name,
      },
    });

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        call_sid: twilioData.sid,
        call_status: twilioData.status,
        call_log_id: callLog?.id,
        from: TWILIO_PHONE_NUMBER,
        to: formattedPhone,
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error("❌ Error in place-outbound-call:", error);
    return jsonError(500, error?.message || "Unknown error", "unknown", error);
  }
};

// Build a simple TwiML URL that will connect the call
function buildTwimlUrl(destinationPhone: string, statusCallback: string, callerId: string): string {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting your call now.</Say>
  <Dial callerId="${callerId}">
    <Number statusCallbackEvent="initiated ringing answered completed" statusCallback="${statusCallback}">${destinationPhone}</Number>
  </Dial>
</Response>`;
  
  return `http://twimlets.com/echo?Twiml=${encodeURIComponent(twiml)}`;
}

serve(handler);
