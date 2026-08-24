import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * TEST RING EDGE FUNCTION
 * 
 * Performs a REAL end-to-end test of inbound call routing.
 * This is not a dry run - the phone will actually ring.
 * 
 * Steps:
 * 1. Resolve business
 * 2. Resolve phone number
 * 3. Match inbound route
 * 4. Resolve target role/user
 * 5. Filter callable users
 * 6. Select target user
 * 7. Place real Twilio call
 * 8. Log as test_call = true
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Role priority for routing
const ROLE_PRIORITY: Record<string, number> = {
  owner: 100,
  admin: 90,
  va: 85,
  employee: 70,
  staff: 60,
  csr: 50,
  ambassador: 40,
};

interface TestRingRequest {
  routeId?: string;
  businessId?: string;
  phoneNumberId?: string;
  userId?: string;
  timeSimulation?: "business_hours" | "after_hours"; // Time simulation mode
}

interface TestRingStep {
  step: string;
  status: "success" | "failure" | "skipped";
  details: string;
  data?: Record<string, any>;
}

interface TestRingResult {
  success: boolean;
  steps: TestRingStep[];
  summary: {
    businessName?: string;
    inboundNumber?: string;
    routeType?: string;
    routeTarget?: string;
    callableUsersCount?: number;
    totalUsersCount?: number;
    targetUserName?: string;
    targetPhone?: string;
    twilioCallSid?: string;
    failurePoint?: string;
    failureReason?: string;
    suggestedFix?: string;
    // Time awareness
    timezone?: string;
    localTime?: string;
    isOpen?: boolean;
    timeSimulation?: string;
    afterHoursRoute?: string;
  };
  callLogId?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("🧪 Test Ring request received");

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user and permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("primary_role")
      .eq("user_id", user.id)
      .single();

