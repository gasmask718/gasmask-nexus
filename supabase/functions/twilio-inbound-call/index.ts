import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * TWILIO INBOUND CALL HANDLER
 * 
 * This edge function handles all incoming calls to Dynasty OS.
 * It routes calls based on:
 * 1. Known contacts (stores, customers, partners)
 * 2. Assigned users
 * 3. Role priority (owner > admin > assigned rep)
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
  employee: 70,
  staff: 60,
  csr: 50,
  ambassador: 40,
};

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
    const direction = formData.get("Direction")?.toString() || "inbound";
    const callerCity = formData.get("CallerCity")?.toString() || "";
    const callerState = formData.get("CallerState")?.toString() || "";
    const callerCountry = formData.get("CallerCountry")?.toString() || "";

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

    // STEP 1: Resolve business by matching "To" number against business_phone_numbers
    let businessId: string | null = null;
    let businessName = "Dynasty OS";
    let defaultRouteUserId: string | null = null;

    const { data: businessPhone } = await supabase
      .from("business_phone_numbers")
      .select(`
        id,
        business_id,
        businesses (
          id,
          name,
          default_inbound_route_user_id
        )
      `)
      .eq("is_active", true)
      .in("type", ["call", "both"])
      .or(`phone_number.eq.${to},phone_number.eq.${normalizedTo},phone_number.ilike.%${normalizedTo.slice(-10)}%`)
      .limit(1)
      .single();

    if (businessPhone?.businesses) {
      businessId = businessPhone.business_id;
      businessName = (businessPhone.businesses as any).name || "Dynasty OS";
      defaultRouteUserId = (businessPhone.businesses as any).default_inbound_route_user_id;
      console.log(`✅ Business resolved: ${businessName} (${businessId})`);
    } else {
      console.log("⚠️ No business matched for To number:", to);
    }

    // STEP 2: Try to find the caller in our database
    let callerInfo: CallerInfo | null = null;
    let routeDestination: string | null = null;

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

    // STEP 3: Log the inbound call immediately with business_id
    const callLogData = {
      phone_number: from,
      direction: "inbound",
      status: "ringing",
      started_at: new Date().toISOString(),
      notes: callerInfo ? `Caller: ${callerInfo.name} (${callerInfo.type})` : `Unknown caller from ${from}`,
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

    // Also log to call_recordings with provider_call_sid for status tracking
    const { error: recordingError } = await supabase
      .from("call_recordings")
      .insert({
        manual_call_id: callLog?.id,
        provider: "twilio",
        provider_call_sid: callSid,
        business_id: businessId || callerInfo?.business_id || null,
        store_id: callerInfo?.type === "store" ? callerInfo.id : null,
        started_at: new Date().toISOString(),
      });

    if (recordingError) {
      console.error("❌ Failed to create call recording entry:", recordingError);
    }

    // 3. Determine routing based on caller info and role priority
    let twimlResponse: string;

    if (callerInfo?.assigned_user_id) {
      // Route to assigned user first
      const { data: assignedUser } = await supabase
        .from("profiles")
        .select("id, phone")
        .eq("id", callerInfo.assigned_user_id)
        .single();

      if (assignedUser?.phone) {
        routeDestination = assignedUser.phone;
        console.log(`📞 Routing to assigned user: ${routeDestination}`);
      }
    }

    // If no assigned user, find available admin/owner
    if (!routeDestination) {
      const { data: admins } = await supabase
        .from("profiles")
        .select("id, phone, role")
        .in("role", ["owner", "admin"])
        .not("phone", "is", null)
        .order("role", { ascending: true }) // owner first
        .limit(3);

      if (admins && admins.length > 0) {
        // Sort by role priority
        admins.sort((a, b) => (ROLE_PRIORITY[b.role] || 0) - (ROLE_PRIORITY[a.role] || 0));
        routeDestination = admins[0].phone;
        console.log(`📞 Routing to ${admins[0].role}: ${routeDestination}`);
      }
    }

    // 4. Generate TwiML response
    if (routeDestination) {
      const greeting = callerInfo 
        ? `Hello, you have reached Dynasty OS. ${callerInfo.name} is calling.`
        : "Hello, you have reached Dynasty OS. Connecting you now.";
      
      twimlResponse = `
        <Response>
          <Say voice="alice">${escapeXml(greeting)} Please hold while we connect you.</Say>
          <Dial callerId="${escapeXml(to)}" timeout="30" action="${getStatusCallbackUrl()}">
            <Number statusCallbackEvent="initiated ringing answered completed" statusCallback="${getStatusCallbackUrl()}">${escapeXml(routeDestination)}</Number>
          </Dial>
          <Say voice="alice">We're sorry, no one is available to take your call right now. Please leave a message after the beep.</Say>
          <Record maxLength="120" transcribe="true" playBeep="true" action="${getStatusCallbackUrl()}"/>
          <Say voice="alice">Thank you for your message. Goodbye.</Say>
          <Hangup/>
        </Response>
      `;
    } else {
      // No routing available - go to voicemail
      console.log("⚠️ No route available, sending to voicemail");
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

// Helper types
interface CallerInfo {
  type: string;
  id: string;
  name: string;
  business_id?: string;
  assigned_user_id?: string;
}

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
  // Extract project ID from URL
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
