/**
 * CRM Simulation Data Hook
 * Provides realistic demo data per business type when simulation mode is ON
 */
import { useMemo } from 'react';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { ExtendedEntityType, TOPTIER_PARTNER_CATEGORIES } from '@/config/crmBlueprints';

// ============================================
// TOPTIER SIMULATION DATA (Extended Partner Categories)
// ============================================
const TOPTIER_SIMULATION = {
  partners: [
    // Exotic Car Rentals
    { id: 'p1', company_name: 'Luxury Wheels NYC', contact_name: 'Marcus Johnson', phone: '212-555-0101', email: 'marcus@luxurywheels.com', partner_category: 'exotic_rental_car_promo', state: 'NY', city: 'New York', service_area: ['NY', 'NJ', 'CT'], commission_rate: 15, contract_status: 'active', pricing_range: '$500 - $2,500/day', availability_rules: '48hr advance booking', created_at: '2024-01-15' },
    { id: 'p2', company_name: 'Miami Exotic Rentals', contact_name: 'Carlos Rodriguez', phone: '305-555-0201', email: 'carlos@miamiexotic.com', partner_category: 'exotic_rental_car_promo', state: 'FL', city: 'Miami', service_area: ['FL'], commission_rate: 12, contract_status: 'active', pricing_range: '$600 - $3,000/day', availability_rules: '24hr advance booking', created_at: '2024-01-20' },
    // Helicopters
    { id: 'p3', company_name: 'Elite Helicopters', contact_name: 'Sarah Chen', phone: '305-555-0102', email: 'sarah@elitehelicopters.com', partner_category: 'helicopter_promo', state: 'FL', city: 'Miami', service_area: ['FL', 'GA'], commission_rate: 12, contract_status: 'active', pricing_range: '$1,500 - $8,000/flight', availability_rules: 'Weather dependent, 72hr notice', created_at: '2024-02-01' },
    { id: 'p4', company_name: 'NYC Heli Tours', contact_name: 'David Park', phone: '212-555-0301', email: 'david@nychelitours.com', partner_category: 'helicopter_promo', state: 'NY', city: 'New York', service_area: ['NY', 'NJ'], commission_rate: 10, contract_status: 'active', pricing_range: '$2,000 - $10,000/flight', availability_rules: 'Daily 9AM-6PM', created_at: '2024-02-05' },
    // Yachts
    { id: 'p5', company_name: 'Yacht Life Charters', contact_name: 'Michael Williams', phone: '954-555-0104', email: 'michael@yachtlife.com', partner_category: 'yachts', state: 'FL', city: 'Fort Lauderdale', service_area: ['FL'], commission_rate: 10, contract_status: 'active', pricing_range: '$5,000 - $50,000/day', availability_rules: 'Min 4hr charter', created_at: '2024-01-10' },
    { id: 'p6', company_name: 'LA Yacht Experience', contact_name: 'Jennifer Lee', phone: '310-555-0401', email: 'jlee@layacht.com', partner_category: 'yachts', state: 'CA', city: 'Los Angeles', service_area: ['CA'], commission_rate: 8, contract_status: 'pending', pricing_range: '$4,000 - $35,000/day', availability_rules: 'Weekends preferred', created_at: '2024-02-15' },
    // Club / Lounge Package
    { id: 'p7', company_name: 'VIP Nightlife Miami', contact_name: 'Alex Rivera', phone: '305-555-0501', email: 'alex@vipmiami.com', partner_category: 'club_lounge_package', state: 'FL', city: 'Miami', service_area: ['FL'], commission_rate: 20, contract_status: 'active', pricing_range: '$2,500 - $15,000/package', availability_rules: 'Thu-Sat only', created_at: '2024-01-25' },
    { id: 'p8', company_name: 'NYC Nightclub Connect', contact_name: 'Tiffany Gold', phone: '212-555-0502', email: 'tiffany@nycnightclub.com', partner_category: 'club_lounge_package', state: 'NY', city: 'New York', service_area: ['NY'], commission_rate: 18, contract_status: 'active', pricing_range: '$3,000 - $20,000/package', availability_rules: 'Fri-Sat, 2 weeks notice', created_at: '2024-02-10' },
    // Black Trucks
    { id: 'p9', company_name: 'Black Truck VIP', contact_name: 'David Thompson', phone: '404-555-0105', email: 'david@blacktruckvip.com', partner_category: 'black_trucks_promo', state: 'GA', city: 'Atlanta', service_area: ['GA', 'FL', 'NC'], commission_rate: 20, contract_status: 'pending', pricing_range: '$800 - $2,000/event', availability_rules: 'Available daily', created_at: '2024-02-20' },
    // Room Decor
    { id: 'p10', company_name: 'Dream Decor Studio', contact_name: 'Isabella Rodriguez', phone: '213-555-0103', email: 'isabella@dreamdecor.com', partner_category: 'room_decor_promo', state: 'CA', city: 'Los Angeles', service_area: ['CA', 'NV', 'AZ'], commission_rate: 18, contract_status: 'active', pricing_range: '$500 - $5,000/setup', availability_rules: 'Book 1 week ahead', created_at: '2024-01-18' },
    { id: 'p11', company_name: 'Elegant Events NYC', contact_name: 'Maria Santos', phone: '646-555-0601', email: 'maria@elegantnyc.com', partner_category: 'room_decor_promo', state: 'NY', city: 'New York', service_area: ['NY', 'NJ', 'CT'], commission_rate: 15, contract_status: 'active', pricing_range: '$800 - $8,000/setup', availability_rules: 'Min 5 days notice', created_at: '2024-01-22' },
    // Private Chef
    { id: 'p12', company_name: 'Chef Marcus Kitchen', contact_name: 'Marcus Pierre', phone: '305-555-0701', email: 'marcus@chefmarcus.com', partner_category: 'private_chef_promo', state: 'FL', city: 'Miami', service_area: ['FL'], commission_rate: 15, contract_status: 'active', pricing_range: '$150 - $500/person', availability_rules: '3 days advance booking', created_at: '2024-02-01' },
    // Security
    { id: 'p13', company_name: 'Elite Security Services', contact_name: 'James Bond', phone: '702-555-0801', email: 'james@elitesecurity.com', partner_category: 'security_promo', state: 'NV', city: 'Las Vegas', service_area: ['NV', 'CA', 'AZ'], commission_rate: 12, contract_status: 'active', pricing_range: '$75 - $150/hour per guard', availability_rules: '24/7 availability', created_at: '2024-01-30' },
    // Photography/Videography
    { id: 'p14', company_name: 'Lux Media Studios', contact_name: 'Ryan Cooper', phone: '323-555-0901', email: 'ryan@luxmedia.com', partner_category: 'photography_videography', state: 'CA', city: 'Los Angeles', service_area: ['CA'], commission_rate: 10, contract_status: 'active', pricing_range: '$2,000 - $15,000/event', availability_rules: 'Book 2 weeks ahead', created_at: '2024-02-08' },
    // Hotel Rooms
    { id: 'p15', company_name: 'Luxury Stays Concierge', contact_name: 'Victoria Adams', phone: '212-555-1001', email: 'victoria@luxurystays.com', partner_category: 'hotel_rooms', state: 'NY', city: 'New York', service_area: ['NY', 'NJ', 'FL', 'CA'], commission_rate: 8, contract_status: 'active', pricing_range: '$500 - $10,000/night', availability_rules: 'Subject to availability', created_at: '2024-01-12' },
    // Luxury Residences
    { id: 'p16', company_name: 'Miami Mansion Rentals', contact_name: 'Ricardo Vega', phone: '305-555-1101', email: 'ricardo@miamimansions.com', partner_category: 'luxury_residences', state: 'FL', city: 'Miami', service_area: ['FL'], commission_rate: 10, contract_status: 'active', pricing_range: '$5,000 - $100,000/night', availability_rules: 'Min 2 night stay', created_at: '2024-01-08' },
    // Event Spaces
    { id: 'p17', company_name: 'Rooftop Paradise LA', contact_name: 'Stephanie Kim', phone: '310-555-1201', email: 'steph@rooftopla.com', partner_category: 'eventspaces_rooftop', state: 'CA', city: 'Los Angeles', service_area: ['CA'], commission_rate: 12, contract_status: 'active', pricing_range: '$3,000 - $25,000/event', availability_rules: 'Thu-Sun, 3 weeks notice', created_at: '2024-02-12' },
    // Party Bus
    { id: 'p18', company_name: 'Ultimate Party Bus', contact_name: 'Tony Martinez', phone: '702-555-1301', email: 'tony@ultimatepartybus.com', partner_category: 'party_bus_promo', state: 'NV', city: 'Las Vegas', service_area: ['NV', 'CA'], commission_rate: 18, contract_status: 'active', pricing_range: '$1,000 - $3,000/night', availability_rules: 'Book 48hrs ahead', created_at: '2024-01-28' },
    // Amusement Parks (Affiliate)
    { id: 'p19', company_name: 'Theme Park VIP Access', contact_name: 'Amanda Foster', phone: '407-555-1401', email: 'amanda@themeparkvip.com', partner_category: 'amusementparks_affiliate', state: 'FL', city: 'Orlando', service_area: ['FL', 'CA'], commission_rate: 5, contract_status: 'active', pricing_range: 'Varies by park', availability_rules: 'Affiliate link only', booking_link: 'https://themeparkvip.com/ref=toptier', created_at: '2024-02-18' },
  ],
  customers: [
    { id: 'c1', name: 'Jennifer Martinez', phone: '917-555-1001', email: 'jennifer@email.com', interest_categories: ['exotic_rental_car_promo', 'room_decor_promo'], budget_range: '5000_10000', status: 'vip', event_date: '2024-03-15', preferred_state: 'NY', preferred_city: 'New York', lead_source: 'instagram', created_at: '2024-02-01' },
    { id: 'c2', name: 'Robert Kim', phone: '646-555-1002', email: 'robert.kim@email.com', interest_categories: ['yachts', 'helicopter_promo'], budget_range: 'over_10000', status: 'active', event_date: '2024-04-20', preferred_state: 'FL', preferred_city: 'Miami', lead_source: 'referral', created_at: '2024-02-05' },
    { id: 'c3', name: 'Amanda Foster', phone: '347-555-1003', email: 'amanda.f@email.com', interest_categories: ['club_lounge_package', 'black_trucks_promo'], budget_range: '2500_5000', status: 'lead', event_date: '2024-02-28', preferred_state: 'FL', preferred_city: 'Miami', lead_source: 'google', created_at: '2024-02-10' },
    { id: 'c4', name: 'Christopher Lee', phone: '718-555-1004', email: 'chris.lee@email.com', interest_categories: ['sprinter_van_promo', 'security_promo', 'photography_videography'], budget_range: '1000_2500', status: 'active', event_date: '2024-03-08', preferred_state: 'NV', preferred_city: 'Las Vegas', lead_source: 'influencer', created_at: '2024-02-12' },
    { id: 'c5', name: 'Sophia Williams', phone: '310-555-1005', email: 'sophia.w@email.com', interest_categories: ['luxury_residences', 'private_chef_promo', 'photography_videography'], budget_range: 'over_10000', status: 'vip', event_date: '2024-05-01', preferred_state: 'CA', preferred_city: 'Los Angeles', lead_source: 'website', created_at: '2024-02-15' },
  ],
  influencers: [
    { id: 'i1', name: 'Sophia Rivera', handle: '@sophialuxury', platform: 'instagram', audience_size: 850000, engagement_rate: 4.2, promo_code: 'SOPHIA20', commission_rate: 15, created_at: '2024-01-20' },
    { id: 'i2', name: 'Marcus Bennett', handle: '@marcuslives', platform: 'tiktok', audience_size: 1200000, engagement_rate: 6.8, promo_code: 'MARCUS15', commission_rate: 12, created_at: '2024-01-25' },
    { id: 'i3', name: 'Aria Johnson', handle: '@ariaexperiences', platform: 'youtube', audience_size: 450000, engagement_rate: 3.5, promo_code: 'ARIA25', commission_rate: 18, created_at: '2024-02-01' },
    { id: 'i4', name: 'Diego Fernandez', handle: '@diegoluxe', platform: 'instagram', audience_size: 620000, engagement_rate: 5.1, promo_code: 'DIEGO10', commission_rate: 10, created_at: '2024-02-10' },
  ],
  bookings: [
    { id: 'b1', customer_name: 'Jennifer Martinez', customer_id: 'c1', event_date: '2024-03-15', event_time: '7:00 PM', event_location: 'Manhattan, NY', partner_categories: ['exotic_rental_car_promo', 'room_decor_promo'], linked_partners: ['p1', 'p11'], total_amount: 8500, deposit_amount: 2500, deposit_paid: true, balance_due: 6000, status: 'confirmed', notes: 'Birthday celebration', created_at: '2024-02-01' },
    { id: 'b2', customer_name: 'Robert Kim', customer_id: 'c2', event_date: '2024-04-20', event_time: '10:00 AM', event_location: 'Miami Beach, FL', partner_categories: ['yachts', 'helicopter_promo', 'private_chef_promo'], linked_partners: ['p5', 'p3', 'p12'], total_amount: 35000, deposit_amount: 10000, deposit_paid: true, balance_due: 25000, status: 'deposit_paid', notes: 'Anniversary celebration - full day experience', created_at: '2024-02-05' },
    { id: 'b3', customer_name: 'Amanda Foster', customer_id: 'c3', event_date: '2024-02-28', event_time: '9:00 PM', event_location: 'South Beach, FL', partner_categories: ['club_lounge_package', 'black_trucks_promo'], linked_partners: ['p7'], total_amount: 4500, deposit_amount: 1500, deposit_paid: false, balance_due: 4500, status: 'quote_sent', notes: 'Girls night out package', created_at: '2024-02-10' },
    { id: 'b4', customer_name: 'Sophia Williams', customer_id: 'c5', event_date: '2024-05-01', event_time: '5:00 PM', event_location: 'Hollywood Hills, CA', partner_categories: ['luxury_residences', 'private_chef_promo', 'photography_videography', 'security_promo'], linked_partners: ['p16', 'p12', 'p14', 'p13'], total_amount: 75000, deposit_amount: 25000, deposit_paid: true, balance_due: 50000, status: 'confirmed', notes: 'Milestone birthday - weekend mansion rental with full service', created_at: '2024-02-15' },
  ],
  promo_campaigns: [
    { id: 'pc1', name: 'Spring Yacht Special', description: 'Special pricing on yacht charters for spring season', promo_category: 'yachts', linked_partners: ['p5', 'p6'], linked_influencers: ['i1', 'i2'], commission_rules: '12% for first booking, 8% for repeat', tracking_link: 'https://toptier.com/spring-yacht', start_date: '2024-03-01', end_date: '2024-05-31', status: 'active', created_at: '2024-02-20' },
    { id: 'pc2', name: 'Miami Nightlife Package', description: 'VIP club access with Black Truck arrival', promo_category: 'club_lounge_package', linked_partners: ['p7', 'p9'], linked_influencers: ['i2', 'i4'], commission_rules: '15% flat rate', tracking_link: 'https://toptier.com/miami-vip', start_date: '2024-02-01', end_date: '2024-04-30', status: 'active', created_at: '2024-01-28' },
    { id: 'pc3', name: 'Ultimate Experience Package', description: 'Helicopter + Yacht + Mansion combo', promo_category: 'helicopter_promo', linked_partners: ['p3', 'p5', 'p16'], linked_influencers: ['i1', 'i3'], commission_rules: '10% on total package', tracking_link: 'https://toptier.com/ultimate', start_date: '2024-04-01', end_date: '2024-06-30', status: 'draft', created_at: '2024-02-22' },
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
          promo_campaign: TOPTIER_SIMULATION.promo_campaigns,
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
