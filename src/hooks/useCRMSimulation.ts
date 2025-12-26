/**
 * CRM Simulation Data Hook
 * Provides realistic demo data per business type when simulation mode is ON
 */
import { useMemo } from 'react';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { ExtendedEntityType } from '@/config/crmBlueprints';

// ============================================
// TOPTIER SIMULATION DATA
// ============================================
const TOPTIER_SIMULATION = {
  partners: [
    { id: 'p1', company_name: 'Luxury Wheels NYC', contact_name: 'Marcus Johnson', phone: '212-555-0101', email: 'marcus@luxurywheels.com', category: 'exotic_rental_car_promo', state: 'NY', city: 'New York', commission_rate: 15, status: 'active' },
    { id: 'p2', company_name: 'Elite Helicopters', contact_name: 'Sarah Chen', phone: '305-555-0102', email: 'sarah@elitehelicopters.com', category: 'helicopter_promo', state: 'FL', city: 'Miami', commission_rate: 12, status: 'active' },
    { id: 'p3', company_name: 'Dream Decor Studio', contact_name: 'Isabella Rodriguez', phone: '213-555-0103', email: 'isabella@dreamdecor.com', category: 'room_decor_promo', state: 'CA', city: 'Los Angeles', commission_rate: 18, status: 'active' },
    { id: 'p4', company_name: 'Yacht Life Charters', contact_name: 'Michael Williams', phone: '954-555-0104', email: 'michael@yachtlife.com', category: 'yachts', state: 'FL', city: 'Fort Lauderdale', commission_rate: 10, status: 'active' },
    { id: 'p5', company_name: 'Black Truck VIP', contact_name: 'David Thompson', phone: '404-555-0105', email: 'david@blacktruckvip.com', category: 'black_trucks_promo', state: 'GA', city: 'Atlanta', commission_rate: 20, status: 'pending' },
  ],
  customers: [
    { id: 'c1', name: 'Jennifer Martinez', phone: '917-555-1001', email: 'jennifer@email.com', interest_categories: ['exotic_rental_car_promo', 'room_decor_promo'], budget_range: '5000_10000', status: 'vip', event_date: '2024-03-15' },
    { id: 'c2', name: 'Robert Kim', phone: '646-555-1002', email: 'robert.kim@email.com', interest_categories: ['yachts', 'helicopter_promo'], budget_range: 'over_10000', status: 'active', event_date: '2024-04-20' },
    { id: 'c3', name: 'Amanda Foster', phone: '347-555-1003', email: 'amanda.f@email.com', interest_categories: ['club_lounge_package'], budget_range: '2500_5000', status: 'lead', event_date: '2024-02-28' },
    { id: 'c4', name: 'Christopher Lee', phone: '718-555-1004', email: 'chris.lee@email.com', interest_categories: ['sprinter_van_promo', 'security_promo'], budget_range: '1000_2500', status: 'active', event_date: '2024-03-08' },
  ],
  influencers: [
    { id: 'i1', name: 'Sophia Rivera', handle: '@sophialuxury', platform: 'instagram', audience_size: 850000, engagement_rate: 4.2, promo_code: 'SOPHIA20', commission_rate: 15 },
    { id: 'i2', name: 'Marcus Bennett', handle: '@marcuslives', platform: 'tiktok', audience_size: 1200000, engagement_rate: 6.8, promo_code: 'MARCUS15', commission_rate: 12 },
    { id: 'i3', name: 'Aria Johnson', handle: '@ariaexperiences', platform: 'youtube', audience_size: 450000, engagement_rate: 3.5, promo_code: 'ARIA25', commission_rate: 18 },
  ],
  bookings: [
    { id: 'b1', customer_name: 'Jennifer Martinez', service: 'Exotic Car + Room Decor', event_date: '2024-03-15', status: 'confirmed', total: 8500 },
    { id: 'b2', customer_name: 'Robert Kim', service: 'Yacht Charter + Helicopter', event_date: '2024-04-20', status: 'deposit_paid', total: 25000 },
    { id: 'b3', customer_name: 'Amanda Foster', service: 'Club Package', event_date: '2024-02-28', status: 'quote_sent', total: 3500 },
  ],
};

