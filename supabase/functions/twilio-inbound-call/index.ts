import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * TWILIO INBOUND CALL HANDLER
 * 
 * This edge function handles all incoming calls to Dynasty OS.
 * 
 * Routing Priority:
 * 1. Phone number-specific route (inbound_call_routes with phone_number_id)
 * 2. Business default route (inbound_call_routes with is_default=true)
 * 3. Known caller routing (assigned user for stores/contacts)
 * 4. Fallback to voicemail/kiosk
 * 
 * Returns TwiML for Twilio to execute the call routing.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Role priority for routing (higher = more priority)
const ROLE_PRIORITY: Record<string, number> = {
  owner: 100,
  admin: 90,
  va: 85,
  employee: 70,
  staff: 60,
  csr: 50,
  ambassador: 40,
};

interface InboundRoute {
  id: string;
  route_type: "user" | "role" | "voicemail";
  route_target_user_id: string | null;
  route_target_role: string | null;
  is_default: boolean;
  is_active: boolean;
}

interface CallerInfo {
  type: string;
  id: string;
  name: string;
  business_id?: string;
  assigned_user_id?: string;
}

interface RoutingResult {
  success: boolean;
  destination: string | null;
  source: string;
  failureReason?: string;
  userFound?: boolean;
  phoneValid?: boolean;
  callableDisabled?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("📞 Inbound call webhook received");

