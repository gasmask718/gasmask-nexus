/**
 * Dynasty Automations - Integration Examples
 * 
 * This file shows how to integrate automation triggers throughout the Dynasty OS.
 * Copy these patterns into your actual components to enable event-based automations.
 */

import { triggerAutomationEvent } from '@/services/automationService';

// ============================================
// EXAMPLE 1: Order Created
// ============================================
// Use this pattern when creating a new order
export const exampleOrderCreated = async (orderId: string, brand: string, businessId: string) => {
  // ... your order creation logic ...
  
  // Trigger automation
  await triggerAutomationEvent(
    'order_created',
    orderId,
    'order',
    brand,
    businessId
  );
};

// ============================================
// EXAMPLE 2: New Contact Created
// ============================================
// Use this pattern when adding a new CRM contact
export const exampleNewContact = async (contactId: string, brand: string, businessId: string) => {
  // ... your contact creation logic ...
  
  // Trigger automation
  await triggerAutomationEvent(
    'new_contact_created',
    contactId,
    'contact',
    brand,
    businessId
  );
};

// ============================================
// EXAMPLE 3: New Store Created
// ============================================
// Use this pattern when onboarding a new store
export const exampleNewStore = async (storeId: string, brand: string, businessId: string) => {
  // ... your store creation logic ...
  
  // Trigger automation
  await triggerAutomationEvent(
    'new_store_created',
    storeId,
    'store',
    brand,
    businessId
  );
};

// ============================================
// EXAMPLE 4: Delivery Assigned
// ============================================
// Use this pattern when assigning a delivery to a biker
export const exampleDeliveryAssigned = async (deliveryId: string, brand: string, businessId: string) => {
  // ... your delivery assignment logic ...
  
  // Trigger automation
  await triggerAutomationEvent(
    'biker_delivery_assigned',
    deliveryId,
    'delivery',
    brand,
    businessId
  );
};

// ============================================
// EXAMPLE 5: Lead Signup (Wholesale)
// ============================================
// Use this pattern when a wholesale client signs up
export const exampleWholesaleSignup = async (wholesalerId: string, brand: string, businessId: string) => {
  // ... your signup logic ...
  
  // Trigger automation
  await triggerAutomationEvent(
    'wholesale_signup',
    wholesalerId,
    'wholesaler',
    brand,
    businessId
  );
};

// ============================================
// EXAMPLE 6: Integration in React Component
// ============================================
/*
import { triggerAutomationEvent } from '@/services/automationService';
import { useBusiness } from '@/contexts/BusinessContext';

const MyComponent = () => {
  const { currentBusiness } = useBusiness();
  
  const handleCreateOrder = async (orderData) => {
    try {
      // Create the order
      const { data: order } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();
      
      // Trigger automation
      await triggerAutomationEvent(
        'order_created',
        order.id,
        'order',
        orderData.brand,
        currentBusiness?.id
      );
      
      toast.success('Order created!');
    } catch (error) {
      toast.error('Failed to create order');
    }
  };
  
  return <YourComponent />;
};
*/

// ============================================
// WHERE TO ADD AUTOMATION TRIGGERS
// ============================================
/*
ORDER EVENTS:
- src/pages/StoreOrder.tsx → When order is created/paid/delivered
- src/components/store/OrderForm.tsx → When order is confirmed

CONTACT EVENTS:
- src/pages/CRMContactNew.tsx → When new contact is added
- src/pages/CRMCustomerNew.tsx → When new customer is added
- src/components/crm/QuickAddContactForm.tsx → When quick-adding contacts

STORE EVENTS:
- src/pages/Stores.tsx → When new store is created
- src/components/store/StoreOnboardingForm.tsx → When store completes onboarding

DELIVERY EVENTS:
- src/pages/Routes.tsx → When biker is assigned
- src/components/delivery/DeliveryAssignmentForm.tsx → When delivery is assigned/completed

LEAD SIGNUP EVENTS:
- src/pages/Wholesale.tsx → When wholesale client signs up
- src/pages/RealEstateLeads.tsx → When funding lead signs up
- Brand-specific signup forms → When brand-specific leads sign up
*/