// ============================================
// FUNDING SIMULATION DATA
// ============================================
const FUNDING_SIMULATION = {
  clients: [
    { id: 'cl1', legal_name: 'John Smith', business_name: 'Smith Construction LLC', phone: '555-0201', email: 'john@smithconstruction.com', funding_goal: 150000, status: 'docs_pending', next_follow_up_date: '2024-02-20', assigned_case_manager: 'Maria Garcia' },
    { id: 'cl2', legal_name: 'Sarah Johnson', business_name: 'JJ Logistics Inc', phone: '555-0202', email: 'sarah@jjlogistics.com', funding_goal: 250000, status: 'submitted', next_follow_up_date: '2024-02-18', assigned_case_manager: 'Carlos Rodriguez' },
    { id: 'cl3', legal_name: 'Michael Brown', business_name: 'Brown Auto Sales', phone: '555-0203', email: 'mike@brownauto.com', funding_goal: 75000, status: 'approved', next_follow_up_date: '2024-02-22', assigned_case_manager: 'Maria Garcia' },
    { id: 'cl4', legal_name: 'Lisa Davis', business_name: 'Davis Restaurant Group', phone: '555-0204', email: 'lisa@davisrestaurants.com', funding_goal: 500000, status: 'intake', next_follow_up_date: '2024-02-19', assigned_case_manager: 'James Wilson' },
    { id: 'cl5', legal_name: 'Robert Wilson', business_name: 'Wilson Medical Supplies', phone: '555-0205', email: 'rwilson@medsupply.com', funding_goal: 180000, status: 'funded', next_follow_up_date: null, assigned_case_manager: 'Carlos Rodriguez' },
  ],
  applications: [
    { id: 'app1', client_name: 'Smith Construction LLC', amount_requested: 150000, status: 'document_collection', lender: 'First National', created_at: '2024-02-10' },
    { id: 'app2', client_name: 'JJ Logistics Inc', amount_requested: 250000, status: 'submission', lender: 'Capital Finance', created_at: '2024-02-05' },
    { id: 'app3', client_name: 'Brown Auto Sales', amount_requested: 75000, status: 'offers_received', lender: 'Quick Fund', offer_amount: 68000, created_at: '2024-01-28' },
    { id: 'app4', client_name: 'Wilson Medical Supplies', amount_requested: 180000, status: 'funded', lender: 'Healthcare Capital', offer_amount: 175000, created_at: '2024-01-15' },
  ],
  tasks: [
    { id: 't1', client_name: 'Smith Construction LLC', label: 'Request bank statements', status: 'pending', due_date: '2024-02-20' },
    { id: 't2', client_name: 'Smith Construction LLC', label: 'Verify business registration', status: 'completed', due_date: '2024-02-15' },
    { id: 't3', client_name: 'JJ Logistics Inc', label: 'Follow up with lender', status: 'pending', due_date: '2024-02-18' },
    { id: 't4', client_name: 'Davis Restaurant Group', label: 'Request ID', status: 'pending', due_date: '2024-02-19' },
  ],
};

