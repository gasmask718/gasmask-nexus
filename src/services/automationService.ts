import { supabase } from '@/integrations/supabase/client';

/**
 * Event types supported by Dynasty Automations
 */
export type AutomationEventType =
  // Order Events
  | 'order_created'
  | 'order_paid'
  | 'order_delivered'
  // Contact Events
  | 'new_contact_created'
  | 'new_store_created'
  | 'new_brand_sub_account_created'
  // Delivery Events
  | 'biker_delivery_assigned'
  | 'biker_delivery_completed'
  // Ambassador / Driver / Biker Events
  | 'new_store_found'
  | 'new_purchase_initiated'
  | 'new_transaction_completed'
  // Customer / Lead Events
  | 'wholesale_signup'
  | 'funding_signup'
  | 'playboxxx_model_signup'
  | 'icllean_client_signup'
  | 'sports_betting_user_signup';

/**
 * Trigger an automation event
 * This will check for matching automation rules and execute them
 */
export const triggerAutomationEvent = async (
  eventType: AutomationEventType,
  entityId: string,
  entityType: string,
  brand?: string,
  businessId?: string,
  metadata?: Record<string, any>
) => {
  try {
    console.log(`🎯 Triggering automation: ${eventType} for ${entityType} ${entityId}`);

    // Call the database function to process the automation
    const { error } = await supabase.rpc('process_automation_event', {
      p_event_type: eventType,
      p_entity_id: entityId,
      p_entity_type: entityType,
      p_brand: brand,
      p_business_id: businessId,
      p_metadata: metadata || {},
    });

    if (error) {
      console.error('❌ Failed to trigger automation:', error);
      throw error;
    }

    console.log(`✅ Automation triggered successfully`);

    // Call the edge function to process pending automations
    await supabase.functions.invoke('process-automation');

  } catch (error) {
    console.error('❌ Automation trigger error:', error);
    // Don't throw - we don't want to break the main flow if automation fails
  }
};

/**
 * Default automation templates for each event type
 */
export const DEFAULT_AUTOMATION_TEMPLATES: Record<AutomationEventType, string> = {
  // Order Events
  order_created: 'Thank you for your order from {brand}! We\'ll notify you when it ships.',
  order_paid: 'Payment confirmed! Your {brand} order is being prepared.',
  order_delivered: 'Your {brand} order has been delivered! Enjoy your products.',
  
  // Contact Events
  new_contact_created: 'Welcome to {brand}! We\'re excited to have you.',
  new_store_created: 'Welcome {store_name}! Thank you for partnering with {brand}.',
  new_brand_sub_account_created: 'Your {brand} account is ready! Let\'s get started.',
  
  // Delivery Events
  biker_delivery_assigned: 'Your {brand} delivery is on the way! Estimated arrival soon.',
  biker_delivery_completed: 'Delivery complete! Thank you for choosing {brand}.',
  
  // Ambassador / Driver / Biker Events
  new_store_found: 'Great news! We found a new partner store in your area.',
  new_purchase_initiated: 'Purchase in progress. We\'ll confirm when complete.',
  new_transaction_completed: 'Transaction successful! Thank you.',
  
  // Customer / Lead Events
  wholesale_signup: 'Welcome to {brand} Wholesale! Your account is active.',
  funding_signup: 'Funding application received! We\'ll review and contact you soon.',
  playboxxx_model_signup: 'Welcome to Playboxxx! Your model account is being set up.',
  icllean_client_signup: 'Welcome to IC Llean! Your appointment is confirmed.',
  sports_betting_user_signup: 'Welcome to Sports Betting! Your account is ready.',
};

/**
 * Create a default automation rule for a brand
 */
export const createDefaultAutomationRule = async (
  eventType: AutomationEventType,
  brand: string,
  businessId: string,
  customMessage?: string
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('automation_rules')
      .insert({
        business_id: businessId,
        brand,
        event_type: eventType,
        action_type: 'send_sms',
        is_enabled: true,
        template_message: customMessage || DEFAULT_AUTOMATION_TEMPLATES[eventType],
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Created automation rule for ${eventType} on ${brand}`);
    return data;
  } catch (error) {
    console.error('❌ Failed to create automation rule:', error);
    throw error;
  }
};