  try {
    // Parse the form-urlencoded body from Twilio
    const formData = await req.formData();
    
    // Extract Twilio webhook fields
    const callSid = formData.get("CallSid")?.toString() || "";
    const from = formData.get("From")?.toString() || "";
    const to = formData.get("To")?.toString() || "";
    const callStatus = formData.get("CallStatus")?.toString() || "";

    console.log(`📞 Inbound Call: SID=${callSid}, From=${from}, To=${to}, Status=${callStatus}`);

    if (!callSid || !from) {
      console.error("❌ Missing required fields: CallSid or From");
      return generateTwiML(`
        <Say voice="alice">We're sorry, we couldn't process your call. Please try again later.</Say>
        <Hangup/>
      `);
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Normalize phone numbers for lookup
    const normalizedFrom = normalizePhone(from);
    const normalizedTo = normalizePhone(to);

    // =====================================================
    // STEP 1: Resolve business by matching "To" number
    // =====================================================
    let businessId: string | null = null;
    let businessName = "Dynasty OS";
    let phoneNumberId: string | null = null;
    let businessTimezone: string | null = null;
    let businessHours: Record<string, any> | null = null;
    let afterHoursRouteType: string | null = null;
    let afterHoursRouteUserId: string | null = null;
    let afterHoursRouteRole: string | null = null;
    let afterHoursMessage: string | null = null;

    const { data: businessPhone } = await supabase
      .from("business_phone_numbers")
      .select(`
        id,
        business_id,
        phone_number,
        businesses (
          id,
          name,
          timezone,
          business_hours,
          after_hours_route_type,
          after_hours_route_user_id,
          after_hours_route_role,
          after_hours_message
        )
      `)
      .eq("is_active", true)
      .in("type", ["call", "both"])
      .or(`phone_number.eq.${to},phone_number.eq.${normalizedTo},phone_number.ilike.%${normalizedTo.slice(-10)}%`)
      .limit(1)
      .single();

    if (businessPhone?.businesses) {
      const biz = businessPhone.businesses as any;
      businessId = businessPhone.business_id;
      phoneNumberId = businessPhone.id;
      businessName = biz.name || "Dynasty OS";
      businessTimezone = biz.timezone || null;
      businessHours = biz.business_hours || null;
      afterHoursRouteType = biz.after_hours_route_type || null;
      afterHoursRouteUserId = biz.after_hours_route_user_id || null;
      afterHoursRouteRole = biz.after_hours_route_role || null;
      afterHoursMessage = biz.after_hours_message || null;
      console.log(`✅ Business resolved: ${businessName} (${businessId}), Phone ID: ${phoneNumberId}, TZ: ${businessTimezone}`);
    } else {
      console.log(`❌ ROUTING FAILURE: No business matched for To number: ${to}`);
    }

    // =====================================================
    // STEP 1.5: 24/7 Operation — No business hours check
    // =====================================================
    const isOpen = true; // System operates 24/7 — always open
    const localTimeStr = "";
    const dayOfWeek = "";
    console.log(`🕒 24/7 mode: All calls accepted regardless of time`);

    // =====================================================
    // STEP 2: Look up inbound routing rules
    // =====================================================
    let inboundRoute: InboundRoute | null = null;
    let routeSource = "none";

    if (businessId) {
      // First, try phone-specific route
      if (phoneNumberId) {
        const { data: phoneRoute } = await supabase
          .from("inbound_call_routes")
          .select("id, route_type, route_target_user_id, route_target_role, is_default, is_active")
          .eq("phone_number_id", phoneNumberId)
          .eq("is_active", true)
          .limit(1)
          .single();

        if (phoneRoute) {
          inboundRoute = phoneRoute as InboundRoute;
          routeSource = "phone_specific";
          console.log(`✅ Found phone-specific route: ${inboundRoute.route_type}`);
        }
      }

      // If no phone-specific route, try business default
      if (!inboundRoute) {
        const { data: defaultRoute } = await supabase
          .from("inbound_call_routes")
          .select("id, route_type, route_target_user_id, route_target_role, is_default, is_active")
          .eq("business_id", businessId)
          .eq("is_default", true)
          .eq("is_active", true)
          .limit(1)
          .single();

        if (defaultRoute) {
          inboundRoute = defaultRoute as InboundRoute;
          routeSource = "business_default";
          console.log(`✅ Found business default route: ${inboundRoute.route_type}`);
        }
      }
    }

    // =====================================================
    // STEP 3: Identify the caller
    // =====================================================
    let callerInfo: CallerInfo | null = null;

    // Check if caller is a known store
    const { data: storeMatch } = await supabase
      .from("store_master")
      .select("id, store_name, owner_name, phone, assigned_driver_id, business_id")
      .or(`phone.ilike.%${normalizedFrom.slice(-10)}%`)
      .is("deleted_at", null)
      .limit(1)
      .single();

    if (storeMatch) {
      callerInfo = {
        type: "store",
        id: storeMatch.id,
        name: storeMatch.store_name || storeMatch.owner_name,
        business_id: storeMatch.business_id || businessId,
        assigned_user_id: storeMatch.assigned_driver_id,
      };
      console.log(`✅ Caller identified as store: ${callerInfo.name}`);
    }

    // Check if caller is a known person/contact
    if (!callerInfo) {
      const { data: personMatch } = await supabase
        .from("people")
        .select("id, full_name, phone, entity_type")
        .or(`phone.ilike.%${normalizedFrom.slice(-10)}%`)
        .limit(1)
        .single();

      if (personMatch) {
        callerInfo = {
          type: personMatch.entity_type || "contact",
          id: personMatch.id,
          name: personMatch.full_name,
        };
        console.log(`✅ Caller identified as person: ${callerInfo.name}`);
      }
    }

    // =====================================================
    // STEP 4: Log the inbound call
    // =====================================================
    const callLogData = {
      phone_number: from,
      direction: "inbound",
      status: "ringing",
      started_at: new Date().toISOString(),
      notes: callerInfo 
        ? `Caller: ${callerInfo.name} (${callerInfo.type}) | Route: ${routeSource} | Hours: ${isOpen ? 'Open' : 'Closed'}` 
        : `Unknown caller from ${from} | Route: ${routeSource} | Hours: ${isOpen ? 'Open' : 'Closed'}`,
      business_id: businessId || callerInfo?.business_id || null,
      store_id: callerInfo?.type === "store" ? callerInfo.id : null,
      from_number: from,
      to_number: to,
    };

    const { data: callLog, error: logError } = await supabase
      .from("manual_call_logs")
      .insert(callLogData)
      .select()
      .single();

    if (logError) {
      console.error("❌ Failed to log call:", logError);
    } else {
      console.log(`✅ Call logged: ${callLog.id} with business_id: ${businessId}`);
    }

    // Create call_recordings entry for status tracking
    await supabase
      .from("call_recordings")
      .insert({
        manual_call_id: callLog?.id,
        provider: "twilio",
        provider_call_sid: callSid,
        business_id: businessId || callerInfo?.business_id || null,
        store_id: callerInfo?.type === "store" ? callerInfo.id : null,
        started_at: new Date().toISOString(),
      });

    // =====================================================
    // STEP 5: Handle After-Hours Routing (if closed)
    // =====================================================
    if (!isOpen && afterHoursRouteType) {
      console.log(`🌙 After-hours routing active: ${afterHoursRouteType}`);
      
      // Handle after-hours based on configuration
      let afterHoursResult: RoutingResult | null = null;
      
      switch (afterHoursRouteType) {
        case "voicemail":
          console.log("🌙 After-hours: Sending to voicemail");
          const voicemailMessage = afterHoursMessage || `Thank you for calling ${businessName}. We are currently closed. Please leave a message after the beep.`;
          return generateTwiML(`
            <Response>
              <Say voice="alice">${escapeXml(voicemailMessage)}</Say>
              <Record maxLength="120" transcribe="true" playBeep="true" action="${getStatusCallbackUrl()}"/>
              <Say voice="alice">Thank you for your message. Goodbye.</Say>
              <Hangup/>
            </Response>
          `);
          
        case "kiosk":
          console.log("🌙 After-hours: Sending to kiosk fallback");
          const kioskMessage = afterHoursMessage || `Thank you for calling ${businessName}. We are currently closed. Please call back during business hours.`;
          return generateTwiML(`
            <Response>
              <Say voice="alice">${escapeXml(kioskMessage)}</Say>
              <Hangup/>
            </Response>
          `);
          
        case "message":
          console.log("🌙 After-hours: Playing custom message");
          const customMessage = afterHoursMessage || `Thank you for calling ${businessName}. We are currently closed.`;
          return generateTwiML(`
            <Response>
              <Say voice="alice">${escapeXml(customMessage)}</Say>
              <Hangup/>
            </Response>
          `);
          
        case "user":
          if (afterHoursRouteUserId) {
            // Route to specific after-hours user
            const fakeAfterHoursRoute: InboundRoute = {
              id: "after-hours",
              route_type: "user",
              route_target_user_id: afterHoursRouteUserId,
              route_target_role: null,
              is_default: false,
              is_active: true,
            };
            inboundRoute = fakeAfterHoursRoute;
            routeSource = "after_hours_user";
            console.log(`🌙 After-hours: Routing to user ${afterHoursRouteUserId}`);
          }
          break;
          
        case "role":
          if (afterHoursRouteRole) {
            // Route to after-hours role
            const fakeAfterHoursRoute: InboundRoute = {
              id: "after-hours",
              route_type: "role",
              route_target_user_id: null,
              route_target_role: afterHoursRouteRole,
              is_default: false,
              is_active: true,
            };
            inboundRoute = fakeAfterHoursRoute;
            routeSource = "after_hours_role";
            console.log(`🌙 After-hours: Routing to role ${afterHoursRouteRole}`);
          }
          break;
      }
    }

    // =====================================================
    // STEP 6: Apply routing logic with DETAILED LOGGING
    // =====================================================
    const routingResult = await resolveRoutingDestination(
      supabase, 
      inboundRoute, 
      callerInfo, 
      businessId, 
      businessName
    );

    // Log the routing result for debugging
    console.log(`📊 ROUTING RESULT: ${JSON.stringify(routingResult)}`);

    // Update call log with routing outcome
    if (callLog?.id) {
      await supabase
        .from("manual_call_logs")
        .update({
          notes: callLogData.notes + ` | Outcome: ${routingResult.source}${routingResult.failureReason ? ` (${routingResult.failureReason})` : ''}`,
        })
        .eq("id", callLog.id);
    }

    // =====================================================
    // STEP 6: Generate TwiML response
    // =====================================================
    let twimlResponse: string;

    if (routingResult.success && routingResult.destination) {
      const greeting = callerInfo 
        ? `Hello, you have reached ${escapeXml(businessName)}. ${escapeXml(callerInfo.name)} is calling.`
        : `Hello, you have reached ${escapeXml(businessName)}. Connecting you now.`;
      
      console.log(`📞 DIALING: ${routingResult.destination} (source: ${routingResult.source})`);
      
      twimlResponse = `
        <Response>
          <Say voice="alice">${greeting} Please hold while we connect you.</Say>
          <Dial callerId="${escapeXml(to)}" timeout="30" action="${getStatusCallbackUrl()}">
            <Number statusCallbackEvent="initiated ringing answered completed" statusCallback="${getStatusCallbackUrl()}">${escapeXml(routingResult.destination)}</Number>
          </Dial>
          <Say voice="alice">We're sorry, no one is available to take your call right now. Please leave a message after the beep.</Say>
          <Record maxLength="120" transcribe="true" playBeep="true" action="${getStatusCallbackUrl()}"/>
          <Say voice="alice">Thank you for your message. Goodbye.</Say>
          <Hangup/>
        </Response>
      `;
    } else if (inboundRoute?.route_type === "voicemail") {
      // Explicit voicemail route
      console.log("📞 Sending to configured voicemail");
      twimlResponse = `
        <Response>
          <Say voice="alice">Hello, thank you for calling ${escapeXml(businessName)}. Please leave a message after the beep and we'll return your call as soon as possible.</Say>
          <Record maxLength="120" transcribe="true" playBeep="true" action="${getStatusCallbackUrl()}"/>
          <Say voice="alice">Thank you for your message. Goodbye.</Say>
          <Hangup/>
        </Response>
      `;
    } else {
      // No routing available - kiosk fallback
      console.log(`⚠️ KIOSK FALLBACK: ${routingResult.failureReason || 'No route available'}`);
      twimlResponse = `
        <Response>
          <Say voice="alice">Hello, thank you for calling ${escapeXml(businessName)}. We're currently unavailable. Please leave a message after the beep and we'll return your call as soon as possible.</Say>
          <Record maxLength="120" transcribe="true" playBeep="true" action="${getStatusCallbackUrl()}"/>
          <Say voice="alice">Thank you for your message. Goodbye.</Say>
          <Hangup/>
        </Response>
      `;
    }

    return generateTwiML(twimlResponse);

  } catch (error: any) {
    console.error("❌ Error in inbound call handler:", error);
    
    // Return a safe TwiML response even on error
    return generateTwiML(`
      <Response>
        <Say voice="alice">We're experiencing technical difficulties. Please try again later.</Say>
        <Hangup/>
      </Response>
    `);
  }
};

/**
 * Resolve the destination phone number with detailed failure tracking
 */
async function resolveRoutingDestination(
  supabase: any,
  inboundRoute: InboundRoute | null,
  callerInfo: CallerInfo | null,
  businessId: string | null,
  businessName: string
): Promise<RoutingResult> {
  
  // Try configured inbound route first
  if (inboundRoute) {
    switch (inboundRoute.route_type) {
      case "user":
        if (inboundRoute.route_target_user_id) {
          const { data: targetUser, error } = await supabase
            .from("user_profiles")
            .select("user_id, phone, full_name, is_callable")
            .eq("user_id", inboundRoute.route_target_user_id)
            .single();

          if (error || !targetUser) {
            console.log(`❌ ROUTING FAILURE: User ${inboundRoute.route_target_user_id} not found in user_profiles`);
            return {
              success: false,
              destination: null,
              source: "route_user",
              failureReason: `Target user not found (id: ${inboundRoute.route_target_user_id})`,
              userFound: false,
            };
          }

          // Check is_callable flag
          if (targetUser.is_callable === false) {
            console.log(`❌ ROUTING FAILURE: User ${targetUser.full_name || targetUser.user_id} is disabled for calling (is_callable=false)`);
            return {
              success: false,
              destination: null,
              source: "route_user",
              failureReason: `User ${targetUser.full_name || 'Unknown'} is disabled for calling`,
              userFound: true,
              phoneValid: true,
              callableDisabled: true,
            };
          }

          if (!targetUser.phone) {
            console.log(`❌ ROUTING FAILURE: User ${targetUser.full_name || targetUser.user_id} has no phone number`);
            return {
              success: false,
              destination: null,
              source: "route_user",
              failureReason: `User ${targetUser.full_name || 'Unknown'} has no phone number configured`,
              userFound: true,
              phoneValid: false,
            };
          }

          const normalizedPhone = normalizeToE164(targetUser.phone);
          if (!normalizedPhone) {
            console.log(`❌ ROUTING FAILURE: User ${targetUser.full_name} has invalid phone format: ${targetUser.phone}`);
            return {
              success: false,
              destination: null,
              source: "route_user",
              failureReason: `User ${targetUser.full_name} has invalid phone format`,
              userFound: true,
              phoneValid: false,
            };
          }

          console.log(`✅ Routing to user ${targetUser.full_name}: ${normalizedPhone}`);
          return {
            success: true,
            destination: normalizedPhone,
            source: "route_user",
            userFound: true,
            phoneValid: true,
          };
        }
        break;

      case "role":
        if (inboundRoute.route_target_role) {
          // Query users with the target role who have valid phone numbers AND are callable
          const { data: roleUsers, error } = await supabase
            .from("user_profiles")
            .select("user_id, phone, full_name, primary_role, is_callable")
            .eq("primary_role", inboundRoute.route_target_role)
            .eq("is_callable", true)
            .not("phone", "is", null);

          if (error) {
            console.log(`❌ ROUTING FAILURE: Database error querying role ${inboundRoute.route_target_role}: ${error.message}`);
            return {
              success: false,
              destination: null,
              source: "route_role",
              failureReason: `Database error: ${error.message}`,
            };
          }

          // Also check how many total users have this role (even without phone or is_callable)
          const { data: allRoleUsers } = await supabase
            .from("user_profiles")
            .select("user_id, phone, full_name, is_callable")
            .eq("primary_role", inboundRoute.route_target_role);

          const totalWithRole = allRoleUsers?.length || 0;
          const withPhone = allRoleUsers?.filter((u: any) => u.phone && u.phone.trim() !== "").length || 0;
          const callable = allRoleUsers?.filter((u: any) => u.is_callable === true).length || 0;
          const callableWithPhone = allRoleUsers?.filter((u: any) => u.is_callable === true && u.phone && u.phone.trim() !== "").length || 0;

          if (!roleUsers || roleUsers.length === 0) {
            console.log(`❌ ROUTING FAILURE: 0 callable users found with role='${inboundRoute.route_target_role}' AND phone IS NOT NULL`);
            console.log(`   📊 Total users with role '${inboundRoute.route_target_role}': ${totalWithRole}`);
            console.log(`   📊 Users with phone: ${withPhone}`);
            console.log(`   📊 Users with is_callable=true: ${callable}`);
            console.log(`   📊 Callable users with phone: ${callableWithPhone}`);
            return {
              success: false,
              destination: null,
              source: "route_role",
              failureReason: `0 callable users found for role='${inboundRoute.route_target_role}' (${totalWithRole} total, ${withPhone} with phone, ${callable} callable)`,
              userFound: false,
            };
          }

          // Find first user with valid E.164 phone
          for (const user of roleUsers) {
            const normalizedPhone = normalizeToE164(user.phone);
            if (normalizedPhone) {
              console.log(`✅ Routing to ${inboundRoute.route_target_role} ${user.full_name || user.user_id}: ${normalizedPhone}`);
              return {
                success: true,
                destination: normalizedPhone,
                source: "route_role",
                userFound: true,
                phoneValid: true,
              };
            }
          }

          console.log(`❌ ROUTING FAILURE: ${roleUsers.length} callable users with role='${inboundRoute.route_target_role}' but none have valid E.164 phone format`);
          return {
            success: false,
            destination: null,
            source: "route_role",
            failureReason: `${roleUsers.length} callable users with role='${inboundRoute.route_target_role}' but no valid phone format`,
            userFound: true,
            phoneValid: false,
          };
        }
        break;

      case "voicemail":
        // Voicemail is handled separately in main flow
        return {
          success: false,
          destination: null,
          source: "route_voicemail",
          failureReason: "Configured for voicemail",
        };
    }
  }

  // Fallback: Try caller's assigned user
  if (callerInfo?.assigned_user_id) {
    const { data: assignedUser } = await supabase
      .from("user_profiles")
      .select("user_id, phone, full_name")
      .eq("user_id", callerInfo.assigned_user_id)
      .single();

    if (assignedUser?.phone) {
      const normalizedPhone = normalizeToE164(assignedUser.phone);
      if (normalizedPhone) {
        console.log(`✅ Routing to assigned user ${assignedUser.full_name}: ${normalizedPhone}`);
        return {
          success: true,
          destination: normalizedPhone,
          source: "assigned_user",
          userFound: true,
          phoneValid: true,
        };
      }
    }
  }

  // Last resort fallback: Find any available admin
  if (!inboundRoute) {
    const { data: admins } = await supabase
      .from("user_profiles")
      .select("user_id, phone, full_name, primary_role")
      .in("primary_role", ["owner", "admin", "va"])
      .not("phone", "is", null)
      .limit(5);

    if (admins && admins.length > 0) {
      // Sort by role priority
      admins.sort((a: any, b: any) => (ROLE_PRIORITY[b.primary_role] || 0) - (ROLE_PRIORITY[a.primary_role] || 0));
      
      for (const admin of admins) {
        const normalizedPhone = normalizeToE164(admin.phone);
        if (normalizedPhone) {
          console.log(`✅ Fallback routing to ${admin.primary_role} ${admin.full_name}: ${normalizedPhone}`);
          return {
            success: true,
            destination: normalizedPhone,
            source: "admin_fallback",
            userFound: true,
            phoneValid: true,
          };
        }
      }
    }

    // Check total admin count for better error message
    const { data: allAdmins } = await supabase
      .from("user_profiles")
      .select("user_id, phone, primary_role")
      .in("primary_role", ["owner", "admin", "va"]);

    const adminCount = allAdmins?.length || 0;
    const adminsWithPhone = allAdmins?.filter((a: any) => a.phone).length || 0;

    console.log(`❌ ROUTING FAILURE: No admin fallback available`);
    console.log(`   📊 Total admins/owners/VAs: ${adminCount}`);
    console.log(`   📊 With phone numbers: ${adminsWithPhone}`);

    return {
      success: false,
      destination: null,
      source: "admin_fallback",
      failureReason: `No admin available (${adminCount} total, ${adminsWithPhone} with phone)`,
      userFound: adminCount > 0,
      phoneValid: false,
    };
  }

  return {
    success: false,
    destination: null,
    source: "no_route",
    failureReason: "No routing configuration found",
  };
}

// Helper functions
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Normalize phone to E.164 format
 */
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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getStatusCallbackUrl(): string {
  const projectUrl = Deno.env.get("SUPABASE_URL")!;
  const projectId = projectUrl.replace("https://", "").split(".")[0];
  return `https://${projectId}.supabase.co/functions/v1/twilio-call-status`;
}

function generateTwiML(content: string): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>${content.trim()}`;
  return new Response(twiml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      ...corsHeaders,
    },
  });
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

serve(handler);