import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IncomingMessage {
  channel: 'sms' | 'email' | 'call';
  sender_phone?: string;
  sender_email?: string;
  message_content: string;
  business_id: string;
  brand?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { channel, sender_phone, sender_email, message_content, business_id, brand }: IncomingMessage = await req.json();

    console.log('📨 Processing incoming message:', { channel, sender_phone, sender_email });

    // Step 1: Try to match sender to existing contact
    let matchedContact = null;
    let confidence = 0;

    // Try phone match first
    if (sender_phone) {
      const cleanPhone = sender_phone.replace(/\D/g, '').slice(-10);
      
      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('id, store_id, phone, name')
        .eq('business_id', business_id)
        .ilike('phone', `%${cleanPhone}%`)
        .limit(5);

      if (contacts && contacts.length > 0) {
        matchedContact = contacts[0];
        confidence = 1.0;
      }
    }

    // Try email match if no phone match
    if (!matchedContact && sender_email) {
      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('id, store_id, email, name')
        .eq('business_id', business_id)
        .ilike('email', sender_email)
        .limit(1);

      if (contacts && contacts.length > 0) {
        matchedContact = contacts[0];
        confidence = 1.0;
      }
    }

    // If still no match, use AI to suggest a match based on message content
    if (!matchedContact) {
      console.log('🤖 No direct match found, using AI to suggest match...');

      // Get recent contacts for this business
      const { data: recentContacts } = await supabase
        .from('crm_contacts')
        .select('id, name, store_id, phone, email')
        .eq('business_id', business_id)
        .order('last_contact_date', { ascending: false })
        .limit(10);

      if (recentContacts && recentContacts.length > 0) {
        const aiPrompt = `Analyze this incoming message and suggest which contact it most likely belongs to:

Message: "${message_content}"
Sender Phone: ${sender_phone || 'unknown'}
Sender Email: ${sender_email || 'unknown'}

Recent Contacts:
${recentContacts.map((c, i) => `${i + 1}. ${c.name} - Phone: ${c.phone || 'N/A'}, Email: ${c.email || 'N/A'}`).join('\n')}

Return JSON with:
{
  "contact_index": <index of most likely contact, or null if no good match>,
  "confidence": <0-1 score>,
  "reasoning": "<brief explanation>"
}`;

        try {
          const aiResponse = await fetch('https://api.lovable.app/v1/inference', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${lovableApiKey}`,
            },
            body: JSON.stringify({
              model: 'openai/gpt-5-mini',
              messages: [{
                role: 'user',
                content: aiPrompt
              }],
              response_format: { type: 'json_object' }
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const analysis = JSON.parse(aiData.choices[0].message.content);
            
            if (analysis.contact_index !== null && analysis.confidence > 0.5) {
              matchedContact = recentContacts[analysis.contact_index];
              confidence = analysis.confidence;
              console.log(`🎯 AI matched to: ${matchedContact.name} (confidence: ${confidence})`);
            }
          }
        } catch (aiError) {
          console.error('AI matching failed:', aiError);
        }
      }
    }

    // Step 2: Log the message
    if (matchedContact && confidence >= 0.7) {
      // High confidence match - automatically log to communication_logs
      const { data: log, error: logError } = await supabase
        .from('communication_logs')
        .insert({
          channel,
          direction: 'inbound',
          summary: `Incoming ${channel} from ${matchedContact.name}`,
          message_content,
          contact_id: matchedContact.id,
          store_id: matchedContact.store_id,
          business_id,
          brand,
          sender_phone,
          sender_email,
          performed_by: 'system',
        })
        .select()
        .single();

      if (logError) throw logError;

      // Update last contact date
      await supabase
        .from('crm_contacts')
        .update({ last_contact_date: new Date().toISOString() })
        .eq('id', matchedContact.id);

      console.log(`✅ Message logged to contact ${matchedContact.id}`);

      return new Response(JSON.stringify({
        success: true,
        matched: true,
        contact_id: matchedContact.id,
        confidence,
        log_id: log.id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Low confidence or no match - create unmatched message for VA review
      const { data: unmatchedMsg, error: unmatchedError } = await supabase
        .from('unmatched_messages')
        .insert({
          channel,
          sender_phone,
          sender_email,
          message_content,
          business_id,
          status: 'pending',
          ai_suggested_contact_id: matchedContact?.id || null,
          ai_confidence_score: confidence,
        })
        .select()
        .single();

      if (unmatchedError) throw unmatchedError;

      console.log(`⚠️ Message needs VA review - unmatched message created`);

      return new Response(JSON.stringify({
        success: true,
        matched: false,
        needs_review: true,
        suggested_contact_id: matchedContact?.id,
        confidence,
        unmatched_message_id: unmatchedMsg.id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error processing incoming message:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
