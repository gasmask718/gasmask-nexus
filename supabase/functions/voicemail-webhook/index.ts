import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { verifyTwilio } from '../_shared/dialer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-twilio-signature',
};

interface VoicemailPayload {
  CallSid: string;
  RecordingUrl: string;
  RecordingSid: string;
  RecordingDuration: string;
  From: string;
  To: string;
  TranscriptionText?: string;
  TranscriptionStatus?: string;
  business_id?: string;
  phone_number_id?: string;
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse form data from Twilio
    const formData = await req.formData();
    const payload: Partial<VoicemailPayload> = {};
    const sigParams: Record<string, string> = {};

    for (const [key, value] of formData.entries()) {
      payload[key as keyof VoicemailPayload] = value as string;
      sigParams[key] = String(value);
    }

    // ── Signature verification ──
    const v = verifyTwilio(req, sigParams);
    if (!v.ok) {
      console.error(`[voicemail-webhook] signature invalid: ${v.reason}`);
      return new Response('Forbidden', { status: 403, headers: corsHeaders });
    }

    console.log('Voicemail webhook received:', JSON.stringify(payload));

    const {
      CallSid,
      RecordingUrl,
      RecordingSid,
      RecordingDuration,
      From,
      To,
      TranscriptionText,
      TranscriptionStatus,
    } = payload;

    // Get business and phone number from the To number
    const { data: phoneNumber } = await supabase
      .from('business_phone_numbers')
      .select('id, business_id, businesses(name)')
      .eq('phone_number', To)
      .eq('is_active', true)
      .maybeSingle();

    const businessId = phoneNumber?.business_id || payload.business_id;
    const phoneNumberId = phoneNumber?.id || payload.phone_number_id;

    // Try to match caller to existing contact
    const cleanPhone = From?.replace(/\D/g, '').slice(-10);
    let contactId = null;
    let callerName = null;

    if (cleanPhone && businessId) {
      const { data: contact } = await supabase
        .from('people')
        .select('id, name')
        .eq('business_id', businessId)
        .ilike('phone', `%${cleanPhone}%`)
        .maybeSingle();

      if (contact) {
        contactId = contact.id;
        callerName = contact.name;
      }

      // Also check stores
      if (!contactId) {
        const { data: store } = await supabase
          .from('stores')
          .select('id, name')
          .ilike('phone', `%${cleanPhone}%`)
          .maybeSingle();

        if (store) {
          callerName = store.name;
        }
      }
    }

    // Create voicemail record
    const { data: voicemail, error: vmError } = await supabase
      .from('voicemails')
      .insert({
        business_id: businessId,
        phone_number_id: phoneNumberId,
        contact_id: contactId,
        caller_number: From,
        caller_name: callerName,
        recording_url: RecordingUrl ? `${RecordingUrl}.mp3` : null,
        recording_sid: RecordingSid,
        duration_seconds: parseInt(RecordingDuration || '0', 10),
        transcription: TranscriptionText || null,
        transcription_status: TranscriptionStatus || 'pending',
        reason: payload.reason || 'no_answer',
        status: 'new',
        metadata: {
          call_sid: CallSid,
          raw_payload: payload,
        },
      })
      .select()
      .single();

    if (vmError) {
      console.error('Error creating voicemail:', vmError);
      throw vmError;
    }

    console.log('Voicemail created:', voicemail.id);

    // Create call outcome record
    await supabase
      .from('call_outcomes')
      .insert({
        business_id: businessId,
        phone_number_id: phoneNumberId,
        call_sid: CallSid,
        direction: 'inbound',
        caller_number: From,
        called_number: To,
        outcome: 'voicemail',
        outcome_reason: payload.reason || 'no_answer',
        voicemail_id: voicemail.id,
        resolution_path: [{
          step: 'voicemail_recorded',
          timestamp: new Date().toISOString(),
          duration: RecordingDuration,
        }],
      });

    // Check if auto-followup is enabled
    const { data: vmSettings } = await supabase
      .from('business_voicemail_settings')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();

    if (vmSettings?.auto_followup_enabled !== false) {
      // Create auto follow-up task
      await supabase
        .from('call_followups')
        .insert({
          business_id: businessId,
          source_type: 'voicemail',
          source_id: voicemail.id,
          voicemail_id: voicemail.id,
          caller_number: From,
          caller_name: callerName,
          followup_type: 'callback',
          title: `Return call: ${callerName || From}`,
          description: TranscriptionText 
            ? `Voicemail transcript: "${TranscriptionText.substring(0, 200)}..."`
            : `Voicemail received from ${From}. Duration: ${RecordingDuration}s`,
          priority: 'high',
          status: 'pending',
          due_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // Due in 2 hours
        });

      console.log('Auto follow-up created for voicemail:', voicemail.id);
    }

    // Check if auto-SMS is enabled
    if (vmSettings?.auto_sms_enabled && vmSettings?.auto_sms_template && From) {
      // Queue auto-SMS response
      await supabase
        .from('sms_logs')
        .insert({
          business_id: businessId,
          direction: 'outbound',
          to_number: From,
          message: vmSettings.auto_sms_template,
          status: 'queued',
          source: 'voicemail_auto_reply',
          metadata: { voicemail_id: voicemail.id },
        });

      // Update voicemail with SMS sent status
      await supabase
        .from('voicemails')
        .update({ 
          metadata: { 
            ...voicemail.metadata, 
            auto_sms_queued: true,
            auto_sms_queued_at: new Date().toISOString(),
          }
        })
        .eq('id', voicemail.id);

      console.log('Auto-SMS queued for voicemail:', voicemail.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        voicemail_id: voicemail.id,
        followup_created: vmSettings?.auto_followup_enabled !== false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Voicemail webhook error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
