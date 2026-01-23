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
      console.log("⚠️ No business matched for To number:", to);
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
    // STEP 5: Apply routing logic
    // =====================================================
    let routeDestination: string | null = null;
    let twimlResponse: string;

    if (inboundRoute) {
      // Route based on configured rules
      switch (inboundRoute.route_type) {
        case "user":
          if (inboundRoute.route_target_user_id) {
            const { data: targetUser } = await supabase
              .from("user_profiles")
              .select("phone")
              .eq("user_id", inboundRoute.route_target_user_id)
              .single();

            if (targetUser?.phone) {
              routeDestination = targetUser.phone;
              console.log(`📞 Routing to configured user: ${routeDestination}`);
            }
          }
          break;

        case "role":
          if (inboundRoute.route_target_role) {
            const { data: roleUsers } = await supabase
              .from("user_profiles")
              .select("user_id, phone, primary_role")
              .eq("primary_role", inboundRoute.route_target_role)
              .not("phone", "is", null)
              .limit(5);

            if (roleUsers && roleUsers.length > 0) {
              // Pick the first available user with that role
              routeDestination = roleUsers[0].phone;
              console.log(`📞 Routing to ${inboundRoute.route_target_role}: ${routeDestination}`);
            }
          }
          break;

        case "voicemail":
          console.log("📞 Configured for voicemail");
          // routeDestination stays null, will go to voicemail
          break;
      }
    }

    // Fallback: Try caller's assigned user
    if (!routeDestination && callerInfo?.assigned_user_id) {
      const { data: assignedUser } = await supabase
        .from("user_profiles")
        .select("phone")
        .eq("user_id", callerInfo.assigned_user_id)
        .single();

      if (assignedUser?.phone) {
        routeDestination = assignedUser.phone;
        console.log(`📞 Routing to assigned user: ${routeDestination}`);
      }
    }

    // Last resort fallback: Find any available admin
    if (!routeDestination && !inboundRoute) {
      const { data: admins } = await supabase
        .from("user_profiles")
        .select("user_id, phone, primary_role")
        .in("primary_role", ["owner", "admin", "va"])
        .not("phone", "is", null)
        .limit(3);

      if (admins && admins.length > 0) {
        admins.sort((a, b) => (ROLE_PRIORITY[b.primary_role] || 0) - (ROLE_PRIORITY[a.primary_role] || 0));
        routeDestination = admins[0].phone;
        console.log(`📞 Fallback routing to ${admins[0].primary_role}: ${routeDestination}`);
      }
    }

    // =====================================================
    // STEP 6: Generate TwiML response
    // =====================================================
    if (routeDestination) {
      const greeting = callerInfo 
        ? `Hello, you have reached ${escapeXml(businessName)}. ${escapeXml(callerInfo.name)} is calling.`
        : `Hello, you have reached ${escapeXml(businessName)}. Connecting you now.`;
      
      twimlResponse = `
        <Response>
          <Say voice="alice">${greeting} Please hold while we connect you.</Say>
          <Dial callerId="${escapeXml(to)}" timeout="30" action="${getStatusCallbackUrl()}">
            <Number statusCallbackEvent="initiated ringing answered completed" statusCallback="${getStatusCallbackUrl()}">${escapeXml(routeDestination)}</Number>
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
      console.log("⚠️ No route available, sending to kiosk voicemail");
      twimlResponse = `
        <Response>
          <Say voice="alice">Hello, thank you for calling Dynasty OS. We're currently unavailable. Please leave a message after the beep and we'll return your call as soon as possible.</Say>
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

// Helper functions
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
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