// ============================================
// UNFORGETTABLE TIMES SIMULATION DATA
// ============================================
const UNFORGETTABLE_SIMULATION = {
  vendors: [
    { id: 'v1', name: 'Grand Ballroom NYC', category: 'event_hall', contact_name: 'Patricia Moore', phone: '212-555-3001', city: 'New York', state: 'NY', availability: 'Weekends', rating: 4.8 },
    { id: 'v2', name: 'Elite Party Rentals', category: 'rental_company', contact_name: 'Kevin Thomas', phone: '718-555-3002', city: 'Brooklyn', state: 'NY', availability: 'Daily', rating: 4.5 },
    { id: 'v3', name: 'Celebration Supplies Co', category: 'party_items_supplier', contact_name: 'Diana Ross', phone: '347-555-3003', city: 'Queens', state: 'NY', availability: 'Daily', rating: 4.7 },
    { id: 'v4', name: 'Premium Staff Solutions', category: 'staff_vendor', contact_name: 'Anthony Garcia', phone: '646-555-3004', city: 'Manhattan', state: 'NY', availability: 'On demand', rating: 4.9 },
    { id: 'v5', name: 'Skyline Rooftop Venue', category: 'event_hall', contact_name: 'Rachel Green', phone: '212-555-3005', city: 'New York', state: 'NY', availability: 'Thu-Sun', rating: 4.6 },
  ],
  staff: [
    { id: 's1', name: 'Carlos Mendez', role: 'server', phone: '917-555-4001', availability: 'Weekends', rate: 25 },
    { id: 's2', name: 'Emily Watson', role: 'bartender', phone: '347-555-4002', availability: 'Fri-Sun', rate: 35 },
    { id: 's3', name: 'DJ Mike', role: 'dj', phone: '646-555-4003', availability: 'Weekends', rate: 150 },
    { id: 's4', name: 'James Photography', role: 'photographer', phone: '718-555-4004', availability: 'By booking', rate: 200 },
    { id: 's5', name: 'Security Team Alpha', role: 'security', phone: '212-555-4005', availability: 'On demand', rate: 50 },
  ],
  events: [
    { id: 'e1', client_name: 'Martinez Family', event_type: 'birthday', event_date: '2024-03-15', guest_count: 150, location: 'Grand Ballroom NYC', status: 'vendor_assigned', budget: 15000 },
    { id: 'e2', client_name: 'Johnson Wedding', event_type: 'wedding', event_date: '2024-04-22', guest_count: 200, location: 'Skyline Rooftop Venue', status: 'deposit_paid', budget: 45000 },
    { id: 'e3', client_name: 'Tech Corp Annual', event_type: 'corporate', event_date: '2024-03-08', guest_count: 100, location: 'Grand Ballroom NYC', status: 'event_scheduled', budget: 25000 },
    { id: 'e4', client_name: 'Baby Chen Shower', event_type: 'baby_shower', event_date: '2024-02-28', guest_count: 50, location: 'Private Residence', status: 'quote_sent', budget: 5000 },
  ],
};

