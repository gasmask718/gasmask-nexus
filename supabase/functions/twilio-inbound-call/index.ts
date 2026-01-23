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

    const { data: businessPhone } = await supabase
      .from("business_phone_numbers")
      .select(`
        id,
        business_id,
        phone_number,
        businesses (
          id,
          name
        )
      `)
      .eq("is_active", true)
      .in("type", ["call", "both"])
      .or(`phone_number.eq.${to},phone_number.eq.${normalizedTo},phone_number.ilike.%${normalizedTo.slice(-10)}%`)
      .limit(1)
      .single();

    if (businessPhone?.businesses) {
      businessId = businessPhone.business_id;
      phoneNumberId = businessPhone.id;
      businessName = (businessPhone.businesses as any).name || "Dynasty OS";
      console.log(`✅ Business resolved: ${businessName} (${businessId}), Phone ID: ${phoneNumberId}`);
    } else {
      console.log(`❌ ROUTING FAILURE: No business matched for To number: ${to}`);
    }

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
        ? `Caller: ${callerInfo.name} (${callerInfo.type}) | Route: ${routeSource}` 
        : `Unknown caller from ${from} | Route: ${routeSource}`,
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
    // STEP 5: Apply routing logic with DETAILED LOGGING
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
            .select("user_id, phone, full_name")
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
          // Query users with the target role who have valid phone numbers
          const { data: roleUsers, error } = await supabase
            .from("user_profiles")
            .select("user_id, phone, full_name, primary_role")
            .eq("primary_role", inboundRoute.route_target_role)
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

          // Also check how many total users have this role (even without phone)
          const { data: allRoleUsers } = await supabase
            .from("user_profiles")
            .select("user_id, phone, full_name")
            .eq("primary_role", inboundRoute.route_target_role);

          const totalWithRole = allRoleUsers?.length || 0;
          const withPhone = roleUsers?.filter((u: any) => u.phone && u.phone.trim() !== "").length || 0;

          if (!roleUsers || roleUsers.length === 0) {
            console.log(`❌ ROUTING FAILURE: 0 users found with role='${inboundRoute.route_target_role}' AND phone IS NOT NULL`);
            console.log(`   📊 Total users with role '${inboundRoute.route_target_role}': ${totalWithRole}`);
            console.log(`   📊 Users with valid phone: ${withPhone}`);
            return {
              success: false,
              destination: null,
              source: "route_role",
              failureReason: `0 users found for role='${inboundRoute.route_target_role}' with valid phone (${totalWithRole} total users with this role)`,
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

          console.log(`❌ ROUTING FAILURE: ${roleUsers.length} users with role='${inboundRoute.route_target_role}' but none have valid E.164 phone format`);
          return {
            success: false,
            destination: null,
            source: "route_role",
            failureReason: `${roleUsers.length} users with role='${inboundRoute.route_target_role}' but no valid phone format`,
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

serve(handler);