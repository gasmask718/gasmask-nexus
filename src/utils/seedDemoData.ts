import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const demoContacts = [
  { name: 'Sarah Mitchell', email: 'sarah.mitchell@email.com', phone: '+1-917-234-5678', type: 'customer', tags: ['VIP', 'Returning'] },
  { name: 'Marcus Johnson', email: 'marcus.j@email.com', phone: '+1-646-987-6543', type: 'lead', tags: ['Hot Lead'] },
  { name: 'Elena Rodriguez', email: 'elena.rod@email.com', phone: '+1-212-555-1234', type: 'customer', tags: ['Wholesale', 'VIP'] },
  { name: 'David Chen', email: 'david.chen@email.com', phone: '+1-347-888-9999', type: 'lead', tags: ['Event'] },
  { name: 'Amanda Foster', email: 'amanda.f@email.com', phone: '+1-718-444-5555', type: 'vendor', tags: ['Wholesale'] },
  { name: 'James Wilson', email: 'james.wilson@email.com', phone: '+1-917-333-2222', type: 'customer', tags: ['Returning'] },
  { name: 'Maria Garcia', email: 'maria.garcia@email.com', phone: '+1-646-777-8888', type: 'lead', tags: ['Hot Lead', 'Event'] },
  { name: 'Robert Taylor', email: 'robert.t@email.com', phone: '+1-212-999-0000', type: 'customer', tags: ['VIP'] },
  { name: 'Lisa Anderson', email: 'lisa.anderson@email.com', phone: '+1-347-222-3333', type: 'lead', tags: [] },
  { name: 'Kevin Martinez', email: 'kevin.m@email.com', phone: '+1-718-666-7777', type: 'vendor', tags: ['Wholesale'] },
  { name: 'Jennifer Lee', email: 'jennifer.lee@email.com', phone: '+1-917-111-2222', type: 'customer', tags: ['Returning', 'Event'] },
  { name: 'Michael Brown', email: 'michael.brown@email.com', phone: '+1-646-555-4444', type: 'lead', tags: ['Hot Lead'] },
];

const communicationMessages = [
  "Customer inquired about bulk pricing for wholesale orders",
  "Follow-up on delivery schedule for upcoming event",
  "VIP customer requesting exclusive product access",
  "Lead interested in partnership opportunities",
  "Customer complaint about late delivery",
  "Positive feedback on product quality",
  "Requesting invoice for recent purchase",
  "Inquiry about return policy",
  "Interested in becoming a vendor",
  "Event planning discussion for upcoming festival",
  "Price negotiation for wholesale order",
  "Customer satisfaction survey response",
  "Product recommendation request",
  "Delivery confirmation and thank you",
  "Technical support question",
  "Referral from existing customer",
  "Contract renewal discussion",
  "New lead from marketing campaign",
  "Payment processing issue",
  "General inquiry about business hours"
];

const callSummaries = [
  "Customer asked about delivery times for weekend orders",
  "Wholesale inquiry for bulk purchase discount",
  "VIP client requesting priority service",
  "Complaint about product quality, resolved with replacement",
  "New lead interested in partnership program",
  "Follow-up on previous order status",
  "Event coordinator planning large order",
  "Customer praise for excellent service",
  "Technical question about product specifications",
  "Price comparison inquiry",
  "Return request processed successfully",
  "New customer onboarding call",
  "Existing customer reorder",
  "Vendor application discussion",
  "Marketing campaign follow-up",
  "Referral program inquiry",
  "Payment method update",
  "Delivery address change request",
  "Product availability check",
  "General business inquiry",
  "Customer retention outreach",
  "Feedback collection call",
  "Lost customer win-back attempt",
  "Cross-sell opportunity discussion",
  "Loyalty program enrollment"
];

function randomDate(daysBack: number): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  return date.toISOString();
}

function randomFutureDate(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + Math.floor(Math.random() * daysAhead) + 1);
  return date.toISOString();
}

