import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readForm, verifyTwilio } from "../_shared/dialer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


// Map Twilio status to our database status values
const mapTwilioStatus = (twilioStatus: string): string => {
  const statusMap: Record<string, string> = {
    "accepted": "pending",
    "queued": "pending",
    "sending": "pending",
    "sent": "sent",
    "delivered": "delivered",
    "undelivered": "failed",
    "failed": "failed",
    "read": "read",
  };
  return statusMap[twilioStatus.toLowerCase()] || twilioStatus.toLowerCase();
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests from Twilio
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    // Parse the form-urlencoded body from Twilio (single read — readForm also
    // feeds signature verification below).
    const params = await readForm(req);

    // Extract Twilio webhook fields
    const messageSid = params.MessageSid || "";
    const messageStatus = params.MessageStatus || "";
    const to = params.To || "";
    const from = params.From || "";
    const errorCode = params.ErrorCode || null;
    const errorMessage = params.ErrorMessage || null;
    const accountSid = params.AccountSid || "";

    console.log(`📨 Twilio Status Callback: SID=${messageSid}, Status=${messageStatus}, To=${to}`);

    // Signature validation — fail closed. Twilio signs every status callback
    // with the Account Auth Token; anything unsigned is forged.
    const v = verifyTwilio(req, params);
    if (!v.ok) {
      console.error(`[twilio-sms-status] signature invalid: ${v.reason}`);
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    // Synthetic health-check probe (comms-health-monitor sends MessageSid=SMhealth*):
    // ack with 200 so the deployment layer reports green without us pretending
    // a real status update happened.
    if (messageSid.startsWith("SMhealth")) {
      return new Response(
        JSON.stringify({ success: true, synthetic: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }


    if (!messageSid || !messageStatus) {
      console.error("❌ Missing required fields: MessageSid or MessageStatus");
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Initialize Supabase client with service role for database updates
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Map Twilio status to our database status
    const dbStatus = mapTwilioStatus(messageStatus);
    const isError = messageStatus === "failed" || messageStatus === "undelivered";

    console.log(`🔄 Mapped status: ${messageStatus} → ${dbStatus}`);

    // ── CANONICAL OUTBOUND LEDGER ────────────────────────────────────────
    // outbound_messages is the row send-sms wrote. Without this update every
    // outbound text is frozen at "sent" forever. Matched on the provider SID —
    // never on phone+recency, which would mislabel a different message.
    {
      const nowIso = new Date().toISOString();
      const ledgerStatus =
        messageStatus.toLowerCase() === "undelivered" ? "undelivered" : dbStatus;
      const patch: Record<string, any> = {
        status: ledgerStatus,
        status_updated_at: nowIso,
        error_code: errorCode,
        error_message: errorMessage,
      };
      if (ledgerStatus === "delivered") patch.delivered_at = nowIso;

      const { data: ledgerRows, error: ledgerErr } = await supabase
        .from("outbound_messages")
        .update(patch)
        .eq("provider_message_id", messageSid)
        .select("id");

      if (ledgerErr) {
        console.error(`❌ outbound_messages update failed for ${messageSid}: ${ledgerErr.message}`);
      } else if (!ledgerRows || ledgerRows.length === 0) {
        console.warn(`⚠️ No outbound_messages row for SID ${messageSid} (status ${messageStatus}) — unmatched status callback`);
      } else {
        console.log(`✅ outbound_messages ${ledgerRows[0].id} → ${ledgerStatus}`);
      }
    }


    // Prepare the update payload
    const updatePayload: Record<string, any> = {
      status: dbStatus,
      updated_at: new Date().toISOString(),
    };

    // If there's an error, store error details in metadata
    if (isError && (errorCode || errorMessage)) {
      console.log(`⚠️ Error detected: Code=${errorCode}, Message=${errorMessage}`);
    }

    // Find and update the message in communication_messages by matching twilio_sid in metadata
    const { data: messages, error: findError } = await supabase
      .from("communication_messages")
      .select("id, metadata")
      .or(`metadata->>twilio_sid.eq.${messageSid},phone_number.eq.${to}`)
      .order("created_at", { ascending: false })
      .limit(10);

    if (findError) {
      console.error("❌ Error finding message:", findError);
    }

    // Find the exact message with matching SID
    let matchedMessage = messages?.find(msg => {
      const metadata = msg.metadata as Record<string, any> | null;
      return metadata?.twilio_sid === messageSid;
    });

    // If no exact SID match, try to match by phone and recent timestamp
    if (!matchedMessage && messages && messages.length > 0) {
      matchedMessage = messages[0]; // Use most recent message to that phone
      console.log(`📱 Using most recent message to ${to}: ${matchedMessage.id}`);
    }

    if (matchedMessage) {
      // Update metadata with delivery status info
      const existingMetadata = (matchedMessage.metadata as Record<string, any>) || {};
      const updatedMetadata = {
        ...existingMetadata,
        twilio_sid: messageSid,
        last_status_update: new Date().toISOString(),
        delivery_status: messageStatus,
        ...(errorCode && { error_code: errorCode }),
        ...(errorMessage && { error_message: errorMessage }),
      };

      const { error: updateError } = await supabase
        .from("communication_messages")
        .update({
          ...updatePayload,
          metadata: updatedMetadata,
          ...(isError && { priority: "high" }), // Flag failed messages as high priority
        })
        .eq("id", matchedMessage.id);

      if (updateError) {
        console.error("❌ Error updating communication_messages:", updateError);
      } else {
        console.log(`✅ Updated communication_messages: ${matchedMessage.id} → ${dbStatus}`);
      }
    } else {
      console.log(`⚠️ No matching message found for SID: ${messageSid}`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INVOICE RECEIPT LOG UPDATE - Append delivery status to audit trail
    // ═══════════════════════════════════════════════════════════════════════════
    const { data: receiptLogEntry, error: receiptLogFindError } = await supabase
      .from("invoice_receipt_log")
      .select("id, invoice_id")
      .eq("message_sid", messageSid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (receiptLogFindError) {
      console.error("❌ Error finding invoice_receipt_log entry:", receiptLogFindError);
    }

    if (receiptLogEntry) {
      // Update the existing receipt log entry with delivery confirmation
      const { error: receiptUpdateError } = await supabase
        .from("invoice_receipt_log")
        .update({
          delivery_status: dbStatus,
          delivered_at: dbStatus === "delivered" ? new Date().toISOString() : null,
          error_message: isError ? (errorMessage || errorCode || "Delivery failed") : null,
        })
        .eq("id", receiptLogEntry.id);

      if (receiptUpdateError) {
        console.error("❌ Error updating invoice_receipt_log:", receiptUpdateError);
      } else {
        console.log(`✅ Updated invoice_receipt_log: ${receiptLogEntry.id} → ${dbStatus}`);
      }

      // Also update the invoice record itself if we have the invoice_id
      if (receiptLogEntry.invoice_id) {
        const invoiceUpdatePayload: Record<string, any> = {
          receipt_status: dbStatus,
        };

        if (dbStatus === "delivered") {
          invoiceUpdatePayload.receipt_delivered_at = new Date().toISOString();
        } else if (isError) {
          invoiceUpdatePayload.receipt_failure_reason = errorMessage || errorCode || "Delivery failed";
        }

        const { error: invoiceUpdateError } = await supabase
          .from("invoices")
          .update(invoiceUpdatePayload)
          .eq("id", receiptLogEntry.invoice_id);

        if (invoiceUpdateError) {
          console.error("❌ Error updating invoice receipt status:", invoiceUpdateError);
        } else {
          console.log(`✅ Updated invoice receipt_status: ${receiptLogEntry.invoice_id} → ${dbStatus}`);
        }
      }
    } else {
      console.log(`📝 No invoice_receipt_log entry found for SID: ${messageSid} (may be non-invoice SMS)`);
    }

    // Also update communication_logs if there's a matching record
    const { error: logUpdateError } = await supabase
      .from("communication_logs")
      .update({
        delivery_status: dbStatus,
      })
      .eq("recipient_phone", to)
      .eq("channel", "sms")
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(1);

    if (logUpdateError) {
      console.error("❌ Error updating communication_logs:", logUpdateError);
    } else {
      console.log(`✅ Updated communication_logs for ${to}`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // NUMBER VERIFICATION — promote store_contacts row when delivery confirmed
    // ═══════════════════════════════════════════════════════════════════════════
    try {
      const { data: verifContact } = await supabase
        .from("store_contacts")
        .select("id, number_verification_status")
        .eq("number_verification_message_sid", messageSid)
        .maybeSingle();

      if (verifContact) {
        const verifPatch: Record<string, any> = {};
        if (dbStatus === "delivered" && verifContact.number_verification_status !== "confirmed") {
          verifPatch.number_verification_status = "delivered";
          verifPatch.number_verification_delivered_at = new Date().toISOString();
        } else if (isError) {
          verifPatch.number_verification_status = "failed";
          verifPatch.number_verification_failed_at = new Date().toISOString();
          verifPatch.number_verification_error = errorMessage || errorCode || "Delivery failed";
        }
        if (Object.keys(verifPatch).length > 0) {
          await supabase.from("store_contacts").update(verifPatch).eq("id", verifContact.id);
          console.log(`✅ store_contacts ${verifContact.id} verification → ${verifPatch.number_verification_status}`);
        }
      }
    } catch (e) {
      console.error("verification status sync error:", e);
    }


    // Log the webhook event for audit trail
    const webhookPayload = {
      message_sid: messageSid,
      message_status: messageStatus,
      to,
      from,
      error_code: errorCode,
      error_message: errorMessage,
      account_sid: accountSid,
      received_at: new Date().toISOString(),
    };

    // Insert audit log entry
    const { error: auditError } = await supabase
      .from("communication_logs")
      .insert({
        channel: "sms",
        direction: "inbound", // This is an inbound webhook
        recipient_phone: to,
        sender_phone: from,
        message_content: `Status update: ${messageStatus}`,
        delivery_status: dbStatus,
        performed_by: "twilio_webhook",
        summary: `Twilio delivery status: ${messageStatus}${errorCode ? ` (Error: ${errorCode})` : ""}`,
      });

    if (auditError) {
      console.error("❌ Error creating audit log:", auditError);
    } else {
      console.log(`✅ Audit log created for status callback`);
    }

    // Return 200 OK quickly to prevent Twilio retries
    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error("❌ Error processing Twilio status callback:", error);
    
    // Still return 200 to prevent Twilio retries, but log the error
    return new Response(
      JSON.stringify({ success: true, note: "Error logged" }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
};

serve(handler);