// ============================================
// PLAYBOXXX SIMULATION DATA
// ============================================
const PLAYBOXXX_SIMULATION = {
  models: [
    { id: 'm1', stage_name: 'Luna Star', country: 'United States', city: 'Miami', whatsapp_number: '+1-305-555-5001', languages: ['english', 'spanish'], status: 'active', verification_status: 'verified', content_categories: ['lifestyle', 'fashion'] },
    { id: 'm2', stage_name: 'Valentina Rose', country: 'Brazil', city: 'São Paulo', whatsapp_number: '+55-11-555-5002', languages: ['portuguese', 'english'], status: 'featured', verification_status: 'verified', content_categories: ['fitness', 'lifestyle'] },
    { id: 'm3', stage_name: 'Mia Noir', country: 'France', city: 'Paris', whatsapp_number: '+33-1-555-5003', languages: ['french', 'english'], status: 'active', verification_status: 'verified', content_categories: ['glamour', 'fashion'] },
    { id: 'm4', stage_name: 'Natasha Crystal', country: 'Russia', city: 'Moscow', whatsapp_number: '+7-495-555-5004', languages: ['russian', 'english'], status: 'onboarded', verification_status: 'pending', content_categories: ['lifestyle'] },
    { id: 'm5', stage_name: 'Sofia Angel', country: 'Colombia', city: 'Medellín', whatsapp_number: '+57-4-555-5005', languages: ['spanish', 'english'], status: 'new_lead', verification_status: 'pending', content_categories: [] },
  ],
  collabs: [
    { id: 'col1', model_name: 'Luna Star', type: 'content', start_date: '2024-02-01', status: 'active', revenue: 5000, payout: 3500 },
    { id: 'col2', model_name: 'Valentina Rose', type: 'exclusive', start_date: '2024-01-15', status: 'active', revenue: 15000, payout: 10500 },
    { id: 'col3', model_name: 'Mia Noir', type: 'promo', start_date: '2024-02-10', status: 'pending', revenue: 0, payout: 0 },
  ],
  interactions: [
    { id: 'int1', model_name: 'Luna Star', type: 'whatsapp', message: 'Sent new content package', timestamp: new Date(Date.now() - 3600000) },
    { id: 'int2', model_name: 'Valentina Rose', type: 'whatsapp', message: 'Discussed exclusive terms', timestamp: new Date(Date.now() - 7200000) },
    { id: 'int3', model_name: 'Sofia Angel', type: 'whatsapp', message: 'Initial contact - interested', timestamp: new Date(Date.now() - 86400000) },
  ],
  media: [
    { id: 'med1', model_id: 'm1', type: 'photo', url: '/placeholder.svg', tags: ['portfolio', 'professional'], consent_note: 'Full consent signed', uploaded_at: new Date(Date.now() - 86400000) },
    { id: 'med2', model_id: 'm2', type: 'video', url: '/placeholder.svg', tags: ['content', 'exclusive'], consent_note: 'Platform use approved', uploaded_at: new Date(Date.now() - 172800000) },
  ],
};

// ============================================
// MAIN HOOK
// ============================================
export interface CRMSimulationData {
  [key: string]: any[];
}

export function useCRMSimulation(businessSlug: string | null): {
  simulationData: CRMSimulationData;
  isSimulationMode: boolean;
  getEntityData: (entityType: ExtendedEntityType) => any[];
} {
  const { simulationMode } = useSimulationMode();

  const simulationData = useMemo(() => {
    if (!businessSlug) return {};

    switch (businessSlug) {
      case 'toptier-experience':
        return {
          partner: TOPTIER_SIMULATION.partners,
          customer: TOPTIER_SIMULATION.customers,
          influencer: TOPTIER_SIMULATION.influencers,
          booking: TOPTIER_SIMULATION.bookings,
        };
      case 'usa-funding':
        return {
          client: FUNDING_SIMULATION.clients,
          funding_application: FUNDING_SIMULATION.applications,
          task: FUNDING_SIMULATION.tasks,
        };
      case 'unforgettable-times':
        return {
          vendor: UNFORGETTABLE_SIMULATION.vendors,
          staff: UNFORGETTABLE_SIMULATION.staff,
          event_booking: UNFORGETTABLE_SIMULATION.events,
        };
      case 'the-playboxxx':
        return {
          model: PLAYBOXXX_SIMULATION.models,
          collab: PLAYBOXXX_SIMULATION.collabs,
          interaction: PLAYBOXXX_SIMULATION.interactions,
          media: PLAYBOXXX_SIMULATION.media,
        };
      default:
        return {};
    }
  }, [businessSlug]);

  const getEntityData = (entityType: ExtendedEntityType): any[] => {
    return simulationData[entityType] || [];
  };

  return {
    simulationData,
    isSimulationMode: simulationMode,
    getEntityData,
  };
}

// Helper to get simulation stats
export function useCRMSimulationStats(businessSlug: string | null) {
  const { simulationData, isSimulationMode } = useCRMSimulation(businessSlug);

  const stats = useMemo(() => {
    if (!isSimulationMode) return {};
    
    const result: Record<string, number> = {};
    Object.entries(simulationData).forEach(([key, data]) => {
      result[key] = Array.isArray(data) ? data.length : 0;
    });
    return result;
  }, [simulationData, isSimulationMode]);

  return stats;
}