    const allowedRoles = ["owner", "admin", "va"];
    if (!profile || !allowedRoles.includes(profile.primary_role)) {
      return new Response(
        JSON.stringify({ error: "Permission denied. Only Owners and Admins can run Test Ring." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: TestRingRequest = await req.json();
    const { routeId, businessId, phoneNumberId, userId, timeSimulation } = body;

    const result: TestRingResult = {
      success: false,
      steps: [],
      summary: {},
    };

    // Track if we're in time simulation mode
    if (timeSimulation) {
      result.summary.timeSimulation = timeSimulation;
      result.steps.push({
        step: "Time Simulation",
        status: "success",
        details: `Testing ${timeSimulation === "after_hours" ? "AFTER-HOURS" : "BUSINESS HOURS"} routing`,
      });
    }

    // =========================================
    // STEP 1: Resolve Business
    // =========================================
    let resolvedBusinessId: string | null = businessId || null;
    let businessName = "Unknown Business";
    let inboundNumber = "";
    let inboundPhoneNumberId: string | null = phoneNumberId || null;

    if (routeId) {
      // Get route to extract business
      const { data: route, error: routeError } = await supabase
        .from("inbound_call_routes")
        .select(`
          *,
          businesses(id, name),
          business_phone_numbers(id, phone_number, label)
        `)
        .eq("id", routeId)
        .single();

      if (routeError || !route) {
        result.steps.push({
          step: "Resolve Route",
          status: "failure",
          details: `Route not found: ${routeId}`,
        });
        result.summary.failurePoint = "Route Resolution";
        result.summary.failureReason = "The specified route does not exist";
        result.summary.suggestedFix = "Verify the route ID or create a new route";
        return jsonResponse(result);
      }

      resolvedBusinessId = route.business_id;
      businessName = (route.businesses as any)?.name || "Unknown";
      inboundNumber = (route.business_phone_numbers as any)?.phone_number || "";
      inboundPhoneNumberId = route.phone_number_id;

      result.steps.push({
        step: "Resolve Route",
        status: "success",
        details: `Route found: ${route.route_type} → ${route.route_target_role || route.route_target_user_id || 'voicemail'}`,
        data: { routeId: route.id, routeType: route.route_type },
      });
    }

    // Resolve business with timezone and hours data
    let businessTimezone: string | null = null;
    let businessHours: Record<string, any> | null = null;
    let afterHoursRouteType: string | null = null;
    let afterHoursRouteUserId: string | null = null;
    let afterHoursRouteRole: string | null = null;
    let afterHoursMessage: string | null = null;

    if (resolvedBusinessId) {
      const { data: business } = await supabase
        .from("businesses")
        .select("id, name, timezone, business_hours, after_hours_route_type, after_hours_route_user_id, after_hours_route_role, after_hours_message")
        .eq("id", resolvedBusinessId)
        .single();

      if (business) {
        businessName = business.name;
        businessTimezone = business.timezone;
        businessHours = business.business_hours;
        afterHoursRouteType = business.after_hours_route_type;
        afterHoursRouteUserId = business.after_hours_route_user_id;
        afterHoursRouteRole = business.after_hours_route_role;
        afterHoursMessage = business.after_hours_message;
        
        if (!routeId) {
          result.steps.push({
            step: "Resolve Business",
            status: "success",
            details: `Business: ${businessName}`,
          });
        }
      }
    }

    result.summary.businessName = businessName;

    // =========================================
    // STEP 1.5: Check Business Hours
    // =========================================
    let isOpen = true; // Default to open
    let localTime = "";
    let dayOfWeek = "";

    if (businessTimezone && businessHours) {
      // If time simulation is set, override the real check
      if (timeSimulation === "after_hours") {
        isOpen = false;
        localTime = "22:00 (simulated)";
        dayOfWeek = "simulated";
      } else if (timeSimulation === "business_hours") {
        isOpen = true;
        localTime = "10:00 (simulated)";
        dayOfWeek = "simulated";
      } else {
        const hoursCheck = checkBusinessHours(businessTimezone, businessHours);
        isOpen = hoursCheck.isOpen;
        localTime = hoursCheck.localTime;
        dayOfWeek = hoursCheck.dayName;
      }
      
      result.summary.timezone = businessTimezone;
      result.summary.localTime = localTime;
      result.summary.isOpen = isOpen;
      
      result.steps.push({
        step: "Check Business Hours",
        status: isOpen ? "success" : "failure",
        details: `${dayOfWeek} ${localTime} - ${isOpen ? "OPEN" : "CLOSED"}`,
        data: { timezone: businessTimezone, isOpen },
      });

      // Handle after-hours routing
      if (!isOpen) {
        if (afterHoursRouteType) {
          result.summary.afterHoursRoute = afterHoursRouteType;
          result.steps.push({
            step: "After-Hours Route",
            status: "success",
            details: `After-hours configured: ${afterHoursRouteType}`,
          });

          // For voicemail/kiosk/message, test ends here (no user to ring)
          if (["voicemail", "kiosk", "message"].includes(afterHoursRouteType)) {
            result.success = true;
            result.steps.push({
              step: "After-Hours Action",
              status: "success",
              details: `Call would go to ${afterHoursRouteType} during after-hours`,
            });
            result.summary.routeType = afterHoursRouteType;
            return jsonResponse(result);
          }
        } else {
          result.steps.push({
            step: "After-Hours Route",
            status: "failure",
            details: "No after-hours routing configured",
          });
          result.summary.failurePoint = "After-Hours Configuration";
          result.summary.failureReason = "Business is closed and no after-hours routing is configured";
          result.summary.suggestedFix = "Configure after-hours routing in Business Hours settings";
          return jsonResponse(result);
        }
      }
    } else {
      result.steps.push({
        step: "Check Business Hours",
        status: "skipped",
        details: "No business hours configured - assuming OPEN",
      });
    }

    // =========================================
    // STEP 2: Resolve Phone Number
    // =========================================
    if (inboundPhoneNumberId) {
      const { data: phoneNum } = await supabase
        .from("business_phone_numbers")
        .select("id, phone_number, label")
        .eq("id", inboundPhoneNumberId)
        .single();

      if (phoneNum) {
        inboundNumber = phoneNum.phone_number;
        result.steps.push({
          step: "Resolve Phone Number",
          status: "success",
          details: `Inbound: ${inboundNumber} ${phoneNum.label ? `(${phoneNum.label})` : ''}`,
        });
      }
    } else if (resolvedBusinessId) {
      // Get default business phone
      const { data: defaultPhone } = await supabase
        .from("business_phone_numbers")
        .select("id, phone_number, label")
        .eq("business_id", resolvedBusinessId)
        .eq("is_active", true)
        .in("type", ["call", "both"])
        .eq("is_default", true)
        .limit(1)
        .single();

      if (defaultPhone) {
        inboundNumber = defaultPhone.phone_number;
        inboundPhoneNumberId = defaultPhone.id;
        result.steps.push({
          step: "Resolve Phone Number",
          status: "success",
          details: `Default: ${inboundNumber}`,
        });
      }
    }

    result.summary.inboundNumber = inboundNumber || "None";

    // =========================================
    // STEP 3: Match Inbound Route
    // =========================================
    let matchedRoute: any = null;

    if (routeId) {
      const { data: route } = await supabase
        .from("inbound_call_routes")
        .select("*")
        .eq("id", routeId)
        .single();
      matchedRoute = route;
    } else if (resolvedBusinessId) {
      // Try phone-specific first
      if (inboundPhoneNumberId) {
        const { data: phoneRoute } = await supabase
          .from("inbound_call_routes")
          .select("*")
          .eq("phone_number_id", inboundPhoneNumberId)
          .eq("is_active", true)
          .limit(1)
          .single();
        
        if (phoneRoute) {
          matchedRoute = phoneRoute;
        }
      }

      // Try business default
      if (!matchedRoute) {
        const { data: defaultRoute } = await supabase
          .from("inbound_call_routes")
          .select("*")
          .eq("business_id", resolvedBusinessId)
          .eq("is_default", true)
          .eq("is_active", true)
          .limit(1)
          .single();
        
        if (defaultRoute) {
          matchedRoute = defaultRoute;
        }
      }
    }

    if (!matchedRoute && !userId) {
      result.steps.push({
        step: "Match Inbound Route",
        status: "failure",
        details: "No inbound route found for this business/phone",
      });
      result.summary.failurePoint = "Route Matching";
      result.summary.failureReason = "No inbound route configured";
      result.summary.suggestedFix = "Create an inbound route for this business or phone number";
      return jsonResponse(result);
    }

    if (matchedRoute) {
      result.steps.push({
        step: "Match Inbound Route",
        status: "success",
        details: `Route type: ${matchedRoute.route_type}`,
        data: { routeId: matchedRoute.id },
      });
      result.summary.routeType = matchedRoute.route_type;
    }

    // =========================================
    // STEP 4: Resolve Target
    // =========================================
    let targetUserId: string | null = userId || null;
    let targetPhone: string | null = null;
    let targetUserName: string | null = null;
    let callableCount = 0;
    let totalCount = 0;

    if (userId) {
      // Direct user test
      const { data: userProfile } = await supabase
        .from("user_profiles")
        .select("user_id, full_name, phone, is_callable")
        .eq("user_id", userId)
        .single();

      if (!userProfile) {
        result.steps.push({
          step: "Resolve Target User",
          status: "failure",
          details: `User not found: ${userId}`,
        });
        result.summary.failurePoint = "User Resolution";
        result.summary.failureReason = "Target user does not exist";
        return jsonResponse(result);
      }

      targetUserName = userProfile.full_name;
      totalCount = 1;

      if (!userProfile.is_callable) {
        result.steps.push({
          step: "Resolve Target User",
          status: "failure",
          details: `User ${userProfile.full_name} is disabled for calling (is_callable=false)`,
        });
        result.summary.failurePoint = "Callable Check";
        result.summary.failureReason = `User ${userProfile.full_name} is disabled for calling`;
        result.summary.suggestedFix = "Enable calling for this user in User Call Settings";
        return jsonResponse(result);
      }

      if (!userProfile.phone) {
        result.steps.push({
          step: "Resolve Target User",
          status: "failure",
          details: `User ${userProfile.full_name} has no phone number`,
        });
        result.summary.failurePoint = "Phone Validation";
        result.summary.failureReason = `User ${userProfile.full_name} has no phone number configured`;
        result.summary.suggestedFix = "Add a valid E.164 phone number in User Call Settings";
        return jsonResponse(result);
      }

      targetPhone = normalizeToE164(userProfile.phone);
      if (!targetPhone) {
        result.steps.push({
          step: "Resolve Target User",
          status: "failure",
          details: `User ${userProfile.full_name} has invalid phone format: ${userProfile.phone}`,
        });
        result.summary.failurePoint = "Phone Validation";
        result.summary.failureReason = `Invalid phone format: ${userProfile.phone}`;
        result.summary.suggestedFix = "Update phone to valid E.164 format (e.g., +1XXXXXXXXXX)";
        return jsonResponse(result);
      }

      callableCount = 1;
      result.steps.push({
        step: "Resolve Target User",
        status: "success",
        details: `User: ${userProfile.full_name} (${targetPhone})`,
      });
    } else if (matchedRoute?.route_type === "user") {
      // Route to specific user
      const { data: userProfile } = await supabase
        .from("user_profiles")
        .select("user_id, full_name, phone, is_callable")
        .eq("user_id", matchedRoute.route_target_user_id)
        .single();

      if (!userProfile) {
        result.steps.push({
          step: "Resolve Target User",
          status: "failure",
          details: `User not found: ${matchedRoute.route_target_user_id}`,
        });
        result.summary.failurePoint = "User Resolution";
        result.summary.failureReason = "Configured target user does not exist";
        result.summary.suggestedFix = "Update the route to a valid user or select a different route type";
        return jsonResponse(result);
      }

      targetUserId = userProfile.user_id;
      targetUserName = userProfile.full_name;
      totalCount = 1;
      result.summary.routeTarget = userProfile.full_name || "Unknown User";

      if (!userProfile.is_callable) {
        result.steps.push({
          step: "Check Callable Status",
          status: "failure",
          details: `User ${userProfile.full_name} is disabled for calling`,
        });
        result.summary.failurePoint = "Callable Check";
        result.summary.failureReason = `User ${userProfile.full_name} has is_callable=false`;
        result.summary.suggestedFix = "Enable calling for this user in User Call Settings";
        return jsonResponse(result);
      }

      if (!userProfile.phone) {
        result.steps.push({
          step: "Check Phone Number",
          status: "failure",
          details: `User ${userProfile.full_name} has no phone number`,
        });
        result.summary.failurePoint = "Phone Validation";
        result.summary.failureReason = `User ${userProfile.full_name} has no phone number`;
        result.summary.suggestedFix = "Add a phone number for this user in User Call Settings";
        return jsonResponse(result);
      }

      targetPhone = normalizeToE164(userProfile.phone);
      if (!targetPhone) {
        result.steps.push({
          step: "Validate Phone Format",
          status: "failure",
          details: `Invalid phone format: ${userProfile.phone}`,
        });
        result.summary.failurePoint = "Phone Validation";
        result.summary.failureReason = `Phone ${userProfile.phone} is not valid E.164`;
        result.summary.suggestedFix = "Update phone to E.164 format (e.g., +1XXXXXXXXXX)";
        return jsonResponse(result);
      }

      callableCount = 1;
      result.steps.push({
        step: "Resolve Target User",
        status: "success",
        details: `User: ${userProfile.full_name} (${targetPhone})`,
      });

    } else if (matchedRoute?.route_type === "role") {
      // Route to role
      const targetRole = matchedRoute.route_target_role;
      result.summary.routeTarget = `Role: ${targetRole}`;

      // Get all users with this role
      const { data: allRoleUsers } = await supabase
        .from("user_profiles")
        .select("user_id, full_name, phone, is_callable")
        .eq("primary_role", targetRole);

      totalCount = allRoleUsers?.length || 0;

      // Get callable users with valid phones
      const { data: callableUsers } = await supabase
        .from("user_profiles")
        .select("user_id, full_name, phone, is_callable")
        .eq("primary_role", targetRole)
        .eq("is_callable", true)
        .not("phone", "is", null);

      callableCount = callableUsers?.filter(u => {
        const normalized = normalizeToE164(u.phone);
        return !!normalized;
      }).length || 0;

      result.steps.push({
        step: "Filter Callable Users",
        status: callableCount > 0 ? "success" : "failure",
        details: `Role ${targetRole}: ${callableCount}/${totalCount} callable`,
        data: { role: targetRole, callable: callableCount, total: totalCount },
      });

      if (callableCount === 0) {
        result.summary.failurePoint = "Callable User Resolution";
        result.summary.failureReason = `0 callable users found for role='${targetRole}' (${totalCount} total)`;
        result.summary.suggestedFix = `Add phone numbers and enable calling for at least one ${targetRole} user`;
        return jsonResponse(result);
      }

      // Select first callable user
      for (const u of (callableUsers || [])) {
        const normalized = normalizeToE164(u.phone);
        if (normalized) {
          targetUserId = u.user_id;
          targetUserName = u.full_name;
          targetPhone = normalized;
          break;
        }
      }

      result.steps.push({
        step: "Select Target User",
        status: "success",
        details: `Selected: ${targetUserName} (${targetPhone})`,
      });

    } else if (matchedRoute?.route_type === "voicemail") {
      result.steps.push({
        step: "Resolve Target",
        status: "skipped",
        details: "Route configured for voicemail - no user to ring",
      });
      result.summary.routeTarget = "Voicemail";
      result.summary.failurePoint = "Voicemail Route";
      result.summary.failureReason = "This route is configured for voicemail, not user ringing";
      result.summary.suggestedFix = "Change route type to 'User' or 'Role' to test ringing";
      return jsonResponse(result);
    }

    result.summary.callableUsersCount = callableCount;
    result.summary.totalUsersCount = totalCount;
    result.summary.targetUserName = targetUserName || undefined;
    result.summary.targetPhone = targetPhone || undefined;

    // =========================================
    // STEP 5: Place Real Twilio Call
    // =========================================
    if (!targetPhone) {
      result.summary.failurePoint = "No Target";
      result.summary.failureReason = "Could not determine a target phone number";
      return jsonResponse(result);
    }

    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!twilioAccountSid || !twilioAuthToken) {
      result.steps.push({
        step: "Initialize Twilio",
        status: "failure",
        details: "Twilio credentials not configured",
      });
      result.summary.failurePoint = "Twilio Configuration";
      result.summary.failureReason = "TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set";
      result.summary.suggestedFix = "Configure Twilio credentials in environment secrets";
      return jsonResponse(result);
    }

    // Get a caller ID from the business
    let fromNumber = inboundNumber;
    if (!fromNumber && resolvedBusinessId) {
      const { data: defaultPhone } = await supabase
        .from("business_phone_numbers")
        .select("phone_number")
        .eq("business_id", resolvedBusinessId)
        .eq("is_active", true)
        .in("type", ["call", "both"])
        .limit(1)
        .single();
      
      if (defaultPhone) {
        fromNumber = defaultPhone.phone_number;
      }
    }

    if (!fromNumber) {
      // Last resort: get any active business phone
      const { data: anyPhone } = await supabase
        .from("business_phone_numbers")
        .select("phone_number")
        .eq("is_active", true)
        .in("type", ["call", "both"])
        .limit(1)
        .single();
      
      if (anyPhone) {
        fromNumber = anyPhone.phone_number;
      }
    }

    if (!fromNumber) {
      result.steps.push({
        step: "Get Caller ID",
        status: "failure",
        details: "No caller ID available for test call",
      });
      result.summary.failurePoint = "Caller ID";
      result.summary.failureReason = "No business phone number available to place call";
      result.summary.suggestedFix = "Add at least one active phone number for the business";
      return jsonResponse(result);
    }

    result.steps.push({
      step: "Get Caller ID",
      status: "success",
      details: `From: ${fromNumber}`,
    });

    // Create call log entry first
    const { data: callLog, error: logError } = await supabase
      .from("manual_call_logs")
      .insert({
        business_id: resolvedBusinessId,
        caller_id: user.id,
        phone_number: targetPhone,
        direction: "outbound",
        status: "initiating",
        from_number: fromNumber,
        to_number: targetPhone,
        receiving_user_id: targetUserId,
        is_test_call: true,
        notes: `Test Ring: ${businessName} → ${targetUserName || 'Unknown'}`,
        test_ring_result: result,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) {
      console.error("Failed to create call log:", logError);
    }

    result.callLogId = callLog?.id;

    // Place Twilio call using REST API
    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-call-status`;
    const twimlContent = `<Response><Say voice="alice">This is a test ring from ${businessName}. Your phone is correctly configured to receive calls. Goodbye.</Say><Hangup/></Response>`;

    try {
      const callParams = new URLSearchParams({
        To: targetPhone,
        From: fromNumber,
        Twiml: twimlContent,
        StatusCallback: statusCallbackUrl,
        StatusCallbackMethod: "POST",
      });
      // Repeated params — a space-joined single value subscribes to nothing.
      for (const ev of ["initiated", "ringing", "answered", "completed"]) {
        callParams.append("StatusCallbackEvent", ev);
      }
      const twilioResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: callParams.toString(),
        }
      );

      if (!twilioResponse.ok) {
        const errorText = await twilioResponse.text();
        throw new Error(`Twilio API error: ${twilioResponse.status} - ${errorText}`);
      }

      const callData = await twilioResponse.json();
      const callSid = callData.sid;

      result.steps.push({
        step: "Place Twilio Call",
        status: "success",
        details: `Call SID: ${callSid}`,
        data: { callSid },
      });

      result.summary.twilioCallSid = callSid;
      result.success = true;

      // Update call log with Twilio SID
      if (callLog?.id) {
        await supabase
          .from("manual_call_logs")
          .update({ 
            status: "ringing",
            metadata: { twilio_call_sid: callSid },
            test_ring_result: result,
          })
          .eq("id", callLog.id);

        // Create call_recordings entry for status tracking
        await supabase
          .from("call_recordings")
          .insert({
            manual_call_id: callLog.id,
            provider: "twilio",
            provider_call_sid: callSid,
            business_id: resolvedBusinessId,
            started_at: new Date().toISOString(),
          });
      }

    } catch (twilioError: any) {
      console.error("Twilio call error:", twilioError);
      result.steps.push({
        step: "Place Twilio Call",
        status: "failure",
        details: `Twilio error: ${twilioError.message}`,
      });
      result.summary.failurePoint = "Twilio Call";
      result.summary.failureReason = twilioError.message;
      result.summary.suggestedFix = "Check Twilio account status and phone number configuration";

      // Update call log with failure
      if (callLog?.id) {
        await supabase
          .from("manual_call_logs")
          .update({ 
            status: "failed",
            outcome: "failed",
            notes: `Test Ring FAILED: ${twilioError.message}`,
            test_ring_result: result,
          })
          .eq("id", callLog.id);
      }

      return jsonResponse(result);
    }

    // =========================================
    // STEP 6: Log Test Result
    // =========================================
    result.steps.push({
      step: "Log Test Ring",
      status: "success",
      details: `Logged as test_call with ID: ${callLog?.id}`,
    });

    return jsonResponse(result);

  } catch (error: any) {
    console.error("Test Ring error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        steps: [],
        summary: {
          failurePoint: "System Error",
          failureReason: error.message,
        }
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function jsonResponse(result: TestRingResult): Response {
  return new Response(
    JSON.stringify(result),
    { 
      status: 200, 
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json" 
      } 
    }
  );
}

function normalizeToE164(phone: string | null): string | null {
  if (!phone) return null;
  
  const digits = phone.replace(/\D/g, "");
  
  // Already has country code
  if (phone.startsWith("+")) {
    if (digits.length >= 10) {
      return `+${digits}`;
    }
    return null;
  }
  
  // US/Canada: 10 digits -> +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // US/Canada with 1 prefix
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  
  // Philippines: 11 digits starting with 09 -> +63
  if (digits.length === 11 && digits.startsWith("09")) {
    return `+63${digits.slice(1)}`;
  }
  
  // Already looks like international (12+ digits)
  if (digits.length >= 12) {
    return `+${digits}`;
  }
  
  return null;
}

/**
 * Check if business is currently open based on timezone and hours config
 */
function checkBusinessHours(
  timezone: string,
  hoursConfig: Record<string, any>
): { isOpen: boolean; localTime: string; dayName: string } {
  try {
    // Get current time in business timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "long",
    });

    const parts = formatter.formatToParts(now);
    const hour = parts.find(p => p.type === "hour")?.value || "00";
    const minute = parts.find(p => p.type === "minute")?.value || "00";
    const weekday = parts.find(p => p.type === "weekday")?.value?.toLowerCase() || "monday";

    const currentTimeMinutes = parseInt(hour) * 60 + parseInt(minute);
    const localTime = `${hour}:${minute}`;

    // Get hours for current day
    const dayHours = hoursConfig[weekday];
    if (!dayHours || !dayHours.enabled) {
      return { isOpen: false, localTime, dayName: weekday };
    }

    // Parse open/close times
    const [openHour, openMinute] = (dayHours.open || "09:00").split(":").map(Number);
    const [closeHour, closeMinute] = (dayHours.close || "17:00").split(":").map(Number);

    const openMinutes = openHour * 60 + openMinute;
    const closeMinutes = closeHour * 60 + closeMinute;

    const isOpen = currentTimeMinutes >= openMinutes && currentTimeMinutes < closeMinutes;

    return { isOpen, localTime, dayName: weekday };
  } catch (error) {
    console.error("Error checking business hours:", error);
    // Default to open on error
    return { isOpen: true, localTime: "unknown", dayName: "unknown" };
  }
}
