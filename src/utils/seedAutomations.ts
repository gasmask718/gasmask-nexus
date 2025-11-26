import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_AUTOMATION_TEMPLATES, AutomationEventType } from '@/services/automationService';

/**
 * Seed default automation rules for Dynasty brands
 */
export const seedDefaultAutomations = async (businessId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error('No user found');
    return;
  }

  // GasMask Automations
  const gasmaskAutomations: Array<{ event: AutomationEventType; message: string }> = [
    { event: 'order_created', message: 'Thanks for your GasMask order! We\'ll text you when it ships. 💨' },
    { event: 'order_delivered', message: 'Your GasMask order has been delivered! Enjoy. 😎' },
    { event: 'new_store_created', message: 'Welcome {store_name} to the GasMask family! Let\'s dominate together. 💪' },
    { event: 'biker_delivery_assigned', message: 'Your GasMask delivery is on the way! 🚴' },
  ];

  // Grabba Automations
  const grabbaAutomations: Array<{ event: AutomationEventType; message: string }> = [
    { event: 'order_created', message: 'Grabba order confirmed! You\'ll get a text when it ships. 🔥' },
    { event: 'order_delivered', message: 'Your Grabba order is here! Time to stock up. 📦' },
    { event: 'new_store_created', message: 'Welcome {store_name}! Thanks for partnering with Grabba. 🤝' },
  ];

  // Dynasty Automations
  const dynastyAutomations: Array<{ event: AutomationEventType; message: string }> = [
    { event: 'order_created', message: 'Dynasty order received! We\'ll notify you at each step. 👑' },
    { event: 'order_delivered', message: 'Your Dynasty order has arrived! Enjoy premium quality. ✨' },
    { event: 'new_store_created', message: 'Welcome {store_name} to Dynasty! Excellence awaits. 🌟' },
  ];

  // Playboxxx Automations
  const playboxxxAutomations: Array<{ event: AutomationEventType; message: string }> = [
    { event: 'playboxxx_model_signup', message: 'Welcome to Playboxxx! Your model profile is being set up. 💋' },
    { event: 'new_contact_created', message: 'Thanks for joining Playboxxx! Check your inbox for details. 🎭' },
  ];

  // IC Llean Automations
  const iclleanAutomations: Array<{ event: AutomationEventType; message: string }> = [
    { event: 'icllean_client_signup', message: 'Welcome to IC Llean! Your appointment is confirmed. 🧼' },
    { event: 'order_created', message: 'IC Llean service booked! We\'ll arrive on time. ✅' },
  ];

  // Wholesale Signups
  const wholesaleAutomations: Array<{ event: AutomationEventType; message: string }> = [
    { event: 'wholesale_signup', message: 'Welcome to {brand} Wholesale! Your account is active. Let\'s grow together. 📈' },
  ];

  // Funding Signups
  const fundingAutomations: Array<{ event: AutomationEventType; message: string }> = [
    { event: 'funding_signup', message: 'Funding application received! We\'ll review and reach out within 24 hours. 💰' },
  ];

  try {
    console.log('🌱 Seeding default automation rules...');

    // Seed GasMask automations
    for (const auto of gasmaskAutomations) {
      await supabase.from('automation_rules').insert({
        business_id: businessId,
        brand: 'GasMask',
        event_type: auto.event,
        action_type: 'send_sms',
        is_enabled: true,
        template_message: auto.message,
        created_by: user.id,
      });
    }

    // Seed Grabba automations
    for (const auto of grabbaAutomations) {
      await supabase.from('automation_rules').insert({
        business_id: businessId,
        brand: 'Grabba',
        event_type: auto.event,
        action_type: 'send_sms',
        is_enabled: true,
        template_message: auto.message,
        created_by: user.id,
      });
    }

    // Seed Dynasty automations
    for (const auto of dynastyAutomations) {
      await supabase.from('automation_rules').insert({
        business_id: businessId,
        brand: 'Dynasty',
        event_type: auto.event,
        action_type: 'send_sms',
        is_enabled: true,
        template_message: auto.message,
        created_by: user.id,
      });
    }

    // Seed Playboxxx automations
    for (const auto of playboxxxAutomations) {
      await supabase.from('automation_rules').insert({
        business_id: businessId,
        brand: 'Playboxxx',
        event_type: auto.event,
        action_type: 'send_sms',
        is_enabled: true,
        template_message: auto.message,
        created_by: user.id,
      });
    }

    // Seed IC Llean automations
    for (const auto of iclleanAutomations) {
      await supabase.from('automation_rules').insert({
        business_id: businessId,
        brand: 'IC Llean',
        event_type: auto.event,
        action_type: 'send_sms',
        is_enabled: true,
        template_message: auto.message,
        created_by: user.id,
      });
    }

    // Seed Wholesale automations (brand-agnostic)
    for (const auto of wholesaleAutomations) {
      await supabase.from('automation_rules').insert({
        business_id: businessId,
        brand: null, // Applies to all brands
        event_type: auto.event,
        action_type: 'send_sms',
        is_enabled: true,
        template_message: auto.message,
        created_by: user.id,
      });
    }

    // Seed Funding automations (brand-agnostic)
    for (const auto of fundingAutomations) {
      await supabase.from('automation_rules').insert({
        business_id: businessId,
        brand: null, // Applies to all brands
        event_type: auto.event,
        action_type: 'send_sms',
        is_enabled: true,
        template_message: auto.message,
        created_by: user.id,
      });
    }

    console.log('✅ Default automation rules seeded successfully');
  } catch (error) {
    console.error('❌ Failed to seed automation rules:', error);
  }
};
