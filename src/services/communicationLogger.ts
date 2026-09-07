import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CommunicationLogData {
  channel: 'sms' | 'email' | 'call' | 'ai_call' | 'va_call';
  direction: 'inbound' | 'outbound';
  summary: string;
  full_message?: string;
  message_content?: string;
  outcome?: string;
  brand?: string;
  performed_by?: 'ai' | 'va' | 'system';
  delivery_status?: string;
  contact_id?: string;
  store_id?: string;
  business_id?: string;
  recipient_phone?: string;
  recipient_email?: string;
  sender_phone?: string;
  sender_email?: string;
  call_duration?: number;
  recording_url?: string;
  follow_up_required?: boolean;
  follow_up_date?: string;
  driver_id?: string;
  influencer_id?: string;
  wholesaler_id?: string;
}

/**
 * Unified Communication Logger
 * Logs all communications (SMS, Email, Calls, AI Calls, VA Calls) to communication_logs
 * and syncs across CRM, Store Master Profile, Brand Sub-Accounts, and Conversations
 */
export const logCommunication = async (data: CommunicationLogData) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    const logEntry = {
      ...data,
      created_by: user?.id,
      created_at: new Date().toISOString(),
    };

    const { data: insertedLog, error } = await supabase
      .from('communication_logs')
      .insert(logEntry)
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Communication logged:', insertedLog.id, data.channel, data.direction);
    
    return insertedLog;
  } catch (error) {
    console.error('❌ Failed to log communication:', error);
    toast.error('Failed to log communication');
    throw error;
  }
};

export interface AgentOutboundLogData
  extends Omit<CommunicationLogData, 'direction' | 'performed_by'> {
  /** Twilio message/call SID when known. */
  external_sid?: string;
  /** Which screen produced the message — recorded in metadata only. */
  source_ui?: string;
}

/**
 * STAGE 1 ATTRIBUTION — the single way a caller-generated OUTBOUND message or
 * call gets written to communication_logs from the client.
 *
 * Reuses the existing log table and existing columns only:
 *   created_by   → auth user id of the signed-in agent (canonical attribution)
 *   performed_by → 'va' (a human agent, as opposed to 'ai' / 'system')
 *   store_id / contact_id → canonical account + contact when the caller knows them
 *   metadata.agent_name / agent_email → display name for the performance boards
 *
 * Never guesses: if there is no authenticated user, nothing is stamped and the
 * row is written unattributed rather than credited to somebody.
 */
export const logAgentOutboundCommunication = async (data: AgentOutboundLogData) => {
  const { external_sid, source_ui, ...rest } = data;
  try {
    const { data: { user } } = await supabase.auth.getUser();

    let agentName: string | null = null;
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', user.id)
        .maybeSingle();
      agentName = (profile as any)?.name || (profile as any)?.email || user.email || null;
    }

    const nowIso = new Date().toISOString();
    const { data: inserted, error } = await supabase
      .from('communication_logs')
      .insert({
        ...rest,
        direction: 'outbound',
        performed_by: user ? 'va' : 'system',
        created_by: user?.id ?? null,
        twilio_call_sid: rest.channel === 'call' ? external_sid ?? null : undefined,
        started_at: nowIso,
        created_at: nowIso,
        metadata: {
          agent_user_id: user?.id ?? null,
          agent_name: agentName,
          agent_email: user?.email ?? null,
          source_ui: source_ui ?? null,
          external_sid: external_sid ?? null,
        },
      } as any)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    return inserted;
  } catch (error) {
    // Logging must never break the send itself.
    console.error('❌ Failed to log attributed outbound communication:', error);
    return null;
  }
};

/**
 * Match incoming message to existing contact by phone or email
 */
export const matchIncomingMessage = async (
  senderPhone?: string,
  senderEmail?: string,
  businessId?: string
): Promise<{ contactId: string; confidence: number } | null> => {
  try {
    // First, try exact match on phone
    if (senderPhone) {
      const cleanPhone = senderPhone.replace(/\D/g, '');
      
      // Check crm_contacts
      const { data: contacts } = await supabase
        .from('people')
        .select('id, phone')
        .eq('business_id', businessId)
        .ilike('phone', `%${cleanPhone.slice(-10)}%`)
        .limit(1);

      if (contacts && contacts.length > 0) {
        return {
          contactId: contacts[0].id,
          confidence: 1.0,
        };
      }

      // Check stores table for phone match
      const { data: stores } = await supabase
        .from('stores')
        .select('id, phone')
        .eq('approval_status', 'approved') // Phase 7: exclude pending captures
        .ilike('phone', `%${cleanPhone.slice(-10)}%`)
        .limit(1);

      if (stores && stores.length > 0) {
        // Look for primary contact at this store
        const { data: storeContacts } = await supabase
          .from('people')
          .select('id')
          .eq('organization', stores[0].id)
          .limit(1);

        if (storeContacts && storeContacts.length > 0) {
          return {
            contactId: storeContacts[0].id,
            confidence: 0.9,
          };
        }
      }
    }

    // Try exact match on email
    if (senderEmail) {
      const { data: contacts } = await supabase
        .from('people')
        .select('id, email')
        .eq('business_id', businessId)
        .ilike('email', senderEmail)
        .limit(1);

      if (contacts && contacts.length > 0) {
        return {
          contactId: contacts[0].id,
          confidence: 1.0,
        };
      }
    }

    // No match found
    return null;
  } catch (error) {
    console.error('❌ Failed to match incoming message:', error);
    return null;
  }
};

/**
 * Log incoming message (from customer)
 * Automatically matches to existing contact and creates unmatched_message if needed
 */
export const logIncomingMessage = async (
  channel: 'sms' | 'email' | 'call',
  messageContent: string,
  senderPhone?: string,
  senderEmail?: string,
  businessId?: string,
  brand?: string
) => {
  try {
    // Try to match the sender to an existing contact
    const match = await matchIncomingMessage(senderPhone, senderEmail, businessId);

    if (match) {
      // We found a match! Log it to communication_logs
      await logCommunication({
        channel,
        direction: 'inbound',
        summary: `Incoming ${channel} from customer`,
        message_content: messageContent,
        contact_id: match.contactId,
        business_id: businessId,
        brand,
        sender_phone: senderPhone,
        sender_email: senderEmail,
        performed_by: 'system',
      });

      console.log(`✅ Incoming ${channel} matched to contact ${match.contactId}`);
      toast.success(`New ${channel} from customer matched`);
    } else {
      // No match - create unmatched message for VA review
      const { error } = await supabase
        .from('unmatched_messages')
        .insert({
          channel,
          sender_phone: senderPhone,
          sender_email: senderEmail,
          message_content: messageContent,
          business_id: businessId,
          status: 'pending',
        });

      if (error) throw error;

      console.log(`⚠️ Incoming ${channel} could not be matched - created unmatched message`);
      toast.warning(`New ${channel} from unknown sender - needs review`);
    }
  } catch (error) {
    console.error('❌ Failed to log incoming message:', error);
    toast.error('Failed to process incoming message');
  }
};