export async function seedDemoData(businessId: string) {
  try {
    console.log('Starting demo data seed for business:', businessId);

    // 1. Insert demo contacts
    const contactsToInsert = demoContacts.map(contact => ({
      ...contact,
      business_id: businessId,
      relationship_status: 'active',
      last_contact_date: randomDate(30),
      notes: `Demo contact for testing purposes`,
      created_at: randomDate(60)
    }));

    const { data: insertedContacts, error: contactsError } = await supabase
      .from('crm_contacts')
      .insert(contactsToInsert)
      .select();

    if (contactsError) throw contactsError;
    console.log(`✓ Inserted ${insertedContacts.length} contacts`);

    // 2. Insert communication logs
    const logsToInsert = communicationMessages.slice(0, 20).map((message, idx) => {
      const contactId = insertedContacts[idx % insertedContacts.length].id;
      const channels = ['call', 'sms', 'email'];
      const channel = channels[Math.floor(Math.random() * channels.length)];
      const directions = ['inbound', 'outbound'];
      
      return {
        business_id: businessId,
        contact_id: contactId,
        channel,
        direction: directions[Math.floor(Math.random() * directions.length)],
        summary: message,
        notes: `Demo ${channel} communication log`,
        follow_up_required: Math.random() > 0.6,
        follow_up_date: Math.random() > 0.5 ? randomFutureDate(14) : null,
        created_at: randomDate(30)
      };
    });

    const { error: logsError } = await supabase
      .from('communication_logs')
      .insert(logsToInsert);

    if (logsError) throw logsError;
    console.log(`✓ Inserted ${logsToInsert.length} communication logs`);

    // 3. Insert phone numbers
    const phoneNumbers = [
      {
        phone_number: '+1-917-555-2301',
        business_name: 'GasMask Demo',
        label: 'GasMask Support',
        type: 'both',
        business_id: businessId,
        is_active: true
      },
      {
        phone_number: '+1-646-555-8821',
        business_name: 'GasMask Demo',
        label: 'Wholesale Line',
        type: 'both',
        business_id: businessId,
        is_active: true
      },
      {
        phone_number: '+1-212-555-9305',
        business_name: 'GasMask Demo',
        label: 'VIP Line',
        type: 'both',
        business_id: businessId,
        is_active: true
      }
    ];

    const { data: insertedNumbers, error: numbersError } = await supabase
      .from('call_center_phone_numbers')
      .insert(phoneNumbers)
      .select();

    if (numbersError) throw numbersError;
    console.log(`✓ Inserted ${insertedNumbers.length} phone numbers`);

    // 4. Insert AI agents
    const aiAgents = [
      {
        business_name: 'GasMask Demo',
        name: 'GasMask Support AI',
        personality: 'Helpful, friendly, and professional customer service representative',
        greeting_message: 'Hello! Thanks for calling GasMask. How can I help you today?',
        is_active: true,
        allowed_actions: ['transfer_call', 'schedule_callback', 'send_sms', 'create_ticket'],
        escalation_rules: { conditions: ['angry_customer', 'complex_issue'], action: 'transfer_to_human' },
        knowledge_base: { 
          business_hours: 'Mon-Fri 9AM-6PM EST',
          shipping_info: 'Standard 3-5 business days',
          return_policy: '30 days with receipt'
        }
      },
      {
        business_name: 'GasMask Demo',
        name: 'Wholesale AI Closer',
        personality: 'Professional, persuasive, and knowledgeable about bulk pricing',
        greeting_message: 'Welcome to GasMask Wholesale! I can help you with bulk orders and special pricing.',
        is_active: true,
        allowed_actions: ['send_quote', 'schedule_callback', 'send_email'],
        escalation_rules: { conditions: ['large_order', 'custom_pricing'], action: 'transfer_to_sales' },
        knowledge_base: {
          min_wholesale_qty: 50,
          discount_tiers: { '50-99': '10%', '100-499': '15%', '500+': '20%' }
        }
      },
      {
        business_name: 'GasMask Demo',
        name: 'VIP Concierge AI',
        personality: 'Exclusive, attentive, and focused on premium service',
        greeting_message: 'Welcome back, VIP! How can I provide exceptional service today?',
        is_active: true,
        allowed_actions: ['priority_order', 'schedule_callback', 'send_sms', 'offer_exclusive'],
        escalation_rules: { conditions: ['vip_request'], action: 'immediate_human_transfer' },
        knowledge_base: {
          vip_perks: ['priority_shipping', 'exclusive_products', 'personal_account_manager'],
          contact_method: 'direct_line'
        }
      }
    ];

    const { data: insertedAgents, error: agentsError } = await supabase
      .from('call_center_ai_agents')
      .insert(aiAgents)
      .select();

    if (agentsError) throw agentsError;
    console.log(`✓ Inserted ${insertedAgents.length} AI agents`);

    // 5. Insert call center logs
    const callLogs = callSummaries.map((summary, idx) => {
      const emotions = ['neutral', 'upset', 'excited', 'confused', 'satisfied'];
      const directions = ['inbound', 'outbound'];
      const outcomes = ['completed', 'voicemail', 'no_answer', 'transferred'];
      const tagOptions = ['complaint', 'order_inquiry', 'good_lead', 'support', 'follow_up'];
      
      return {
        business_name: 'GasMask Demo',
        caller_id: `+1-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`,
        direction: directions[Math.floor(Math.random() * directions.length)],
        duration: Math.floor(Math.random() * 290) + 30,
        summary,
        transcript: `Demo transcript: ${summary}. Call handled professionally and resolved satisfactorily.`,
        emotion_detected: emotions[Math.floor(Math.random() * emotions.length)],
        sentiment_score: Math.floor(Math.random() * 75) + 20,
        outcome: outcomes[Math.floor(Math.random() * outcomes.length)],
        tags: [tagOptions[Math.floor(Math.random() * tagOptions.length)]],
        phone_number_id: insertedNumbers[idx % insertedNumbers.length].id,
        ai_agent_id: insertedAgents[idx % insertedAgents.length].id,
        created_at: randomDate(30)
      };
    });

    const { error: callLogsError } = await supabase
      .from('call_center_logs')
      .insert(callLogs);

    if (callLogsError) throw callLogsError;
    console.log(`✓ Inserted ${callLogs.length} call logs`);

    // 6. Insert snapshot
    const snapshot = {
      business_id: businessId,
      snapshot_type: 'manual',
      snapshot_data: {
        contacts: insertedContacts,
        demo_info: 'Demo data snapshot created by seed utility',
        timestamp: new Date().toISOString()
      },
      record_counts: {
        contacts: insertedContacts.length,
        communication_logs: logsToInsert.length,
        phone_numbers: phoneNumbers.length,
        ai_agents: aiAgents.length,
        call_logs: callLogs.length
      },
      created_at: new Date().toISOString()
    };

    const { error: snapshotError } = await supabase
      .from('crm_snapshots')
      .insert(snapshot);

    if (snapshotError) throw snapshotError;
    console.log('✓ Created snapshot');

    toast({
      title: 'Demo Data Loaded Successfully',
      description: `Created ${insertedContacts.length} contacts, ${logsToInsert.length} logs, ${phoneNumbers.length} phone numbers, ${aiAgents.length} AI agents, and ${callLogs.length} call logs.`,
    });

    return true;
  } catch (error: any) {
    console.error('Error seeding demo data:', error);
    toast({
      title: 'Error Loading Demo Data',
      description: error.message,
      variant: 'destructive',
    });
    return false;
  }
}
